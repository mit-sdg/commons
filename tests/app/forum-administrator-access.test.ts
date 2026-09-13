import { afterAll, expect, test } from "vite-plus/test";
import { assembleCommons } from "../../src/assembly/application.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { forumMailEligibility } from "../../src/email/forum-policy.ts";

const missing = { ok: false, error: { kind: "domain", value: "NOT_FOUND" } };
const forbidden = { ok: false, error: { kind: "domain", value: "FORBIDDEN" } };
afterAll(stopTestDb);

async function fixture() {
  const instances = mongoImplementations(await testDb());
  const people = [];
  for (const username of ["author", "recipient", "administrator", "moderator"]) {
    const { user } = await instances.Authenticating.register({
      username,
      password: "long-password",
      email: `${username}@example.edu`,
    });
    const { session } = await instances.Sessioning.start({ user });
    // Administration must not depend on a student seat or group membership.
    if (username === "author" || username === "recipient") {
      await instances.Rostering.enrol({
        user,
        email: `${username}@example.edu`,
        kind: "STUDENT",
        section: null,
      });
    }
    people.push({ user, session });
  }
  const [author, recipient, administrator, moderator] = people;
  const { role: adminRole } = await instances.Roling.defineRole({
    name: "Operations",
    capabilities: ["administer"],
  });
  const { role: staffRole } = await instances.Roling.defineRole({
    name: "Teaching staff",
    capabilities: ["grade", "moderate"],
  });
  await instances.Roling.assign({ user: administrator.user, context: "commons", role: adminRole });
  await instances.Roling.assign({ user: moderator.user, context: "commons", role: staffRole });
  const app = assembleCommons(instances);
  const invoke = (path: string, input: Record<string, unknown>) => app.invoker.invoke(path, input);
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
  return { app, invoke, author, recipient, administrator, moderator, adminRole, holders, thread };
}

test("administrators read direct, group, and section discussions without joining their audiences", async () => {
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
  // Read access does not make an administrator a member who can address this group.
  expect(
    await f.invoke("/audiences/preview", { session, holders: [`group:${group}`] }),
  ).toMatchObject(forbidden);
  expect(
    await f.invoke("/threads/create", {
      session,
      holders: [`group:${group}`],
      content: "Not a member",
    }),
  ).toMatchObject(forbidden);
  for (const holders of [f.holders, [`group:${group}`], [`section:${section._id}`]]) {
    const { post, conversation } = await f.thread(holders);
    conversations.push(conversation);
    expect(await f.invoke("/posts/get", { session, post })).toMatchObject({
      ok: true,
      value: { post: { content: "# Private discussion\n\nPrivate message." } },
    });
    expect(await f.invoke("/threads/get", { session, conversation })).toMatchObject({
      ok: true,
      value: { thread: [expect.objectContaining({ item: post })] },
    });
    for (const [path, input] of [
      ["/revisions/latest", { item: post }],
      ["/links/forward", { source: post }],
      ["/unread/count", { scope: conversation }],
      ["/subscriptions/subscribers", { target: conversation }],
    ] as const) {
      expect(await f.invoke(path, { session, ...input }), path).toMatchObject({ ok: true });
    }
    const audience = await f.invoke("/audiences/forConversation", { session, conversation });
    expect(audience).toMatchObject({
      ok: true,
      value: { holders: holders.map((holder) => expect.objectContaining({ holder })) },
    });
    expect(JSON.stringify(audience)).not.toContain(f.administrator.user);
    // Staff and moderation capabilities alone still provide no audience bypass.
    expect(
      await f.invoke("/posts/get", {
        session: f.moderator.session,
        post,
        user: f.administrator.user,
      }),
    ).toMatchObject(missing);
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
      value: {
        conversations: expect.arrayContaining(
          conversations.map((conversation) => expect.objectContaining({ conversation })),
        ),
      },
    });
  }
  expect(await f.app.concepts.Grouping._isMember({ group, member: f.administrator.user })).toEqual({
    isMember: false,
  });
  expect(await f.app.concepts.Notifying._getInbox({ recipient: f.administrator.user })).toEqual([]);
  expect(
    await f.app.concepts.Subscribing._getSubscriptions({ user: f.administrator.user }),
  ).toEqual([]);
  expect(
    (await f.app.concepts.Mailing._getPending({})).every(
      (mail) => mail.recipient === "recipient@example.edu",
    ),
  ).toBe(true);
});

test("administrators can open private mail's source, reply, and moderate without bypassing edit or lock rules", async () => {
  const f = await fixture();
  const content = "# Private discussion\n\nCONFIDENTIAL-MESSAGE for @recipient";
  const { post, conversation, node } = await f.thread(f.holders, content);
  const session = f.administrator.session;
  const [mail] = await f.app.concepts.Mailing._getPending({});
  expect(mail).toBeDefined();
  expect(await f.invoke("/mail/read", { session, message: mail.message })).toMatchObject({
    ok: true,
    value: { text: expect.stringContaining("CONFIDENTIAL-MESSAGE") },
  });
  expect(await f.invoke("/posts/get", { session, post })).toMatchObject({
    ok: true,
    value: { post: { content } },
  });
  expect(await f.invoke("/posts/edit", { session, post, content: "Overwritten" })).toMatchObject(
    forbidden,
  );
  expect(
    await f.invoke("/threads/reply", { session, parent: node, content: "Administrator reply" }),
  ).toMatchObject({ ok: true });
  expect(await f.app.concepts.Accessing._holders({ resource: conversation })).toEqual([
    { holders: f.holders },
  ]);
  expect(await f.invoke("/locks/lock", { session, target: conversation })).toMatchObject({
    ok: true,
  });
  expect(
    await f.invoke("/threads/reply", { session, parent: node, content: "Locked reply" }),
  ).toMatchObject(forbidden);
  expect(await f.invoke("/trash/trash", { session, item: post })).toMatchObject({ ok: true });
  expect(await f.invoke("/posts/get", { session, post })).toMatchObject(missing);
  expect(await f.invoke("/moderation/posts/get", { session, item: post })).toMatchObject({
    ok: true,
    value: { post: { content } },
  });
  expect(await f.invoke("/threads/get", { session, conversation })).toMatchObject({
    ok: true,
    value: {
      thread: [
        expect.objectContaining({
          post: expect.objectContaining({ content: "Administrator reply" }),
        }),
      ],
    },
  });
});

test("administrator mentions, inboxes, and mail eligibility follow current authority and account availability", async () => {
  const f = await fixture();
  const { post, conversation } = await f.thread(
    f.holders,
    "# Private discussion\n\nPlease review, @administrator.",
  );
  const session = f.administrator.session;
  const admin = { user: f.administrator.user, context: "commons" };
  const [notification] = await f.app.concepts.Notifying._getInbox({ recipient: admin.user });
  expect(notification).toMatchObject({ kind: "mention", subject: post });
  const mail = (await f.app.concepts.Mailing._getPending({})).find(
    (mail) => mail.recipient === "administrator@example.edu",
  );
  expect(mail).toBeDefined();
  if (!mail) throw new Error("Administrator mention email was not queued");
  const eligible = forumMailEligibility(f.app);
  expect(await eligible(mail)).toBe(true);
  expect(await f.invoke("/notifications/unreadCount", { session })).toMatchObject({
    ok: true,
    value: { count: 1 },
  });
  await f.app.concepts.Roling.revoke(admin);
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
  expect(await eligible(mail)).toBe(false);
  await f.app.concepts.Roling.assign({ ...admin, role: f.adminRole });
  expect(await eligible(mail)).toBe(true);
  await f.app.concepts.Archiving.trash({ item: admin.user, by: f.author.user, at: new Date() });
  expect((await f.invoke("/posts/get", { session, post })).ok).toBe(false);
  expect(await eligible(mail)).toBe(false);
});
