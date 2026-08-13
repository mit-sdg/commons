import { afterAll, describe, expect, test } from "vite-plus/test";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoRevisingConcept } from "../../src/concepts/revising/revising.mongo.ts";
import { RevisingConcept } from "../../src/concepts/revising/revising.ts";

const floors: [string, () => Promise<RevisingConcept | MongoRevisingConcept>][] = [
  ["in memory", async () => new RevisingConcept()],
  ["on MongoDB", async () => new MongoRevisingConcept(await testDb())],
];

afterAll(stopTestDb);

const at = new Date("2026-07-13T00:00:00Z");

for (const [floor, make] of floors) {
  describe(`Revising ${floor}`, () => {
    test("record numbers monotonically from 1 for an item", async () => {
      const revising = await make();
      expect((await revising.record({ item: "p1", content: "v1", at })).number).toBe(1);
      expect((await revising.record({ item: "p1", content: "v2", at })).number).toBe(2);
      expect((await revising.record({ item: "p1", content: "v3", at })).number).toBe(3);
      expect(
        (await revising._getRevisions({ item: "p1" })).map((r) => [r.number, r.content]),
      ).toEqual([
        [1, "v1"],
        [2, "v2"],
        [3, "v3"],
      ]);
    });

    test("interleaved items number independently", async () => {
      const revising = await make();
      await revising.record({ item: "p1", content: "a1", at });
      await revising.record({ item: "p2", content: "b1", at });
      await revising.record({ item: "p1", content: "a2", at });
      await revising.record({ item: "p2", content: "b2", at });
      expect((await revising._getRevisions({ item: "p1" })).map((r) => r.number)).toEqual([1, 2]);
      expect((await revising._getRevisions({ item: "p2" })).map((r) => r.number)).toEqual([1, 2]);
      expect((await revising._getLatest({ item: "p1" })).map((r) => r.content)).toEqual(["a2"]);
      expect((await revising._getLatest({ item: "p2" })).map((r) => r.content)).toEqual(["b2"]);
    });

    test("_getRevision reads the numbered row, or nothing when absent", async () => {
      const revising = await make();
      await revising.record({ item: "p1", content: "v1", at });
      await revising.record({ item: "p1", content: "v2", at });
      expect(
        (await revising._getRevision({ item: "p1", number: 2 })).map((r) => r.content),
      ).toEqual(["v2"]);
      expect(await revising._getRevision({ item: "p1", number: 9 })).toEqual([]);
      expect(await revising._getRevision({ item: "ghost", number: 1 })).toEqual([]);
    });

    test("_getLatest and _getRevisions of a never-recorded item are empty, never a refusal", async () => {
      const revising = await make();
      expect(await revising._getRevisions({ item: "ghost" })).toEqual([]);
      expect(await revising._getLatest({ item: "ghost" })).toEqual([]);
    });

    test("clearItem removes all history for an item and succeeds when repeated", async () => {
      const revising = await make();
      await revising.record({ item: "p1", content: "v1", at });
      await revising.record({ item: "p1", content: "v2", at });
      await revising.record({ item: "p2", content: "keep", at });
      expect(await revising.clearItem({ item: "p1" })).toEqual({ item: "p1" });
      expect(await revising._getRevisions({ item: "p1" })).toEqual([]);
      expect(await revising._getRevisions({ item: "p2" })).toHaveLength(1);
      expect(await revising.clearItem({ item: "p1" })).toEqual({ item: "p1" });
      expect(await revising.clearItem({ item: "never" })).toEqual({ item: "never" });
    });
  });
}
