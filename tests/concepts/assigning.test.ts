import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/assigning/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoAssigningConcept } from "../../src/concepts/assigning/assigning.mongo.ts";

const floors: [string, () => Promise<MongoAssigningConcept>][] = [
  ["on MongoDB", async () => new MongoAssigningConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

const T0 = new Date("2026-01-01T00:00:00Z");
const T1 = new Date("2026-01-02T00:00:00Z");

const draftInput = (audience: "EVERYONE" | "TARGETS" = "EVERYONE", targets: string[] = []) => ({
  author: "dana",
  title: "Problem set 1",
  instructions: "Do the problems.",
  kind: "homework",
  availableAt: "2026-01-05",
  dueAt: "2026-01-12",
  closeAt: "2026-01-14",
  acceptsSubmissions: true,
  audience,
  targets,
  at: T0,
});

for (const [floor, make] of floors) {
  describe(`Assigning ${floor}`, () => {
    test("createDraft makes a draft and publish returns its audience roles", async () => {
      const c = await make();
      const { assignment } = await c.createDraft(draftInput("TARGETS", ["sec-a", "sec-b"]));
      expect((await c._getDetail({ assignment }))[0]?.detail.status).toBe("DRAFT");

      const out = await c.publish({ assignment, at: T1 });
      expect(out).toEqual({
        assignment,
        audience: "TARGETS",
        targets: ["sec-a", "sec-b"],
        acceptsSubmissions: true,
      });
      expect((await c._getDetail({ assignment }))[0]?.detail.status).toBe("PUBLISHED");
    });

    test("createDraft refuses an unsupported or mismatched audience", async () => {
      const c = await make();
      expect(await refusal(() => c.createDraft(draftInput("OTHER" as "EVERYONE")))).toBeInstanceOf(
        refusalErrors.AssignmentAudienceInvalid,
      );
      expect(await refusal(() => c.createDraft(draftInput("EVERYONE", ["sec-a"])))).toBeInstanceOf(
        refusalErrors.AssignmentEveryoneNoTargets,
      );
      expect(await refusal(() => c.createDraft(draftInput("TARGETS", [])))).toBeInstanceOf(
        refusalErrors.AssignmentTargetsRequired,
      );
    });

    test("revise updates the draft and returns its audience roles", async () => {
      const c = await make();
      const { assignment } = await c.createDraft(draftInput());
      const out = await c.revise({
        ...draftInput("TARGETS", ["sec-c"]),
        assignment,
        title: "Problem set 1 (revised)",
        at: T1,
      });
      expect(out).toEqual({
        assignment,
        status: "DRAFT",
        audience: "TARGETS",
        targets: ["sec-c"],
        acceptsSubmissions: true,
      });
      expect((await c._getDetail({ assignment }))[0]?.detail.title).toBe("Problem set 1 (revised)");
    });

    test("revise refuses an unknown, archived, or differently addressed assignment", async () => {
      const c = await make();
      expect(
        await refusal(() => c.revise({ ...draftInput(), assignment: "missing", at: T1 })),
      ).toBeInstanceOf(refusalErrors.AssignmentNotFound);

      const { assignment } = await c.createDraft(draftInput());
      expect(
        await refusal(() => c.revise({ ...draftInput("EVERYONE", ["sec-a"]), assignment, at: T1 })),
      ).toBeInstanceOf(refusalErrors.AssignmentEveryoneNoTargets);
      expect(
        await refusal(() => c.revise({ ...draftInput("TARGETS", []), assignment, at: T1 })),
      ).toBeInstanceOf(refusalErrors.AssignmentTargetsRequired);
      expect(
        await refusal(() => c.revise({ ...draftInput("OTHER" as "EVERYONE"), assignment, at: T1 })),
      ).toBeInstanceOf(refusalErrors.AssignmentAudienceInvalid);

      await c.archive({ assignment, at: T1 });
      expect(await refusal(() => c.revise({ ...draftInput(), assignment, at: T1 }))).toBeInstanceOf(
        refusalErrors.AssignmentNotRevisable,
      );
    });

    test("publish refuses: not found, not a draft", async () => {
      const c = await make();
      expect(await refusal(() => c.publish({ assignment: "missing", at: T1 }))).toBeInstanceOf(
        refusalErrors.AssignmentNotFound,
      );
      const { assignment } = await c.createDraft(draftInput());
      await c.publish({ assignment, at: T1 });
      expect(await refusal(() => c.publish({ assignment, at: T1 }))).toBeInstanceOf(
        refusalErrors.AssignmentNotDraft,
      );
    });

    test("archive accepts any known assignment and refuses an unknown one", async () => {
      const c = await make();
      expect(await refusal(() => c.archive({ assignment: "missing", at: T1 }))).toBeInstanceOf(
        refusalErrors.AssignmentNotFound,
      );
      const { assignment } = await c.createDraft(draftInput());
      expect(await c.archive({ assignment, at: T1 })).toEqual({ assignment });
      expect((await c._getDetail({ assignment }))[0]?.detail.status).toBe("ARCHIVED");
    });

    test("_getAssignments reads every standing in creation order", async () => {
      const c = await make();
      const first = (await c.createDraft(draftInput())).assignment;
      const second = (await c.createDraft({ ...draftInput(), title: "Problem set 2" })).assignment;
      await c.publish({ assignment: first, at: T1 });
      await c.archive({ assignment: second, at: T1 });

      expect(
        (await c._getAssignments()).map(({ assignment, title, status }) => ({
          assignment,
          title,
          status,
        })),
      ).toEqual([
        { assignment: first, title: "Problem set 1", status: "PUBLISHED" },
        { assignment: second, title: "Problem set 2", status: "ARCHIVED" },
      ]);
    });

    test("assign releases once per assignee; overrides set and clear", async () => {
      const c = await make();
      const { assignment } = await c.createDraft(draftInput());

      expect(
        await refusal(() => c.assign({ assignment: "missing", assignee: "omar", at: T1 })),
      ).toBeInstanceOf(refusalErrors.AssignmentNotFound);
      expect(
        await refusal(() => c.assign({ assignment, assignee: "omar", at: T1 })),
      ).toBeInstanceOf(refusalErrors.AssignmentNotPublished);

      await c.publish({ assignment, at: T1 });
      const { release } = await c.assign({ assignment, assignee: "omar", at: T1 });
      expect(
        await refusal(() => c.assign({ assignment, assignee: "omar", at: T1 })),
      ).toBeInstanceOf(refusalErrors.ReleaseAlreadyExists);
      expect(await c._isAssigned({ assignment, assignee: "omar" })).toEqual({ assigned: true });
      expect(await c._isAssigned({ assignment, assignee: "priya" })).toEqual({ assigned: false });

      expect(await c.setDueOverride({ assignment, assignee: "omar", dueAt: "2026-01-20" })).toEqual(
        {
          release,
        },
      );
      expect(await c._getAssigned({ assignee: "omar" })).toEqual([
        { assignment, release, dueOverride: "2026-01-20", status: "ASSIGNED" },
      ]);
      expect(await c.clearDueOverride({ assignment, assignee: "omar" })).toEqual({ release });
      expect((await c._getAssigned({ assignee: "omar" }))[0]?.dueOverride).toBeNull();
    });

    test("override actions refuse without a release", async () => {
      const c = await make();
      expect(
        await refusal(() =>
          c.setDueOverride({ assignment: "a", assignee: "omar", dueAt: "2026-01-20" }),
        ),
      ).toBeInstanceOf(refusalErrors.ReleaseNotFound);
      expect(
        await refusal(() => c.clearDueOverride({ assignment: "a", assignee: "omar" })),
      ).toBeInstanceOf(refusalErrors.ReleaseNotFound);
    });

    test("_getPublishedInWindow: availability-or-due moments, PUBLISHED only, creation order", async () => {
      const c = await make();
      const mk = async (availableAt: string, dueAt: string) =>
        (await c.createDraft({ ...draftInput(), availableAt, dueAt })).assignment;
      const W = { start: "2026-07-06T00:00:00.000Z", end: "2026-07-13T23:59:59.999Z" };
      const hw1 = await mk("2026-07-01T00:00:00.000Z", "2026-07-10T00:00:00.000Z");
      const hw2 = await mk("2026-08-01T00:00:00.000Z", "2026-08-20T00:00:00.000Z");
      const _hw3 = await mk("2026-07-02T00:00:00.000Z", "2026-07-08T00:00:00.000Z");
      const hw4 = await mk("2026-07-07T00:00:00.000Z", "2026-08-01T00:00:00.000Z");

      await c.publish({ assignment: hw1, at: T1 });
      await c.publish({ assignment: hw2, at: T1 });
      await c.publish({ assignment: hw4, at: T1 });

      expect(await c._getPublishedInWindow(W)).toEqual([{ assignment: hw1 }, { assignment: hw4 }]);

      expect(
        await c._getPublishedInWindow({
          start: "2027-01-01T00:00:00.000Z",
          end: "2027-01-02T00:00:00.000Z",
        }),
      ).toEqual([]);
    });

    test("_getPublishedInWindow: bounds inclusive; Date inputs compare tolerantly", async () => {
      const c = await make();
      const at = (
        await c.createDraft({
          ...draftInput(),
          availableAt: "2026-07-06T00:00:00.000Z",
          dueAt: "2026-07-13T23:59:59.999Z",
        })
      ).assignment;
      await c.publish({ assignment: at, at: T1 });

      expect(
        await c._getPublishedInWindow({
          start: new Date("2026-07-06T00:00:00.000Z"),
          end: new Date("2026-07-13T23:59:59.999Z"),
        }),
      ).toEqual([{ assignment: at }]);
    });
  });
}
