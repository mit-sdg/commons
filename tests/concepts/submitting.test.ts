import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/submitting/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoSubmittingConcept } from "../../src/concepts/submitting/submitting.mongo.ts";

const floors: [string, () => Promise<MongoSubmittingConcept>][] = [
  ["on MongoDB", async () => new MongoSubmittingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

const T0 = new Date("2026-02-01T00:00:00Z");
const T1 = new Date("2026-02-02T00:00:00Z");

for (const [floor, make] of floors) {
  describe(`Submitting ${floor}`, () => {
    test("attempt numbers increase per learner and assignment and are not reused", async () => {
      const c = await make();
      const first = await c.submit({
        assignment: "hw1",
        submitter: "maya",
        artifact: "essay-v1",
        at: T0,
      });
      await c.withdraw({ submission: first.submission });
      const second = await c.submit({
        assignment: "hw1",
        submitter: "maya",
        artifact: "essay-v2",
        at: T1,
      });

      const attempts = await c._getAttempts({ assignment: "hw1", submitter: "maya" });
      expect(attempts.map((a) => a.number)).toEqual([1, 2]);
      expect(attempts[0]?.status).toBe("WITHDRAWN");
      expect(attempts[1]?.artifacts).toEqual(["essay-v2"]);

      const other = await c.submit({
        assignment: "hw1",
        submitter: "omar",
        artifact: "notes",
        at: T1,
      });
      expect((await c._getAttempts({ assignment: "hw1", submitter: "omar" }))[0]?.number).toBe(1);
      expect(other.submission).not.toBe(second.submission);
    });

    test("concurrent attempts reserve distinct numbers across concept instances", async () => {
      const db = await testDb();
      const writers = [new MongoSubmittingConcept(db), new MongoSubmittingConcept(db)];
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          writers[i % 2]!.submit({
            assignment: "hw1",
            submitter: "maya",
            artifact: `work-${i}`,
            at: T0,
          }),
        ),
      );
      expect(new Set(results.map((r) => r.submission)).size).toBe(20);
      const attempts = await writers[0]!._getAttempts({ assignment: "hw1", submitter: "maya" });
      expect(attempts.map((a) => a.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
      expect(new Set(attempts.flatMap((a) => a.artifacts)).size).toBe(20);
    });

    test("_getLatest answers the highest-numbered submitted attempt or no row", async () => {
      const c = await make();
      expect(await c._getLatest({ assignment: "hw1", submitter: "maya" })).toEqual([]);

      await c.submit({ assignment: "hw1", submitter: "maya", artifact: "essay-v1", at: T0 });
      const second = await c.submit({
        assignment: "hw1",
        submitter: "maya",
        artifact: "essay-v2",
        at: T1,
      });
      expect((await c._getLatest({ assignment: "hw1", submitter: "maya" }))[0]?.latest.number).toBe(
        2,
      );

      await c.withdraw({ submission: second.submission });
      expect((await c._getLatest({ assignment: "hw1", submitter: "maya" }))[0]?.latest.number).toBe(
        1,
      );
    });

    test("withdraw and restore move an attempt between standings", async () => {
      const c = await make();
      const { submission } = await c.submit({
        assignment: "hw1",
        submitter: "maya",
        artifact: "essay-v1",
        at: T0,
      });
      expect(await c.withdraw({ submission })).toEqual({ submission });
      expect(await c.restore({ submission })).toEqual({ submission });
      expect((await c._getAttempts({ assignment: "hw1", submitter: "maya" }))[0]?.status).toBe(
        "SUBMITTED",
      );
    });

    test("withdraw refuses unknown and already withdrawn attempts", async () => {
      const c = await make();
      expect(await refusal(() => c.withdraw({ submission: "missing" }))).toBeInstanceOf(
        refusalErrors.SubmissionNotFound,
      );
      const { submission } = await c.submit({
        assignment: "hw1",
        submitter: "maya",
        artifact: "essay-v1",
        at: T0,
      });
      await c.withdraw({ submission });
      expect(await refusal(() => c.withdraw({ submission }))).toBeInstanceOf(
        refusalErrors.SubmissionNotSubmitted,
      );
    });

    test("restore refuses unknown and submitted attempts", async () => {
      const c = await make();
      expect(await refusal(() => c.restore({ submission: "missing" }))).toBeInstanceOf(
        refusalErrors.SubmissionNotFound,
      );
      const { submission } = await c.submit({
        assignment: "hw1",
        submitter: "maya",
        artifact: "essay-v1",
        at: T0,
      });
      expect(await refusal(() => c.restore({ submission }))).toBeInstanceOf(
        refusalErrors.SubmissionNotWithdrawn,
      );
    });
  });
}
