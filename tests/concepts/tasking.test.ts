import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/tasking/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoTaskingConcept } from "../../src/concepts/tasking/tasking.mongo.ts";

const floors: [string, () => Promise<MongoTaskingConcept>][] = [
  ["on MongoDB", async () => new MongoTaskingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

const at = new Date("2026-08-19T12:00:00.000Z");
const later = new Date("2026-08-25T12:00:00.000Z");
const window = { startsAt: "2026-08-19T16:00:00.000Z", endsAt: "2026-08-19T17:00:00.000Z" };

const draft = {
  scope: "list-1",
  title: "Draft the reading",
  details: "Two pages",
  ...window,
  assignee: null,
  at,
};

for (const [floor, make] of floors) {
  describe(`Tasking ${floor}`, () => {
    test("create records a task with its window, open and unassigned", async () => {
      const tasking = await make();
      const { task } = await tasking.create(draft);
      expect(await tasking._getTask({ task, at })).toEqual([
        {
          scope: "list-1",
          title: "Draft the reading",
          details: "Two pages",
          ...window,
          assignee: null,
          state: "OPEN",
          overdue: false,
          createdAt: at,
          updatedAt: at,
        },
      ]);
      expect(await tasking._getTasksInScope({ scope: "list-1", at })).toEqual([
        expect.objectContaining({ task, title: "Draft the reading" }),
      ]);
      expect(await tasking._getTask({ task: "ghost", at })).toEqual([]);
    });

    test("describe edits title and details while not canceled", async () => {
      const tasking = await make();
      const { task } = await tasking.create(draft);
      expect(
        await tasking.describe({
          task,
          title: "Updated reading",
          details: "Three pages",
          at: later,
        }),
      ).toEqual({ task });
      expect((await tasking._getTask({ task, at }))[0]).toMatchObject({
        title: "Updated reading",
        details: "Three pages",
        updatedAt: later,
      });

      await tasking.cancel({ task, at: later });
      expect(
        await refusalOf(() =>
          tasking.describe({ task, title: "After cancel", details: "", at: later }),
        ),
      ).toBeInstanceOf(refusalErrors.TaskCanceled);
    });

    test("create refuses a window that ends before it begins or cannot be read", async () => {
      const tasking = await make();
      expect(
        await refusalOf(() =>
          tasking.create({ ...draft, startsAt: window.endsAt, endsAt: window.startsAt }),
        ),
      ).toBeInstanceOf(refusalErrors.TaskWindowInvalid);
      expect(
        await refusalOf(() => tasking.create({ ...draft, endsAt: "not a moment" })),
      ).toBeInstanceOf(refusalErrors.TaskWindowInvalid);
    });

    test("retime replaces the window and refuses an unknown task or a backwards window", async () => {
      const tasking = await make();
      const { task } = await tasking.create(draft);
      expect(
        await tasking.retime({
          task,
          startsAt: "2026-09-01T09:00:00.000Z",
          endsAt: "2026-09-01T10:00:00.000Z",
          at: later,
        }),
      ).toEqual({ task });
      expect((await tasking._getTask({ task, at }))[0]).toMatchObject({
        startsAt: "2026-09-01T09:00:00.000Z",
        endsAt: "2026-09-01T10:00:00.000Z",
        updatedAt: later,
      });
      expect(
        await refusalOf(() => tasking.retime({ task: "ghost", ...window, at })),
      ).toBeInstanceOf(refusalErrors.TaskNotFound);
      expect(
        await refusalOf(() =>
          tasking.retime({ task, startsAt: window.endsAt, endsAt: window.startsAt, at }),
        ),
      ).toBeInstanceOf(refusalErrors.TaskWindowInvalid);
    });

    test("assign overwrites the assignee and release clears it", async () => {
      const tasking = await make();
      const { task } = await tasking.create(draft);
      await tasking.assign({ task, assignee: "mara", at });
      expect(await tasking._getAssigned({ assignee: "mara", at })).toEqual([
        expect.objectContaining({ task, scope: "list-1", state: "OPEN", overdue: false }),
      ]);
      await tasking.assign({ task, assignee: "noah", at });
      expect(await tasking._getAssigned({ assignee: "mara", at })).toEqual([]);
      expect(await tasking.release({ task, at })).toEqual({ task });
      expect(await tasking._getAssigned({ assignee: "noah", at })).toEqual([]);
      expect(await refusalOf(() => tasking.release({ task: "ghost", at }))).toBeInstanceOf(
        refusalErrors.TaskNotFound,
      );
      expect(
        await refusalOf(() => tasking.assign({ task: "ghost", assignee: "mara", at })),
      ).toBeInstanceOf(refusalErrors.TaskNotFound);
    });

    test("complete and reopen move a task between open and done", async () => {
      const tasking = await make();
      const { task } = await tasking.create(draft);
      expect(await refusalOf(() => tasking.reopen({ task, at }))).toBeInstanceOf(
        refusalErrors.TaskNotComplete,
      );
      expect(await tasking.complete({ task, at })).toEqual({ task });
      expect((await tasking._getTask({ task, at }))[0]).toMatchObject({ state: "DONE" });
      expect(await refusalOf(() => tasking.complete({ task, at }))).toBeInstanceOf(
        refusalErrors.TaskAlreadyComplete,
      );
      expect(await tasking.reopen({ task, at })).toEqual({ task });
      expect((await tasking._getTask({ task, at }))[0]).toMatchObject({ state: "OPEN" });
    });

    test("cancel keeps the window and assignee and refuses a completed or canceled task", async () => {
      const tasking = await make();
      const { task: done } = await tasking.create(draft);
      await tasking.complete({ task: done, at });
      expect(await refusalOf(() => tasking.cancel({ task: done, at }))).toBeInstanceOf(
        refusalErrors.TaskAlreadyComplete,
      );

      const { task } = await tasking.create({ ...draft, assignee: "mara" });
      expect(await tasking.cancel({ task, at })).toEqual({ task });
      expect((await tasking._getTask({ task, at }))[0]).toMatchObject({
        state: "CANCELED",
        assignee: "mara",
        ...window,
      });
      expect(await refusalOf(() => tasking.cancel({ task, at }))).toBeInstanceOf(
        refusalErrors.TaskAlreadyCanceled,
      );
      for (const act of [
        () => tasking.complete({ task, at }),
        () => tasking.reopen({ task, at }),
        () => tasking.assign({ task, assignee: "noah", at }),
        () => tasking.release({ task, at }),
      ]) {
        expect(await refusalOf(act)).toBeInstanceOf(refusalErrors.TaskCanceled);
      }
      expect(await refusalOf(() => tasking.cancel({ task: "ghost", at }))).toBeInstanceOf(
        refusalErrors.TaskNotFound,
      );
    });

    test("overdue answers from the supplied moment, and only while a task is open", async () => {
      const tasking = await make();
      const { task } = await tasking.create({ ...draft, assignee: "mara" });
      expect((await tasking._getTask({ task, at }))[0]).toMatchObject({ overdue: false });
      expect((await tasking._getTask({ task, at: later }))[0]).toMatchObject({ overdue: true });
      expect(await tasking._getAssigned({ assignee: "mara", at: later })).toEqual([
        expect.objectContaining({ overdue: true }),
      ]);
      await tasking.complete({ task, at: later });
      expect((await tasking._getTask({ task, at: later }))[0]).toMatchObject({ overdue: false });
    });

    test("assigned tasks answer in creation order", async () => {
      const tasking = await make();
      const { task: first } = await tasking.create({ ...draft, assignee: "mara", title: "One" });
      const { task: second } = await tasking.create({ ...draft, assignee: "mara", title: "Two" });
      expect((await tasking._getAssigned({ assignee: "mara", at })).map((row) => row.task)).toEqual(
        [first, second],
      );
    });
  });
}
