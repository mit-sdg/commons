import { afterAll, describe, expect, test } from "vite-plus/test";
import { VoucherExpiryInvalid, VoucherInvalid } from "../../src/concepts/vouching/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoVouchingConcept } from "../../src/concepts/vouching/vouching.mongo.ts";

const floors: [string, () => Promise<MongoVouchingConcept>][] = [
  ["on MongoDB", async () => new MongoVouchingConcept(await testDb())],
];

afterAll(stopTestDb);

type RefusalClass = abstract new (...args: never[]) => Error;

const expectRefusal = async (fn: () => unknown, Refusal: RefusalClass) => {
  expect(await caughtError(fn)).toBeInstanceOf(Refusal);
};

const issuedAt = new Date("2026-01-01T00:00:00Z");
const expiresAt = new Date("2026-01-01T01:00:00Z");
const beforeExpiry = new Date("2026-01-01T00:30:00Z");
const afterExpiry = new Date("2026-01-01T02:00:00Z");

for (const [floor, make] of floors) {
  describe(`Vouching ${floor}`, () => {
    test("issuing refuses an expiry that does not follow the issue time", async () => {
      const vouching = await make();
      await expectRefusal(
        () => vouching.issue({ subject: "user-1", at: issuedAt, expiresAt: issuedAt }),
        VoucherExpiryInvalid,
      );
    });

    test("verifying leaves the voucher usable and redeeming consumes it", async () => {
      const vouching = await make();
      const issued = await vouching.issue({ subject: "user-1", at: issuedAt, expiresAt });
      expect(issued.credential.startsWith("R-")).toBe(true);

      expect(await vouching.verify({ ...issued, at: beforeExpiry })).toEqual({
        voucher: issued.voucher,
        subject: "user-1",
      });
      expect(await vouching.verify({ ...issued, at: beforeExpiry })).toEqual({
        voucher: issued.voucher,
        subject: "user-1",
      });

      expect(await vouching.redeem({ ...issued, at: beforeExpiry })).toEqual({
        voucher: issued.voucher,
        subject: "user-1",
      });
      await expectRefusal(() => vouching.redeem({ ...issued, at: beforeExpiry }), VoucherInvalid);
    });

    test("redeeming discards the subject's other vouchers but nobody else's", async () => {
      const vouching = await make();
      const first = await vouching.issue({ subject: "user-1", at: issuedAt, expiresAt });
      const second = await vouching.issue({ subject: "user-1", at: beforeExpiry, expiresAt });
      const other = await vouching.issue({ subject: "user-2", at: issuedAt, expiresAt });

      await vouching.redeem({ ...second, at: beforeExpiry });
      await expectRefusal(() => vouching.redeem({ ...first, at: beforeExpiry }), VoucherInvalid);
      expect(await vouching._getForSubject({ subject: "user-1" })).toEqual([]);
      expect(await vouching.verify({ ...other, at: beforeExpiry })).toEqual({
        voucher: other.voucher,
        subject: "user-2",
      });
    });

    test("a wrong credential and a lapsed voucher receive the same refusal", async () => {
      const vouching = await make();
      const issued = await vouching.issue({ subject: "user-1", at: issuedAt, expiresAt });
      await expectRefusal(
        () =>
          vouching.verify({ voucher: issued.voucher, credential: "R-guessed", at: beforeExpiry }),
        VoucherInvalid,
      );
      await expectRefusal(() => vouching.verify({ ...issued, at: expiresAt }), VoucherInvalid);
      await expectRefusal(() => vouching.redeem({ ...issued, at: afterExpiry }), VoucherInvalid);
    });

    test("issuing prunes the subject's expired vouchers", async () => {
      const vouching = await make();
      const stale = await vouching.issue({ subject: "user-1", at: issuedAt, expiresAt });
      const laterExpiry = new Date("2026-01-01T03:00:00Z");
      const fresh = await vouching.issue({
        subject: "user-1",
        at: afterExpiry,
        expiresAt: laterExpiry,
      });

      const remaining = await vouching._getForSubject({ subject: "user-1" });
      expect(remaining).toEqual([
        { voucher: fresh.voucher, issuedAt: afterExpiry, expiresAt: laterExpiry },
      ]);
      expect(remaining.map((row) => row.voucher)).not.toContain(stale.voucher);
    });

    test("vouchers list newest first without credentials", async () => {
      const vouching = await make();
      const first = await vouching.issue({ subject: "user-1", at: issuedAt, expiresAt });
      const second = await vouching.issue({
        subject: "user-1",
        at: beforeExpiry,
        expiresAt,
      });
      expect(await vouching._getForSubject({ subject: "user-1" })).toEqual([
        { voucher: second.voucher, issuedAt: beforeExpiry, expiresAt },
        { voucher: first.voucher, issuedAt: issuedAt, expiresAt },
      ]);
    });
  });
}
