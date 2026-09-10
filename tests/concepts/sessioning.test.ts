import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/sessioning/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoSessioningConcept } from "../../src/concepts/sessioning/sessioning.mongo.ts";

const floors: [string, () => Promise<MongoSessioningConcept>][] = [
  ["on MongoDB", async () => new MongoSessioningConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;
const startedAt = new Date("2026-07-19T12:00:00.000Z");
const beforeExpiry = new Date("2026-07-22T11:59:59.999Z");
const atExpiry = new Date("2026-07-22T12:00:00.000Z");

for (const [floor, make] of floors) {
  describe(`Sessioning ${floor}`, () => {
    test("start creates a session answering for the user", async () => {
      const sessioning = await make();
      const { session, expiresAt } = await sessioning.start({ user: "maya", at: startedAt });
      expect(expiresAt).toEqual(atExpiry);
      expect(await sessioning._getUser({ session, at: beforeExpiry })).toEqual([{ user: "maya" }]);
    });

    test("end removes the session; it no longer answers for anyone", async () => {
      const sessioning = await make();
      const { session } = await sessioning.start({ user: "maya", at: startedAt });
      expect(await sessioning.end({ session })).toEqual({ session });
      expect(await sessioning._getUser({ session, at: beforeExpiry })).toEqual([]);
    });

    test("ending an unknown session refuses with SESSION_NOT_FOUND", async () => {
      const sessioning = await make();
      const err = await refusal(() => sessioning.end({ session: "no-such-session" }));
      expect(err).toBeInstanceOf(refusalErrors.SessionNotFound);
    });

    test("endAllForUser revokes every session for the user and is idempotent", async () => {
      const sessioning = await make();
      const a = (await sessioning.start({ user: "maya", at: startedAt })).session;
      const b = (await sessioning.start({ user: "maya", at: startedAt })).session;
      const other = (await sessioning.start({ user: "omar", at: startedAt })).session;
      expect(await sessioning.endAllForUser({ user: "maya" })).toEqual({ user: "maya" });
      expect(await sessioning._getUser({ session: a, at: beforeExpiry })).toEqual([]);
      expect(await sessioning._getUser({ session: b, at: beforeExpiry })).toEqual([]);
      expect(await sessioning._getUser({ session: other, at: beforeExpiry })).toEqual([
        { user: "omar" },
      ]);
      expect(await sessioning.endAllForUser({ user: "maya" })).toEqual({ user: "maya" });
    });

    test("the 72-hour boundary is exclusive", async () => {
      const sessioning = await make();
      const { session } = await sessioning.start({ user: "maya", at: startedAt });
      expect(await sessioning._getUser({ session, at: beforeExpiry })).toEqual([{ user: "maya" }]);
      expect(await sessioning._isExpired({ session, at: beforeExpiry })).toEqual({
        expired: false,
      });
      expect(await sessioning._getUser({ session, at: atExpiry })).toEqual([]);
      expect(await sessioning._isExpired({ session, at: atExpiry })).toEqual({ expired: true });
    });
  });
}

test("MongoDB retains the expiry across a fresh concept instance", async () => {
  const db = await testDb();
  const first = new MongoSessioningConcept(db);
  const { session } = await first.start({ user: "restart-user", at: startedAt });
  const restarted = new MongoSessioningConcept(db);
  expect(await restarted._getUser({ session, at: beforeExpiry })).toEqual([
    { user: "restart-user" },
  ]);
  expect(await restarted._getUser({ session, at: atExpiry })).toEqual([]);
});

test.each([
  ["2026-10-31T12:34:56.789Z", "2027-02-28T12:34:56.789Z"],
  ["2027-10-31T12:34:56.789Z", "2028-02-29T12:34:56.789Z"],
  ["2026-07-19T12:00:00.000Z", "2026-11-19T12:00:00.000Z"],
])("the four-month UTC cap clamps month ends: %s", async (start, cap) => {
  const sessioning = new MongoSessioningConcept(await testDb());
  const result = await sessioning.start({ user: "maya", at: new Date(start) });
  expect(result.absoluteExpiresAt).toEqual(new Date(cap));
});

test("refresh slides persisted expiry, never shortens it, and stops at the absolute cap", async () => {
  const db = await testDb();
  let now = startedAt;
  const sessioning = new MongoSessioningConcept(db, () => now);
  const { session, absoluteExpiresAt } = await sessioning.start({ user: "maya" });
  const records = db.collection<{ _id: string; expiresAt: Date }>("sessioning.sessions");
  now = new Date("2026-07-21T12:00:00Z");
  expect(await sessioning.refresh({ session })).toEqual({ session, refreshed: true });
  expect((await records.findOne({ _id: session }))?.expiresAt).toEqual(
    new Date("2026-07-24T12:00:00Z"),
  );
  now = startedAt; // A clock correction must not shorten the stored deadline.
  await sessioning.refresh({ session });
  expect((await records.findOne({ _id: session }))?.expiresAt).toEqual(
    new Date("2026-07-24T12:00:00Z"),
  );
  const restarted = new MongoSessioningConcept(db, () => now);
  for (
    now = new Date("2026-07-23T12:00:00Z");
    now < absoluteExpiresAt;
    now = new Date(now.getTime() + 48 * 3_600_000)
  ) {
    expect((await restarted.refresh({ session })).refreshed).toBe(true);
  }
  expect((await records.findOne({ _id: session }))?.expiresAt).toEqual(absoluteExpiresAt);
  now = new Date(absoluteExpiresAt.getTime() - 1);
  expect(await restarted._getUser({ session })).toEqual([{ user: "maya" }]);
  now = absoluteExpiresAt;
  expect(await restarted.refresh({ session })).toEqual({ session, refreshed: false });
  expect(await restarted._getUser({ session })).toEqual([]);
});

test("unknown, idle-expired, and legacy sessions cannot refresh", async () => {
  const db = await testDb();
  let now = startedAt;
  const sessioning = new MongoSessioningConcept(db, () => now);
  const { session } = await sessioning.start({ user: "maya" });
  now = atExpiry;
  expect((await sessioning.refresh({ session })).refreshed).toBe(false);
  expect((await sessioning.refresh({ session: "missing" })).refreshed).toBe(false);
  const records = db.collection<{ _id: string; user: string; expiresAt: Date }>(
    "sessioning.sessions",
  );
  const legacyExpiry = new Date(startedAt.getTime() + 24 * 3_600_000);
  await records.insertOne({ _id: "legacy", user: "maya", expiresAt: legacyExpiry });
  now = startedAt;
  expect((await sessioning.refresh({ session: "legacy" })).refreshed).toBe(false);
  expect(await sessioning._getUser({ session: "legacy" })).toEqual([{ user: "maya" }]);
  expect((await records.findOne({ _id: "legacy" }))?.expiresAt).toEqual(legacyExpiry);
  now = legacyExpiry;
  expect(await sessioning._getUser({ session: "legacy" })).toEqual([]);
});

test("independent instances can renew concurrently without defeating session or user revocation", async () => {
  const db = await testDb();
  const first = new MongoSessioningConcept(db, () => new Date("2026-07-20T12:00:00Z"));
  const second = new MongoSessioningConcept(db, () => new Date("2026-07-21T12:00:00Z"));
  const records = db.collection<{ _id: string; expiresAt: Date }>("sessioning.sessions");
  for (let i = 0; i < 10; i++) {
    const { session } = await first.start({ user: "maya", at: startedAt });
    await Promise.all([first.refresh({ session }), second.refresh({ session })]);
    expect((await records.findOne({ _id: session }))?.expiresAt).toEqual(
      new Date("2026-07-24T12:00:00Z"),
    );
    const revoke = () =>
      i % 2 === 0 ? first.end({ session }) : first.endAllForUser({ user: "maya" });
    await Promise.all(
      i % 2 === 0
        ? [revoke(), second.refresh({ session })]
        : [second.refresh({ session }), revoke()],
    );
    expect(await records.findOne({ _id: session })).toBeNull();
    expect((await first.refresh({ session })).refreshed).toBe(false);
  }
});
