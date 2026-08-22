/**
 * Independent evidence for the task-notification change.
 *
 * This file does not restate what `tests/app/task-notifications.test.ts`
 * already establishes. It adds the three things that suite leaves open:
 *
 *  1. the forum path proved through the forum's *own* boundary — a real reply
 *     raising a real forum notification — rather than by calling
 *     `Notifying.notify` directly, so "no forum reaction fires for a task
 *     notification, and no task reaction fires for a forum one" is shown
 *     against live reactions on both sides;
 *  2. that the eight kinds are distinguishable in the mail a reader receives,
 *     rather than one sentence repeated; and
 *  3. that inbox and mail state are durable across a process restart.
 */

import { afterAll, describe, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { assembleCommons } from "../../src/assembly/application.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

type App = ReturnType<typeof assembleCommons>;

const WINDOW = { startsAt: "2026-08-19T16:00:00.000Z", endsAt: "2026-08-19T17:00:00.000Z" };
const LATER = { startsAt: "2026-09-01T09:00:00.000Z", endsAt: "2026-09-02T17:00:00.000Z" };

/** The forum instance's one generic subject line, from `Forum.notifications`. */
const GENERIC_SUBJECT = "New Commons notification";

async function actor(app: App, username: string) {
  const email = `${username}@example.edu`;
  const registered = await app.concepts.Authenticating.register({
    username,
    password: "password123",
    email,
  });
  if ("error" in registered) throw new Error(String(registered.error));
  await app.concepts.Profiling.createProfile({
    user: registered.user,
    displayName: username,
    email,
  });
  const login = await app.invoker.invoke("/auth/login", {
    username,
    password: "password123",
  } as never);
  if (!login.ok) throw new Error(`could not create ${username}`);
  return { user: registered.user, email, session: (login.value as { session: string }).session };
}

function answer(result: Awaited<ReturnType<App["invoker"]["invoke"]>>) {
  return result.ok
    ? (result.value as Record<string, unknown>)
    : { error: result.error.kind === "domain" ? result.error.value : result.error.code };
}

/** Every call goes through the assembled application's own endpoint boundary. */
async function call(app: App, path: string, body: Record<string, unknown>) {
  const answered = answer(await app.invoker.invoke(path as never, body as never));
  await app.whenIdle();
  return answered;
}

interface Row {
  notification: string;
  kind: string;
  subject?: string;
  link: string | null;
  read: boolean;
  listTitle?: string | null;
  list?: string | null;
  task?: { title: string | null } & Record<string, unknown>;
}

async function taskInbox(app: App, session: string): Promise<Row[]> {
  return (await call(app, "/tasknotifications/inbox", { session })).notifications as Row[];
}

async function forumInbox(app: App, session: string): Promise<Row[]> {
  return (await call(app, "/notifications/inbox", { session })).notifications as Row[];
}

async function pending(app: App) {
  return app.concepts.Mailing._getPending({});
}

async function newApp() {
  return assembleCommons(mongoImplementations(await testDb()));
}

afterAll(stopTestDb);

describe("the forum path is unchanged, proved through the forum's own boundary", () => {
  test("a real forum reply queues exactly one generic email, and a task event queues only its own", async () => {
    const app = await newApp();
    const alice = await actor(app, "alice_forumpath");
    const bob = await actor(app, "bob_forumpath");

    // A genuine forum event: Bob replies to Alice's thread, so the forum's own
    // reaction raises the notification rather than the test raising it.
    const thread = await call(app, "/threads/create", {
      session: alice.session,
      content: "Hello forum",
    });
    expect(thread.node).toEqual(expect.any(String));
    const replied = await call(app, "/threads/reply", {
      session: bob.session,
      parent: thread.node,
      content: "Hi Alice",
    });
    expect(replied.post).toEqual(expect.any(String));

    const forumRows = await forumInbox(app, alice.session);
    expect(forumRows).toHaveLength(1);
    expect(forumRows[0]).toMatchObject({ kind: "reply", read: false });
    expect(await call(app, "/notifications/unreadCount", { session: alice.session })).toEqual({
      count: 1,
    });

    // Exactly one email, and it is the forum's generic one.
    const afterReply = await pending(app);
    expect(afterReply).toHaveLength(1);
    expect(afterReply[0]).toMatchObject({
      key: forumRows[0].notification,
      recipient: alice.email,
      subject: GENERIC_SUBJECT,
    });

    // No task declaration fired for it: the task inbox and count are untouched.
    expect(await taskInbox(app, alice.session)).toEqual([]);
    expect(await call(app, "/tasknotifications/unreadCount", { session: alice.session })).toEqual({
      count: 0,
    });

    // Now the other direction, in the same running application.
    const created = await call(app, "/tasklists/create", {
      session: alice.session,
      title: "Reading Group",
    });
    const list = String(created.list);
    expect(
      await call(app, "/tasklists/add-member", {
        session: alice.session,
        list,
        candidate: bob.user,
      }),
    ).toEqual({ list });

    const taskRows = await taskInbox(app, bob.session);
    expect(taskRows).toHaveLength(1);
    expect(taskRows[0]).toMatchObject({ kind: "task-list-added", subject: list, read: false });

    // One further message, and it is not the forum's generic one.
    const afterTask = await pending(app);
    expect(afterTask).toHaveLength(2);
    const taskMail = afterTask.filter((message) => message.key === taskRows[0].notification);
    expect(taskMail).toHaveLength(1);
    expect(taskMail[0].recipient).toBe(bob.email);
    expect(taskMail[0].subject).not.toBe(GENERIC_SUBJECT);
    expect(taskMail[0].subject).toContain("Reading Group");
    // and the forum's generic email was queued once in the whole run, for the reply alone
    expect(afterTask.filter((message) => message.subject === GENERIC_SUBJECT)).toHaveLength(1);

    // No forum declaration fired for the task notification: Bob's forum inbox
    // and count stay empty, and Alice's forum inbox is exactly as it was.
    expect(await forumInbox(app, bob.session)).toEqual([]);
    expect(await call(app, "/notifications/unreadCount", { session: bob.session })).toEqual({
      count: 0,
    });
    expect(await forumInbox(app, alice.session)).toHaveLength(1);
    expect(await call(app, "/notifications/unreadCount", { session: alice.session })).toEqual({
      count: 1,
    });

    // A body value cannot select another recipient: the reader is the session's
    // account, so Alice naming Bob still reads Alice's own empty task inbox.
    expect(
      await call(app, "/tasknotifications/inbox", {
        session: alice.session,
        user: bob.user,
        recipient: bob.user,
      }),
    ).toEqual({ notifications: [] });
    // The forum surface the task instance deliberately does not mirror still works.
    const listed = await call(app, "/notifications/list", { session: alice.session });
    expect(listed.notifications).toHaveLength(1);

    // Marking everything read on one instance leaves the other alone: the two
    // counts the web badge sums are genuinely independent.
    await call(app, "/notifications/markAllRead", { session: alice.session });
    expect(await call(app, "/notifications/unreadCount", { session: alice.session })).toEqual({
      count: 0,
    });
    expect(await call(app, "/tasknotifications/unreadCount", { session: bob.session })).toEqual({
      count: 1,
    });
    await call(app, "/tasknotifications/markAllRead", { session: bob.session });
    expect(await call(app, "/tasknotifications/unreadCount", { session: bob.session })).toEqual({
      count: 0,
    });
  });
});

describe("the mail distinguishes the kinds", () => {
  test("the membership kind and the six task kinds each read differently", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_distinct");
    const noah = await actor(app, "noah_distinct");
    const created = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "Distinct Ops",
    });
    const list = String(created.list);
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const madeTask = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Watched",
      ...WINDOW,
    });
    const task = String(madeTask.task);

    await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });
    await call(app, "/tasks/retime", { session: mara.session, task, ...LATER });
    await call(app, "/tasks/complete", { session: mara.session, task });
    await call(app, "/tasks/reopen", { session: mara.session, task });
    await call(app, "/tasks/cancel", { session: mara.session, task });
    await call(app, "/tasks/uncancel", { session: mara.session, task });

    const rows = await taskInbox(app, noah.session);
    expect(rows).toHaveLength(7);
    const queued = await pending(app);
    expect(queued).toHaveLength(7);

    // Seven kinds, seven different subject lines and seven different bodies.
    expect(new Set(rows.map((row) => row.kind)).size).toBe(7);
    expect(new Set(queued.map((message) => message.subject)).size).toBe(7);
    expect(new Set(queued.map((message) => message.text)).size).toBe(7);
    expect(new Set(queued.map((message) => message.html)).size).toBe(7);

    for (const message of queued) {
      expect(message.subject).not.toBe(GENERIC_SUBJECT);
      expect(message.text).toContain("Distinct Ops");
    }

    // Every task message carries the task, the list and the deadline as it
    // stood when that message was queued: the assignment predates the retime,
    // so it names the original window and the four after it name the new one.
    const byKey = new Map(queued.map((message) => [message.key, message]));
    for (const row of rows.filter((entry) => entry.kind !== "task-list-added")) {
      const message = byKey.get(row.notification);
      expect(message?.text).toContain("Watched");
      expect(message?.text).toContain("Distinct Ops");
      expect(message?.html).toContain("Watched");
      const deadline = row.kind === "task-assigned" ? WINDOW.endsAt : LATER.endsAt;
      expect(message?.text).toContain(deadline);
    }
  });
});

describe("notification and mail state outlive the process", () => {
  test("both inboxes, both unread counts and the queued mail survive a restart", async () => {
    const db = await testDb();
    const app1 = assembleCommons(mongoImplementations(db));
    const mara = await actor(app1, "mara_durable");
    const noah = await actor(app1, "noah_durable");

    const created = await call(app1, "/tasklists/create", {
      session: mara.session,
      title: "Durable List",
    });
    const list = String(created.list);
    await call(app1, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const madeTask = await call(app1, "/tasks/create", {
      session: mara.session,
      list,
      title: "Durable Task",
      ...WINDOW,
    });
    const task = String(madeTask.task);
    await call(app1, "/tasks/assign", { session: mara.session, task, assignee: noah.user });

    // and one forum notification for the same person, so the restart is judged
    // on both instances rather than one
    const thread = await call(app1, "/threads/create", {
      session: noah.session,
      content: "A thread of my own",
    });
    await call(app1, "/threads/reply", {
      session: mara.session,
      parent: thread.node,
      content: "Replying",
    });

    const before = await taskInbox(app1, noah.session);
    expect(before).toHaveLength(2);
    expect(await pending(app1)).toHaveLength(3);
    const keysBefore = new Set((await pending(app1)).map((message) => message.key));

    // Restart: a second assembly over the same database, with no shared memory.
    const app2 = assembleCommons(mongoImplementations(db));

    const after = await taskInbox(app2, noah.session);
    expect(after.map((row) => row.notification).sort()).toEqual(
      before.map((row) => row.notification).sort(),
    );
    const membership = after.find((row) => row.kind === "task-list-added");
    const assignment = after.find((row) => row.kind === "task-assigned");
    expect(membership).toMatchObject({ subject: list, link: list, read: false });
    expect(membership?.listTitle).toBe("Durable List");
    expect(assignment).toMatchObject({ subject: task, link: task, read: false });
    expect(assignment?.task?.title).toBe("Durable Task");
    expect(assignment?.listTitle).toBe("Durable List");

    expect(await call(app2, "/tasknotifications/unreadCount", { session: noah.session })).toEqual({
      count: 2,
    });
    expect(await call(app2, "/notifications/unreadCount", { session: noah.session })).toEqual({
      count: 1,
    });
    expect(await forumInbox(app2, noah.session)).toHaveLength(1);

    // The queued mail is the same three messages, still addressed and still keyed
    // to the notifications that raised them.
    const mailAfter = await pending(app2);
    expect(mailAfter).toHaveLength(3);
    expect(new Set(mailAfter.map((message) => message.key))).toEqual(keysBefore);
    expect(mailAfter.filter((message) => message.subject === GENERIC_SUBJECT)).toHaveLength(1);
    expect(
      mailAfter.filter((message) => message.key === assignment?.notification)[0]?.text,
    ).toContain("Durable Task");

    // Read state written after the restart is durable in the same way.
    expect(
      await call(app2, "/tasknotifications/markRead", {
        session: noah.session,
        notification: assignment?.notification,
      }),
    ).toEqual({ notification: assignment?.notification });

    const app3 = assembleCommons(mongoImplementations(db));
    expect(await call(app3, "/tasknotifications/unreadCount", { session: noah.session })).toEqual({
      count: 1,
    });
    const finalRows = await taskInbox(app3, noah.session);
    expect(finalRows.find((row) => row.kind === "task-assigned")?.read).toBe(true);
    expect(finalRows.find((row) => row.kind === "task-list-added")?.read).toBe(false);
  });
});
