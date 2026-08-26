import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/scoring/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoScoringConcept } from "../../src/concepts/scoring/scoring.mongo.ts";

const floors: [string, () => Promise<MongoScoringConcept>][] = [
  ["on MongoDB", async () => new MongoScoringConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

const expectations = [
  { item: "q1", expected: "yes", explanation: "because" },
  { item: "q2", expected: "no", explanation: "" },
  { item: "q3", expected: "maybe", explanation: "kept back" },
];

for (const [floor, make] of floors) {
  describe(`Scoring ${floor}`, () => {
    test("establish records the key and all its expectations in one act", async () => {
      const scoring = await make();
      const { key } = await scoring.establish({
        subject: "quiz",
        disclosure: "answers",
        expectations,
      });
      expect(await scoring._key({ key })).toEqual([{ subject: "quiz", disclosure: "answers" }]);
      expect(await scoring._keyFor({ subject: "quiz" })).toEqual([{ key, disclosure: "answers" }]);
      expect(await scoring._expectations({ key })).toEqual(expectations);
    });

    test("a subject has at most one key", async () => {
      const scoring = await make();
      await scoring.establish({ subject: "quiz", disclosure: "score", expectations: [] });
      const err = await refusal(() =>
        scoring.establish({ subject: "quiz", disclosure: "explanations", expectations: [] }),
      );
      expect(err).toBeInstanceOf(refusalErrors.KeyExists);
    });

    test("only score, answers, and explanations name a level", async () => {
      const scoring = await make();
      for (const disclosure of ["score", "answers", "explanations"]) {
        const { key } = await scoring.establish({
          subject: `quiz-${disclosure}`,
          disclosure,
          expectations: [],
        });
        expect((await scoring._key({ key }))[0]?.disclosure).toBe(disclosure);
      }
      const err = await refusal(() =>
        scoring.establish({ subject: "other", disclosure: "everything", expectations: [] }),
      );
      expect(err).toBeInstanceOf(refusalErrors.UnknownDisclosure);
      expect(await scoring._keyFor({ subject: "other" })).toEqual([]);
    });

    test("a score counts matched expectations exactly, out of the key's expectations", async () => {
      const scoring = await make();
      const { key } = await scoring.establish({
        subject: "quiz",
        disclosure: "answers",
        expectations,
      });
      const { result, score } = await scoring.grade({
        key,
        submission: "leon",
        answers: [
          { item: "q1", value: "yes" },
          { item: "q2", value: "Yes" },
          { item: "q3", value: "maybe" },
        ],
      });
      expect(score).toBe(2);
      expect(await scoring._resultFor({ key, submission: "leon" })).toEqual([
        { result, score: 2, outOf: 3 },
      ]);
    });

    test("answers to unexpected items count nothing, and missing answers score zero", async () => {
      const scoring = await make();
      const { key } = await scoring.establish({
        subject: "quiz",
        disclosure: "score",
        expectations,
      });
      const graded = await scoring.grade({
        key,
        submission: "mira",
        answers: [
          { item: "q9", value: "yes" },
          { item: "q1", value: "yes" },
        ],
      });
      expect(graded.score).toBe(1);
      const empty = await scoring.grade({ key, submission: "pat", answers: [] });
      expect(empty.score).toBe(0);
      expect(await scoring._resultFor({ key, submission: "pat" })).toEqual([
        { result: empty.result, score: 0, outOf: 3 },
      ]);
    });

    test("grading is refused twice over, and against a key that does not exist", async () => {
      const scoring = await make();
      const { key } = await scoring.establish({
        subject: "quiz",
        disclosure: "score",
        expectations,
      });
      await scoring.grade({ key, submission: "leon", answers: [{ item: "q1", value: "yes" }] });
      const again = await refusal(() =>
        scoring.grade({ key, submission: "leon", answers: [{ item: "q1", value: "no" }] }),
      );
      expect(again).toBeInstanceOf(refusalErrors.AlreadyGraded);
      const missing = await refusal(() =>
        scoring.grade({ key: "none", submission: "leon", answers: [] }),
      );
      expect(missing).toBeInstanceOf(refusalErrors.KeyNotFound);
      expect((await scoring._results({ key })).length).toBe(1);
    });

    test("_results answers the key's results in grading order", async () => {
      const scoring = await make();
      const { key } = await scoring.establish({
        subject: "quiz",
        disclosure: "answers",
        expectations,
      });
      const first = await scoring.grade({
        key,
        submission: "leon",
        answers: [{ item: "q1", value: "yes" }],
      });
      const second = await scoring.grade({
        key,
        submission: "mira",
        answers: [
          { item: "q1", value: "yes" },
          { item: "q2", value: "no" },
        ],
      });
      expect(await scoring._results({ key })).toEqual([
        { result: first.result, submission: "leon", score: 1, outOf: 3 },
        { result: second.result, submission: "mira", score: 2, outOf: 3 },
      ]);
    });

    test("a subject without a key answers nothing anywhere", async () => {
      const scoring = await make();
      expect(await scoring._keyFor({ subject: "survey" })).toEqual([]);
      expect(await scoring._key({ key: "no-such" })).toEqual([]);
      expect(await scoring._expectations({ key: "no-such" })).toEqual([]);
      expect(await scoring._results({ key: "no-such" })).toEqual([]);
      expect(await scoring._resultFor({ key: "no-such", submission: "leon" })).toEqual([]);
    });
  });
}
