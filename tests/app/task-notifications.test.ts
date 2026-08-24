import { afterAll, describe, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { assembleCommons } from "../../src/assembly/application.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

type App = ReturnType<typeof assembleCommons>;

const WINDOW = { startsAt: "2026-08-19T16:00:00.000Z", endsAt: "2026-08-19T17:00:00.000Z" };

async function newApp() {
  return assembleCommons(mongoImplementations(await testDb()));
}

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

async function call(app: App, path: string, body: Record<string, unknown>) {
  const answered = answer(await app.invoker.invoke(path as never, body as never));
  await app.whenIdle();
  return answered;
}

interface InboxRow {
  notification: string;
  kind: string;
  subject: string;
  link: string | null;
  read: boolean;
  listTitle: string | null;
  list: string | null;
  task: { title: string | null; state: string | null } & Record<string, unknown>;
}

/** A row carries no task presentation when every leaf of its task fragment is null. */
function withoutTaskPresentation(row: InboxRow | undefined) {
  return { list: row?.list ?? null, title: row?.task?.title ?? null };
}

async function inbox(app: App, session: string): Promise<InboxRow[]> {
  const read = await call(app, "/tasknotifications/inbox", { session });
  return read.notifications as InboxRow[];
}

async function pending(app: App) {
  return app.concepts.Mailing._getPending({});
}

async function makeList(app: App, owner: { session: string }, title: string) {
  const created = await call(app, "/tasklists/create", { session: owner.session, title });
  return String(created.list);
}

async function makeTask(
  app: App,
  session: string,
  list: string,
  title: string,
  window: { startsAt: string; endsAt: string } = WINDOW,
) {
  const created = await call(app, "/tasks/create", { session, list, title, ...window });
  return String(created.task);
}

afterAll(stopTestDb);

describe("task-list membership notifications", () => {
  test("adding a person tells that person once, with an email naming the list", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_add");
    const noah = await actor(app, "noah_add");
    const list = await makeList(app, mara, "Reading Group");

    const added = await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    expect(added).toEqual({ list });

    const noahRows = await inbox(app, noah.session);
    expect(noahRows).toHaveLength(1);
    expect(noahRows[0]).toMatchObject({
      kind: "task-list-added",
      subject: list,
      link: list,
      read: false,
      listTitle: "Reading Group",
    });
    expect(withoutTaskPresentation(noahRows[0])).toEqual({ list: null, title: null });

    expect(await inbox(app, mara.session)).toEqual([]);

    const queued = await pending(app);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      key: noahRows[0].notification,
      recipient: noah.email,
    });
    expect(queued[0].subject).toContain("Reading Group");
    expect(queued[0].text).toContain("Reading Group");
    expect(queued[0].html).toContain("Reading Group");
    expect(queued[0].text).not.toContain("You have a new Commons notification");
  });

  test("removing another member tells that member once, however many tasks are released", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_rm");
    const noah = await actor(app, "noah_rm");
    const list = await makeList(app, mara, "Field Work");
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });

    const first = await makeTask(app, mara.session, list, "First");
    const second = await makeTask(app, mara.session, list, "Second");
    const third = await makeTask(app, mara.session, list, "Third");
    for (const task of [first, second, third]) {
      await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });
    }

    const beforeRemoval = (await inbox(app, noah.session)).length;
    expect(beforeRemoval).toBe(4); // one membership row and three assignments

    const removed = await call(app, "/tasklists/remove-member", {
      session: mara.session,
      list,
      target: noah.user,
    });
    expect(removed).toEqual({ list });

    const rows = await inbox(app, noah.session);
    const losses = rows.filter((row) => row.kind === "task-list-removed");
    expect(losses).toHaveLength(1);
    expect(losses[0]).toMatchObject({ subject: list, link: list, read: false });

    const queued = await pending(app);
    const lossMail = queued.filter((message) => message.key === losses[0].notification);
    expect(lossMail).toHaveLength(1);
    expect(lossMail[0].text).toContain("Field Work");

    // every open task was released without adding any further announcement
    for (const task of [first, second, third]) {
      const held = await app.concepts.Tasking._getTask({ task, at: new Date() });
      expect(held[0].assignee).toBeNull();
    }
    expect(rows).toHaveLength(beforeRemoval + 1);
  });

  test("leaving and removing yourself say nothing", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_quiet");
    const noah = await actor(app, "noah_quiet");
    const priya = await actor(app, "priya_quiet");
    const list = await makeList(app, mara, "Quiet List");
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: priya.user,
    });

    const before = await pending(app);
    const left = await call(app, "/tasklists/leave", { session: noah.session, list });
    expect(left).toEqual({ list });
    expect(await inbox(app, noah.session)).toHaveLength(1); // only the earlier add

    const selfRemoved = await call(app, "/tasklists/remove-member", {
      session: priya.session,
      list,
      target: priya.user,
    });
    expect(selfRemoved).toEqual({ list });
    const priyaRows = await inbox(app, priya.session);
    expect(priyaRows.filter((row) => row.kind === "task-list-removed")).toEqual([]);

    expect(await pending(app)).toHaveLength(before.length);
  });
});

describe("task assignment notifications", () => {
  test("assigning to another member tells them, with task, list and deadline in the mail", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_assign");
    const noah = await actor(app, "noah_assign");
    const list = await makeList(app, mara, "Launch Plan");
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const task = await makeTask(app, mara.session, list, "Draft the brief");

    const assigned = await call(app, "/tasks/assign", {
      session: mara.session,
      task,
      assignee: noah.user,
    });
    expect(assigned).toEqual({ task });

    const rows = await inbox(app, noah.session);
    const assignment = rows.filter((row) => row.kind === "task-assigned");
    expect(assignment).toHaveLength(1);
    expect(assignment[0]).toMatchObject({ subject: task, link: task, read: false });
    expect(assignment[0].list).toBe(list);
    expect(assignment[0].listTitle).toBe("Launch Plan");
    expect(assignment[0].task).toMatchObject({ title: "Draft the brief", state: "OPEN" });

    const queued = await pending(app);
    const mail = queued.filter((message) => message.key === assignment[0].notification);
    expect(mail).toHaveLength(1);
    expect(mail[0].recipient).toBe(noah.email);
    expect(mail[0].subject).toContain("Draft the brief");
    expect(mail[0].text).toContain("Draft the brief");
    expect(mail[0].text).toContain("Launch Plan");
    expect(mail[0].text).toContain(WINDOW.endsAt);
  });

  test("assigning to yourself says nothing", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_self");
    const list = await makeList(app, mara, "Solo");
    const task = await makeTask(app, mara.session, list, "Mine");

    const assigned = await call(app, "/tasks/assign", {
      session: mara.session,
      task,
      assignee: mara.user,
    });
    expect(assigned).toEqual({ task });
    expect(await inbox(app, mara.session)).toEqual([]);
    expect(await pending(app)).toEqual([]);
  });

  test("assigning outside the list is still refused and tells nobody", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_out");
    const noah = await actor(app, "noah_out");
    const list = await makeList(app, mara, "Closed");
    const task = await makeTask(app, mara.session, list, "Held");

    const refused = await call(app, "/tasks/assign", {
      session: mara.session,
      task,
      assignee: noah.user,
    });
    expect(refused).toEqual({ error: "FORBIDDEN" });
    expect(await inbox(app, noah.session)).toEqual([]);
    expect(await pending(app)).toEqual([]);
  });

  test("assigning again to the person who already holds the task tells them again", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_again");
    const noah = await actor(app, "noah_again");
    const list = await makeList(app, mara, "Repeat");
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const task = await makeTask(app, mara.session, list, "Held twice");

    await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });
    await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });

    const rows = await inbox(app, noah.session);
    expect(rows.filter((row) => row.kind === "task-assigned")).toHaveLength(2);
    const keys = new Set((await pending(app)).map((message) => message.key));
    for (const row of rows.filter((entry) => entry.kind === "task-assigned")) {
      expect(keys.has(row.notification)).toBe(true);
    }
  });

  test("create, describe and release say nothing", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_silent");
    const noah = await actor(app, "noah_silent");
    const list = await makeList(app, mara, "Silent Ops");
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const task = await makeTask(app, mara.session, list, "Quiet");
    await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });

    const announced = (await inbox(app, noah.session)).length;
    const mailed = (await pending(app)).length;

    await makeTask(app, mara.session, list, "Another");
    await call(app, "/tasks/describe", {
      session: mara.session,
      task,
      title: "Quieter",
      details: "hush",
    });
    await call(app, "/tasks/release", { session: mara.session, task });

    const after = await inbox(app, noah.session);
    expect(after.filter((row) => row.kind === "task-assigned")).toHaveLength(1);
    expect(after).toHaveLength(announced);
    expect(await pending(app)).toHaveLength(mailed);
  });

  test("deleting a settled task tells nobody and leaves its archived row standing", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_del");
    const noah = await actor(app, "noah_del");
    const list = await makeList(app, mara, "Delete Ops");
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const task = await makeTask(app, mara.session, list, "Doomed");
    await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });
    await call(app, "/tasks/complete", { session: mara.session, task });

    const before = await inbox(app, noah.session);
    const mailedBefore = (await pending(app)).length;

    expect(await call(app, "/tasks/delete", { session: mara.session, task })).toEqual({
      ok: true,
    });

    const after = await inbox(app, noah.session);
    expect(after).toHaveLength(before.length);
    expect(await pending(app)).toHaveLength(mailedBefore);
  });
});

describe("changes to an assigned task", () => {
  const LATER = { startsAt: "2026-09-01T09:00:00.000Z", endsAt: "2026-09-02T17:00:00.000Z" };

  async function watchedTask(app: App, suffix: string) {
    const mara = await actor(app, `mara_${suffix}`);
    const noah = await actor(app, `noah_${suffix}`);
    const list = await makeList(app, mara, "State Ops");
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const task = await makeTask(app, mara.session, list, "Watched");
    await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });
    return { mara, noah, list, task };
  }

  /** Runs all five state operations in an order each of them accepts. */
  async function everyStateOperation(app: App, session: string, task: string) {
    return [
      await call(app, "/tasks/retime", { session, task, ...LATER }),
      await call(app, "/tasks/complete", { session, task }),
      await call(app, "/tasks/reopen", { session, task }),
      await call(app, "/tasks/cancel", { session, task }),
      await call(app, "/tasks/uncancel", { session, task }),
    ];
  }

  test("another member's retime, complete, reopen, cancel and uncancel each tell the assignee", async () => {
    const app = await newApp();
    const { mara, noah, task } = await watchedTask(app, "state");

    expect(await everyStateOperation(app, mara.session, task)).toEqual([
      { task },
      { task },
      { task },
      { task },
      { task },
    ]);

    const rows = await inbox(app, noah.session);
    const aboutTheTask = rows.filter((row) => row.kind !== "task-list-added");
    expect(aboutTheTask.map((row) => row.kind).sort()).toEqual(
      [
        "task-assigned",
        "task-canceled",
        "task-completed",
        "task-reopened",
        "task-retimed",
        "task-uncanceled",
      ].sort(),
    );
    for (const row of aboutTheTask) {
      expect(row).toMatchObject({ subject: task, link: task, read: false });
    }

    // exactly one message per notification, and the task message carries the new deadline
    const queued = await pending(app);
    expect(queued).toHaveLength(rows.length);
    expect(new Set(queued.map((message) => message.key))).toEqual(
      new Set(rows.map((row) => row.notification)),
    );
    const retimed = rows.find((row) => row.kind === "task-retimed");
    const retimedMail = queued.find((message) => message.key === retimed?.notification);
    expect(retimedMail?.text).toContain("Watched");
    expect(retimedMail?.text).toContain("State Ops");
    expect(retimedMail?.text).toContain(LATER.endsAt);
    expect(retimedMail?.text).not.toContain(WINDOW.endsAt);

    // the member who acted hears nothing about their own work
    expect(await inbox(app, mara.session)).toEqual([]);
  });

  test("the assignee's own five operations tell nobody", async () => {
    const app = await newApp();
    const { mara, noah, task } = await watchedTask(app, "selfstate");

    const announced = (await inbox(app, noah.session)).length;
    const mailed = (await pending(app)).length;

    expect(await everyStateOperation(app, noah.session, task)).toEqual([
      { task },
      { task },
      { task },
      { task },
      { task },
    ]);

    expect(await inbox(app, noah.session)).toHaveLength(announced);
    expect(await inbox(app, mara.session)).toEqual([]);
    expect(await pending(app)).toHaveLength(mailed);
  });

  test("an unassigned task tells nobody, however it is moved", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_free");
    const noah = await actor(app, "noah_free");
    const list = await makeList(app, mara, "Free Ops");
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const membershipMail = (await pending(app)).length;
    const task = await makeTask(app, mara.session, list, "Nobody's");

    expect(await everyStateOperation(app, mara.session, task)).toEqual([
      { task },
      { task },
      { task },
      { task },
      { task },
    ]);

    expect(await inbox(app, noah.session)).toHaveLength(1); // only the membership row
    expect(await inbox(app, mara.session)).toEqual([]);
    expect(await pending(app)).toHaveLength(membershipMail);
  });

  test("a revived task naming somebody who has left the list tells nobody", async () => {
    const app = await newApp();
    const { mara, noah, list, task } = await watchedTask(app, "left");

    await call(app, "/tasks/complete", { session: mara.session, task });
    // a settled task keeps its assignee, so the departure sweep leaves this one naming Noah
    await call(app, "/tasklists/remove-member", {
      session: mara.session,
      list,
      target: noah.user,
    });
    const held = await app.concepts.Tasking._getTask({ task, at: new Date() });
    expect(held[0].assignee).toBe(noah.user);

    const announced = (await inbox(app, noah.session)).length;
    const mailed = (await pending(app)).length;

    expect(await call(app, "/tasks/reopen", { session: mara.session, task })).toEqual({ task });
    expect(await call(app, "/tasks/cancel", { session: mara.session, task })).toEqual({ task });
    expect(await call(app, "/tasks/uncancel", { session: mara.session, task })).toEqual({ task });

    expect(await inbox(app, noah.session)).toHaveLength(announced);
    expect(await pending(app)).toHaveLength(mailed);
  });

  test("a refused state operation is refused identically and tells nobody", async () => {
    const app = await newApp();
    const { mara, noah, task } = await watchedTask(app, "refused");
    const outsider = await actor(app, "outsider_refused");

    const announced = (await inbox(app, noah.session)).length;
    const mailed = (await pending(app)).length;

    // Tasking's own refusals still come through distinguishably
    expect(await call(app, "/tasks/reopen", { session: mara.session, task })).toEqual({
      error: "TASK_NOT_COMPLETE",
    });
    expect(await call(app, "/tasks/uncancel", { session: mara.session, task })).toEqual({
      error: "TASK_NOT_CANCELED",
    });
    await call(app, "/tasks/cancel", { session: mara.session, task });
    expect(await call(app, "/tasks/cancel", { session: mara.session, task })).toEqual({
      error: "TASK_ALREADY_CANCELED",
    });
    expect(await call(app, "/tasks/retime", { session: mara.session, task, ...LATER })).toEqual({
      error: "TASK_CANCELED",
    });
    // and a non-member is still refused as forbidden
    expect(await call(app, "/tasks/uncancel", { session: outsider.session, task })).toEqual({
      error: "FORBIDDEN",
    });

    const rows = await inbox(app, noah.session);
    expect(rows.filter((row) => row.kind === "task-canceled")).toHaveLength(1);
    expect(rows).toHaveLength(announced + 1); // the one successful cancel, nothing more
    expect(await pending(app)).toHaveLength(mailed + 1);
  });
});

describe("the task inbox", () => {
  test("a row about a list the reader has left keeps its link and loses its content", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_gate");
    const noah = await actor(app, "noah_gate");
    const list = await makeList(app, mara, "Gated List");
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const task = await makeTask(app, mara.session, list, "Gated Task");
    await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });
    await call(app, "/tasklists/remove-member", {
      session: mara.session,
      list,
      target: noah.user,
    });

    const rows = await inbox(app, noah.session);
    const added = rows.find((row) => row.kind === "task-list-added");
    const assigned = rows.find((row) => row.kind === "task-assigned");
    const lost = rows.find((row) => row.kind === "task-list-removed");

    expect(added).toMatchObject({ subject: list, link: list, listTitle: null });
    expect(withoutTaskPresentation(added)).toEqual({ list: null, title: null });
    expect(assigned).toMatchObject({ subject: task, link: task, listTitle: null });
    expect(withoutTaskPresentation(assigned)).toEqual({ list: null, title: null });
    // the one exception: a membership-loss row still names the list it is about
    expect(lost).toMatchObject({ subject: list, link: list, listTitle: "Gated List" });
    expect(withoutTaskPresentation(lost)).toEqual({ list: null, title: null });
  });

  test("a row whose task has been deleted answers as a bare archived row", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_gone");
    const noah = await actor(app, "noah_gone");
    const list = await makeList(app, mara, "Vanishing");
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const task = await makeTask(app, mara.session, list, "Doomed");
    await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });
    await call(app, "/tasks/complete", { session: mara.session, task });
    await call(app, "/tasks/delete", { session: mara.session, task });

    const rows = await inbox(app, noah.session);
    const assigned = rows.find((row) => row.kind === "task-assigned");
    expect(assigned).toMatchObject({ subject: task, link: task, list: null, listTitle: null });
    expect(withoutTaskPresentation(assigned)).toEqual({ list: null, title: null });
  });

  test("unread count, mark read, mark all read and dismiss are the recipient's alone", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_read");
    const noah = await actor(app, "noah_read");
    const list = await makeList(app, mara, "Counted");
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const task = await makeTask(app, mara.session, list, "Counted Task");
    await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });

    expect(await call(app, "/tasknotifications/unreadCount", { session: noah.session })).toEqual({
      count: 2,
    });
    expect(await call(app, "/tasknotifications/unreadCount", { session: mara.session })).toEqual({
      count: 0,
    });

    const rows = await inbox(app, noah.session);
    const one = rows[0].notification;

    expect(
      await call(app, "/tasknotifications/markRead", {
        session: mara.session,
        notification: one,
      }),
    ).toEqual({ error: "NOTIFICATION_NOT_FOUND" });

    expect(
      await call(app, "/tasknotifications/markRead", {
        session: noah.session,
        notification: one,
      }),
    ).toEqual({ notification: one });
    expect(await call(app, "/tasknotifications/unreadCount", { session: noah.session })).toEqual({
      count: 1,
    });

    expect(await call(app, "/tasknotifications/markAllRead", { session: noah.session })).toEqual({
      recipient: noah.user,
    });
    expect(await call(app, "/tasknotifications/unreadCount", { session: noah.session })).toEqual({
      count: 0,
    });

    expect(
      await call(app, "/tasknotifications/dismiss", {
        session: mara.session,
        notification: one,
      }),
    ).toEqual({ error: "NOTIFICATION_NOT_FOUND" });
    expect(
      await call(app, "/tasknotifications/dismiss", {
        session: noah.session,
        notification: one,
      }),
    ).toEqual({ notification: one });
    expect(await inbox(app, noah.session)).toHaveLength(rows.length - 1);
  });
});

describe("the two notification instances stay apart", () => {
  test("a task notification queues its own mail and never the forum's generic one", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_apart");
    const noah = await actor(app, "noah_apart");
    const list = await makeList(app, mara, "Apart");

    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const taskMail = await pending(app);
    expect(taskMail).toHaveLength(1);
    expect(taskMail[0].subject).not.toBe("New Commons notification");

    // the forum instance holds none of it, and its own inbox stays empty
    expect(await app.concepts.Notifying._getInbox({ recipient: noah.user })).toEqual([]);
    expect(await app.concepts.TaskNotifying._getInbox({ recipient: noah.user })).toHaveLength(1);

    const forumNotification = await app.concepts.Notifying.notify({
      recipient: noah.user,
      kind: "reply",
      subject: "post-1",
      link: "post-1",
      at: new Date(),
    });
    await app.whenIdle();

    const both = await pending(app);
    expect(both).toHaveLength(2);
    const forumMail = both.filter((message) => message.key === forumNotification.notification);
    expect(forumMail).toHaveLength(1);
    expect(forumMail[0].subject).toBe("New Commons notification");
    // and the forum entry never reaches the task inbox
    expect(await inbox(app, noah.session)).toHaveLength(1);
  });

  test("a task settled and deleted before its message is built queues nothing", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_raced");
    const noah = await actor(app, "noah_raced");
    const list = await makeList(app, mara, "Raced");
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const task = await makeTask(app, mara.session, list, "Fleeting");
    await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });
    await call(app, "/tasks/complete", { session: mara.session, task });
    await call(app, "/tasks/delete", { session: mara.session, task });

    const mailed = (await pending(app)).length;
    // the notification the race would raise, built after the task is already gone
    const raised = await app.concepts.TaskNotifying.notify({
      recipient: noah.user,
      kind: "task-completed",
      subject: task,
      link: task,
      at: new Date(),
    });
    await app.whenIdle();

    expect((await pending(app)).filter((message) => message.key === raised.notification)).toEqual(
      [],
    );
    expect(await pending(app)).toHaveLength(mailed);
    const row = (await inbox(app, noah.session)).find(
      (entry) => entry.notification === raised.notification,
    );
    expect(row).toMatchObject({ kind: "task-completed", subject: task, read: false });
    expect(withoutTaskPresentation(row)).toEqual({ list: null, title: null });
  });

  test("a task message is withheld from a departed recipient while a membership message is not", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_gateemail");
    const noah = await actor(app, "noah_gateemail");
    const list = await makeList(app, mara, "Gated Mail");
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });
    const task = await makeTask(app, mara.session, list, "Left Behind");
    await call(app, "/tasklists/remove-member", {
      session: mara.session,
      list,
      target: noah.user,
    });

    const mailed = (await pending(app)).length;

    // the residue of a removal landing in the same instant as a task change
    const taskEvent = await app.concepts.TaskNotifying.notify({
      recipient: noah.user,
      kind: "task-completed",
      subject: task,
      link: task,
      at: new Date(),
    });
    await app.whenIdle();
    expect(
      (await pending(app)).filter((message) => message.key === taskEvent.notification),
    ).toEqual([]);
    expect(await pending(app)).toHaveLength(mailed);

    // and its inbox entry stands, contentless
    const residue = (await inbox(app, noah.session)).find(
      (entry) => entry.notification === taskEvent.notification,
    );
    expect(residue).toMatchObject({ kind: "task-completed", subject: task, read: false });
    expect(withoutTaskPresentation(residue)).toEqual({ list: null, title: null });
    expect(residue?.listTitle).toBeNull();

    // a membership message to the same non-member still names the list
    const membership = await app.concepts.TaskNotifying.notify({
      recipient: noah.user,
      kind: "task-list-removed",
      subject: list,
      link: list,
      at: new Date(),
    });
    await app.whenIdle();
    const membershipMail = (await pending(app)).filter(
      (message) => message.key === membership.notification,
    );
    expect(membershipMail).toHaveLength(1);
    expect(membershipMail[0].text).toContain("Gated Mail");
  });

  test("a task notification whose subject resolves through neither read queues nothing", async () => {
    const app = await newApp();
    const noah = await actor(app, "noah_nowhere");

    const raised = await app.concepts.TaskNotifying.notify({
      recipient: noah.user,
      kind: "task-assigned",
      subject: "00000000-0000-4000-8000-000000000000",
      link: "00000000-0000-4000-8000-000000000000",
      at: new Date(),
    });
    await app.whenIdle();

    expect(await pending(app)).toEqual([]);
    const rows = await inbox(app, noah.session);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      notification: raised.notification,
      kind: "task-assigned",
      read: false,
      listTitle: null,
    });
    expect(withoutTaskPresentation(rows[0])).toEqual({ list: null, title: null });
  });
});
