import { afterAll, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";
import { forumMailEligibility } from "../../src/email/forum-policy.ts";

const missing = { ok: false, error: { kind: "domain", value: "NOT_FOUND" } };
const origin = "https://commons.example.edu";
afterAll(stopTestDb);

async function fixture() {
  const instances = mongoImplementations(await testDb());
  const people = [];
  for (const username of ["author", "recipient", "administrator"]) {
    const email = `${username}@example.edu`;
    const { user } = await instances.Authenticating.register({
      username,
      password: "long-password",
      email,
    });
    const { session } = await instances.Sessioning.start({ user });
    // An administrator need not have a roster seat; only the audience grants access.
    if (username !== "administrator") {
      await instances.Rostering.enrol({ user, email, kind: "STUDENT", section: null });
    }
    people.push({ user, session, email });
  }
  const [author, recipient, administrator] = people;
  const { role } = await instances.Roling.defineRole({
    name: "Operations",
    capabilities: ["administer"],
  });
  await instances.Roling.assign({ user: administrator.user, context: "commons", role });
  const edge = createEdge(instances, origin);
  const app = edge.application;
  const invoke = async (path: string, input: Record<string, unknown>) => {
    const result = await app.invoker.invoke(path, input);
    await app.whenIdle();
    return result;
  };
  const holders = [`account:${author.user}`, `account:${recipient.user}`].sort();
  async function thread(selected = holders, content = "# Private discussion\n\nPrivate message.") {
    const result = await invoke("/threads/create", {
      session: author.session,
      holders: selected,
      content,
    });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("Thread creation failed");
    return result.value as { post: string; conversation: string; node: string };
  }
  return { app, edge, invoke, author, recipient, administrator, holders, thread };
}

test("administrators outside direct, group, and section audiences cannot read or act on their discussions", async () => {
  const f = await fixture();
  const { group } = await f.app.concepts.Grouping.create({
    creator: f.author.user,
    title: "Study group",
    at: new Date(),
  });
  const { section } = await f.app.concepts.Rostering.createSection({
    name: "Section A",
    location: "",
    meetingPattern: "",
  });
  const [{ seat }] = await f.app.concepts.Rostering._getSeatByUser({ user: f.author.user });
  await f.app.concepts.Rostering.moveSection({ seat, section: section._id });
  const session = f.administrator.session;
  const conversations: string[] = [];
  expect(
    await f.invoke("/audiences/preview", { session, holders: [`group:${group}`] }),
  ).toMatchObject({ ok: false, error: { value: "FORBIDDEN" } });
  for (const holders of [f.holders, [`group:${group}`], [`section:${section._id}`]]) {
    const { post, conversation, node } = await f.thread(
      holders,
      "# Private discussion\n\nA mention of @administrator does not grant access.",
    );
    conversations.push(conversation);
    expect(await f.invoke("/posts/get", { session: f.author.session, post })).toMatchObject({
      ok: true,
    });
    for (const [path, input] of [
      ["/posts/get", { post }],
      ["/threads/get", { conversation }],
      ["/threads/post-controls", { conversation, posts: [post] }],
      ["/audiences/forConversation", { conversation }],
      ["/revisions/latest", { item: post }],
      ["/links/forward", { source: post }],
      ["/unread/count", { scope: conversation }],
      ["/subscriptions/subscribers", { target: conversation }],
      ["/notices/preview", { post }],
      ["/notices/notify", { post }],
      ["/threads/reply", { parent: node, content: "Intrusion" }],
      ["/locks/lock", { target: conversation }],
      ["/trash/trash", { item: post }],
    ] as const) {
      expect(
        await f.invoke(path, { session, ...input, user: f.author.user, reader: f.author.user }),
        path,
      ).toMatchObject(missing);
    }
    expect(await f.app.concepts.Accessing._holders({ resource: conversation })).toEqual([
      { holders },
    ]);
    expect(await f.app.concepts.Locking._isLocked({ target: conversation })).toEqual({
      locked: false,
    });
    expect(await f.app.concepts.Trashing._isTrashed({ item: post })).toEqual({ trashed: false });
    await f.app.concepts.Trashing.trash({ item: post, by: f.author.user, at: new Date() });
    expect(await f.invoke("/moderation/posts/get", { session, item: post })).toMatchObject(missing);
  }
  for (const [path, input] of [
    ["/threads/latest", {}],
    ["/threads/activity", {}],
    ["/threads/index", { order: "latest" }],
    ["/threads/index", { order: "activity" }],
    ["/threads/summaries", { conversations }],
  ] as const) {
    expect(await f.invoke(path, { session, ...input }), path).toMatchObject({
      ok: true,
      value: { conversations: [] },
    });
  }
  expect(await f.invoke("/trash/list", { session })).toMatchObject({
    ok: true,
    value: { trashed: [] },
  });
  expect(await f.app.concepts.Grouping._isMember({ group, member: f.administrator.user })).toEqual({
    isMember: false,
  });
  expect(await f.app.concepts.Notifying._getInbox({ recipient: f.administrator.user })).toEqual([]);
  expect(
    await f.app.concepts.Subscribing._getSubscriptions({ user: f.administrator.user }),
  ).toEqual([]);
  expect(
    (await f.app.concepts.Mailing._getPending({})).some(
      (mail) => mail.recipient === f.administrator.email,
    ),
  ).toBe(false);
});

test("administrator membership controls mentions, notices, and queued mail after leaving a group", async () => {
  const f = await fixture();
  const { group } = await f.app.concepts.Grouping.create({
    creator: f.author.user,
    title: "Study group",
    at: new Date(),
  });
  await f.app.concepts.Grouping.addMember({
    group,
    member: f.author.user,
    candidate: f.administrator.user,
    at: new Date(),
  });
  const { post, conversation } = await f.thread(
    [`group:${group}`],
    "# Group discussion\n\nPlease review, @administrator.",
  );
  const session = f.administrator.session;
  expect(await f.invoke("/posts/get", { session, post })).toMatchObject({ ok: true });
  expect(await f.invoke("/notices/notify", { session, post })).toMatchObject({
    ok: true,
    value: { post, recipients: 1 },
  });
  const notifications = await f.app.concepts.Notifying._getInbox({
    recipient: f.administrator.user,
  });
  expect(notifications.map((notification) => notification.kind).sort()).toEqual([
    "audience_notice",
    "mention",
  ]);
  const mail = (await f.app.concepts.Mailing._getPending({})).filter(
    (message) => message.recipient === f.administrator.email && message.key.startsWith("forum:"),
  );
  expect(mail).toHaveLength(2);
  const eligible = forumMailEligibility(f.app);
  for (const message of mail) expect(await eligible(message)).toBe(true);

  await f.app.concepts.Grouping.leave({ group, member: f.administrator.user, at: new Date() });
  expect(
    await f.app.concepts.Roling._hasCapability({
      user: f.administrator.user,
      context: "commons",
      capability: "administer",
    }),
  ).toEqual({ allowed: true });
  expect(await f.invoke("/posts/get", { session, post })).toMatchObject(missing);
  expect(await f.invoke("/threads/get", { session, conversation })).toMatchObject(missing);
  expect(await f.invoke("/notifications/inbox", { session })).toMatchObject({
    ok: true,
    value: { notifications: [] },
  });
  expect(await f.invoke("/notifications/unreadCount", { session })).toMatchObject({
    ok: true,
    value: { count: 0 },
  });
  for (const message of mail) expect(await eligible(message)).toBe(false);
});

test("administrator outbox inspection intentionally exposes snapshots without granting forum access", async () => {
  const f = await fixture();
  const { post } = await f.thread(f.holders, "# Private discussion\n\nCONFIDENTIAL-MESSAGE");
  const [mail] = await f.app.concepts.Mailing._getPending({});
  expect(mail).toBeDefined();
  expect(mail.recipient).toBe(f.recipient.email);
  const request = async (path: string, input: Record<string, unknown>) => {
    const response = await f.edge.fetch(
      new Request(`${origin}/api${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: `__Host-commons-session=${f.administrator.session}`,
        },
        body: JSON.stringify(input),
      }),
    );
    return { status: response.status, body: (await response.json()) as unknown };
  };
  expect(await request("/posts/get", { post })).toEqual({
    status: 404,
    body: { error: "NOT_FOUND" },
  });
  expect(await request("/mail/list", {})).toMatchObject({
    status: 200,
    body: { messages: [expect.objectContaining({ message: mail.message, subject: mail.subject })] },
  });
  expect(await request("/mail/read", { message: mail.message })).toMatchObject({
    status: 200,
    body: { recipient: f.recipient.email, text: expect.stringContaining("CONFIDENTIAL-MESSAGE") },
  });
});
