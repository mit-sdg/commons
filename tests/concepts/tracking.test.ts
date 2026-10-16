import { MongoClient } from "mongodb";
import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/tracking/errors.ts";
import { caughtError, stopTestDb, testDb, testDbUri } from "../../src/concepts/testing.ts";
import { MongoTrackingConcept } from "../../src/concepts/tracking/tracking.mongo.ts";

const floors: [string, () => Promise<MongoTrackingConcept>][] = [
  ["on MongoDB", async () => new MongoTrackingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

for (const [floor, make] of floors) {
  describe(`Tracking ${floor}`, () => {
    test("register places the item in its scope", async () => {
      const tracking = await make();
      expect(await tracking.register({ item: "discussion-1", scope: "algebra" })).toEqual({
        item: "discussion-1",
      });
      await tracking.register({ item: "discussion-2", scope: "algebra" });
      await tracking.register({ item: "discussion-3", scope: "biology" });
      expect(await tracking._inScope({ scope: "algebra" })).toEqual([
        { item: "discussion-1" },
        { item: "discussion-2" },
      ]);
    });

    test("register refuses an item that is already tracked", async () => {
      const tracking = await make();
      await tracking.register({ item: "discussion-1", scope: "algebra" });
      expect(
        await refusalOf(() => tracking.register({ item: "discussion-1", scope: "biology" })),
      ).toBeInstanceOf(refusalErrors.ItemAlreadyRegistered);
    });

    test("unregister removes the item and is idempotent", async () => {
      const tracking = await make();
      await tracking.register({ item: "discussion-1", scope: "algebra" });
      expect(await tracking.unregister({ item: "discussion-1" })).toEqual({ item: "discussion-1" });
      expect(await tracking._inScope({ scope: "algebra" })).toEqual([]);
      expect(await tracking.unregister({ item: "discussion-1" })).toEqual({ item: "discussion-1" });
    });

    test("unread lists registered-but-unseen items in registration order", async () => {
      const tracking = await make();
      await tracking.register({ item: "p1", scope: "c1" });
      await tracking.register({ item: "r1", scope: "c1" });
      await tracking.register({ item: "r2", scope: "c1" });
      await tracking.register({ item: "other", scope: "c2" });
      expect(await tracking._getUnread({ user: "bob", scope: "c1" })).toEqual([
        { item: "p1" },
        { item: "r1" },
        { item: "r2" },
      ]);
      expect(await tracking._getUnreadCount({ user: "bob", scope: "c1" })).toEqual({ count: 3 });
      expect(await tracking._getUnread({ user: "bob", scope: "ghost" })).toEqual([]);
    });

    test("markSeen drops the item from the reader's unread; the duplicate and the ghost refuse", async () => {
      const tracking = await make();
      await tracking.register({ item: "p1", scope: "c1" });
      await tracking.register({ item: "r1", scope: "c1" });
      expect(await tracking.markSeen({ user: "bob", item: "p1" })).toEqual({ item: "p1" });
      expect(await tracking._getUnreadCount({ user: "bob", scope: "c1" })).toEqual({ count: 1 });
      expect(await tracking._getUnreadCount({ user: "ada", scope: "c1" })).toEqual({ count: 2 });
      expect(await refusalOf(() => tracking.markSeen({ user: "bob", item: "p1" }))).toBeInstanceOf(
        refusalErrors.ItemAlreadySeen,
      );
      expect(
        await refusalOf(() => tracking.markSeen({ user: "bob", item: "ghost" })),
      ).toBeInstanceOf(refusalErrors.ItemNotRegistered);
    });

    test("markAllSeen sweeps the scope and is idempotent", async () => {
      const tracking = await make();
      await tracking.register({ item: "p1", scope: "c1" });
      await tracking.register({ item: "r1", scope: "c1" });
      await tracking.register({ item: "other", scope: "c2" });
      expect(await tracking.markAllSeen({ user: "bob", scope: "c1" })).toEqual({ user: "bob" });
      expect(await tracking._getUnreadCount({ user: "bob", scope: "c1" })).toEqual({ count: 0 });
      expect(await tracking._getUnreadCount({ user: "bob", scope: "c2" })).toEqual({ count: 1 });
      expect(await tracking.markAllSeen({ user: "bob", scope: "c1" })).toEqual({ user: "bob" });
    });

    test("markEachSeen marks the listed registered items once and skips the rest", async () => {
      const tracking = await make();
      await tracking.register({ item: "p1", scope: "c1" });
      await tracking.register({ item: "p2", scope: "c1" });
      await tracking.register({ item: "p3", scope: "c1" });
      await tracking.markSeen({ user: "bob", item: "p1" });
      expect(
        await tracking.markEachSeen({
          user: "bob",
          items: [{ item: "p1" }, { item: "p2" }, { item: "p2" }, { item: "ghost" }],
        }),
      ).toEqual({ user: "bob" });
      expect(await tracking._getUnread({ user: "bob", scope: "c1" })).toEqual([{ item: "p3" }]);
      expect(await tracking._getUnreadCount({ user: "ann", scope: "c1" })).toEqual({ count: 3 });
      expect(await tracking.markEachSeen({ user: "bob", items: [] })).toEqual({ user: "bob" });
      await expect(tracking.markEachSeen({ user: "bob", items: [{ post: "p3" }] })).rejects.toThrow(
        "every row needs an item",
      );
      await tracking.unregister({ item: "p2" });
      await tracking.register({ item: "p2", scope: "c1" });
      expect(await tracking._getUnreadCount({ user: "bob", scope: "c1" })).toEqual({ count: 2 });
    });

    test("unregister also clears the item's seen-marks", async () => {
      const tracking = await make();
      await tracking.register({ item: "p1", scope: "c1" });
      await tracking.markSeen({ user: "bob", item: "p1" });
      await tracking.unregister({ item: "p1" });
      await tracking.register({ item: "p1", scope: "c1" });
      expect(await tracking._getUnreadCount({ user: "bob", scope: "c1" })).toEqual({ count: 1 });
    });
  });
}

test("unread reads every seen-mark of the scope in one find and answers as before", async () => {
  const db = await testDb();
  const monitored = new MongoClient(await testDbUri(), { monitorCommands: true });
  await monitored.connect();
  try {
    const tracking = new MongoTrackingConcept(monitored.db(db.databaseName));
    // Registration order differs from the items' sort order, so an answer in
    // index order instead of registration order would show.
    for (const item of ["r9", "a1", "m5", "c3", "z0"]) {
      await tracking.register({ item, scope: "c1" });
    }
    await tracking.register({ item: "b2", scope: "c2" });
    await tracking.markSeen({ user: "bob", item: "a1" });
    await tracking.markSeen({ user: "bob", item: "c3" });
    await tracking.markSeen({ user: "ada", item: "m5" });
    await tracking.markSeen({ user: "bob", item: "b2" });

    const finds: string[] = [];
    monitored.on("commandStarted", (event) => {
      if (event.commandName === "find") finds.push(String(event.command.find));
    });
    expect(await tracking._getUnread({ user: "bob", scope: "c1" })).toEqual([
      { item: "r9" },
      { item: "m5" },
      { item: "z0" },
    ]);
    expect(finds).toEqual(["tracking.registered", "tracking.seen"]);

    finds.length = 0;
    expect(await tracking._getUnread({ user: "ada", scope: "c1" })).toEqual([
      { item: "r9" },
      { item: "a1" },
      { item: "c3" },
      { item: "z0" },
    ]);
    expect(await tracking._getUnread({ user: "nobody", scope: "c1" })).toEqual([
      { item: "r9" },
      { item: "a1" },
      { item: "m5" },
      { item: "c3" },
      { item: "z0" },
    ]);
    expect(await tracking._getUnread({ user: "bob", scope: "c2" })).toEqual([]);
    expect(await tracking._getUnread({ user: "bob", scope: "ghost" })).toEqual([]);
    expect(await tracking._getUnreadCount({ user: "bob", scope: "c1" })).toEqual({ count: 3 });
    expect(finds.filter((collection) => collection === "tracking.seen")).toHaveLength(4);
  } finally {
    await monitored.close();
  }
});
