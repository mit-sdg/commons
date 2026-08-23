import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/trashing/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoTrashingConcept } from "../../src/concepts/trashing/trashing.mongo.ts";

const floors: [string, () => Promise<MongoTrashingConcept>][] = [
  ["on MongoDB", async () => new MongoTrashingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

for (const [floor, make] of floors) {
  describe(`Trashing ${floor}`, () => {
    const at = new Date("2026-01-01T00:00:00Z");

    test("a second instantiation keeps its own trash, and Trashing keeps its collection", async () => {
      const database = await testDb();
      const trashing = new MongoTrashingConcept(database);
      const archiving = new MongoTrashingConcept(database, "Archiving");

      await trashing.trash({ item: "shared-id", by: "maya", at });
      expect(await trashing._isTrashed({ item: "shared-id" })).toEqual({ trashed: true });
      // The same identity in the other instance is untouched.
      expect(await archiving._isTrashed({ item: "shared-id" })).toEqual({ trashed: false });

      await archiving.trash({ item: "shared-id", by: "admin", at });
      expect(await archiving._getTrashed({})).toEqual([
        { item: "shared-id", trashedBy: "admin", trashedAt: at },
      ]);
      // Restoring in one instance leaves the other alone.
      await archiving.restore({ item: "shared-id" });
      expect(await archiving._isTrashed({ item: "shared-id" })).toEqual({ trashed: false });
      expect(await trashing._isTrashed({ item: "shared-id" })).toEqual({ trashed: true });

      // The default instance must keep writing to the pre-existing collection.
      expect(await database.collection("trashing.items").countDocuments()).toBe(1);
      expect(await database.collection("archiving.items").countDocuments()).toBe(0);
    });

    test("trash records who moved the item and when", async () => {
      const trashing = await make();
      expect(await trashing.trash({ item: "draft", by: "maya", at })).toEqual({ item: "draft" });
      expect(await trashing._isTrashed({ item: "draft" })).toEqual({ trashed: true });
      expect(await trashing._getTrashed({})).toEqual([
        { item: "draft", trashedBy: "maya", trashedAt: at },
      ]);
    });

    test("trash refuses an item already in the trash", async () => {
      const trashing = await make();
      await trashing.trash({ item: "draft", by: "maya", at });
      expect(
        await refusalOf(() => trashing.trash({ item: "draft", by: "maya", at })),
      ).toBeInstanceOf(refusalErrors.ItemAlreadyTrashed);
    });

    test("restore removes the item from trash", async () => {
      const trashing = await make();
      await trashing.trash({ item: "draft", by: "maya", at });
      expect(await trashing.restore({ item: "draft" })).toEqual({ item: "draft" });
      expect(await trashing._isTrashed({ item: "draft" })).toEqual({ trashed: false });
    });

    test("restore refuses an item not in the trash", async () => {
      const trashing = await make();
      expect(await refusalOf(() => trashing.restore({ item: "draft" }))).toBeInstanceOf(
        refusalErrors.ItemNotTrashed,
      );
    });

    test("purge removes the trash record", async () => {
      const trashing = await make();
      await trashing.trash({ item: "draft", by: "maya", at });
      expect(await trashing.purge({ item: "draft" })).toEqual({ item: "draft" });
      expect(await trashing._getTrashed({})).toEqual([]);
    });

    test("purge refuses an item not in the trash", async () => {
      const trashing = await make();
      expect(await refusalOf(() => trashing.purge({ item: "draft" }))).toBeInstanceOf(
        refusalErrors.ItemNotTrashed,
      );
    });
  });
}
