import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/banking/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoBankingConcept } from "../../src/concepts/banking/banking.mongo.ts";
import { BankingConcept } from "../../src/concepts/banking/banking.ts";

const floors: [string, () => Promise<BankingConcept | MongoBankingConcept>][] = [
  ["in memory", async () => new BankingConcept()],
  ["on MongoDB", async () => new MongoBankingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

const T0 = new Date("2026-03-01T00:00:00Z");
const T1 = new Date("2026-03-02T00:00:00Z");
const T2 = new Date("2026-03-03T00:00:00Z");

const seat = (c: BankingConcept | MongoBankingConcept) =>
  c.setTerms({ allowance: 3, perItemLimit: 2, unitHours: 24 });

for (const [floor, make] of floors) {
  describe(`Banking ${floor}`, () => {
    test("terms stand at their defaults until stated, then take the stated values", async () => {
      const c = await make();
      expect(await c._getTerms()).toEqual({ allowance: 0, perItemLimit: 5, unitHours: 24 });
      await seat(c);
      expect(await c._getTerms()).toEqual({ allowance: 3, perItemLimit: 2, unitHours: 24 });
    });

    test("balance equals allowance + grants − applied days", async () => {
      const c = await make();
      await seat(c);
      expect(await c._getBalance({ learner: "ana" })).toEqual({
        granted: 3,
        used: 0,
        remaining: 3,
      });

      await c.apply({ learner: "ana", item: "essay", days: 2, at: T0 });
      expect(await c._getBalance({ learner: "ana" })).toEqual({
        granted: 3,
        used: 2,
        remaining: 1,
      });

      await c.grant({ learner: "ana", days: 2, reason: "conference travel", at: T1 });
      expect(await c._getBalance({ learner: "ana" })).toEqual({
        granted: 5,
        used: 2,
        remaining: 3,
      });
    });

    test("a grant permits a use that the starting balance refused, and cancellation restores it", async () => {
      const c = await make();
      await seat(c);
      await c.apply({ learner: "ana", item: "essay", days: 2, at: T0 });

      expect(
        await refusalOf(() => c.apply({ learner: "ana", item: "pset", days: 2, at: T1 })),
      ).toBeInstanceOf(refusalErrors.InsufficientBalance);

      await c.grant({ learner: "ana", days: 2, reason: "conference travel", at: T1 });
      expect(await c._getGrants({ learner: "ana" })).toEqual([
        { grant: expect.any(String), days: 2, reason: "conference travel", grantedAt: T1 },
      ]);

      const { use } = await c.apply({ learner: "ana", item: "pset", days: 2, at: T1 });
      expect(await c._getBalance({ learner: "ana" })).toEqual({
        granted: 5,
        used: 4,
        remaining: 1,
      });

      expect(await c.cancel({ learner: "ana", item: "pset" })).toEqual({ use });
      expect(await c._getBalance({ learner: "ana" })).toEqual({
        granted: 5,
        used: 2,
        remaining: 3,
      });
      expect(await c._getApplied({ learner: "ana", item: "pset" })).toEqual([]);
      expect(await c._getUses({ learner: "ana" })).toEqual([
        { use: expect.any(String), item: "essay", days: 2, status: "APPLIED", appliedAt: T0 },
        { use, item: "pset", days: 2, status: "CANCELED", appliedAt: T1 },
      ]);
    });

    test("grant refuses a non-positive number of days", async () => {
      const c = await make();
      expect(
        await refusalOf(() => c.grant({ learner: "ana", days: 0, reason: "", at: T0 })),
      ).toBeInstanceOf(refusalErrors.LateDaysMustBePositive);
      expect(
        await refusalOf(() => c.grant({ learner: "ana", days: -1, reason: "", at: T0 })),
      ).toBeInstanceOf(refusalErrors.LateDaysMustBePositive);
    });

    test("apply refuses non-positive, over-limit, duplicate, and over-balance uses", async () => {
      const c = await make();
      await seat(c);
      expect(
        await refusalOf(() => c.apply({ learner: "ana", item: "essay", days: 0, at: T0 })),
      ).toBeInstanceOf(refusalErrors.LateDaysMustBePositive);
      expect(
        await refusalOf(() => c.apply({ learner: "ana", item: "essay", days: 3, at: T0 })),
      ).toBeInstanceOf(refusalErrors.LateDaysExceedMax);
      await c.apply({ learner: "ana", item: "essay", days: 2, at: T0 });
      expect(
        await refusalOf(() => c.apply({ learner: "ana", item: "essay", days: 1, at: T0 })),
      ).toBeInstanceOf(refusalErrors.LateUseAlreadyExists);
      expect(
        await refusalOf(() => c.apply({ learner: "ana", item: "pset", days: 2, at: T0 })),
      ).toBeInstanceOf(refusalErrors.InsufficientBalance);
      const ok = await c.apply({ learner: "ana", item: "pset", days: 1, at: T0 });
      expect(await c._getApplied({ learner: "ana", item: "pset" })).toEqual([
        { use: ok.use, days: 1, appliedAt: T0 },
      ]);
    });

    test("change refuses missing, negative, over-limit, and unaffordable uses", async () => {
      const c = await make();
      await seat(c);
      expect(
        await refusalOf(() => c.change({ learner: "ana", item: "essay", days: 1 })),
      ).toBeInstanceOf(refusalErrors.LateUseNotFound);

      await c.apply({ learner: "ana", item: "essay", days: 1, at: T0 });
      expect(
        await refusalOf(() => c.change({ learner: "ana", item: "essay", days: -1 })),
      ).toBeInstanceOf(refusalErrors.LateDaysNegative);
      expect(
        await refusalOf(() => c.change({ learner: "ana", item: "essay", days: 3 })),
      ).toBeInstanceOf(refusalErrors.LateDaysExceedMax);
      await c.apply({ learner: "ana", item: "pset", days: 2, at: T0 });
      expect(
        await refusalOf(() => c.change({ learner: "ana", item: "essay", days: 2 })),
      ).toBeInstanceOf(refusalErrors.InsufficientBalance);
      const { use } = await c.change({ learner: "ana", item: "essay", days: 0 });
      expect(await c._getApplied({ learner: "ana", item: "essay" })).toEqual([
        { use, days: 0, appliedAt: T0 },
      ]);
    });

    test("a use may be changed to zero: it stands applied while spending nothing", async () => {
      const c = await make();
      await seat(c);
      const { use } = await c.apply({ learner: "ana", item: "essay", days: 2, at: T0 });
      expect(await c._getBalance({ learner: "ana" })).toEqual({
        granted: 3,
        used: 2,
        remaining: 1,
      });

      await c.change({ learner: "ana", item: "essay", days: 0 });
      expect(await c._getApplied({ learner: "ana", item: "essay" })).toEqual([
        { use, days: 0, appliedAt: T0 },
      ]);
      expect(await c._getBalance({ learner: "ana" })).toEqual({
        granted: 3,
        used: 0,
        remaining: 3,
      });
      expect(await c._getUsesForItem({ item: "essay" })).toEqual([{ learner: "ana", days: 0 }]);
    });

    test("cancel then reapply makes a fresh use; the canceled one remains on the record", async () => {
      const c = await make();
      await seat(c);
      const first = await c.apply({ learner: "ana", item: "essay", days: 2, at: T0 });
      await c.cancel({ learner: "ana", item: "essay" });
      expect(await refusalOf(() => c.cancel({ learner: "ana", item: "essay" }))).toBeInstanceOf(
        refusalErrors.LateUseNotFound,
      );

      const second = await c.apply({ learner: "ana", item: "essay", days: 1, at: T2 });
      expect(second.use).not.toBe(first.use);
      expect(await c._getApplied({ learner: "ana", item: "essay" })).toEqual([
        { use: second.use, days: 1, appliedAt: T2 },
      ]);
      expect(await c._getUses({ learner: "ana" })).toEqual([
        { use: first.use, item: "essay", days: 2, status: "CANCELED", appliedAt: T0 },
        { use: second.use, item: "essay", days: 1, status: "APPLIED", appliedAt: T2 },
      ]);
    });

    test("cancel refuses when no use stands applied", async () => {
      const c = await make();
      await seat(c);
      expect(await refusalOf(() => c.cancel({ learner: "ana", item: "essay" }))).toBeInstanceOf(
        refusalErrors.LateUseNotFound,
      );
    });

    test("_getUsesForItem lists only applied uses, in creation order", async () => {
      const c = await make();
      await c.setTerms({ allowance: 10, perItemLimit: 5, unitHours: 24 });
      await c.apply({ learner: "ana", item: "essay", days: 2, at: T0 });
      await c.apply({ learner: "ben", item: "essay", days: 3, at: T1 });
      await c.cancel({ learner: "ben", item: "essay" });
      await c.apply({ learner: "cai", item: "essay", days: 1, at: T2 });
      expect(await c._getUsesForItem({ item: "essay" })).toEqual([
        { learner: "ana", days: 2 },
        { learner: "cai", days: 1 },
      ]);
    });
  });
}
