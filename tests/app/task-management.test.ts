import { afterAll, describe, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { assembleCommons } from "../../src/assembly/application.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

type App = ReturnType<typeof assembleCommons>;

async function actor(app: App, username: string) {
  const email = `${username}@example.edu`;
  const registered = await app.concepts.Authenticating.register({
    username,
    password: "password123",
    email,
  });
  await app.concepts.Profiling.createProfile({
    user: registered.user,
    displayName: username,
  });
  const login = await app.invoker.invoke("/auth/login", {
    username,
    password: "password123",
  } as never);
  if (!login.ok) throw new Error(`could not create ${username}`);
  return { user: registered.user, session: (login.value as { session: string }).session };
}

function answer(result: Awaited<ReturnType<App["invoker"]["invoke"]>>) {
  return result.ok
    ? (result.value as Record<string, unknown>)
    : { error: result.error.kind === "domain" ? result.error.value : result.error.code };
}

async function call(app: App, path: string, body: Record<string, unknown>) {
  return answer(await app.invoker.invoke(path as never, body as never));
}

const WINDOW = { startsAt: "2026-08-19T16:00:00.000Z", endsAt: "2026-08-19T17:00:00.000Z" };

async function newApp() {
  return assembleCommons(mongoImplementations(await testDb()));
}

afterAll(stopTestDb);

describe("collaborative task lists management", () => {
  test("creating two lists produces distinct independent lists", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara");

    const created1 = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "Team Project",
    });
    const list1 = String(created1.list);
    expect(list1).toEqual(expect.any(String));

    const created2 = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "Team Project",
    });
    const list2 = String(created2.list);
    expect(list2).toEqual(expect.any(String));
    expect(list1).not.toBe(list2);

    const taskCreated = await call(app, "/tasks/create", {
      session: mara.session,
      list: list1,
      title: "Task in List 1",
      ...WINDOW,
    });
    const task = String(taskCreated.task);

    const page1 = await call(app, "/tasklists/get", { session: mara.session, list: list1 });
    expect(page1.tasks).toEqual([
      expect.objectContaining({ task, title: "Task in List 1", state: "OPEN" }),
    ]);

    const page2 = await call(app, "/tasklists/get", { session: mara.session, list: list2 });
    expect(page2.tasks).toEqual([]);
  });

  test("any member can rename a list", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_rename");
    const noah = await actor(app, "noah_rename");

    const { list } = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "Draft Title",
    });
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });

    const renamed = await call(app, "/tasklists/rename", {
      session: noah.session,
      list,
      title: "Renamed by Noah",
    });
    expect(renamed).toEqual({ list });

    const page = await call(app, "/tasklists/get", { session: mara.session, list });
    expect((page.list as { title: string }).title).toBe("Renamed by Noah");
  });

  test("any member can add, remove, or leave, with equal authority", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_collab");
    const noah = await actor(app, "noah_collab");
    const priya = await actor(app, "priya_collab");

    const { list } = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "Shared Board",
    });
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });

    // Noah adds Priya
    expect(
      await call(app, "/tasklists/add-member", {
        session: noah.session,
        list,
        candidate: priya.user,
      }),
    ).toEqual({ list });

    const pageBefore = await call(app, "/tasklists/get", { session: mara.session, list });
    expect((pageBefore.list as { members: { user: string }[] }).members).toHaveLength(3);

    // Noah creates task, Priya assigns to Noah, Mara edits description
    const { task } = await call(app, "/tasks/create", {
      session: noah.session,
      list,
      title: "Initial title",
      details: "Initial details",
      ...WINDOW,
    });

    expect(
      await call(app, "/tasks/assign", { session: priya.session, task, assignee: noah.user }),
    ).toEqual({ task });

    expect(
      await call(app, "/tasks/describe", {
        session: mara.session,
        task,
        title: "Edited title",
        details: "Markdown **details**",
      }),
    ).toEqual({ task });

    const taskPage = await call(app, "/tasklists/get", { session: priya.session, list });
    expect((taskPage.tasks as { title: string; details: string; assignee: string }[])[0]).toEqual(
      expect.objectContaining({
        title: "Edited title",
        details: "Markdown **details**",
        assignee: noah.user,
      }),
    );

    // Noah removes Priya
    expect(
      await call(app, "/tasklists/remove-member", {
        session: noah.session,
        list,
        target: priya.user,
      }),
    ).toEqual({ list });

    expect(await call(app, "/tasklists/get", { session: priya.session, list })).toEqual({
      error: "FORBIDDEN",
    });
  });

  test("leaving or removal releases open tasks and preserves done/canceled task history", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_lin");
    const noah = await actor(app, "noah_lin");

    const { list } = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "Linearization List",
    });
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });

    const { task: openTask } = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Open Task",
      ...WINDOW,
    });
    await call(app, "/tasks/assign", {
      session: mara.session,
      task: openTask,
      assignee: noah.user,
    });

    const { task: doneTask } = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Done Task",
      ...WINDOW,
    });
    await call(app, "/tasks/assign", {
      session: mara.session,
      task: doneTask,
      assignee: noah.user,
    });
    await call(app, "/tasks/complete", { session: mara.session, task: doneTask });

    const { task: canceledTask } = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Canceled Task",
      ...WINDOW,
    });
    await call(app, "/tasks/assign", {
      session: mara.session,
      task: canceledTask,
      assignee: noah.user,
    });
    await call(app, "/tasks/cancel", { session: mara.session, task: canceledTask });

    // Noah leaves
    expect(await call(app, "/tasklists/leave", { session: noah.session, list })).toEqual({ list });
    await app.whenIdle();

    const kept = await call(app, "/tasklists/get", { session: mara.session, list });
    const tasks = kept.tasks as { task: string; assignee: string | null; state: string }[];
    const openRow = tasks.find((t) => t.task === openTask);
    const doneRow = tasks.find((t) => t.task === doneTask);
    const canceledRow = tasks.find((t) => t.task === canceledTask);

    expect(openRow).toEqual(expect.objectContaining({ state: "OPEN", assignee: null }));
    expect(doneRow).toEqual(expect.objectContaining({ state: "DONE", assignee: noah.user }));
    expect(canceledRow).toEqual(
      expect.objectContaining({ state: "CANCELED", assignee: noah.user }),
    );
  });

  test("last remaining member cannot leave or be removed", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_last");

    const { list } = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "Solo List",
    });

    expect(await call(app, "/tasklists/leave", { session: mara.session, list })).toEqual({
      error: "LAST_MEMBER",
    });
    expect(
      await call(app, "/tasklists/remove-member", {
        session: mara.session,
        list,
        target: mara.user,
      }),
    ).toEqual({ error: "LAST_MEMBER" });
  });

  test("tasks/mine returns open tasks across lists the user belongs to ordered by due time", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_mine");

    const { list: listA } = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "List A",
    });
    const { list: listB } = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "List B",
    });

    const { task: taskLater } = await call(app, "/tasks/create", {
      session: mara.session,
      list: listA,
      title: "Due Later",
      startsAt: "2026-08-19T10:00:00.000Z",
      endsAt: "2026-08-19T18:00:00.000Z",
    });
    await call(app, "/tasks/assign", {
      session: mara.session,
      task: taskLater,
      assignee: mara.user,
    });

    const { task: taskSooner } = await call(app, "/tasks/create", {
      session: mara.session,
      list: listB,
      title: "Due Sooner",
      startsAt: "2026-08-19T10:00:00.000Z",
      endsAt: "2026-08-19T14:00:00.000Z",
    });
    await call(app, "/tasks/assign", {
      session: mara.session,
      task: taskSooner,
      assignee: mara.user,
    });

    const mine = await call(app, "/tasks/mine", { session: mara.session });
    const mineTasks = mine.tasks as { task: string; title: string }[];
    expect(mineTasks.map((t) => t.task)).toEqual([taskSooner, taskLater]);
  });

  test("retime, release, and reopen endpoints operate correctly for members", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_ops");
    const noah = await actor(app, "noah_ops");

    const { list } = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "Ops List",
    });
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });

    const { task } = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Ops Task",
      ...WINDOW,
    });

    // Retime
    const retimed = await call(app, "/tasks/retime", {
      session: noah.session,
      task,
      startsAt: "2026-08-20T09:00:00.000Z",
      endsAt: "2026-08-20T17:00:00.000Z",
    });
    expect(retimed).toEqual({ task });

    // Assign then release
    await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });
    const released = await call(app, "/tasks/release", { session: noah.session, task });
    expect(released).toEqual({ task });

    // Complete then reopen
    const completed = await call(app, "/tasks/complete", { session: mara.session, task });
    expect(completed).toEqual({ task });
    const reopened = await call(app, "/tasks/reopen", { session: noah.session, task });
    expect(reopened).toEqual({ task });

    const page = await call(app, "/tasklists/get", { session: mara.session, list });
    expect(page.tasks).toEqual([
      expect.objectContaining({
        task,
        startsAt: "2026-08-20T09:00:00.000Z",
        endsAt: "2026-08-20T17:00:00.000Z",
        assignee: null,
        state: "OPEN",
      }),
    ]);
  });

  test("leaving or being removed from a list removes its tasks from cross-list /tasks/mine read", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_mine_leave");
    const noah = await actor(app, "noah_mine_leave");

    const { list: listA } = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "List A",
    });
    const { list: listB } = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "List B",
    });

    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list: listA,
      candidate: noah.user,
    });
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list: listB,
      candidate: noah.user,
    });

    const { task: taskA } = await call(app, "/tasks/create", {
      session: mara.session,
      list: listA,
      title: "Task in A",
      ...WINDOW,
    });
    await call(app, "/tasks/assign", { session: mara.session, task: taskA, assignee: noah.user });

    const { task: taskB } = await call(app, "/tasks/create", {
      session: mara.session,
      list: listB,
      title: "Task in B",
      ...WINDOW,
    });
    await call(app, "/tasks/assign", { session: mara.session, task: taskB, assignee: noah.user });

    const mineInitial = await call(app, "/tasks/mine", { session: noah.session });
    const initialTaskIds = (mineInitial.tasks as { task: string }[]).map((t) => t.task);
    expect(initialTaskIds).toContain(taskA);
    expect(initialTaskIds).toContain(taskB);

    // Noah leaves List A
    await call(app, "/tasklists/leave", { session: noah.session, list: listA });

    const mineAfter = await call(app, "/tasks/mine", { session: noah.session });
    const afterTaskIds = (mineAfter.tasks as { task: string }[]).map((t) => t.task);
    expect(afterTaskIds).not.toContain(taskA);
    expect(afterTaskIds).toContain(taskB);
  });

  test("state survives application restart in MongoDB", async () => {
    const db = await testDb();
    const app1 = assembleCommons(mongoImplementations(db));
    const mara = await actor(app1, "mara_restart");
    const noah = await actor(app1, "noah_restart");

    const { list } = await call(app1, "/tasklists/create", {
      session: mara.session,
      title: "Durable List",
    });
    await call(app1, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });

    const { task } = await call(app1, "/tasks/create", {
      session: mara.session,
      list,
      title: "Durable Task",
      details: "Must survive restart",
      ...WINDOW,
    });
    await call(app1, "/tasks/assign", { session: mara.session, task, assignee: noah.user });

    // Restart application by instantiating new assembly over same db
    const app2 = assembleCommons(mongoImplementations(db));

    const page = await call(app2, "/tasklists/get", { session: mara.session, list });
    expect((page.list as { title: string }).title).toBe("Durable List");
    expect((page.list as { members: { user: string }[] }).members).toHaveLength(2);
    expect(page.tasks).toEqual([
      expect.objectContaining({
        task,
        title: "Durable Task",
        details: "Must survive restart",
        assignee: noah.user,
        state: "OPEN",
      }),
    ]);

    // Perform lifecycle transition on second instance
    const completed = await call(app2, "/tasks/complete", { session: noah.session, task });
    expect(completed).toEqual({ task });

    const pageUpdated = await call(app2, "/tasklists/get", { session: mara.session, list });
    expect(pageUpdated.tasks).toEqual([
      expect.objectContaining({
        task,
        state: "DONE",
      }),
    ]);
  });

  test("expected refusals", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_ref");
    const outsider = await actor(app, "outsider_ref");

    const { list } = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "Refusals List",
    });

    // Invalid window
    expect(
      await call(app, "/tasks/create", {
        session: mara.session,
        list,
        title: "Bad window",
        startsAt: "2026-08-19T17:00:00.000Z",
        endsAt: "2026-08-19T16:00:00.000Z",
      }),
    ).toEqual({ error: "TASK_WINDOW_INVALID" });

    // Valid task
    const { task } = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Valid task",
      ...WINDOW,
    });

    // Outsider cannot act
    expect(await call(app, "/tasklists/get", { session: outsider.session, list })).toEqual({
      error: "FORBIDDEN",
    });
    expect(await call(app, "/tasks/complete", { session: outsider.session, task })).toEqual({
      error: "FORBIDDEN",
    });
    expect(
      await call(app, "/tasks/describe", {
        session: outsider.session,
        task,
        title: "Hack",
        details: "",
      }),
    ).toEqual({ error: "FORBIDDEN" });

    // Assigning outsider refused
    expect(
      await call(app, "/tasks/assign", {
        session: mara.session,
        task,
        assignee: outsider.user,
      }),
    ).toEqual({ error: "FORBIDDEN" });

    // Adding already member refused
    expect(
      await call(app, "/tasklists/add-member", {
        session: mara.session,
        list,
        candidate: mara.user,
      }),
    ).toEqual({ error: "ALREADY_A_MEMBER" });

    // Adding nonexistent user refused
    expect(
      await call(app, "/tasklists/add-member", {
        session: mara.session,
        list,
        candidate: "nonexistent-user-id",
      }),
    ).toEqual({ error: "NOT_FOUND" });

    // Cancel workflow
    await call(app, "/tasks/cancel", { session: mara.session, task });
    expect(await call(app, "/tasks/cancel", { session: mara.session, task })).toEqual({
      error: "TASK_ALREADY_CANCELED",
    });
    expect(await call(app, "/tasks/complete", { session: mara.session, task })).toEqual({
      error: "TASK_CANCELED",
    });
    expect(
      await call(app, "/tasks/describe", {
        session: mara.session,
        task,
        title: "Try edit",
        details: "",
      }),
    ).toEqual({ error: "TASK_CANCELED" });
  });

  test("a member uncancels a canceled task, keeping its window, text, and assignee", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_uncancel");
    const noah = await actor(app, "noah_uncancel");

    const { list } = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "Uncancel List",
    });
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });

    const { task } = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Revivable Task",
      details: "the original details",
      ...WINDOW,
    });
    await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });
    expect(await call(app, "/tasks/cancel", { session: mara.session, task })).toEqual({ task });

    const canceledPage = await call(app, "/tasklists/get", { session: mara.session, list });
    expect((canceledPage.list as { openTasks: number }).openTasks).toBe(0);

    // Any member, not only the one who canceled, may take the cancellation back.
    expect(await call(app, "/tasks/uncancel", { session: noah.session, task })).toEqual({ task });

    const page = await call(app, "/tasklists/get", { session: mara.session, list });
    expect(page.tasks).toEqual([
      expect.objectContaining({
        task,
        title: "Revivable Task",
        details: "the original details",
        startsAt: WINDOW.startsAt,
        endsAt: WINDOW.endsAt,
        assignee: noah.user,
        state: "OPEN",
      }),
    ]);
    // The list counts the revived task as outstanding work again.
    expect((page.list as { openTasks: number }).openTasks).toBe(1);
  });

  test("a member deletes settled tasks, and they disappear from the list and from /tasks/mine", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_delete");
    const noah = await actor(app, "noah_delete");

    const { list } = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "Delete List",
    });
    await call(app, "/tasklists/add-member", {
      session: mara.session,
      list,
      candidate: noah.user,
    });

    const settled: Record<string, string> = {};
    for (const title of ["Done Task", "Canceled Task", "Open Task"]) {
      const { task } = await call(app, "/tasks/create", {
        session: mara.session,
        list,
        title,
        ...WINDOW,
      });
      await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });
      settled[title] = String(task);
    }
    await call(app, "/tasks/complete", { session: mara.session, task: settled["Done Task"] });
    await call(app, "/tasks/cancel", { session: mara.session, task: settled["Canceled Task"] });

    // An outstanding task cannot be removed in one step, and survives the attempt.
    expect(
      await call(app, "/tasks/delete", { session: mara.session, task: settled["Open Task"] }),
    ).toEqual({ error: "TASK_NOT_SETTLED" });

    expect(
      await call(app, "/tasks/delete", { session: noah.session, task: settled["Done Task"] }),
    ).toEqual({ ok: true });
    expect(
      await call(app, "/tasks/delete", { session: mara.session, task: settled["Canceled Task"] }),
    ).toEqual({ ok: true });

    const page = await call(app, "/tasklists/get", { session: mara.session, list });
    expect(page.tasks).toEqual([
      expect.objectContaining({ task: settled["Open Task"], title: "Open Task", state: "OPEN" }),
    ]);

    const mine = await call(app, "/tasks/mine", { session: noah.session });
    expect(mine.tasks).toEqual([
      expect.objectContaining({ task: settled["Open Task"], title: "Open Task" }),
    ]);
  });

  test("delete and uncancel refuse a non-member, and a repeated delete", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_del_ref");
    const outsider = await actor(app, "outsider_del_ref");

    const { list } = await call(app, "/tasklists/create", {
      session: mara.session,
      title: "Delete Refusals List",
    });

    const { task } = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Settled Task",
      ...WINDOW,
    });
    await call(app, "/tasks/cancel", { session: mara.session, task });

    expect(await call(app, "/tasks/uncancel", { session: outsider.session, task })).toEqual({
      error: "FORBIDDEN",
    });
    expect(await call(app, "/tasks/delete", { session: outsider.session, task })).toEqual({
      error: "FORBIDDEN",
    });

    // Tasking's own refusals still reach the caller distinguishably.
    await call(app, "/tasks/uncancel", { session: mara.session, task });
    expect(await call(app, "/tasks/uncancel", { session: mara.session, task })).toEqual({
      error: "TASK_NOT_CANCELED",
    });
    await call(app, "/tasks/complete", { session: mara.session, task });
    expect(await call(app, "/tasks/uncancel", { session: mara.session, task })).toEqual({
      error: "TASK_ALREADY_COMPLETE",
    });

    expect(await call(app, "/tasks/delete", { session: mara.session, task })).toEqual({ ok: true });
    // A second delete names a task no readable list holds, so it is answered exactly
    // as a non-member is, with no distinguishable "already removed".
    expect(await call(app, "/tasks/delete", { session: mara.session, task })).toEqual({
      error: "FORBIDDEN",
    });
  });
});
