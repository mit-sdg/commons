import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "./errors.ts";
import { caughtError, stopTestDb, testDb } from "../testing.ts";
import { MongoSessioningConcept } from "./sessioning.mongo.ts";
import { SessioningConcept } from "./sessioning.ts";

const floors: [string, () => Promise<SessioningConcept | MongoSessioningConcept>][] = [
  ["in memory", async () => new SessioningConcept()],
  ["on MongoDB", async () => new MongoSessioningConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;
const startedAt = new Date("2026-07-19T12:00:00.000Z");
const beforeExpiry = new Date("2026-07-20T11:59:59.999Z");
const atExpiry = new Date("2026-07-20T12:00:00.000Z");

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

    test("the one-day boundary is exclusive", async () => {
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
