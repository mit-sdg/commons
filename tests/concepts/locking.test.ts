import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/locking/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoLockingConcept } from "../../src/concepts/locking/locking.mongo.ts";

const floors: [string, () => Promise<MongoLockingConcept>][] = [
  ["on MongoDB", async () => new MongoLockingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

for (const [floor, make] of floors) {
  describe(`Locking ${floor}`, () => {
    test("lock holds the target and keeps the moment", async () => {
      const locking = await make();
      const at = new Date("2026-03-01T17:00:00Z");
      expect(await locking.lock({ target: "report-1", at })).toEqual({ target: "report-1" });
      expect(await locking._isLocked({ target: "report-1" })).toEqual({ locked: true });
      expect(await locking._getLocked({})).toEqual([{ target: "report-1", lockedAt: at }]);
    });

    test("locking an already-locked target refuses with TARGET_ALREADY_LOCKED", async () => {
      const locking = await make();
      await locking.lock({ target: "report-1", at: new Date("2026-03-01T17:00:00Z") });
      const err = await refusal(() =>
        locking.lock({ target: "report-1", at: new Date("2026-03-02T09:00:00Z") }),
      );
      expect(err).toBeInstanceOf(refusalErrors.TargetAlreadyLocked);
    });

    test("unlock releases the hold", async () => {
      const locking = await make();
      await locking.lock({ target: "report-1", at: new Date("2026-03-01T17:00:00Z") });
      expect(await locking.unlock({ target: "report-1" })).toEqual({ target: "report-1" });
      expect(await locking._isLocked({ target: "report-1" })).toEqual({ locked: false });
      expect(await locking._getLocked({})).toEqual([]);
    });

    test("unlocking an unlocked target refuses with TARGET_NOT_LOCKED", async () => {
      const locking = await make();
      const err = await refusal(() => locking.unlock({ target: "report-1" }));
      expect(err).toBeInstanceOf(refusalErrors.TargetNotLocked);
    });
  });
}
