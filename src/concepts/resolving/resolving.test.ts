import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "./errors.ts";
import { caughtError, stopTestDb, testDb } from "../testing.ts";
import { MongoResolvingConcept } from "./resolving.mongo.ts";
import { ResolvingConcept } from "./resolving.ts";

const floors: [string, () => Promise<ResolvingConcept | MongoResolvingConcept>][] = [
  ["in memory", async () => new ResolvingConcept()],
  ["on MongoDB", async () => new MongoResolvingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

const at = new Date("2026-01-01T00:00:00Z");
const later = new Date("2026-01-02T00:00:00Z");

for (const [floor, make] of floors) {
  describe(`Resolving ${floor}`, () => {
    test("accept marks the accepted answer with who and when", async () => {
      const resolving = await make();
      expect(await resolving.accept({ question: "q1", answer: "a1", by: "lena", at })).toEqual({
        resolution: "q1",
      });
      expect(await resolving._isResolved({ question: "q1" })).toEqual({ resolved: true });
      expect(await resolving._getResolution({ question: "q1" })).toEqual([
        { answer: "a1", resolvedBy: "lena", resolvedAt: at },
      ]);
      expect(await resolving._getQuestionsAnswered({ answer: "a1" })).toEqual([{ question: "q1" }]);
    });

    test("a second acceptance replaces the first", async () => {
      const resolving = await make();
      await resolving.accept({ question: "q1", answer: "a1", by: "lena", at });
      expect(
        await resolving.accept({ question: "q1", answer: "a2", by: "lena", at: later }),
      ).toEqual({
        resolution: "q1",
      });
      expect(await resolving._getResolution({ question: "q1" })).toEqual([
        { answer: "a2", resolvedBy: "lena", resolvedAt: later },
      ]);
      expect(await resolving._getQuestionsAnswered({ answer: "a1" })).toEqual([]);
    });

    test("clear removes the resolution and refuses when there is none", async () => {
      const resolving = await make();
      await resolving.accept({ question: "q1", answer: "a1", by: "lena", at });
      expect(await resolving.clear({ question: "q1" })).toEqual({ question: "q1" });
      expect(await resolving._isResolved({ question: "q1" })).toEqual({ resolved: false });
      expect(await refusalOf(() => resolving.clear({ question: "q1" }))).toBeInstanceOf(
        refusalErrors.ResolutionNotFound,
      );
    });
  });
}
