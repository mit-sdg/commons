import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/profiling/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoProfilingConcept } from "../../src/concepts/profiling/profiling.mongo.ts";

const floors: [string, () => Promise<MongoProfilingConcept>][] = [
  ["on MongoDB", async () => new MongoProfilingConcept(await testDb())],
];

afterAll(stopTestDb);

type RefusalClass = abstract new (...args: never[]) => Error;

const expectRefusal = async (fn: () => unknown, Refusal: RefusalClass) => {
  expect(await caughtError(fn)).toBeInstanceOf(Refusal);
};

for (const [floor, make] of floors) {
  describe(`Profiling ${floor}`, () => {
    test("createProfile records the face with an empty bio and avatar", async () => {
      const profiling = await make();
      const result = await profiling.createProfile({
        user: "priya",
        displayName: "Priya",
        email: "priya@example.edu",
      });
      expect(result).toEqual({ user: "priya" });
      expect(await profiling._getProfile({ user: "priya" })).toEqual([
        { profile: { displayName: "Priya", bio: "", avatar: "", email: "priya@example.edu" } },
      ]);
    });

    test("a second profile for the same user is refused", async () => {
      const profiling = await make();
      await profiling.createProfile({
        user: "priya",
        displayName: "Priya",
        email: "priya@example.edu",
      });
      await expectRefusal(
        () => profiling.createProfile({ user: "priya", displayName: "P.", email: "p@example.edu" }),
        refusalErrors.ProfileAlreadyExists,
      );
    });

    test("an unknown user has no profile to read", async () => {
      const profiling = await make();
      expect(await profiling._getProfile({ user: "nobody" })).toEqual([]);
    });

    test("the three setters update one profile and return the user", async () => {
      const profiling = await make();
      await profiling.createProfile({
        user: "priya",
        displayName: "Priya",
        email: "priya@example.edu",
      });
      expect(await profiling.setDisplayName({ user: "priya", displayName: "Priya V." })).toEqual({
        user: "priya",
      });
      expect(await profiling.setBio({ user: "priya", bio: "Ports engines by day." })).toEqual({
        user: "priya",
      });
      expect(
        await profiling.setAvatar({ user: "priya", avatar: "https://example.com/p.png" }),
      ).toEqual({
        user: "priya",
      });
      expect(await profiling._getProfile({ user: "priya" })).toEqual([
        {
          profile: {
            displayName: "Priya V.",
            bio: "Ports engines by day.",
            avatar: "https://example.com/p.png",
            email: "priya@example.edu",
          },
        },
      ]);
    });

    test("an empty display name is accepted", async () => {
      const profiling = await make();
      await profiling.createProfile({
        user: "priya",
        displayName: "Priya",
        email: "priya@example.edu",
      });
      expect(await profiling.setDisplayName({ user: "priya", displayName: "" })).toEqual({
        user: "priya",
      });
      expect(await profiling._getProfileFields({ user: "priya" })).toEqual([
        { displayName: "", bio: "", avatar: "", email: "priya@example.edu" },
      ]);
    });

    test("updating a profile that was never created is refused", async () => {
      const profiling = await make();
      await expectRefusal(
        () => profiling.setDisplayName({ user: "ghost", displayName: "X" }),
        refusalErrors.ProfileNotFound,
      );
      await expectRefusal(
        () => profiling.setBio({ user: "ghost", bio: "X" }),
        refusalErrors.ProfileNotFound,
      );
      await expectRefusal(
        () => profiling.setAvatar({ user: "ghost", avatar: "X" }),
        refusalErrors.ProfileNotFound,
      );
    });

    test("the flat profile question answers the same fields or no row", async () => {
      const profiling = await make();
      await profiling.createProfile({
        user: "priya",
        displayName: "Priya",
        email: "priya@example.edu",
      });
      expect(await profiling._getProfileFields({ user: "priya" })).toEqual([
        { displayName: "Priya", bio: "", avatar: "", email: "priya@example.edu" },
      ]);
      expect(await profiling._getProfileFields({ user: "nobody" })).toEqual([]);
    });

    test("named profiles answer in the order asked, without unknown or repeated names", async () => {
      const profiling = await make();
      for (const name of ["priya", "omar"]) {
        await profiling.createProfile({
          user: name,
          displayName: name.toUpperCase(),
          email: `${name}@example.edu`,
        });
      }
      expect(
        await profiling._getProfilesOf({ users: ["omar", "nobody", "priya", "omar"] }),
      ).toEqual([
        { user: "omar", displayName: "OMAR", bio: "", avatar: "" },
        { user: "priya", displayName: "PRIYA", bio: "", avatar: "" },
      ]);
      expect(await profiling._getProfilesOf({ users: [] })).toEqual([]);
    });
  });
}
