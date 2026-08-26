import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/locating/errors.ts";
import {
  type LocationCodeMint,
  MongoLocatingConcept,
} from "../../src/concepts/locating/locating.mongo.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";

const floors: [string, () => Promise<MongoLocatingConcept>][] = [
  ["on MongoDB", async () => new MongoLocatingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

function codes(...values: string[]): LocationCodeMint {
  let next = 0;
  return () => {
    const value = values[next];
    if (value === undefined) throw new Error("Test code mint exhausted.");
    next += 1;
    return value;
  };
}

for (const [floor, make] of floors) {
  describe(`Locating ${floor}`, () => {
    test("ensure gives a subject one durable six-character code", async () => {
      const locating = await make();
      const first = await locating.ensure({ subject: "run-1" });
      const second = await locating.ensure({ subject: "run-1" });

      expect(first.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      expect(first.location).not.toBe("");
      expect(second).toEqual(first);
      expect(await locating._for({ subject: "run-1" })).toEqual([first]);
      expect(await locating._at(first)).toEqual([{ location: first.location, subject: "run-1" }]);
    });

    test("locate trims and uppercases a code", async () => {
      const db = await testDb();
      const locating = new MongoLocatingConcept(db, codes("7KMP2Q"));
      const { location } = await locating.ensure({ subject: "run-1" });

      expect(await locating.locate({ code: "  7kmp2q  " })).toEqual({ subject: "run-1" });
      expect(await locating._at({ code: "  7kmp2q  " })).toEqual([{ location, subject: "run-1" }]);
    });

    test("malformed and unknown codes receive one indistinguishable refusal", async () => {
      const locating = await make();
      const malformed = await refusal(() => locating.locate({ code: "bad!" }));
      const unknown = await refusal(() => locating.locate({ code: "ABC234" }));

      expect(malformed).toBeInstanceOf(refusalErrors.NothingLocated);
      expect(unknown).toBeInstanceOf(refusalErrors.NothingLocated);
      expect(malformed.message).toBe("Nothing is located there.");
      expect(unknown.message).toBe(malformed.message);
      expect(await locating._at({ code: "bad!" })).toEqual([]);
      expect(await locating._at({ code: "ABC234" })).toEqual([]);
    });

    test("a code collision mints again without disturbing the first location", async () => {
      const db = await testDb();
      const locating = new MongoLocatingConcept(db, codes("AAAAAA", "AAAAAA", "BBBBBB"));

      expect((await locating.ensure({ subject: "run-1" })).code).toBe("AAAAAA");
      expect((await locating.ensure({ subject: "run-2" })).code).toBe("BBBBBB");
      expect(await locating.locate({ code: "AAAAAA" })).toEqual({ subject: "run-1" });
      expect(await locating.locate({ code: "BBBBBB" })).toEqual({ subject: "run-2" });
    });

    test("concurrent ensures for one subject converge on one location", async () => {
      const db = await testDb();
      const first = new MongoLocatingConcept(db, codes("CCCCCC"));
      const second = new MongoLocatingConcept(db, codes("DDDDDD"));

      const results = await Promise.all([
        first.ensure({ subject: "run-1" }),
        second.ensure({ subject: "run-1" }),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(await first._for({ subject: "run-1" })).toEqual([results[0]]);
    });

    test("concurrent code collisions preserve globally unique locations", async () => {
      const db = await testDb();
      const first = new MongoLocatingConcept(db, codes("EEEEEE", "FFFFFF"));
      const second = new MongoLocatingConcept(db, codes("EEEEEE", "GGGGGG"));

      const results = await Promise.all([
        first.ensure({ subject: "run-1" }),
        second.ensure({ subject: "run-2" }),
      ]);
      expect(new Set(results.map(({ code }) => code)).size).toBe(2);
      expect(results.map(({ code }) => code)).toContain("EEEEEE");
      expect(results[0]?.location).not.toBe(results[1]?.location);
      expect(await first.locate({ code: results[0]!.code })).toEqual({ subject: "run-1" });
      expect(await first.locate({ code: results[1]!.code })).toEqual({ subject: "run-2" });
    });

    test("queries answer no row where no location exists", async () => {
      const locating = await make();
      expect(await locating._for({ subject: "run-9" })).toEqual([]);
      expect(await locating._at({ code: "ZZZZZZ" })).toEqual([]);
    });
  });
}
