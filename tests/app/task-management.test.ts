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
    email,
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

describe("task management", () => {
  test("a profile's own tasks are the list whose only member is that profile", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara");

    const opened = await call(app, "/tasklists/open", {
      session: mara.session,
      members: [mara.user],
      title: "My work",
    });
    const list = String(opened.list);
    expect(list).toEqual(expect.any(String));

    const again = await call(app, "/tasklists/open", {
      session: mara.session,
      members: [mara.user],
      title: "Ignored on reopening",
    });
    expect(again.list).toBe(list);

    const created = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Read the chapter",
      ...WINDOW,
    });
    const task = String(created.task);

    const page = await call(app, "/tasklists/get", { session: mara.session, list });
    expect(page.list).toEqual(
      expect.objectContaining({
        list,
        title: "My work",
        members: [{ user: mara.user, displayName: "mara" }],
        present: [{ user: mara.user }],
        openTasks: 1,
      }),
    );
    expect(page.tasks).toEqual([
      expect.objectContaining({ task, title: "Read the chapter", state: "OPEN", assignee: null }),
    ]);

    expect(await call(app, "/tasks/complete", { session: mara.session, task })).toEqual({ task });
    const done = await call(app, "/tasklists/get", { session: mara.session, list });
    expect((done.tasks as { state: string }[])[0].state).toBe("DONE");
  });

  test("a time-blocked duty is read as an occupied window assigned to its holder", async () => {
    const app = await newApp();
    const staff = await actor(app, "staff_omar");
    const { list } = await call(app, "/tasklists/open", {
      session: staff.session,
      members: [staff.user],
      title: "Duties",
    });
    const { task } = await call(app, "/tasks/create", {
      session: staff.session,
      list,
      title: "Office hours",
      details: "Room 2-131",
      startsAt: "2026-09-01T20:00:00.000Z",
      endsAt: "2026-09-01T21:00:00.000Z",
    });
    expect(
      await call(app, "/tasks/assign", { session: staff.session, task, assignee: staff.user }),
    ).toEqual({ task });

    const mine = await call(app, "/tasks/mine", { session: staff.session });
    expect(mine.tasks).toEqual([
      expect.objectContaining({
        task,
        list,
        listTitle: "Duties",
        title: "Office hours",
        startsAt: "2026-09-01T20:00:00.000Z",
        endsAt: "2026-09-01T21:00:00.000Z",
        state: "OPEN",
      }),
    ]);
  });

  test("overdue follows the current moment rather than a stored flag", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_overdue");
    const { list } = await call(app, "/tasklists/open", {
      session: mara.session,
      members: [mara.user],
      title: "",
    });
    const { task } = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Late already",
      startsAt: "2020-01-01T00:00:00.000Z",
      endsAt: "2020-01-02T00:00:00.000Z",
    });
    await call(app, "/tasks/assign", { session: mara.session, task, assignee: mara.user });

    const before = await call(app, "/tasks/mine", { session: mara.session });
    expect((before.tasks as { overdue: boolean }[])[0].overdue).toBe(true);

    await call(app, "/tasks/retime", {
      session: mara.session,
      task,
      startsAt: "2099-01-01T00:00:00.000Z",
      endsAt: "2099-01-02T00:00:00.000Z",
    });
    const after = await call(app, "/tasks/mine", { session: mara.session });
    expect((after.tasks as { overdue: boolean }[])[0].overdue).toBe(false);
  });

  test("either member of a shared list may take, reassign, retime, and cancel its tasks", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_team");
    const noah = await actor(app, "noah_team");

    const { list } = await call(app, "/tasklists/open", {
      session: mara.session,
      members: [mara.user, noah.user],
      title: "Team project",
    });
    const { task } = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Write the report",
      ...WINDOW,
    });

    const seenByNoah = await call(app, "/tasklists/get", { session: noah.session, list });
    expect(seenByNoah.tasks).toEqual([expect.objectContaining({ task, assignee: null })]);

    expect(
      await call(app, "/tasks/assign", { session: noah.session, task, assignee: noah.user }),
    ).toEqual({ task });
    expect(
      await call(app, "/tasks/assign", { session: mara.session, task, assignee: mara.user }),
    ).toEqual({ task });
    expect(
      await call(app, "/tasks/retime", {
        session: noah.session,
        task,
        startsAt: "2026-08-20T16:00:00.000Z",
        endsAt: "2026-08-21T17:00:00.000Z",
      }),
    ).toEqual({ task });
    expect(await call(app, "/tasks/cancel", { session: noah.session, task })).toEqual({ task });

    const after = await call(app, "/tasklists/get", { session: mara.session, list });
    expect(after.tasks).toEqual([
      expect.objectContaining({
        task,
        state: "CANCELED",
        assignee: mara.user,
        startsAt: "2026-08-20T16:00:00.000Z",
        endsAt: "2026-08-21T17:00:00.000Z",
      }),
    ]);
  });

  test("a mistaken completion is reopened and the task is outstanding again", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_reopen");
    const { list } = await call(app, "/tasklists/open", {
      session: mara.session,
      members: [mara.user],
      title: "",
    });
    const { task } = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Wrong one",
      ...WINDOW,
    });
    await call(app, "/tasks/complete", { session: mara.session, task });
    expect(await call(app, "/tasks/cancel", { session: mara.session, task })).toEqual({
      error: "TASK_ALREADY_COMPLETE",
    });
    expect(await call(app, "/tasks/reopen", { session: mara.session, task })).toEqual({ task });

    const page = await call(app, "/tasklists/get", { session: mara.session, list });
    expect((page.tasks as { state: string }[])[0].state).toBe("OPEN");
    expect((page.list as { openTasks: number }).openTasks).toBe(1);
  });

  test("leaving releases held tasks, withdraws membership, and keeps the list's identity", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_leave");
    const noah = await actor(app, "noah_leave");

    const { list } = await call(app, "/tasklists/open", {
      session: mara.session,
      members: [mara.user, noah.user],
      title: "Shared",
    });
    const { task } = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Held by noah",
      ...WINDOW,
    });
    await call(app, "/tasks/assign", { session: mara.session, task, assignee: noah.user });

    expect(await call(app, "/tasklists/leave", { session: noah.session, list })).toEqual({ list });
    await app.whenIdle();

    expect(await call(app, "/tasks/mine", { session: noah.session })).toEqual({ tasks: [] });
    expect(await call(app, "/tasklists/mine", { session: noah.session })).toEqual({ lists: [] });
    expect(await call(app, "/tasklists/get", { session: noah.session, list })).toEqual({
      error: "FORBIDDEN",
    });
    expect(await call(app, "/tasklists/leave", { session: noah.session, list })).toEqual({
      error: "FORBIDDEN",
    });

    const kept = await call(app, "/tasklists/get", { session: mara.session, list });
    expect((kept.list as { members: unknown[]; present: unknown[] }).members).toHaveLength(2);
    expect((kept.list as { present: unknown[] }).present).toEqual([{ user: mara.user }]);
    expect(kept.tasks).toEqual([expect.objectContaining({ task, assignee: null, state: "OPEN" })]);

    const reopened = await call(app, "/tasklists/open", {
      session: mara.session,
      members: [noah.user, mara.user],
      title: "Shared",
    });
    expect(reopened.list).toBe(list);
    await app.whenIdle();
    expect(await call(app, "/tasklists/mine", { session: noah.session })).toEqual({
      lists: [expect.objectContaining({ list })],
    });
  });

  test("adding a member either takes the list along or starts a separate one", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_extend");
    const noah = await actor(app, "noah_extend");
    const priya = await actor(app, "priya_extend");

    const { list } = await call(app, "/tasklists/open", {
      session: mara.session,
      members: [mara.user, noah.user],
      title: "Pair",
    });
    await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Existing work",
      ...WINDOW,
    });

    expect(
      await call(app, "/tasklists/extend", {
        session: mara.session,
        list,
        members: [mara.user, noah.user, priya.user],
      }),
    ).toEqual({ list });
    await app.whenIdle();

    const taken = await call(app, "/tasklists/get", { session: priya.session, list });
    expect((taken.list as { members: unknown[] }).members).toHaveLength(3);
    expect(taken.tasks).toHaveLength(1);

    const separate = await call(app, "/tasklists/open", {
      session: mara.session,
      members: [mara.user, noah.user],
      title: "Pair again",
    });
    expect(separate.list).not.toBe(list);
    const fresh = await call(app, "/tasklists/get", { session: mara.session, list: separate.list });
    expect(fresh.tasks).toEqual([]);

    // Taking the separate list to the set the first list already holds is refused.
    expect(
      await call(app, "/tasklists/extend", {
        session: mara.session,
        list: separate.list,
        members: [priya.user],
      }),
    ).toEqual({ error: "CATEGORY_ALREADY_EXISTS" });
  });

  test("extending only ever enlarges the set a list is for", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_grow");
    const noah = await actor(app, "noah_grow");
    const priya = await actor(app, "priya_grow");

    const { list } = await call(app, "/tasklists/open", {
      session: mara.session,
      members: [mara.user, noah.user],
      title: "Pair",
    });
    // A request naming only the new member keeps everyone the list is already for.
    expect(
      await call(app, "/tasklists/extend", {
        session: mara.session,
        list,
        members: [priya.user],
      }),
    ).toEqual({ list });
    await app.whenIdle();

    const page = await call(app, "/tasklists/get", { session: priya.session, list });
    expect(
      ((page.list as { members: { user: string }[] }).members ?? [])
        .map((member) => member.user)
        .sort(),
    ).toEqual([mara.user, noah.user, priya.user].sort());
    expect(await call(app, "/tasklists/get", { session: noah.session, list })).toEqual(
      expect.objectContaining({ tasks: [] }),
    );
  });

  test("expected refusals", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_refusals");
    const outsider = await actor(app, "outsider_refusals");

    const { list } = await call(app, "/tasklists/open", {
      session: mara.session,
      members: [mara.user],
      title: "",
    });

    expect(
      await call(app, "/tasks/create", {
        session: mara.session,
        list,
        title: "Backwards",
        startsAt: "2026-08-19T17:00:00.000Z",
        endsAt: "2026-08-19T16:00:00.000Z",
      }),
    ).toEqual({ error: "TASK_WINDOW_INVALID" });

    const { task } = await call(app, "/tasks/create", {
      session: mara.session,
      list,
      title: "Fine",
      ...WINDOW,
    });

    expect(
      await call(app, "/tasks/retime", {
        session: mara.session,
        task,
        startsAt: "2026-08-19T17:00:00.000Z",
        endsAt: "2026-08-19T16:00:00.000Z",
      }),
    ).toEqual({ error: "TASK_WINDOW_INVALID" });

    expect(await call(app, "/tasks/complete", { session: outsider.session, task })).toEqual({
      error: "FORBIDDEN",
    });
    expect(
      await call(app, "/tasks/create", {
        session: outsider.session,
        list,
        title: "Not mine",
        ...WINDOW,
      }),
    ).toEqual({ error: "FORBIDDEN" });
    expect(await call(app, "/tasklists/get", { session: outsider.session, list })).toEqual({
      error: "FORBIDDEN",
    });
    expect(await call(app, "/tasklists/leave", { session: outsider.session, list })).toEqual({
      error: "FORBIDDEN",
    });
    expect(
      await call(app, "/tasks/assign", {
        session: mara.session,
        task,
        assignee: outsider.user,
      }),
    ).toEqual({ error: "FORBIDDEN" });

    await call(app, "/tasks/cancel", { session: mara.session, task });
    expect(await call(app, "/tasks/cancel", { session: mara.session, task })).toEqual({
      error: "TASK_ALREADY_CANCELED",
    });
    expect(await call(app, "/tasks/complete", { session: mara.session, task })).toEqual({
      error: "TASK_CANCELED",
    });

    expect(await call(app, "/tasks/complete", { session: mara.session, task: "ghost" })).toEqual({
      error: "FORBIDDEN",
    });
  });

  test("task-list membership shares no role space or store with course authorization", async () => {
    const app = await newApp();
    const mara = await actor(app, "mara_isolated");
    const { list } = await call(app, "/tasklists/open", {
      session: mara.session,
      members: [mara.user],
      title: "",
    });

    expect(await app.concepts.Roling._getRoleByName({ name: "task-list-member" })).toEqual([]);
    expect(
      await app.concepts.Roling._hasCapability({
        user: mara.user,
        context: String(list),
        capability: "tasks:manage",
      }),
    ).toEqual({ allowed: false });
    expect(
      await app.concepts.TaskListMembership._hasCapability({
        user: mara.user,
        context: String(list),
        capability: "tasks:manage",
      }),
    ).toEqual({ allowed: true });
    expect(
      await app.concepts.TaskListMembership._hasCapability({
        user: mara.user,
        context: "forum",
        capability: "administer",
      }),
    ).toEqual({ allowed: false });
  });
});
