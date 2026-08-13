import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/reacting/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoReactingConcept } from "../../src/concepts/reacting/reacting.mongo.ts";

const floors: [string, () => Promise<MongoReactingConcept>][] = [
  ["on MongoDB", async () => new MongoReactingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

const at = new Date("2026-07-13T00:00:00Z");

for (const [floor, make] of floors) {
  describe(`Reacting ${floor}`, () => {
    test("react records the reaction; kinds and reactors coexist", async () => {
      const reacting = await make();
      const { reaction } = await reacting.react({ reactor: "noah", target: "p1", kind: "up", at });
      expect(typeof reaction).toBe("string");
      await reacting.react({ reactor: "mara", target: "p1", kind: "up", at });
      await reacting.react({ reactor: "mara", target: "p1", kind: "heart", at });
      expect(
        (await reacting._getReactionsForTarget({ target: "p1" })).map((r) => [r.reactor, r.kind]),
      ).toEqual([
        ["noah", "up"],
        ["mara", "up"],
        ["mara", "heart"],
      ]);
    });

    test("a person cannot repeat the same reaction on one target", async () => {
      const reacting = await make();
      await reacting.react({ reactor: "noah", target: "p1", kind: "up", at });
      expect(
        await refusalOf(() => reacting.react({ reactor: "noah", target: "p1", kind: "up", at })),
      ).toBeInstanceOf(refusalErrors.ReactionAlreadyExists);
    });

    test("unreact removes exactly the named reaction; a second withdrawal refuses", async () => {
      const reacting = await make();
      await reacting.react({ reactor: "noah", target: "p1", kind: "up", at });
      await reacting.react({ reactor: "noah", target: "p1", kind: "heart", at });
      await reacting.unreact({ reactor: "noah", target: "p1", kind: "up" });
      expect((await reacting._getReactionsForTarget({ target: "p1" })).map((r) => r.kind)).toEqual([
        "heart",
      ]);
      expect(
        await refusalOf(() => reacting.unreact({ reactor: "noah", target: "p1", kind: "up" })),
      ).toBeInstanceOf(refusalErrors.ReactionNotFound);
    });

    test("clearTarget strips every reaction on the target and is idempotent", async () => {
      const reacting = await make();
      await reacting.react({ reactor: "noah", target: "p1", kind: "up", at });
      await reacting.react({ reactor: "mara", target: "p1", kind: "up", at });
      await reacting.react({ reactor: "mara", target: "p2", kind: "up", at });
      expect(await reacting.clearTarget({ target: "p1" })).toEqual({ target: "p1" });
      expect(await reacting._getReactionsForTarget({ target: "p1" })).toEqual([]);
      expect(await reacting._getReactionsForTarget({ target: "p2" })).toHaveLength(1);
      expect(await reacting.clearTarget({ target: "p1" })).toEqual({ target: "p1" });
    });

    test("the questions answer counts by kind, a person's reaction, and their targets", async () => {
      const reacting = await make();
      await reacting.react({ reactor: "noah", target: "p1", kind: "up", at });
      await reacting.react({ reactor: "mara", target: "p1", kind: "up", at });
      await reacting.react({ reactor: "mara", target: "p1", kind: "heart", at });
      expect(await reacting._countByKind({ target: "p1" })).toEqual([
        { kind: "up", count: 2 },
        { kind: "heart", count: 1 },
      ]);
      expect(await reacting._hasReacted({ reactor: "noah", target: "p1", kind: "up" })).toEqual({
        hasReacted: true,
      });
      expect(await reacting._hasReacted({ reactor: "noah", target: "p1", kind: "heart" })).toEqual({
        hasReacted: false,
      });
      expect((await reacting._getReactionsByUser({ reactor: "mara" })).map((r) => r.kind)).toEqual([
        "up",
        "heart",
      ]);
    });
  });
}
