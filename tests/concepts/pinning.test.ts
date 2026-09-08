import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/pinning/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoPinningConcept } from "../../src/concepts/pinning/pinning.mongo.ts";

const floors: [string, () => Promise<MongoPinningConcept>][] = [
  ["on MongoDB", async () => new MongoPinningConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

const at1 = new Date("2026-07-13T00:00:00Z");
const at2 = new Date("2026-07-13T00:01:00Z");
const at3 = new Date("2026-07-13T00:02:00Z");

test("concurrent pinning creates one membership and unpin removes it completely", async () => {
  const pinning = new MongoPinningConcept(await testDb());
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      pinning.pin({ item: "pile", scope: "round", priority: 0, at: at1 }),
    ),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  for (const result of results) {
    if (result.status === "rejected")
      expect(result.reason).toBeInstanceOf(refusalErrors.ItemAlreadyPinned);
  }
  expect(await pinning._getPinned({ scope: "round" })).toHaveLength(1);
  await pinning.unpin({ item: "pile", scope: "round" });
  expect(await pinning._isPinned({ item: "pile", scope: "round" })).toEqual({ pinned: false });
});

test("unpin also removes duplicates stored by older racing writers", async () => {
  const db = await testDb();
  await db
    .collection("pinning.pins")
    .insertMany(
      [1, 2].map((seq) => ({ item: "pile", scope: "round", priority: 0, pinnedAt: at1, seq })),
    );
  const pinning = new MongoPinningConcept(db);
  await pinning.pin({ item: "pile", scope: "other", priority: 0, at: at1 });
  await pinning.unpin({ item: "pile", scope: "round" });
  expect(await pinning._getPinned({ scope: "round" })).toEqual([]);
  expect(await pinning._isPinned({ item: "pile", scope: "other" })).toEqual({ pinned: true });
});

for (const [floor, make] of floors) {
  describe(`Pinning ${floor}`, () => {
    test("pin records the pin; a scope's listing reads priority-descending", async () => {
      const pinning = await make();
      const { pin } = await pinning.pin({ item: "p1", scope: "c1", priority: 1, at: at1 });
      expect(typeof pin).toBe("string");
      await pinning.pin({ item: "r1", scope: "c1", priority: 5, at: at2 });
      expect(await pinning._getPinned({ scope: "c1" })).toEqual([
        { item: "r1", priority: 5 },
        { item: "p1", priority: 1 },
      ]);
      expect(await pinning._isPinned({ item: "p1", scope: "c1" })).toEqual({ pinned: true });
      expect(await pinning._isPinned({ item: "p1", scope: "c2" })).toEqual({ pinned: false });
    });

    test("a duplicate pin in one scope is refused while another scope is independent", async () => {
      const pinning = await make();
      await pinning.pin({ item: "p1", scope: "c1", priority: 1, at: at1 });
      expect(
        await refusalOf(() => pinning.pin({ item: "p1", scope: "c1", priority: 2, at: at2 })),
      ).toBeInstanceOf(refusalErrors.ItemAlreadyPinned);
      expect(await pinning.pin({ item: "p1", scope: "c2", priority: 2, at: at2 })).toHaveProperty(
        "pin",
      );
    });

    test("setPriority reorders the listing; unpin removes exactly that pin", async () => {
      const pinning = await make();
      const { pin } = await pinning.pin({ item: "p1", scope: "c1", priority: 1, at: at1 });
      await pinning.pin({ item: "r1", scope: "c1", priority: 5, at: at2 });
      expect(await pinning.setPriority({ item: "p1", scope: "c1", priority: 10 })).toEqual({ pin });
      expect(await pinning._getPinned({ scope: "c1" })).toEqual([
        { item: "p1", priority: 10 },
        { item: "r1", priority: 5 },
      ]);
      expect(await pinning.unpin({ item: "r1", scope: "c1" })).toEqual({ item: "r1" });
      expect(await pinning._getPinned({ scope: "c1" })).toEqual([{ item: "p1", priority: 10 }]);
    });

    test("unpin changes nothing when there is no such pin; setPriority refuses", async () => {
      const pinning = await make();
      expect(await pinning.unpin({ item: "p1", scope: "c1" })).toEqual({ item: "p1" });
      expect(await pinning._getPinned({ scope: "c1" })).toEqual([]);
      expect(
        await refusalOf(() => pinning.setPriority({ item: "p1", scope: "c1", priority: 3 })),
      ).toBeInstanceOf(refusalErrors.ItemNotPinned);
    });

    test("clearItem strips every pin of the item across scopes and is idempotent", async () => {
      const pinning = await make();
      await pinning.pin({ item: "p1", scope: "c1", priority: 1, at: at1 });
      await pinning.pin({ item: "p1", scope: "c2", priority: 2, at: at2 });
      await pinning.pin({ item: "r1", scope: "c1", priority: 5, at: at3 });
      expect(await pinning.clearItem({ item: "p1" })).toEqual({ item: "p1" });
      expect(await pinning._isPinned({ item: "p1", scope: "c1" })).toEqual({ pinned: false });
      expect(await pinning._isPinned({ item: "p1", scope: "c2" })).toEqual({ pinned: false });
      expect(await pinning._getPinned({ scope: "c1" })).toEqual([{ item: "r1", priority: 5 }]);
      expect(await pinning.clearItem({ item: "p1" })).toEqual({ item: "p1" });
    });
  });
}
