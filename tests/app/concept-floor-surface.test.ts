import { afterAll, describe, expect, test } from "vite-plus/test";
import { memoryImplementations, mongoImplementations } from "../../src/assembly/concept-floor.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

describe("concept floor completeness", () => {
  test("the named Mongo floor constructs every concept in the set", async () => {
    const memory = memoryImplementations();
    const mongo = mongoImplementations(await testDb());

    expect(Object.keys(mongo).sort()).toEqual(Object.keys(memory).sort());
    expect(Object.values(mongo).every((implementation) => implementation !== undefined)).toBe(true);
  });
});
