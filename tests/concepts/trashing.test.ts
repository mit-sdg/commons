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
