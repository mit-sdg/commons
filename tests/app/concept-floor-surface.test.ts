import { afterAll, describe, expect, test } from "vite-plus/test";
import { concepts, mongoImplementations } from "../../src/vocabulary.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

describe("concept floor completeness", () => {
  test("the named Mongo floor constructs every concept in the set", async () => {
    const mongo = mongoImplementations(await testDb());

    expect(Object.keys(mongo).sort()).toEqual(Object.keys(concepts).sort());
    expect(Object.values(mongo).every((implementation) => implementation !== undefined)).toBe(true);
  });
});
