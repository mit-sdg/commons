import { afterAll, expect, test } from "vite-plus/test";
import { assembleCommons } from "../../src/assembly/application.ts";
import { inspectAssembly } from "@mit-sdg/sync-engine/tooling";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

async function fixture() {
  const instances = mongoImplementations(await testDb());
  const { user } = await instances.Authenticating.register({
    username: "moderator",
    email: "moderator@example.edu",
    password: "test-password",
  });
  const { session } = await instances.Sessioning.start({ user });
  await instances.Rostering.enrol({
    user,
    email: "moderator@example.edu",
    kind: "STUDENT",
    section: null,
  });
  const { role } = await instances.Roling.defineRole({
    name: "Moderator",
    capabilities: ["moderate"],
  });
  await instances.Roling.assign({ user, role, context: "commons" });
  const app = assembleCommons(instances);
  const rootResult = await app.invoker.invoke("/threads/create", {
    session,
    content: "Opening",
    holders: [`account:${user}`],
  });
  if (!rootResult.ok) throw new Error("Could not create fixture");
  const root = rootResult.value as { post: string; node: string; conversation: string };
  const replyResult = await app.invoker.invoke("/threads/reply", {
    session,
    parent: root.node,
    content: "Reply",
  });
  if (!replyResult.ok) throw new Error("Could not create reply fixture");
  const reply = replyResult.value as { post: string; node: string };
  return { instances, app, user, session, root, reply };
}

for (const failure of ["all", "reply", "trash-record"] as const) {
  test(`a failed thread purge (${failure}) stays hidden and can be retried after reassembly`, async () => {
    const f = await fixture();
    const input = { session: f.session, item: f.root.conversation };
    expect(await f.app.invoker.invoke("/trash/trash", input)).toMatchObject({ ok: true });
    const realDelete = f.instances.Posting.delete.bind(f.instances.Posting);
    const realPurge = f.instances.Trashing.purge.bind(f.instances.Trashing);
    f.instances.Posting.delete = async function deletePost({ post }) {
      if (failure === "all" || (failure === "reply" && post === f.reply.post))
        throw new Error("storage unavailable");
      return realDelete({ post });
    };
    Object.defineProperty(f.instances.Posting.delete, "name", { value: "delete" });
    f.instances.Trashing.purge = async function purge({ item }) {
      if (failure === "trash-record" && item === f.reply.post)
        throw new Error("trash storage unavailable");
      return realPurge({ item });
    };
    const failing = assembleCommons(f.instances);
    expect(await failing.invoker.invoke("/trash/purge", input)).toMatchObject({ ok: false });
    await failing.whenIdle();
    expect(await f.instances.Conversing._exists({ conversation: input.item })).toEqual({
      exists: true,
    });
    expect(await f.instances.Trashing._isTrashed({ item: input.item })).toEqual({ trashed: true });
    expect(
      await failing.invoker.invoke("/threads/get", {
        session: f.session,
        conversation: input.item,
      }),
    ).toMatchObject({ ok: false });
    expect(await failing.invoker.invoke("/trash/list", { session: f.session })).toMatchObject({
      ok: true,
      value: {
        trashed: expect.arrayContaining([
          expect.objectContaining({ item: input.item, thread: true }),
        ]),
      },
    });

    f.instances.Posting.delete = realDelete;
    Object.defineProperty(f.instances.Posting.delete, "name", { value: "delete" });
    f.instances.Trashing.purge = realPurge;
    Object.defineProperty(f.instances.Trashing.purge, "name", { value: "purge" });
    const retry = assembleCommons(f.instances);
    expect(await retry.invoker.invoke("/trash/purge", input)).toMatchObject({ ok: true });
    await retry.whenIdle();
    expect(await f.instances.Conversing._exists({ conversation: input.item })).toEqual({
      exists: false,
    });
    for (const post of [f.root.post, f.reply.post]) {
      expect(await f.instances.Posting._getPost({ post })).toEqual([]);
      expect(await f.instances.Trashing._isTrashed({ item: post })).toEqual({ trashed: false });
    }
    expect(await retry.invoker.invoke("/trash/list", { session: f.session })).toMatchObject({
      ok: true,
      value: { trashed: [] },
    });
  });
}

test("a reply purge with deleted content remains in the bin and can finish after reassembly", async () => {
  const f = await fixture();
  const input = { session: f.session, item: f.reply.post };
  await f.app.invoker.invoke("/trash/trash", input);
  const realPurge = f.instances.Trashing.purge.bind(f.instances.Trashing);
  f.instances.Trashing.purge = async function purge() {
    throw new Error("trash storage unavailable");
  };
  const failing = assembleCommons(f.instances);
  expect(await failing.invoker.invoke("/trash/purge", input)).toMatchObject({ ok: false });
  await failing.whenIdle();
  expect(await f.instances.Posting._getPost({ post: f.reply.post })).toEqual([]);
  expect(await failing.invoker.invoke("/trash/list", { session: f.session })).toMatchObject({
    ok: true,
    value: { trashed: [expect.objectContaining({ item: f.reply.post, thread: false })] },
  });
  // Missing content cannot be restored merely because its trash record survives.
  expect(await failing.invoker.invoke("/trash/restore", input)).toMatchObject({ ok: false });
  const { user: outsider } = await f.instances.Authenticating.register({
    username: "outsider",
    email: "outsider@example.edu",
    password: "test-password",
  });
  const { session } = await f.instances.Sessioning.start({ user: outsider });
  const { role } = await f.instances.Roling.defineRole({
    name: "Other moderator",
    capabilities: ["moderate"],
  });
  await f.instances.Roling.assign({ user: outsider, role, context: "commons" });
  expect(await failing.invoker.invoke("/trash/list", { session })).toMatchObject({
    ok: true,
    value: { trashed: [] },
  });
  expect(await failing.invoker.invoke("/trash/purge", { ...input, session })).toEqual(
    await failing.invoker.invoke("/trash/purge", { session, item: "unknown" }),
  );

  f.instances.Trashing.purge = realPurge;
  Object.defineProperty(f.instances.Trashing.purge, "name", { value: "purge" });
  const retry = assembleCommons(f.instances);
  expect(await retry.invoker.invoke("/trash/purge", input)).toMatchObject({ ok: true });
  await retry.whenIdle();
  expect(await f.instances.Trashing._isTrashed({ item: f.reply.post })).toEqual({ trashed: false });
  expect(await f.instances.Revising._getRevisions({ item: f.reply.post })).toEqual([]);
  expect(await f.instances.Posting._getPost({ post: f.root.post })).toHaveLength(1);
});

test("moderators can review all retained thread content without widening ordinary reads or audiences", async () => {
  const f = await fixture();
  const input = { session: f.session, conversation: f.root.conversation };
  expect(await f.app.invoker.invoke("/moderation/threads/get", input)).toMatchObject({ ok: false });
  await f.app.invoker.invoke("/trash/trash", { session: f.session, item: f.reply.post });
  await f.app.invoker.invoke("/trash/trash", { session: f.session, item: f.root.conversation });
  expect(await f.app.invoker.invoke("/threads/get", input)).toMatchObject({ ok: false });
  expect(await f.app.invoker.invoke("/moderation/threads/get", input)).toMatchObject({
    ok: true,
    value: {
      thread: [
        expect.objectContaining({
          item: f.root.post,
          trashed: false,
          post: expect.objectContaining({ content: "Opening" }),
        }),
        expect.objectContaining({
          item: f.reply.post,
          parent: f.root.node,
          trashed: true,
          post: expect.objectContaining({ content: "Reply" }),
        }),
      ],
    },
  });
  for (const moderate of [false, true]) {
    const { user } = await f.instances.Authenticating.register({
      username: `outsider-${moderate}`,
      email: `outsider-${moderate}@example.edu`,
      password: "test-password",
    });
    const { session } = await f.instances.Sessioning.start({ user });
    if (moderate) {
      const { role } = await f.instances.Roling.defineRole({
        name: "Other moderator",
        capabilities: ["moderate"],
      });
      await f.instances.Roling.assign({ user, role, context: "commons" });
    }
    expect(await f.app.invoker.invoke("/moderation/threads/get", { ...input, session })).toEqual(
      await f.app.invoker.invoke("/moderation/threads/get", { session, conversation: "unknown" }),
    );
  }
  for (const path of [
    "/moderation/revisions/list",
    "/moderation/revisions/get",
    "/moderation/revisions/latest",
  ]) {
    const before = inspectAssembly(f.app).occurrences.length;
    expect(
      await f.app.invoker.invoke(path, { session: f.session, item: f.root.post, number: 1 }),
    ).toMatchObject({ ok: true });
    expect(
      inspectAssembly(f.app)
        .occurrences.slice(before)
        .filter((entry) => entry.concept === "RequestBoundary" && entry.action === "respond"),
    ).toHaveLength(1);
  }
  await f.app.invoker.invoke("/trash/purge", { session: f.session, item: f.reply.post });
  expect(await f.app.invoker.invoke("/moderation/threads/get", input)).toMatchObject({
    ok: true,
    value: {
      thread: expect.arrayContaining([
        expect.objectContaining({
          item: f.reply.post,
          post: expect.objectContaining({ content: null, rendered: null }),
        }),
      ]),
    },
  });
});

test("permanently deleting a leaf reply preserves its removed slot", async () => {
  const f = await fixture();
  const input = { session: f.session, item: f.reply.post };
  await f.app.invoker.invoke("/trash/trash", input);
  expect(await f.app.invoker.invoke("/trash/purge", input)).toMatchObject({ ok: true });
  expect(await f.instances.Posting._getPost({ post: f.reply.post })).toEqual([]);
  expect(await f.instances.Conversing._getNodeByItem({ item: f.reply.post })).toEqual([
    { node: f.reply.node },
  ]);
  expect(
    await f.app.invoker.invoke("/threads/get", {
      session: f.session,
      conversation: f.root.conversation,
    }),
  ).toMatchObject({
    ok: true,
    value: {
      context: [
        expect.objectContaining({
          structure: expect.arrayContaining([expect.objectContaining({ item: f.reply.post })]),
        }),
      ],
    },
  });
});
