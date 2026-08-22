import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/inviting/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoInvitingConcept } from "../../src/concepts/inviting/inviting.mongo.ts";

const floors: [string, () => Promise<MongoInvitingConcept>][] = [
  ["on MongoDB", async () => new MongoInvitingConcept(await testDb())],
];

afterAll(stopTestDb);

type RefusalClass = abstract new (...args: never[]) => Error;

const expectRefusal = async (fn: () => unknown, Refusal: RefusalClass) => {
  expect(await caughtError(fn)).toBeInstanceOf(Refusal);
};

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

    test("retract deletes an unclaimed invitation and returns {}", async () => {
      const inviting = await make();
      const issued = await inviting.invite({
        channel: "email",
        address: "retract-me@example.edu",
        at: new Date("2026-01-01T00:00:00Z"),
      });
      expect(await inviting.retract({ invitation: issued.invitation })).toEqual({});
      expect(await inviting._getAvailable(issued)).toEqual([]);
      const all = await inviting._getInvitations({});
      expect(all.some((inv) => inv.invitation === issued.invitation)).toBe(false);
      await expectRefusal(
        () =>
          inviting.verify({
            invitation: issued.invitation,
            credential: issued.credential,
            channel: issued.channel,
          }),
        refusalErrors.InvitationInvalid,
      );
      await expectRefusal(
        () =>
          inviting.claim({
            invitation: issued.invitation,
            credential: issued.credential,
            user: "user-2",
          }),
        refusalErrors.InvitationInvalid,
      );
    });

    test("retract refuses an unknown invitation", async () => {
      const inviting = await make();
      await expectRefusal(
        () => inviting.retract({ invitation: "nonexistent-invitation-id" }),
        refusalErrors.InvitationNotFound,
      );
    });

    test("retract refuses an already claimed invitation", async () => {
      const inviting = await make();
      const issued = await inviting.invite({
        channel: "email",
        address: "claimed@example.edu",
        at: new Date("2026-01-01T00:00:00Z"),
      });
      await inviting.claim({ ...issued, user: "user-claimed" });
      await expectRefusal(
        () => inviting.retract({ invitation: issued.invitation }),
        refusalErrors.InvitationAlreadyClaimed,
      );
    });

    test("retracting an already retracted invitation is refused", async () => {
      const inviting = await make();
      const issued = await inviting.invite({
        channel: "email",
        address: "double-retract@example.edu",
        at: new Date("2026-01-01T00:00:00Z"),
      });
      expect(await inviting.retract({ invitation: issued.invitation })).toEqual({});
      await expectRefusal(
        () => inviting.retract({ invitation: issued.invitation }),
        refusalErrors.InvitationNotFound,
      );
    });

    test("_getInvitations returns all invitations sorted by createdAt newest to oldest", async () => {
      const inviting = await make();
      expect(await inviting._getInvitations({})).toEqual([]);
      const inv1 = await inviting.invite({
        channel: "email",
        address: "first@example.edu",
        at: new Date("2026-01-01T00:00:00Z"),
      });
      const inv2 = await inviting.invite({
        channel: "email",
        address: "second@example.edu",
        at: new Date("2026-02-01T00:00:00Z"),
      });
      const list = await inviting._getInvitations({});
      expect(list).toHaveLength(2);
      expect(list[0].invitation).toBe(inv2.invitation);
      expect(list[1].invitation).toBe(inv1.invitation);
      expect(list[0].user).toBeNull();
    });
  });
}
