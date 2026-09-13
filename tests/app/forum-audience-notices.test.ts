import { afterAll, expect, test } from "vite-plus/test";
import { assembleCommons } from "../../src/assembly/application.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

/**
 * `admin` and `tutor` are staff; `student` writes, `outsider` is enrolled but
 * outside every audience below, so a notice must never reach them.
 */
async function fixture() {
  const instances = mongoImplementations(await testDb());
  const people: { user: string; session: string; email: string; seat: string }[] = [];
  for (const username of ["student", "admin", "tutor", "outsider"]) {
    const email = `${username}@example.edu`;
    const { user } = await instances.Authenticating.register({
      username,
      password: "long-password",
      email,
    });
    const { session } = await instances.Sessioning.start({ user });
    const { seat } = await instances.Rostering.enrol({
      user,
      email,
      kind: username === "admin" || username === "tutor" ? "STAFF" : "STUDENT",
      section: null,
    });
    people.push({ user, session, email, seat: seat._id });
  }
  for (const [index, capability] of [
    [1, "administer"],
    [2, "grade"],
  ] as const) {
    const { role } = await instances.Roling.defineRole({
      name: capability,
      capabilities: [capability],
    });
    await instances.Roling.assign({ user: people[index]!.user, context: "commons", role });
  }
  return { app: assembleCommons(instances), instances, people };
}

type App = Awaited<ReturnType<typeof fixture>>["app"];
async function invoke(app: App, path: string, body: Record<string, unknown>) {
  const result = await app.invoker.invoke(path as never, body as never);
  await app.whenIdle();
  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.value as Record<string, any>;
}
async function refuse(app: App, path: string, body: Record<string, unknown>, code: string) {
  const result = await app.invoker.invoke(path as never, body as never);
  await app.whenIdle();
  expect(result, JSON.stringify(result)).toMatchObject({ ok: false, error: { value: code } });
}

const kindsOf = (rows: { kind: string }[], kind: string) => rows.filter((row) => row.kind === kind);

test("staff notify a post's audience once, with the post itself, excluding its author", async () => {
  const {
    app,
    people: [student, admin, tutor, outsider],
  } = await fixture();
  const thread = await invoke(app, "/threads/create", {
    session: student!.session,
    content: "# Lab timing\n\nWhen does the lab open?",
    holders: [`account:${student!.user}`, `account:${admin!.user}`, `account:${tutor!.user}`],
  });
  const reply = await invoke(app, "/threads/reply", {
    session: student!.session,
    parent: thread.node,
    content: "Correction: the second bench is broken.",
  });
  const pendingBefore = await app.concepts.Mailing._getPending({});

  expect(
    await invoke(app, "/notices/preview", { session: admin!.session, post: reply.post }),
  ).toEqual({ recipients: 2, notified: false });

  expect(
    await invoke(app, "/notices/notify", { session: admin!.session, post: reply.post }),
  ).toEqual({ post: reply.post, recipients: 2 });

  const inbox = async (session: string) =>
    (await invoke(app, "/notifications/inbox", { session })).notifications as {
      kind: string;
      link: string;
      discussionTitle?: string;
    }[];
  expect(kindsOf(await inbox(admin!.session), "audience_notice")).toEqual([
    expect.objectContaining({ link: reply.post, discussionTitle: "Lab timing" }),
  ]);
  expect(kindsOf(await inbox(tutor!.session), "audience_notice")).toEqual([
    expect.objectContaining({ link: reply.post }),
  ]);
  // The post's author wrote the words; they are not told about their own post.
  expect(kindsOf(await inbox(student!.session), "audience_notice")).toEqual([]);
  expect(await inbox(outsider!.session)).toEqual([]);

  const queued = (await app.concepts.Mailing._getPending({})).filter(
    (message) => !pendingBefore.some((earlier) => earlier.message === message.message),
  );
  expect(queued.map((message) => message.recipient).sort()).toEqual(
    [admin!.email, tutor!.email].sort(),
  );
  const mail = queued.find((message) => message.recipient === tutor!.email);
  expect(mail?.subject).toBe("Staff shared a post with the discussion audience: Lab timing");
  expect(mail?.text).toContain("Correction: the second bench is broken.");
  expect(mail?.text).toContain("From: @student");
  expect(mail?.text).toContain(`#post-${reply.post}`);
  expect(mail?.html).toContain("Correction: the second bench is broken.");
  // One post, not the thread it sits in.
  expect(`${mail?.text}${mail?.html}`).not.toContain("When does the lab open?");
});

test("a post notifies once; a second send and a later edit add nothing", async () => {
  const {
    app,
    people: [student, admin, tutor],
  } = await fixture();
  const thread = await invoke(app, "/threads/create", {
    session: student!.session,
    content: "Reading question",
    holders: [`account:${student!.user}`, `account:${admin!.user}`, `account:${tutor!.user}`],
  });
  await invoke(app, "/notices/notify", { session: admin!.session, post: thread.post });
  const after = (await app.concepts.Mailing._getPending({})).length;

  await refuse(app, "/notices/notify", { session: admin!.session, post: thread.post }, "CONFLICT");
  expect(
    await invoke(app, "/notices/preview", { session: admin!.session, post: thread.post }),
  ).toEqual({ recipients: 2, notified: true });
  // Another staff account does not get a second send of the same post either.
  await refuse(app, "/notices/notify", { session: tutor!.session, post: thread.post }, "CONFLICT");

  await invoke(app, "/posts/edit", {
    session: student!.session,
    post: thread.post,
    content: "Reading question, corrected",
  });
  await refuse(app, "/notices/notify", { session: admin!.session, post: thread.post }, "CONFLICT");
  expect(await app.concepts.Mailing._getPending({})).toHaveLength(after);
  const notices = (await invoke(app, "/notifications/inbox", { session: tutor!.session }))
    .notifications as { kind: string }[];
  expect(kindsOf(notices, "audience_notice")).toHaveLength(1);
  // The capture keeps what the audience was sent, not what the post now says.
  expect(await app.concepts.NoticeSnapshotting._snapshot({ subject: thread.post })).toMatchObject([
    { value: expect.objectContaining({ content: "Reading question" }) },
  ]);
});

test("only staff inside the audience may notify or read notice state", async () => {
  const {
    app,
    instances,
    people: [student, admin, tutor, outsider],
  } = await fixture();
  const thread = await invoke(app, "/threads/create", {
    session: student!.session,
    content: "Section-only note",
    holders: [`account:${student!.user}`, `account:${admin!.user}`, `account:${tutor!.user}`],
  });
  // A reader inside the audience without a staff capability cannot notify.
  await refuse(
    app,
    "/notices/notify",
    { session: student!.session, post: thread.post },
    "NOT_FOUND",
  );
  await refuse(
    app,
    "/notices/preview",
    { session: student!.session, post: thread.post },
    "NOT_FOUND",
  );
  await refuse(
    app,
    "/notices/forConversation",
    {
      session: student!.session,
      conversation: thread.conversation,
    },
    "FORBIDDEN",
  );
  // An outsider learns nothing about the discussion, staff or not.
  await refuse(
    app,
    "/notices/forConversation",
    {
      session: outsider!.session,
      conversation: thread.conversation,
    },
    "NOT_FOUND",
  );

  expect(
    await invoke(app, "/notices/forConversation", {
      session: admin!.session,
      conversation: thread.conversation,
    }),
  ).toEqual({ notices: [] });
  await invoke(app, "/notices/notify", { session: admin!.session, post: thread.post });
  expect(
    await invoke(app, "/notices/forConversation", {
      session: admin!.session,
      conversation: thread.conversation,
    }),
  ).toEqual({ notices: [{ post: thread.post }] });

  // Staff who lose their capability lose the send with it.
  await instances.Roling.revoke({ user: tutor!.user, context: "commons" });
  const reply = await invoke(app, "/threads/reply", {
    session: student!.session,
    parent: thread.node,
    content: "Follow-up",
  });
  await refuse(app, "/notices/notify", { session: tutor!.session, post: reply.post }, "NOT_FOUND");
  // A former staff account still in the audience is still a recipient.
  expect(
    await invoke(app, "/notices/notify", { session: admin!.session, post: reply.post }),
  ).toEqual({ post: reply.post, recipients: 2 });
});

test("a trashed post admits no notice, and its audience is read at the moment of sending", async () => {
  const {
    app,
    instances,
    people: [student, admin, , outsider],
  } = await fixture();
  const thread = await invoke(app, "/threads/create", {
    session: student!.session,
    content: "Everyone's question",
    holders: ["standing:everyone"],
  });
  await instances.Trashing.trash({ item: thread.post, by: admin!.user, at: new Date() });
  await refuse(app, "/notices/notify", { session: admin!.session, post: thread.post }, "NOT_FOUND");
  await instances.Trashing.restore({ item: thread.post });

  // Course-wide holders admit every active member, so the count follows the roster.
  expect(
    await invoke(app, "/notices/preview", { session: admin!.session, post: thread.post }),
  ).toEqual({ recipients: 3, notified: false });
  await instances.Rostering.dropSeat({ seat: outsider!.seat });
  expect(
    await invoke(app, "/notices/notify", { session: admin!.session, post: thread.post }),
  ).toEqual({ post: thread.post, recipients: 2 });
  const notices = (await invoke(app, "/notifications/inbox", { session: admin!.session }))
    .notifications as { kind: string }[];
  expect(kindsOf(notices, "audience_notice")).toHaveLength(1);
});
