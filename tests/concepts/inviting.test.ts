import { afterAll, describe, expect, test } from "vite-plus/test";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { InvitingConcept } from "../../src/concepts/inviting/inviting.ts";
import { MongoInvitingConcept } from "../../src/concepts/inviting/inviting.mongo.ts";

const floors: [string, () => Promise<InvitingConcept | MongoInvitingConcept>][] = [
  ["in memory", async () => new InvitingConcept()],
  ["on MongoDB", async () => new MongoInvitingConcept(await testDb())],
];

afterAll(stopTestDb);

for (const [floor, make] of floors) {
  describe(`Inviting ${floor}`, () => {
    test("re-inviting a channel and address preserves the credential", async () => {
      const inviting = await make();
      const first = await inviting.invite({
        channel: "sms",
        address: "+1-617-555-0100",
        at: new Date("2026-01-01T00:00:00Z"),
      });
      const again = await inviting.invite({
        channel: "sms",
        address: "+1-617-555-0100",
        at: new Date("2046-01-01T00:00:00Z"),
      });
      expect(again).toMatchObject({
        invitation: first.invitation,
        channel: "sms",
        address: "+1-617-555-0100",
        credential: first.credential,
        created: false,
      });
      expect(await inviting._getAvailable(first)).toEqual([
        { channel: "sms", address: "+1-617-555-0100" },
      ]);
    });

    test("channels distinguish the same address and claims are one-use", async () => {
      const inviting = await make();
      const issued = await inviting.invite({
        channel: "email",
        address: "one@example.edu",
        at: new Date(),
      });
      const otherChannel = await inviting.invite({
        channel: "directory",
        address: "one@example.edu",
        at: new Date(),
      });
      expect(otherChannel.invitation).not.toBe(issued.invitation);
      expect(await inviting.claim({ ...issued, user: "user-1" })).toMatchObject({
        invitation: issued.invitation,
        channel: "email",
        address: "one@example.edu",
      });
      expect(await inviting._getAvailable(issued)).toEqual([]);
    });
  });
}
