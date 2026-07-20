import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "./errors.ts";
import { caughtError, stopTestDb, testDb } from "../testing.ts";
import { MongoGradingConcept } from "./grading.mongo.ts";
import { GradingConcept } from "./grading.ts";

const floors: [string, () => Promise<GradingConcept | MongoGradingConcept>][] = [
  ["in memory", async () => new GradingConcept()],
  ["on MongoDB", async () => new MongoGradingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

const T0 = new Date("2026-03-01T00:00:00Z");
const T1 = new Date("2026-03-02T00:00:00Z");
const T2 = new Date("2026-03-03T00:00:00Z");

const draft = (c: GradingConcept | MongoGradingConcept, learner: string, score = 42) =>
  c.record({
    learner,
    item: "essay",
    evidence: "sub-1",
    grader: "okafor",
    score,
    outOf: 50,
    feedback: "solid",
    at: T0,
  });

for (const [floor, make] of floors) {
  describe(`Grading ${floor}`, () => {
    test("record creates a draft and later updates the same grade", async () => {
      const c = await make();
      const { grade } = await draft(c, "ana", 42);
      const again = await draft(c, "ana", 45);
      expect(again.grade).toBe(grade);
      expect(await c._getGrade({ learner: "ana", item: "essay" })).toEqual([
        { grade, score: 45, outOf: 50, status: "DRAFT", feedback: "solid" },
      ]);
      expect(await c._getGradesForLearner({ learner: "ana" })).toEqual([
        {
          item: "essay",
          grade,
          score: 45,
          outOf: 50,
          status: "DRAFT",
          feedback: "solid",
        },
      ]);
    });

    test("record refuses an out-of-range score", async () => {
      const c = await make();
      expect(await refusal(() => draft(c, "ana", 60))).toBeInstanceOf(
        refusalErrors.ScoreOutOfRange,
      );
    });

    test("release, retract, and re-record keep the grade's identity", async () => {
      const c = await make();
      const { grade } = await draft(c, "ana", 42);
      expect(await c.release({ learner: "ana", item: "essay", at: T1 })).toEqual({ grade });
      expect(await refusal(() => draft(c, "ana", 45))).toBeInstanceOf(
        refusalErrors.GradeAlreadyReleased,
      );

      expect(await c.retract({ learner: "ana", item: "essay", at: T2 })).toEqual({ grade });
      const redone = await draft(c, "ana", 44);
      expect(redone.grade).toBe(grade);
      expect((await c._getGrade({ learner: "ana", item: "essay" }))[0]?.status).toBe("DRAFT");
      expect((await c._getGrade({ learner: "ana", item: "essay" }))[0]?.score).toBe(44);
    });

    test("release and retract refuse when no grade stands in the wanted group", async () => {
      const c = await make();
      expect(
        await refusal(() => c.release({ learner: "ana", item: "essay", at: T1 })),
      ).toBeInstanceOf(refusalErrors.GradeDraftNotFound);
      expect(
        await refusal(() => c.retract({ learner: "ana", item: "essay", at: T1 })),
      ).toBeInstanceOf(refusalErrors.GradeReleasedNotFound);
      await draft(c, "ana");
      expect(
        await refusal(() => c.retract({ learner: "ana", item: "essay", at: T1 })),
      ).toBeInstanceOf(refusalErrors.GradeReleasedNotFound);
      await c.release({ learner: "ana", item: "essay", at: T1 });
      expect(
        await refusal(() => c.release({ learner: "ana", item: "essay", at: T1 })),
      ).toBeInstanceOf(refusalErrors.GradeDraftNotFound);
    });

    test("releaseItem returns every draft it releases", async () => {
      const c = await make();
      const ana = await draft(c, "ana");
      const ben = await draft(c, "ben");
      await c.release({ learner: "ana", item: "essay", at: T0 });
      await c.record({
        learner: "cai",
        item: "quiz",
        evidence: "sub-9",
        grader: "okafor",
        score: 5,
        outOf: 10,
        feedback: "",
        at: T0,
      });

      const { released } = await c.releaseItem({ item: "essay", at: T1 });
      expect(released).toEqual([{ learner: "ben", grade: ben.grade }]);
      expect((await c._getGrade({ learner: "ben", item: "essay" }))[0]?.status).toBe("RELEASED");
      expect((await c._getGrade({ learner: "ana", item: "essay" }))[0]?.grade).toBe(ana.grade);
      expect((await c._getGrade({ learner: "cai", item: "quiz" }))[0]?.status).toBe("DRAFT");

      expect(await c.releaseItem({ item: "essay", at: T2 })).toEqual({ released: [] });
    });

    test("an excused grade refuses recording and retraction", async () => {
      const c = await make();
      await draft(c, "ben");
      const { grade } = await c.excuse({
        learner: "ben",
        item: "essay",
        grader: "okafor",
        feedback: "medical",
        at: T1,
      });
      expect(await c._getGrade({ learner: "ben", item: "essay" })).toEqual([
        { grade, score: 0, outOf: 50, status: "EXCUSED", feedback: "medical" },
      ]);
      expect(await refusal(() => draft(c, "ben"))).toBeInstanceOf(refusalErrors.LearnerExcused);
      expect(
        await refusal(() =>
          c.scoreCriterion({
            learner: "ben",
            item: "essay",
            criterion: "clarity",
            points: 4,
            outOf: 5,
            feedback: "",
          }),
        ),
      ).toBeInstanceOf(refusalErrors.LearnerExcused);
      expect(
        await refusal(() => c.retract({ learner: "ben", item: "essay", at: T2 })),
      ).toBeInstanceOf(refusalErrors.GradeReleasedNotFound);
    });

    test("excuse refuses when the learner has no grade for the item", async () => {
      const c = await make();
      expect(
        await refusal(() =>
          c.excuse({ learner: "ben", item: "essay", grader: "okafor", feedback: "", at: T1 }),
        ),
      ).toBeInstanceOf(refusalErrors.GradeNotFound);
    });

    test("scoreCriterion creates or updates a draft criterion score and refuses otherwise", async () => {
      const c = await make();
      expect(
        await refusal(() =>
          c.scoreCriterion({
            learner: "ana",
            item: "essay",
            criterion: "crit-1",
            points: 10,
            outOf: 20,
            feedback: "",
          }),
        ),
      ).toBeInstanceOf(refusalErrors.GradeNotFound);

      await draft(c, "ana");
      expect(
        await refusal(() =>
          c.scoreCriterion({
            learner: "ana",
            item: "essay",
            criterion: "crit-1",
            points: 25,
            outOf: 20,
            feedback: "",
          }),
        ),
      ).toBeInstanceOf(refusalErrors.ScoreOutOfRange);

      const first = await c.scoreCriterion({
        learner: "ana",
        item: "essay",
        criterion: "crit-1",
        points: 10,
        outOf: 20,
        feedback: "ok",
      });
      const second = await c.scoreCriterion({
        learner: "ana",
        item: "essay",
        criterion: "crit-1",
        points: 15,
        outOf: 20,
        feedback: "better",
      });
      expect(second.criterionScore).toBe(first.criterionScore);
      expect(await c._getCriterionScores({ learner: "ana", item: "essay" })).toEqual([
        { criterion: "crit-1", points: 15, feedback: "better" },
      ]);

      await c.release({ learner: "ana", item: "essay", at: T1 });
      expect(
        await refusal(() =>
          c.scoreCriterion({
            learner: "ana",
            item: "essay",
            criterion: "crit-1",
            points: 12,
            outOf: 20,
            feedback: "",
          }),
        ),
      ).toBeInstanceOf(refusalErrors.GradeAlreadyReleased);
    });

    test("clearCriterionScores removes every matching score and succeeds when none remain", async () => {
      const c = await make();
      await draft(c, "ana");
      await c.scoreCriterion({
        learner: "ana",
        item: "essay",
        criterion: "crit-1",
        points: 10,
        outOf: 20,
        feedback: "",
      });
      expect(await c.clearCriterionScores({ criterion: "crit-1" })).toEqual({
        criterion: "crit-1",
      });
      expect(await c._getCriterionScores({ learner: "ana", item: "essay" })).toEqual([]);
      expect(await c.clearCriterionScores({ criterion: "crit-1" })).toEqual({
        criterion: "crit-1",
      });
    });
  });
}
