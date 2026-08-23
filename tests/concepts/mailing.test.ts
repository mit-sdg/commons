import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/mailing/errors.ts";
import { MongoMailingConcept } from "../../src/concepts/mailing/mailing.mongo.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";

const floors: [string, () => Promise<MongoMailingConcept>][] = [
  ["on MongoDB", async () => new MongoMailingConcept(await testDb())],
];

afterAll(stopTestDb);

for (const [floor, make] of floors) {
  describe(`Mailing ${floor}`, () => {
    test("normalizes valid recipients and rejects invalid ones", async () => {
      const mailing = await make();
      expect(mailing.normalizeRecipient({ recipient: " Member@Example.edu " })).toEqual({
        recipient: "member@example.edu",
      });
      expect(() => mailing.normalizeRecipient({ recipient: "not-an-address" })).toThrow();
    });

    test("enqueue is keyed and markSent removes mail from the pending outbox", async () => {
      const mailing = await make();
      const input = {
        key: "invite-1",
        recipient: " Member@Example.edu ",
        subject: "Invitation",
        text: "temporary",
        html: "<p>temporary</p>",
        at: new Date("2026-01-01T00:00:00Z"),
      };
      const first = await mailing.enqueue(input);
      expect(await mailing.enqueue(input)).toEqual(first);
      expect(await mailing._getPending({})).toMatchObject([{ recipient: "member@example.edu" }]);
      await mailing.markSent({ message: first.message, at: new Date() });
      expect(await mailing._getPending({})).toEqual([]);
      expect(await mailing.enqueue({ ...input, at: new Date() })).toEqual(first);
      expect(await mailing._getPending({})).toHaveLength(1);
    });

    test("markFailed counts the attempt and keeps the message queued", async () => {
      const mailing = await make();
      const at = new Date("2026-01-01T00:00:00Z");
      const { message } = await mailing.enqueue({
        key: "invite-failing",
        recipient: "member@example.edu",
        subject: "Invitation",
        text: "temporary",
        html: "<p>temporary</p>",
        at,
      });

      expect(await mailing._getMessages({})).toMatchObject([
        { message, attempts: 0, sentAt: null, lastError: null, lastAttemptAt: null },
      ]);

      const firstFailure = new Date("2026-01-01T00:01:00Z");
      await mailing.markFailed({ message, error: "connection refused", at: firstFailure });
      await mailing.markFailed({
        message,
        error: "mailbox unavailable",
        at: new Date("2026-01-01T00:02:00Z"),
      });

      expect(await mailing._getMessages({})).toMatchObject([
        {
          message,
          attempts: 2,
          sentAt: null,
          lastError: "mailbox unavailable",
          lastAttemptAt: new Date("2026-01-01T00:02:00Z"),
        },
      ]);
      // A failure must not take the message out of the delivery queue.
      expect(await mailing._getPending({})).toHaveLength(1);

      await mailing.markSent({ message, at: new Date("2026-01-01T00:03:00Z") });
      expect(await mailing._getMessages({})).toMatchObject([
        { message, attempts: 2, lastError: null },
      ]);
      expect(await mailing._getPending({})).toEqual([]);
    });

    test("markFailed refuses a message that does not exist", async () => {
      const mailing = await make();
      expect(
        await caughtError(() =>
          mailing.markFailed({ message: "nope", error: "boom", at: new Date() }),
        ),
      ).toBeInstanceOf(refusalErrors.MailNotFound);
    });

    test("_getMessages lists the whole outbox newest first, without bodies", async () => {
      const mailing = await make();
      const base = {
        recipient: "member@example.edu",
        subject: "Invitation",
        text: "temporary",
        html: "<p>temporary</p>",
      };
      await mailing.enqueue({ ...base, key: "older", at: new Date("2026-01-01T00:00:00Z") });
      const newer = await mailing.enqueue({
        ...base,
        key: "newer",
        at: new Date("2026-02-01T00:00:00Z"),
      });

      const listed = await mailing._getMessages({});
      expect(listed).toHaveLength(2);
      expect(listed[0].message).toBe(newer.message);
      expect(listed[0]).not.toHaveProperty("text");
      expect(listed[0]).not.toHaveProperty("html");
    });
  });
}
