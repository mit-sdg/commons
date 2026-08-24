import type { Db } from "mongodb";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { MongoAuthenticatingConcept } from "../../src/concepts/authenticating/authenticating.mongo.ts";
import { EmailTaken } from "../../src/concepts/authenticating/errors.ts";
import { MongoRolingConcept } from "../../src/concepts/roling/roling.mongo.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { commonsMigrations, runMigrations } from "../../src/migrations/index.ts";

afterAll(stopTestDb);

const silent = () => undefined;

// These mirror the stored shapes the concepts own. Declaring them here keeps the
// tests writing string identifiers, as every Commons concept does, rather than
// the ObjectId an untyped collection handle would assume.
interface AssignmentDoc {
  _id: string;
  user: string;
  context: string;
  role: string;
  seq: number;
}
interface UserDoc {
  _id: string;
  username: string;
  passwordVerifier: string;
  email: string;
}
interface ProfileDoc {
  _id: string;
  user: string;
  displayName: string;
  bio: string;
  avatar: string;
  email?: string;
}

const assignmentsOf = (database: Db) => database.collection<AssignmentDoc>("roling.assignments");
const usersOf = (database: Db) => database.collection<UserDoc>("authenticating.users");
const profilesOf = (database: Db) => database.collection<ProfileDoc>("profiling.profiles");
const ledgerOf = (database: Db) =>
  database.collection<{ _id: string; appliedAt: Date; summary: string }>("commons.migrations");

describe("migrating a database written before this release", () => {
  test("role assignments in the `forum` context move to `commons`, keeping capabilities reachable", async () => {
    const database = await testDb();
    await database
      .collection<{ _id: string; name: string; capabilities: string[]; seq: number }>(
        "roling.roles",
      )
      .insertOne({
        _id: "role-admin",
        name: "administrator",
        capabilities: ["administer"],
        seq: 1,
      });
    await assignmentsOf(database).insertMany([
      { _id: "a1", user: "mara", context: "forum", role: "role-admin", seq: 1 },
      { _id: "a2", user: "noah", context: "forum", role: "role-admin", seq: 2 },
      // An assignment in another context is not this migration's business.
      { _id: "a3", user: "mara", context: "conversation-7", role: "role-admin", seq: 3 },
    ]);

    await runMigrations(database, commonsMigrations, silent);

    const roling = new MongoRolingConcept(database);
    // The capability is reachable in the reserved context the application now asks about.
    expect(
      await roling._hasCapability({ user: "mara", context: "commons", capability: "administer" }),
    ).toEqual({ allowed: true });
    expect(
      await roling._hasCapability({ user: "noah", context: "commons", capability: "administer" }),
    ).toEqual({ allowed: true });
    // And no longer reachable under the name the old assignments used.
    expect(
      await roling._hasCapability({ user: "mara", context: "forum", capability: "administer" }),
    ).toEqual({ allowed: false });
    // Nothing is left behind in the old one, and an unrelated context is untouched.
    expect(await assignmentsOf(database).countDocuments({ context: "forum" })).toBe(0);
    expect(await assignmentsOf(database).countDocuments({ context: "conversation-7" })).toBe(1);
  });

  test("a duplicate assignment already held in `commons` is dropped rather than breaking one-role-per-context", async () => {
    const database = await testDb();
    await assignmentsOf(database).insertMany([
      { _id: "a1", user: "mara", context: "commons", role: "role-a", seq: 1 },
      { _id: "a2", user: "mara", context: "forum", role: "role-b", seq: 2 },
    ]);

    await runMigrations(database, commonsMigrations, silent);

    const held = await assignmentsOf(database).find({ user: "mara" }).toArray();
    expect(held).toHaveLength(1);
    expect(held[0]?.context).toBe("commons");
    // The assignment already in the new context is the one that survives.
    expect(held[0]?.role).toBe("role-a");
  });

  test("stored addresses are trimmed and lower-cased, so a lookup resolves them again", async () => {
    const database = await testDb();
    await usersOf(database).insertMany([
      { _id: "u1", username: "nadia", passwordVerifier: "v1", email: " Nadia@Example.COM " },
      { _id: "u2", username: "omar", passwordVerifier: "v2", email: "omar@example.com" },
    ]);

    await runMigrations(database, commonsMigrations, silent);

    const authenticating = new MongoAuthenticatingConcept(database);
    // Before the migration this lookup answered nothing, which is what stranded
    // an imported seat for the address.
    expect(await authenticating._getByEmail({ email: "nadia@example.com" })).toEqual([
      { user: "u1" },
    ]);
    expect(await authenticating._getByEmail({ email: "  NADIA@EXAMPLE.com " })).toEqual([
      { user: "u1" },
    ]);
    expect(await authenticating._getById({ user: "u1" })).toEqual([
      { username: "nadia", email: "nadia@example.com" },
    ]);
    // The already-normalized row is left alone.
    expect(await authenticating._getById({ user: "u2" })).toEqual([
      { username: "omar", email: "omar@example.com" },
    ]);
  });

  test("uniqueness is enforced after normalizing, so registration does not build the index later", async () => {
    const database = await testDb();
    await usersOf(database).insertOne({
      _id: "u1",
      username: "nadia",
      passwordVerifier: "v1",
      email: "nadia@ex.com",
    });

    await runMigrations(database, commonsMigrations, silent);

    const indexes = await usersOf(database).indexes();
    const unique = indexes.find((index) => index.unique === true && index.key?.email === 1);
    expect(unique).toBeDefined();

    // The index is the authority even for a spelling that differs only by case.
    const authenticating = new MongoAuthenticatingConcept(database);
    const error = await caughtError(() =>
      authenticating.register({
        username: "nadia2",
        password: "password123",
        email: " NADIA@Ex.COM ",
      }),
    );
    expect(error).toBeInstanceOf(EmailTaken);
    expect(await usersOf(database).countDocuments({})).toBe(1);
  });

  test("two accounts colliding on one normalized address stop startup and leave the database untouched", async () => {
    const database = await testDb();
    await usersOf(database).insertMany([
      { _id: "u1", username: "nadia", passwordVerifier: "v1", email: "Nadia@Example.com" },
      { _id: "u2", username: "nadia_alt", passwordVerifier: "v2", email: "nadia@example.com " },
    ]);

    const error = await caughtError(() => runMigrations(database, commonsMigrations, silent));

    expect(error.name).toBe("MigrationBlocked");
    // The diagnostic names the address and both accounts, so an operator can act.
    expect(error.message).toContain("nadia@example.com");
    expect(error.message).toContain("@nadia");
    expect(error.message).toContain("@nadia_alt");
    // Nothing was written: a blocked run is a no-op, not a partial migration.
    const rows = await database
      .collection("authenticating.users")
      .find({}, { projection: { email: 1 } })
      .toArray();
    expect(rows.map((row) => row.email).sort((a, b) => a.localeCompare(b))).toEqual([
      "Nadia@Example.com",
      "nadia@example.com ",
    ]);
    // The blocking migration is not recorded, so it runs again once resolved.
    expect(
      await ledgerOf(database).countDocuments({
        _id: "20260824T000200-normalize-account-emails",
      }),
    ).toBe(0);
  });

  test("the dead profile email field is dropped", async () => {
    const database = await testDb();
    await profilesOf(database).insertMany([
      { _id: "p1", user: "u1", displayName: "Nadia", bio: "", avatar: "", email: "nadia@ex.com" },
      { _id: "p2", user: "u2", displayName: "Omar", bio: "", avatar: "" },
    ]);

    await runMigrations(database, commonsMigrations, silent);

    const profiles = await profilesOf(database).find({}).toArray();
    for (const profile of profiles) expect(profile).not.toHaveProperty("email");
    expect(profiles).toHaveLength(2);
  });

  test("a second run applies nothing and a fresh database needs no repair", async () => {
    const database = await testDb();
    await assignmentsOf(database).insertOne({
      _id: "a1",
      user: "mara",
      context: "forum",
      role: "role-admin",
      seq: 1,
    });

    const messages: string[] = [];
    await runMigrations(database, commonsMigrations, (message) => messages.push(message));
    expect(messages.length).toBeGreaterThan(0);
    expect(await ledgerOf(database).countDocuments({})).toBe(commonsMigrations.length);

    // Every migration is recorded, so a restart does no work and logs nothing.
    const second: string[] = [];
    await runMigrations(database, commonsMigrations, (message) => second.push(message));
    expect(second).toEqual([]);

    // And an empty database is simply already correct.
    const fresh = await testDb();
    await runMigrations(fresh, commonsMigrations, silent);
    expect(await ledgerOf(fresh).countDocuments({})).toBe(commonsMigrations.length);
  });

  test("every migration is idempotent, because the ledger is an optimisation rather than a guarantee", async () => {
    const database = await testDb();
    await usersOf(database).insertOne({
      _id: "u1",
      username: "nadia",
      passwordVerifier: "v1",
      email: " Nadia@Example.com ",
    });
    await assignmentsOf(database).insertOne({
      _id: "a1",
      user: "mara",
      context: "forum",
      role: "role-admin",
      seq: 1,
    });
    await profilesOf(database).insertOne({
      _id: "p1",
      user: "u1",
      displayName: "N",
      bio: "",
      avatar: "",
      email: "x@y.com",
    });

    // Run each migration twice without a ledger, as a process that died between
    // applying and recording would.
    for (const migration of commonsMigrations) {
      const first = await migration.up(database);
      expect(first.blocked).toBeUndefined();
      const second = await migration.up(database);
      expect(second.blocked).toBeUndefined();
    }

    expect(await usersOf(database).findOne({ _id: "u1" })).toMatchObject({
      email: "nadia@example.com",
    });
    expect(await assignmentsOf(database).countDocuments({ context: "forum" })).toBe(0);
    expect(await profilesOf(database).findOne({ _id: "p1" })).not.toHaveProperty("email");
  });

  test("the identifiers are timestamped, sortable, and applied oldest first", async () => {
    const ids = commonsMigrations.map((migration) => migration.id);
    expect([...ids].sort()).toEqual(ids);
    for (const id of ids) expect(id).toMatch(/^\d{8}T\d{6}-[a-z0-9-]+$/);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
