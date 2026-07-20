import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "./errors.ts";
import { caughtError, stopTestDb, testDb } from "../testing.ts";
import { BookmarkingConcept } from "./bookmarking.ts";
import { MongoBookmarkingConcept } from "./bookmarking.mongo.ts";

const floors: [string, () => Promise<BookmarkingConcept | MongoBookmarkingConcept>][] = [
  ["in memory", async () => new BookmarkingConcept()],
  ["on MongoDB", async () => new MongoBookmarkingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

const at1 = new Date("2026-07-13T00:00:00Z");
const at2 = new Date("2026-07-13T00:01:00Z");
const at3 = new Date("2026-07-13T00:02:00Z");

for (const [floor, make] of floors) {
  describe(`Bookmarking ${floor}`, () => {
    test("save records the bookmark; users keep private shortlists of the same item", async () => {
      const bookmarking = await make();
      const { bookmark } = await bookmarking.save({ user: "ada", item: "p1", at: at1 });
      expect(typeof bookmark).toBe("string");
      await bookmarking.save({ user: "bob", item: "p1", at: at1 });
      expect(await bookmarking._isSaved({ user: "ada", item: "p1" })).toEqual({ saved: true });
      expect(await bookmarking._isSaved({ user: "bob", item: "p1" })).toEqual({ saved: true });
      expect(await bookmarking._isSaved({ user: "cal", item: "p1" })).toEqual({ saved: false });
      expect((await bookmarking._getSaved({ user: "ada" })).map((r) => r.item)).toEqual(["p1"]);
      expect(await bookmarking._getSaved({ user: "cal" })).toEqual([]);
    });

    test("one bookmark per (user, item) — the duplicate refuses", async () => {
      const bookmarking = await make();
      await bookmarking.save({ user: "ada", item: "p1", at: at1 });
      expect(
        await refusalOf(() => bookmarking.save({ user: "ada", item: "p1", at: at2 })),
      ).toBeInstanceOf(refusalErrors.BookmarkAlreadyExists);
    });

    test("unsave removes exactly the named bookmark; a second removal refuses", async () => {
      const bookmarking = await make();
      const { bookmark } = await bookmarking.save({ user: "ada", item: "p1", at: at1 });
      await bookmarking.save({ user: "ada", item: "p2", at: at2 });
      expect(await bookmarking.unsave({ user: "ada", item: "p1" })).toEqual({ bookmark });
      expect((await bookmarking._getSaved({ user: "ada" })).map((r) => r.item)).toEqual(["p2"]);
      expect(await refusalOf(() => bookmarking.unsave({ user: "ada", item: "p1" }))).toBeInstanceOf(
        refusalErrors.BookmarkNotFound,
      );
    });

    test("_getSaved answers newest-first — the concept's declared order", async () => {
      const bookmarking = await make();
      await bookmarking.save({ user: "ada", item: "first", at: at1 });
      await bookmarking.save({ user: "ada", item: "second", at: at2 });
      await bookmarking.save({ user: "ada", item: "third", at: at3 });
      expect((await bookmarking._getSaved({ user: "ada" })).map((r) => r.item)).toEqual([
        "third",
        "second",
        "first",
      ]);
    });

    test("clearItem strips every bookmark of the item and is idempotent", async () => {
      const bookmarking = await make();
      await bookmarking.save({ user: "ada", item: "p1", at: at1 });
      await bookmarking.save({ user: "bob", item: "p1", at: at1 });
      await bookmarking.save({ user: "ada", item: "p2", at: at2 });
      expect(await bookmarking.clearItem({ item: "p1" })).toEqual({ item: "p1" });
      expect(await bookmarking._isSaved({ user: "ada", item: "p1" })).toEqual({ saved: false });
      expect(await bookmarking._isSaved({ user: "bob", item: "p1" })).toEqual({ saved: false });
      expect((await bookmarking._getSaved({ user: "ada" })).map((r) => r.item)).toEqual(["p2"]);
      expect(await bookmarking.clearItem({ item: "p1" })).toEqual({ item: "p1" });
    });
  });
}
