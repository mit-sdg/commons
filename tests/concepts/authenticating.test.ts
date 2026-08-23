import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/authenticating/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoAuthenticatingConcept } from "../../src/concepts/authenticating/authenticating.mongo.ts";

const floors: [string, () => Promise<MongoAuthenticatingConcept>][] = [
  ["on MongoDB", async () => new MongoAuthenticatingConcept(await testDb())],
];

afterAll(stopTestDb);

type RefusalClass = abstract new (...args: never[]) => Error;

const expectRefusal = async (fn: () => unknown, Refusal: RefusalClass) => {
  expect(await caughtError(fn)).toBeInstanceOf(Refusal);
};

const good = { username: "nadia", password: "long-enough-secret", email: "nadia@example.edu" };

for (const [floor, make] of floors) {
  describe(`Authenticating ${floor}`, () => {
    test("register creates a user with the given username and email", async () => {
      const auth = await make();
      const { user } = await auth.register(good);
      expect(await auth._getById({ user })).toEqual([
        { username: "nadia", email: "nadia@example.edu" },
      ]);
      expect(await auth._getByUsername({ username: "nadia" })).toEqual([{ user }]);

      const stored = await (
        auth as unknown as {
          users: { findOne(query: unknown): Promise<Record<string, unknown>> };
        }
      ).users.findOne({ _id: user });
      expect(stored).not.toHaveProperty("password");
      expect(stored?.passwordVerifier).toMatch(/^\$scrypt\$/);
      expect(JSON.stringify(stored)).not.toContain(good.password);
    });

    test("register refuses an email without an @", async () => {
      const auth = await make();
      await expectRefusal(
        () => auth.register({ ...good, email: "not-an-address" }),
        refusalErrors.EmailInvalid,
      );
    });

    test("register refuses a username outside 3-32 characters", async () => {
      const auth = await make();
      await expectRefusal(
        () => auth.register({ ...good, username: "ab" }),
        refusalErrors.UsernameInvalidLength,
      );
      await expectRefusal(
        () => auth.register({ ...good, username: "a".repeat(33) }),
        refusalErrors.UsernameInvalidLength,
      );
    });

    test("register refuses a malformed username", async () => {
      const auth = await make();
      await expectRefusal(
        () => auth.register({ ...good, username: "9lives" }),
        refusalErrors.UsernameInvalidChars,
      );
      await expectRefusal(
        () => auth.register({ ...good, username: "na dia" }),
        refusalErrors.UsernameInvalidChars,
      );
    });

    test("register refuses a password outside 8-128 characters", async () => {
      const auth = await make();
      await expectRefusal(
        () => auth.register({ ...good, password: "short" }),
        refusalErrors.PasswordInvalidLength,
      );
      await expectRefusal(
        () => auth.register({ ...good, password: "p".repeat(129) }),
        refusalErrors.PasswordInvalidLength,
      );
    });

    test("register refuses a taken username", async () => {
      const auth = await make();
      await auth.register(good);
      await expectRefusal(
        () => auth.register({ ...good, email: "other@example.edu" }),
        refusalErrors.UsernameTaken,
      );
    });

    test("search answers prefix holders, case-blind, alphabetical, capped at ten", async () => {
      const auth = await make();
      const ids = new Map<string, string>();
      for (const username of ["Mara", "mara_v", "noah", "nadia", "Nate"]) {
        const { user } = await auth.register({
          username,
          password: "long-enough-secret",
          email: `${username}@example.edu`,
        });
        ids.set(username, user);
      }
      expect(await auth._search({ query: "MA" })).toEqual([
        { user: ids.get("Mara"), username: "Mara" },
        { user: ids.get("mara_v"), username: "mara_v" },
      ]);
      expect((await auth._search({ query: "n" })).map((r) => r.username)).toEqual([
        "Nate",
        "nadia",
        "noah",
      ]);
      expect(await auth._search({ query: "zzz" })).toEqual([]);

      for (let i = 0; i < 12; i++) {
        await auth.register({
          username: `zed${String(i).padStart(2, "0")}`,
          password: "long-enough-secret",
          email: `zed${i}@example.edu`,
        });
      }
      expect(await auth._search({ query: "zed" })).toHaveLength(10);
    });

    test("identity resolution is exact first and otherwise case-blind only when unique", async () => {
      const auth = await make();
      const { user: titleCase } = await auth.register({
        ...good,
        username: "Elena",
        email: "title@example.edu",
      });

      expect(await auth._resolveIdentity({ ref: titleCase })).toEqual({
        user: titleCase,
        username: "Elena",
      });
      expect(await auth._resolveIdentity({ ref: "elena" })).toEqual({
        user: titleCase,
        username: "Elena",
      });
      expect(await auth._resolveIdentity({ ref: "nobody" })).toEqual({
        user: null,
        username: null,
      });

      const { user: lowerCase } = await auth.register({
        ...good,
        username: "elena",
        email: "lower@example.edu",
      });
      expect(await auth._resolveIdentity({ ref: "Elena" })).toEqual({
        user: titleCase,
        username: "Elena",
      });
      expect(await auth._resolveIdentity({ ref: "ELENA" })).toEqual({
        user: null,
        username: null,
      });
      expect(await auth._resolveIdentity({ ref: lowerCase })).toEqual({
        user: lowerCase,
        username: "elena",
      });
    });

    test("denoted users always resolve to one identity", async () => {
      const auth = await make();
      const { user } = await auth.register(good);

      expect(await auth._denotedUser({ ref: user })).toEqual({ user });
      expect(await auth._denotedUser({ ref: good.username })).toEqual({ user });
      expect(await auth._denotedUser({ ref: "opaque-user" })).toEqual({ user: "opaque-user" });
    });

    test("authenticate recognizes the registered pair and refuses anything else", async () => {
      const auth = await make();
      const { user } = await auth.register(good);
      expect(await auth.authenticate({ username: "nadia", password: good.password })).toEqual({
        user,
      });
      await expectRefusal(
        () => auth.authenticate({ username: "nadia", password: "wrong-password" }),
        refusalErrors.InvalidCredentials,
      );
      await expectRefusal(
        () => auth.authenticate({ username: "nobody", password: good.password }),
        refusalErrors.InvalidCredentials,
      );
    });

    test("changePassword re-proves the old password, checks the new password's length, and takes effect", async () => {
      const auth = await make();
      const { user } = await auth.register(good);
      await expectRefusal(
        () => auth.changePassword({ user, oldPassword: "wrong", newPassword: "another-secret" }),
        refusalErrors.InvalidCredentials,
      );
      await expectRefusal(
        () => auth.changePassword({ user, oldPassword: good.password, newPassword: "x" }),
        refusalErrors.PasswordInvalidLength,
      );
      expect(
        await auth.changePassword({
          user,
          oldPassword: good.password,
          newPassword: "another-secret",
        }),
      ).toEqual({ user });
      await expectRefusal(
        () => auth.authenticate({ username: "nadia", password: good.password }),
        refusalErrors.InvalidCredentials,
      );
      expect(await auth.authenticate({ username: "nadia", password: "another-secret" })).toEqual({
        user,
      });
    });

    test("_getUsers returns all registered users sorted alphabetically by username", async () => {
      const auth = await make();
      expect(await auth._getUsers({})).toEqual([]);
      const { user: zoe } = await auth.register({
        username: "zoe",
        password: "long-enough-secret",
        email: "zoe@example.edu",
      });
      const { user: alice } = await auth.register({
        username: "alice",
        password: "long-enough-secret",
        email: "alice@example.edu",
      });
      const { user: bob } = await auth.register({
        username: "bob",
        password: "long-enough-secret",
        email: "bob@example.edu",
      });

      expect(await auth._getUsers({})).toEqual([
        { user: alice, username: "alice", email: "alice@example.edu" },
        { user: bob, username: "bob", email: "bob@example.edu" },
        { user: zoe, username: "zoe", email: "zoe@example.edu" },
      ]);
    });
  });
}

test("MongoDB password changes survive a fresh concept instance", async () => {
  const db = await testDb();
  const first = new MongoAuthenticatingConcept(db);
  const { user } = await first.register({
    username: "restart_user",
    password: "first-password",
    email: "restart@example.edu",
  });
  const second = new MongoAuthenticatingConcept(db);
  await second.changePassword({
    user,
    oldPassword: "first-password",
    newPassword: "second-password",
  });
  const third = new MongoAuthenticatingConcept(db);
  expect(
    await third.authenticate({ username: "restart_user", password: "second-password" }),
  ).toEqual({ user });
});
