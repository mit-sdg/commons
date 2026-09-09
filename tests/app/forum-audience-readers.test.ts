import { afterAll, afterEach, expect, test } from "vite-plus/test";
import type { Db } from "mongodb";
import { mongoImplementations } from "../../src/concepts.ts";
import { createEdge } from "../../src/edge.ts";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";
const databases = new Set<Db>();
afterEach(async () => {
  await Promise.all([...databases].map((db) => db.dropDatabase()));
  databases.clear();
});
afterAll(stopTestDb);
async function fixture() {
  const db = await testDb();
  databases.add(db);
  const instances = mongoImplementations(db);
  const people = await Promise.all(
    ["author", "reader", "moderator"].map(async (username) => {
      const { user } = await instances.Authenticating.register({
        username,
        password: "test-password",
        email: `${username}@example.edu`,
      });
      const { session } = await instances.Sessioning.start({ user });
      return { user, session };
    }),
  );
  const [author, reader, moderator] = people;
  const { role } = await instances.Roling.defineRole({
    name: "Moderator",
    capabilities: ["moderate"],
  });
  await instances.Roling.assign({ user: moderator.user, context: "commons", role });
  async function thread(content: string, holders: string[]) {
    const at = new Date();
    const { post } = await instances.Posting.create({ author: author.user, content, at });
    const placement = await instances.Conversing.start({ item: post, at });
    await instances.Accessing.establish({ resource: placement.conversation, holders });
    await instances.Formatting.setSource({ target: post, source: content });
    await instances.Revising.record({ item: post, content, at });
    await instances.Tracking.register({ item: post, scope: placement.conversation });
    return { post, ...placement };
  }
  const privateThread = await thread("SECRET audience body", [`account:${reader.user}`]);
  const shared = await thread(
    "Shared body",
    people.map((p) => `account:${p.user}`),
  );
  const app = createEdge(instances).application;
  const invoke = (path: string, input: Record<string, unknown>) => app.invoker.invoke(path, input);
  return { db, instances, people, author, reader, moderator, privateThread, shared, invoke };
}
const missing = { ok: false, error: { kind: "domain", value: "NOT_FOUND" } };
test("tag names are shared while private tag applications follow the discussion audience", async () => {
  const f = await fixture();
  const { post } = f.privateThread;
  const name = "Shared vocabulary";
  const created = await f.invoke("/tags/create", { session: f.reader.session, name });
  expect(created).toMatchObject({ ok: true });
  if (!created.ok) throw new Error("Tag creation failed");
  const { tag } = created.value as { tag: string };

  const catalog = { ok: true, value: { tags: [{ tag, name }] } };
  expect(await f.invoke("/tags/list", { session: f.author.session })).toEqual(catalog);
  expect(
    await f.invoke("/tags/add", { session: f.author.session, target: post, tag }),
  ).toMatchObject(missing);
  expect(await f.invoke("/tags/list", { session: f.author.session })).toEqual(catalog);
  expect(
    await f.invoke("/tags/add", { session: f.reader.session, target: post, tag }),
  ).toMatchObject({ ok: true });

  for (const actor of [f.reader, f.author, f.moderator]) {
    const admitted = actor === f.reader;
    expect(await f.invoke("/tags/list", { session: actor.session })).toEqual(catalog);
    for (const [path, input] of [
      ["/tags/targets", { tag }],
      ["/tags/targetsByName", { name }],
    ] as const) {
      expect(await f.invoke(path, { session: actor.session, ...input })).toEqual({
        ok: true,
        value: { targets: admitted ? [{ target: post }] : [] },
      });
    }
    expect(
      await f.invoke("/tags/forTarget", { session: actor.session, target: post }),
    ).toMatchObject(admitted ? catalog : missing);
  }

  expect(
    await f.invoke("/tags/remove", { session: f.reader.session, target: post, tag }),
  ).toMatchObject({ ok: true });
  expect(await f.invoke("/tags/list", { session: f.author.session })).toEqual(catalog);
});

test("production target routes hide private posts from authors and moderators outside the audience", async () => {
  const f = await fixture();
  const { post, conversation } = f.privateThread;
  const routes: [string, Record<string, unknown>][] = [
    ["/posts/get", { post }],
    ["/threads/get", { conversation }],
    ["/revisions/list", { item: post }],
    ["/revisions/latest", { item: post }],
    ["/links/forward", { source: post }],
    ["/links/backlinks", { target: post }],
    ["/reactions/forTarget", { target: post }],
    ["/locks/isLocked", { target: conversation }],
    ["/unread/list", { scope: conversation }],
    ["/unread/count", { scope: conversation }],
    ["/reactions/add", { target: post, kind: "like" }],
    ["/locks/lock", { target: conversation }],
    ["/trash/trash", { item: post }],
    ["/unread/markSeen", { item: post }],
    ["/bookmarks/save", { item: post }],
    ["/bookmarks/unsave", { item: post }],
    ["/bookmarks/isSaved", { item: post }],
    ["/categories/forItem", { item: post }],
    ["/categories/assign", { item: post, category: "unknown" }],
    ["/categories/unassign", { item: post }],
    ["/tags/forTarget", { target: post }],
    ["/tags/add", { target: post, tag: "unknown" }],
    ["/tags/remove", { target: post, tag: "unknown" }],
    ["/pins/forScope", { scope: conversation }],
    ["/pins/isPinned", { scope: conversation, item: post }],
    ["/pins/pin", { scope: conversation, item: post, priority: 1 }],
    ["/resolutions/get", { question: post }],
    ["/resolutions/isResolved", { question: post }],
    ["/resolutions/clear", { question: post }],
    ["/subscriptions/subscribe", { target: conversation }],
    ["/subscriptions/unsubscribe", { target: conversation }],
    ["/subscriptions/isSubscribed", { target: conversation }],
    ["/subscriptions/subscribers", { target: conversation }],
  ];
  for (const actor of [f.author, f.moderator])
    for (const [path, input] of routes) {
      expect(
        await f.invoke(path, {
          ...input,
          session: actor.session,
          user: f.reader.user,
          reader: f.reader.user,
        }),
        path,
      ).toMatchObject(missing);
    }
  expect(await f.invoke("/posts/get", { session: f.reader.session, post })).toMatchObject({
    ok: true,
    value: { post: { content: "SECRET audience body" } },
  });
  expect(await f.invoke("/threads/get", { session: f.reader.session, conversation })).toMatchObject(
    { ok: true },
  );
  expect(await f.instances.Locking._isLocked({ target: conversation })).toEqual({ locked: false });
  expect(await f.instances.Trashing._isTrashed({ item: post })).toEqual({ trashed: false });
});

test("production feeds, nested links, notification counts and unread marks filter the same audience", async () => {
  const f = await fixture();
  const at = new Date();
  await f.instances.Linking.setLinksFrom({
    source: f.shared.post,
    content: `[[${f.privateThread.post}]]`,
  });
  await f.instances.Notifying.notify({
    recipient: f.author.user,
    subject: f.privateThread.post,
    link: f.privateThread.post,
    kind: "mention",
    at,
  });
  await f.instances.Notifying.notify({
    recipient: f.author.user,
    subject: f.shared.post,
    link: f.privateThread.post,
    kind: "mention",
    at,
  });
  const { notification } = await f.instances.Notifying.notify({
    recipient: f.author.user,
    subject: f.shared.post,
    link: f.shared.post,
    kind: "reply",
    at,
  });
  for (const path of [
    "/threads/latest",
    "/threads/activity",
    "/notifications/list",
    "/notifications/inbox",
  ]) {
    const result = await f.invoke(path, { session: f.author.session });
    expect(result, path).toMatchObject({ ok: true });
    expect(JSON.stringify(result), path).not.toContain(f.privateThread.post);
    expect(JSON.stringify(result), path).not.toContain("SECRET");
  }
  expect(
    await f.invoke("/links/forward", { session: f.author.session, source: f.shared.post }),
  ).toMatchObject({ ok: true, value: { targets: [] } });
  expect(await f.invoke("/notifications/unreadCount", { session: f.author.session })).toMatchObject(
    { ok: true, value: { count: 1 } },
  );
  expect(await f.invoke("/notifications/markAllRead", { session: f.author.session })).toMatchObject(
    { ok: true },
  );
  const inbox = await f.instances.Notifying._getInbox({ recipient: f.author.user });
  expect(inbox.filter((n) => n.read).map((n) => n.notification)).toEqual([notification]);
  expect(
    await f.invoke("/unread/count", {
      session: f.reader.session,
      scope: f.privateThread.conversation,
    }),
  ).toMatchObject({ ok: true, value: { count: 1 } });
  await f.instances.Trashing.trash({ item: f.privateThread.post, by: f.moderator.user, at });
  expect(
    await f.invoke("/unread/count", {
      session: f.reader.session,
      scope: f.privateThread.conversation,
    }),
  ).toMatchObject({ ok: true, value: { count: 0 } });
  expect(
    await f.invoke("/unread/markAllSeen", {
      session: f.reader.session,
      scope: f.privateThread.conversation,
    }),
  ).toMatchObject({ ok: true });
  expect(
    await f.instances.Tracking._getUnreadCount({
      user: f.reader.user,
      scope: f.privateThread.conversation,
    }),
  ).toEqual({ count: 1 });
});

test("unread counts equal the visible list with multiple rows and after marking", async () => {
  const f = await fixture();
  const at = new Date();
  for (const content of ["First reply", "Second reply"]) {
    const { post } = await f.instances.Posting.create({ author: f.reader.user, content, at });
    await f.instances.Conversing.reply({ item: post, parent: f.shared.node, at });
    await f.instances.Formatting.setSource({ target: post, source: content });
    await f.instances.Tracking.register({ item: post, scope: f.shared.conversation });
    await f.instances.Notifying.notify({
      recipient: f.reader.user,
      kind: "reply",
      subject: post,
      link: post,
      at,
    });
  }
  const input = { session: f.reader.session, scope: f.shared.conversation };
  expect(await f.invoke("/unread/list", input)).toMatchObject({
    ok: true,
    value: { items: expect.arrayContaining([{ item: f.shared.post }]) },
  });
  expect(await f.invoke("/unread/count", input)).toMatchObject({ ok: true, value: { count: 3 } });
  expect(await f.invoke("/notifications/unreadCount", input)).toMatchObject({
    ok: true,
    value: { count: 2 },
  });
  await f.invoke("/unread/markSeen", { ...input, item: f.shared.post });
  expect(await f.invoke("/unread/count", input)).toMatchObject({ ok: true, value: { count: 2 } });
  await f.invoke("/notifications/markAllRead", input);
  expect(await f.invoke("/notifications/unreadCount", input)).toMatchObject({
    ok: true,
    value: { count: 0 },
  });
});

test("an uncategorized opening retains its content in the feed", async () => {
  const f = await fixture();
  for (const path of ["/threads/latest", "/threads/activity"])
    expect(await f.invoke(path, { session: f.reader.session })).toMatchObject({
      ok: true,
      value: {
        conversations: expect.arrayContaining([
          expect.objectContaining({
            conversation: f.privateThread.conversation,
            post: expect.objectContaining({ content: "SECRET audience body" }),
            category: null,
          }),
        ]),
      },
    });
});

test("resolution admission excludes the question itself and hides retained self-resolutions", async () => {
  const f = await fixture();
  const question = f.shared.post;
  const session = f.author.session;
  const accept = (answer: string) => f.invoke("/resolutions/accept", { session, question, answer });
  expect(await accept(question)).toMatchObject(missing);
  expect(await f.instances.Resolving._getResolution({ question })).toEqual([]);
  await f.instances.Resolving.accept({
    question,
    answer: question,
    by: f.author.user,
    at: new Date(),
  });
  expect(await f.invoke("/resolutions/get", { session, question })).toMatchObject({
    ok: true,
    value: { resolution: [] },
  });
  expect(await f.invoke("/resolutions/isResolved", { session, question })).toMatchObject({
    ok: true,
    value: { resolved: false },
  });
  const reply = async (parent: string) => {
    const at = new Date();
    const { post } = await f.instances.Posting.create({
      author: f.reader.user,
      content: "Answer",
      at,
    });
    const { node } = await f.instances.Conversing.reply({ parent, item: post, at });
    return { post, node };
  };
  const direct = await reply(f.shared.node);
  const descendant = await reply(direct.node);
  for (const answer of [direct.post, descendant.post]) {
    expect(await accept(answer)).toMatchObject({ ok: true });
    expect(await f.invoke("/resolutions/get", { session, question })).toMatchObject({
      ok: true,
      value: { resolution: [{ answer }] },
    });
  }
  expect(await accept(f.privateThread.post)).toMatchObject(missing);
  expect(await accept("unknown-answer")).toMatchObject(missing);
  expect(await accept(question)).toMatchObject(missing);
  expect(await f.instances.Resolving._getResolution({ question })).toMatchObject([
    { answer: descendant.post },
  ]);
});
