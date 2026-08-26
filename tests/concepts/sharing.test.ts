import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/sharing/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoSharingConcept } from "../../src/concepts/sharing/sharing.mongo.ts";

const floors: [string, () => Promise<MongoSharingConcept>][] = [
  ["on MongoDB", async () => new MongoSharingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

for (const [floor, make] of floors) {
  describe(`Sharing ${floor}`, () => {
    test("issue mints a token that opens onto the subject", async () => {
      const sharing = await make();
      const { share, token } = await sharing.issue({ subject: "edition-1" });
      expect(token).not.toBe("");
      expect(token).not.toBe(share);
      expect(await sharing.open({ token })).toEqual({ subject: "edition-1" });
      expect(await sharing._share({ token })).toEqual([{ share, subject: "edition-1" }]);
    });

    test("a token opens onto the same subject however many times it is presented", async () => {
      const sharing = await make();
      const { token } = await sharing.issue({ subject: "edition-1" });
      expect(await sharing.open({ token })).toEqual({ subject: "edition-1" });
      expect(await sharing.open({ token })).toEqual({ subject: "edition-1" });
    });

    test("a mistyped token reaches nothing", async () => {
      const sharing = await make();
      await sharing.issue({ subject: "edition-1" });
      const err = await refusal(() => sharing.open({ token: "mistyped" }));
      expect(err).toBeInstanceOf(refusalErrors.NothingShared);
      expect(await sharing._share({ token: "mistyped" })).toEqual([]);
    });

    test("distinct subjects get distinct tokens", async () => {
      const sharing = await make();
      const first = await sharing.issue({ subject: "edition-1" });
      const second = await sharing.issue({ subject: "edition-2" });
      expect(first.token).not.toBe(second.token);
      expect(first.share).not.toBe(second.share);
      expect(await sharing.open({ token: first.token })).toEqual({ subject: "edition-1" });
      expect(await sharing.open({ token: second.token })).toEqual({ subject: "edition-2" });
    });

    test("a subject may hold several shares, answered in issue order", async () => {
      const sharing = await make();
      const first = await sharing.issue({ subject: "edition-1" });
      const second = await sharing.issue({ subject: "edition-1" });
      expect(first.token).not.toBe(second.token);
      expect(await sharing._sharesFor({ subject: "edition-1" })).toEqual([
        { share: first.share, token: first.token },
        { share: second.share, token: second.token },
      ]);
      expect(await sharing.open({ token: second.token })).toEqual({ subject: "edition-1" });
    });

    test("_sharesFor answers no rows for a subject nobody shared", async () => {
      const sharing = await make();
      expect(await sharing._sharesFor({ subject: "edition-9" })).toEqual([]);
      await sharing.issue({ subject: "edition-1" });
      expect(await sharing._sharesFor({ subject: "edition-9" })).toEqual([]);
    });
  });
}
