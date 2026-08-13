import { afterAll, describe, expect, test } from "vite-plus/test";
import { MailingConcept } from "../../src/concepts/mailing/mailing.ts";
import { MongoMailingConcept } from "../../src/concepts/mailing/mailing.mongo.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

const floors: [string, () => Promise<MailingConcept | MongoMailingConcept>][] = [
  ["in memory", async () => new MailingConcept()],
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
  });
}
