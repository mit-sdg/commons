import { afterAll, expect, test } from "vite-plus/test";
import { assembleCommons } from "../../src/assembly/application.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);
async function fixture() {
  const instances = mongoImplementations(await testDb());
  const people = [];
  for (const username of ["author", "reader", "outsider"]) {
    const { user } = await instances.Authenticating.register({
      username,
      password: "long-password",
      email: `${username}@example.edu`,
    });
    const { session } = await instances.Sessioning.start({ user });
    await instances.Rostering.enrol({
      user,
      email: `${username}@example.edu`,
      kind: "STUDENT",
      section: null,
    });
    people.push({ user, session });
  }
  return { instances, people };
}
test("ordinary create and reply establish a fixed private audience", async () => {
  const {
    instances,
    people: [author, reader, outsider],
  } = await fixture();
  const app = assembleCommons(instances);
  const created = await app.invoker.invoke("/threads/create", {
    session: author.session,
    content: "Private opening",
    holders: [`account:${author.user}`, `account:${reader.user}`],
  });
  expect(created).toMatchObject({ ok: true });
  if (!created.ok) return;
  const { post, conversation, node } = created.value as {
    post: string;
    conversation: string;
    node: string;
  };
  expect(
    await app.invoker.invoke("/threads/get", { session: reader.session, conversation }),
  ).toMatchObject({ ok: true });
  expect(
    await app.invoker.invoke("/threads/get", { session: outsider.session, conversation }),
  ).toEqual(
    await app.invoker.invoke("/threads/get", { session: outsider.session, conversation: "absent" }),
  );
  expect(
    await app.invoker.invoke("/threads/reply", {
      session: outsider.session,
      parent: node,
      content: "Intrusion",
    }),
  ).toMatchObject({ ok: false });
  expect(
    await app.invoker.invoke("/threads/reply", {
      session: reader.session,
      parent: node,
      content: "Private answer",
    }),
  ).toMatchObject({ ok: true });
  expect(await app.invoker.invoke("/posts/get", { session: outsider.session, post })).toMatchObject(
    { ok: false },
  );
  expect(await app.invoker.invoke("/threads/latest", { session: outsider.session })).toMatchObject({
    ok: true,
    value: { conversations: [] },
  });
});
test("a failed establishment leaves placed content closed to every reader", async () => {
  const {
    instances,
    people: [author, reader],
  } = await fixture();
  instances.Accessing.establish = async function establish() {
    throw new Error("unavailable storage");
  };
  const app = assembleCommons(instances);
  expect(
    await app.invoker.invoke("/threads/create", {
      session: author.session,
      content: "Unpublished private opening",
      holders: [`account:${author.user}`, `account:${reader.user}`],
    }),
  ).toMatchObject({ ok: false });
  const [conversation] = await instances.Conversing._getConversations({});
  expect(conversation).toBeDefined();
  for (const person of [author, reader]) {
    expect(
      await app.invoker.invoke("/threads/get", {
        session: person.session,
        conversation: conversation.conversation,
      }),
    ).toMatchObject({ ok: false });
    expect(
      await app.invoker.invoke("/posts/get", { session: person.session, post: conversation.item }),
    ).toMatchObject({ ok: false });
    expect(
      await app.invoker.invoke("/threads/activity", { session: person.session }),
    ).toMatchObject({ ok: true, value: { conversations: [] } });
  }
  expect(await instances.Mailing._getPending({})).toEqual([]);
});

test("queued group mail includes its author and full content but is withheld after departure", async () => {
  const {
    instances,
    people: [author, reader],
  } = await fixture();
  const at = new Date();
  const { group } = await instances.Grouping.create({ creator: author.user, title: "Study", at });
  await instances.Grouping.addMember({ group, member: author.user, candidate: reader.user, at });
  const app = assembleCommons(instances);
  const content = "# Homework question\n\nComplete homework question for @reader";
  expect(
    await app.invoker.invoke("/threads/create", {
      session: author.session,
      content,
      holders: [`group:${group}`],
    }),
  ).toMatchObject({ ok: true });
  const [queued] = await instances.Mailing._getPending({});
  expect(queued).toBeDefined();
  expect(queued.subject).toBe("You were mentioned in a discussion: Homework question");
  expect(queued.text).toContain("From: @author");
  expect(queued.text).toContain("Complete homework question for @reader");
  expect(queued.html).toContain("From: <strong>@author</strong>");
  expect(queued.html).toContain("<p>Complete homework question for @reader</p>");
  // The opening's first line is already the discussion title; mail must not say it twice.
  expect(queued.text).not.toContain("# Homework question");
  expect(queued.text.match(/Homework question/g)).toHaveLength(1);
  expect(queued.html).not.toContain("# Homework question");
  await app.concepts.Grouping.leave({ group, member: reader.user, at });
  const { deliverPendingMail } = await import("../../src/email/worker.ts");
  const { forumMailEligibility } = await import("../../src/email/forum-policy.ts");
  let sends = 0;
  const sender = {
    sendMail: async () => {
      sends += 1;
    },
  };
  const configuration = {
    host: "smtp.example.edu",
    port: 587,
    secure: false,
    from: "commons@example.edu",
  };
  expect(
    await deliverPendingMail(
      app.concepts.Mailing,
      configuration,
      sender,
      forumMailEligibility(app),
    ),
  ).toBe(0);
  expect(sends).toBe(0);
  expect(await instances.Mailing._getStatus({ message: queued.message })).toEqual([
    { sentAt: null },
  ]);
  await app.concepts.Grouping.addMember({ group, member: author.user, candidate: reader.user, at });
  expect(
    await deliverPendingMail(
      app.concepts.Mailing,
      configuration,
      sender,
      forumMailEligibility(app),
    ),
  ).toBe(2);
  expect(sends).toBe(2);
});

test("ordinary reports require audience membership even for a moderator", async () => {
  const {
    instances,
    people: [author, reader, outsider],
  } = await fixture();
  const { role } = await instances.Roling.defineRole({
    name: "Moderator",
    capabilities: ["moderate"],
  });
  for (const person of [reader, outsider])
    await instances.Roling.assign({ user: person.user, context: "commons", role });
  const app = assembleCommons(instances);
  const created = await app.invoker.invoke("/threads/create", {
    session: author.session,
    content: "Private report target",
    holders: [`account:${author.user}`, `account:${reader.user}`],
  });
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const { post } = created.value as { post: string };
  expect(
    await app.invoker.invoke("/flags/raise", {
      session: reader.session,
      target: post,
      reason: "Review this",
    }),
  ).toMatchObject({ ok: true });
  expect(
    await app.invoker.invoke("/flags/forTarget", { session: reader.session, target: post }),
  ).toMatchObject({
    ok: true,
    value: { flags: [expect.objectContaining({ reason: "Review this" })] },
  });
  for (const path of ["/flags/raise", "/flags/forTarget", "/flags/resolve"]) {
    const input = {
      session: outsider.session,
      target: post,
      ...(path.endsWith("raise")
        ? { reason: "Review this" }
        : path.endsWith("resolve")
          ? { outcome: "dismissed" }
          : {}),
    };
    expect(await app.invoker.invoke(path, input)).toEqual(
      await app.invoker.invoke(path, { ...input, target: "absent" }),
    );
  }
  expect(await app.invoker.invoke("/flags/open", { session: outsider.session })).toMatchObject({
    ok: true,
    value: { targets: [] },
  });
});

test("failed purge deletion keeps the post trashed and unreadable", async () => {
  const {
    instances,
    people: [author],
  } = await fixture();
  const { role } = await instances.Roling.defineRole({
    name: "Moderator",
    capabilities: ["moderate"],
  });
  await instances.Roling.assign({ user: author.user, context: "commons", role });
  const app = assembleCommons(instances);
  const created = await app.invoker.invoke("/threads/create", {
    session: author.session,
    content: "Must remain hidden",
    holders: [`account:${author.user}`],
  });
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const { post } = created.value as { post: string };
  await instances.Trashing.trash({ item: post, by: author.user, at: new Date() });
  instances.Posting.delete = async function deletePost() {
    throw new Error("storage unavailable");
  };
  Object.defineProperty(instances.Posting.delete, "name", { value: "delete" });
  const failing = assembleCommons(instances);
  expect(
    await failing.invoker.invoke("/trash/purge", { session: author.session, item: post }),
  ).toMatchObject({ ok: false });
  expect(await instances.Trashing._isTrashed({ item: post })).toEqual({ trashed: true });
  expect(
    await failing.invoker.invoke("/posts/get", { session: author.session, post }),
  ).toMatchObject({ ok: false });
});
