import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/subscribing/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoSubscribingConcept } from "../../src/concepts/subscribing/subscribing.mongo.ts";

const floors: [string, () => Promise<MongoSubscribingConcept>][] = [
  ["on MongoDB", async () => new MongoSubscribingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

const at = (iso: string) => new Date(iso);

for (const [floor, make] of floors) {
  describe(`Subscribing ${floor}`, () => {
    test("subscribe records the interest; a person is among the target's subscribers", async () => {
      const subscribing = await make();
      const { subscription } = await subscribing.subscribe({
        user: "mara",
        target: "t1",
        at: at("2026-07-13T00:00:00Z"),
      });
      expect(typeof subscription).toBe("string");
      await subscribing.subscribe({ user: "noah", target: "t1", at: at("2026-07-13T00:01:00Z") });
      expect((await subscribing._getSubscribers({ target: "t1" })).map((r) => r.user)).toEqual([
        "mara",
        "noah",
      ]);
    });

    test("one subscription per (user, target) — the duplicate refuses", async () => {
      const subscribing = await make();
      await subscribing.subscribe({ user: "mara", target: "t1", at: at("2026-07-13T00:00:00Z") });
      expect(
        await refusalOf(() =>
          subscribing.subscribe({ user: "mara", target: "t1", at: at("2026-07-13T00:05:00Z") }),
        ),
      ).toBeInstanceOf(refusalErrors.AlreadySubscribed);
    });

    test("unsubscribe drops exactly the named subscription; a second drop refuses", async () => {
      const subscribing = await make();
      await subscribing.subscribe({ user: "mara", target: "t1", at: at("2026-07-13T00:00:00Z") });
      await subscribing.subscribe({ user: "mara", target: "t2", at: at("2026-07-13T00:01:00Z") });
      await subscribing.unsubscribe({ user: "mara", target: "t1" });
      expect((await subscribing._getSubscriptions({ user: "mara" })).map((r) => r.target)).toEqual([
        "t2",
      ]);
      expect(
        await refusalOf(() => subscribing.unsubscribe({ user: "mara", target: "t1" })),
      ).toBeInstanceOf(refusalErrors.NotSubscribed);
    });

    test("the standing questions: subscriptions newest-first, is-subscribed always answers", async () => {
      const subscribing = await make();
      await subscribing.subscribe({ user: "mara", target: "t1", at: at("2026-07-13T00:00:00Z") });
      await subscribing.subscribe({ user: "mara", target: "t2", at: at("2026-07-13T00:02:00Z") });
      await subscribing.subscribe({ user: "noah", target: "t1", at: at("2026-07-13T00:03:00Z") });
      expect((await subscribing._getSubscriptions({ user: "mara" })).map((r) => r.target)).toEqual([
        "t2",
        "t1",
      ]);
      expect(await subscribing._isSubscribed({ user: "mara", target: "t1" })).toEqual({
        subscribed: true,
      });
      expect(await subscribing._isSubscribed({ user: "mara", target: "t3" })).toEqual({
        subscribed: false,
      });
      expect(await subscribing._isSubscribed({ user: "noah", target: "t2" })).toEqual({
        subscribed: false,
      });
    });

    test("clearTarget removes every subscriber from one target and is idempotent", async () => {
      const subscribing = await make();
      await subscribing.subscribe({ user: "mara", target: "t1", at: at("2026-07-13T00:00:00Z") });
      await subscribing.subscribe({ user: "noah", target: "t1", at: at("2026-07-13T00:01:00Z") });
      await subscribing.subscribe({ user: "mara", target: "t2", at: at("2026-07-13T00:02:00Z") });
      expect(await subscribing.clearTarget({ target: "t1" })).toEqual({ target: "t1" });
      expect(await subscribing._getSubscribers({ target: "t1" })).toEqual([]);
      expect(await subscribing._isSubscribed({ user: "mara", target: "t2" })).toEqual({
        subscribed: true,
      });
      expect(await subscribing.clearTarget({ target: "t1" })).toEqual({ target: "t1" });
    });
  });
}
