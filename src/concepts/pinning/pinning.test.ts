import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "./errors.ts";
import { caughtError, stopTestDb, testDb } from "../testing.ts";
import { MongoPinningConcept } from "./pinning.mongo.ts";
import { PinningConcept } from "./pinning.ts";

const floors: [string, () => Promise<PinningConcept | MongoPinningConcept>][] = [
  ["in memory", async () => new PinningConcept()],
  ["on MongoDB", async () => new MongoPinningConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

const at1 = new Date("2026-07-13T00:00:00Z");
const at2 = new Date("2026-07-13T00:01:00Z");
const at3 = new Date("2026-07-13T00:02:00Z");

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
      expect(await pinning.unpin({ item: "r1", scope: "c1" })).toHaveProperty("pin");
      expect(await pinning._getPinned({ scope: "c1" })).toEqual([{ item: "p1", priority: 10 }]);
    });

    test("unpin and setPriority refuse when there is no such pin", async () => {
      const pinning = await make();
      expect(await refusalOf(() => pinning.unpin({ item: "p1", scope: "c1" }))).toBeInstanceOf(
        refusalErrors.ItemNotPinned,
      );
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
