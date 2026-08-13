import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/notifying/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoNotifyingConcept } from "../../src/concepts/notifying/notifying.mongo.ts";
import { NotifyingConcept } from "../../src/concepts/notifying/notifying.ts";

const floors: [string, () => Promise<NotifyingConcept | MongoNotifyingConcept>][] = [
  ["in memory", async () => new NotifyingConcept()],
  ["on MongoDB", async () => new MongoNotifyingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

const at = new Date("2026-07-13T00:00:00Z");

for (const [floor, make] of floors) {
  describe(`Notifying ${floor}`, () => {
    test("notify lands the notification unread in the recipient's inbox", async () => {
      const notifying = await make();
      const { notification } = await notifying.notify({
        recipient: "mara",
        kind: "reply",
        subject: "p1",
        link: "/p1",
        at,
      });
      expect(typeof notification).toBe("string");
      expect(
        (await notifying._getInbox({ recipient: "mara" })).map((n) => [n.notification, n.read]),
      ).toEqual([[notification, false]]);
      expect(await notifying._getUnreadCount({ recipient: "mara" })).toEqual({ count: 1 });
    });

    test("markRead flips the notification read and drops the unread count", async () => {
      const notifying = await make();
      const { notification } = await notifying.notify({
        recipient: "mara",
        kind: "reply",
        subject: "p1",
        link: "/p1",
        at,
      });
      expect(await notifying.markRead({ notification, recipient: "mara" })).toEqual({
        notification,
      });
      expect((await notifying._getInbox({ recipient: "mara" })).map((n) => n.read)).toEqual([true]);
      expect(await notifying._getUnreadCount({ recipient: "mara" })).toEqual({ count: 0 });
    });

    test("markRead treats another recipient's notification as not found", async () => {
      const notifying = await make();
      const { notification } = await notifying.notify({
        recipient: "mara",
        kind: "reply",
        subject: "p1",
        link: "/p1",
        at,
      });
      expect(
        await refusalOf(() => notifying.markRead({ notification, recipient: "noah" })),
      ).toBeInstanceOf(refusalErrors.NotificationNotFound);
      expect(await notifying._getUnreadCount({ recipient: "mara" })).toEqual({ count: 1 });
    });

    test("markAllRead clears the recipient's unread pile and is idempotent", async () => {
      const notifying = await make();
      await notifying.notify({ recipient: "mara", kind: "reply", subject: "p1", link: "/p1", at });
      await notifying.notify({
        recipient: "mara",
        kind: "mention",
        subject: "p2",
        link: "/p2",
        at,
      });
      await notifying.notify({ recipient: "noah", kind: "reply", subject: "p3", link: "/p3", at });
      expect(await notifying.markAllRead({ recipient: "mara" })).toEqual({ recipient: "mara" });
      expect(await notifying._getUnreadCount({ recipient: "mara" })).toEqual({ count: 0 });
      expect(await notifying._getUnreadCount({ recipient: "noah" })).toEqual({ count: 1 });
      expect(await notifying.markAllRead({ recipient: "mara" })).toEqual({ recipient: "mara" });
      expect(await notifying._getUnreadCount({ recipient: "mara" })).toEqual({ count: 0 });
    });

    test("dismiss removes the notification; a second dismissal refuses", async () => {
      const notifying = await make();
      const { notification } = await notifying.notify({
        recipient: "mara",
        kind: "reply",
        subject: "p1",
        link: "/p1",
        at,
      });
      expect(await notifying.dismiss({ notification, recipient: "mara" })).toEqual({
        notification,
      });
      expect(await notifying._getInbox({ recipient: "mara" })).toEqual([]);
      expect(
        await refusalOf(() => notifying.dismiss({ notification, recipient: "mara" })),
      ).toBeInstanceOf(refusalErrors.NotificationNotFound);
    });

    test("_getInbox is newest-first, ties broken by arrival order", async () => {
      const notifying = await make();
      const earlier = new Date("2026-07-13T00:00:00Z");
      const later = new Date("2026-07-13T01:00:00Z");
      const first = await notifying.notify({
        recipient: "mara",
        kind: "reply",
        subject: "p1",
        link: "/p1",
        at: earlier,
      });
      const second = await notifying.notify({
        recipient: "mara",
        kind: "mention",
        subject: "p2",
        link: "/p2",
        at: later,
      });
      const third = await notifying.notify({
        recipient: "mara",
        kind: "reply",
        subject: "p3",
        link: "/p3",
        at: later,
      });
      expect((await notifying._getInbox({ recipient: "mara" })).map((n) => n.notification)).toEqual(
        [third.notification, second.notification, first.notification],
      );
    });

    test("_getUnreadCount always answers with a single row", async () => {
      const notifying = await make();
      expect(await notifying._getUnreadCount({ recipient: "mara" })).toEqual({ count: 0 });
      await notifying.notify({ recipient: "mara", kind: "reply", subject: "p1", link: "/p1", at });
      await notifying.notify({
        recipient: "mara",
        kind: "mention",
        subject: "p2",
        link: "/p2",
        at,
      });
      expect(await notifying._getUnreadCount({ recipient: "mara" })).toEqual({ count: 2 });
    });

    test("_hasFor answers whether the user has a notification about the subject", async () => {
      const notifying = await make();
      await notifying.notify({
        recipient: "mara",
        kind: "mention",
        subject: "p1",
        link: "/p1",
        at,
      });
      expect(await notifying._hasFor({ user: "mara", subject: "p1" })).toEqual({
        notified: true,
      });
      expect(await notifying._hasFor({ user: "mara", subject: "p2" })).toEqual({
        notified: false,
      });
      expect(await notifying._hasFor({ user: "noah", subject: "p1" })).toEqual({
        notified: false,
      });
      const { notification } = await notifying.notify({
        recipient: "noah",
        kind: "mention",
        subject: "p9",
        link: "/p9",
        at,
      });
      await notifying.dismiss({ notification, recipient: "noah" });
      expect(await notifying._hasFor({ user: "noah", subject: "p9" })).toEqual({
        notified: false,
      });
    });

    test("clearSubject removes every recipient's notification about one subject and is idempotent", async () => {
      const notifying = await make();
      await notifying.notify({ recipient: "mara", kind: "reply", subject: "p1", link: "/p1", at });
      await notifying.notify({
        recipient: "noah",
        kind: "mention",
        subject: "p1",
        link: "/p1",
        at,
      });
      await notifying.notify({ recipient: "mara", kind: "reply", subject: "p2", link: "/p2", at });
      expect(await notifying.clearSubject({ subject: "p1" })).toEqual({ subject: "p1" });
      expect(await notifying._hasFor({ user: "mara", subject: "p1" })).toEqual({
        notified: false,
      });
      expect(await notifying._hasFor({ user: "mara", subject: "p2" })).toEqual({
        notified: true,
      });
      expect(await notifying.clearSubject({ subject: "p1" })).toEqual({ subject: "p1" });
    });
  });
}
