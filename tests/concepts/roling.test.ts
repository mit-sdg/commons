import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/roling/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoRolingConcept } from "../../src/concepts/roling/roling.mongo.ts";

const floors: [string, () => Promise<MongoRolingConcept>][] = [
  ["on MongoDB", async () => new MongoRolingConcept(await testDb())],
];

afterAll(stopTestDb);

type RefusalClass = abstract new (...args: never[]) => Error;

const expectRefusal = async (fn: () => unknown, Refusal: RefusalClass) => {
  expect(await caughtError(fn)).toBeInstanceOf(Refusal);
};

for (const [floor, make] of floors) {
  describe(`Roling ${floor}`, () => {
    test("defineRole creates a role; a duplicate name is refused", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "instructor", capabilities: ["grade"] });
      expect(await roling._getRoleDetail({ role })).toEqual([
        { name: "instructor", capabilities: ["grade"] },
      ]);
      await expectRefusal(
        () => roling.defineRole({ name: "instructor", capabilities: [] }),
        refusalErrors.RoleAlreadyExists,
      );
    });

    test("ensureRole finds an existing role and keeps its capabilities", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "instructor", capabilities: ["grade"] });
      const ensured = await roling.ensureRole({ name: "instructor", capabilities: ["publish"] });
      expect(ensured.role).toBe(role);
      expect(await roling._getRoleDetail({ role })).toEqual([
        { name: "instructor", capabilities: ["grade"] },
      ]);
    });

    test("ensureRole creates the role when the name is new", async () => {
      const roling = await make();
      const { role } = await roling.ensureRole({ name: "student", capabilities: ["submit"] });
      expect(await roling._getRoleDetail({ role })).toEqual([
        { name: "student", capabilities: ["submit"] },
      ]);
    });

    test("denoted roles always resolve to one identity", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "instructor", capabilities: ["grade"] });

      expect(await roling._denotedRole({ ref: role })).toEqual({ role });
      expect(await roling._denotedRole({ ref: "instructor" })).toEqual({ role });
      expect(await roling._denotedRole({ ref: "opaque-role" })).toEqual({ role: "opaque-role" });
    });

    test("grant records a holding; unknown role and duplicate grant are refused", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "instructor", capabilities: ["grade"] });
      const { grant } = await roling.grant({ user: "maya", context: "course", role });
      expect(grant).toBeDefined();
      expect(await roling._getRoles({ user: "maya", context: "course" })).toEqual([{ role }]);
      await expectRefusal(
        () => roling.grant({ user: "maya", context: "course", role: "no-such-role" }),
        refusalErrors.RoleNotFound,
      );
      await expectRefusal(
        () => roling.grant({ user: "maya", context: "course", role }),
        refusalErrors.GrantAlreadyExists,
      );
      expect(
        await roling._holdsRoleNamed({ user: "maya", context: "course", name: "instructor" }),
      ).toEqual({ held: true });
      expect(
        await roling._holdsRoleNamed({ user: "maya", context: "course", name: "student" }),
      ).toEqual({ held: false });
    });

    test("revoke removes the holding; revoking an absent grant is refused", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "instructor", capabilities: ["grade"] });
      await roling.grant({ user: "maya", context: "course", role });
      expect(
        await roling._hasCapability({ user: "maya", context: "course", capability: "grade" }),
      ).toEqual({ allowed: true });
      await roling.revoke({ user: "maya", context: "course", role });
      expect(
        await roling._hasCapability({ user: "maya", context: "course", capability: "grade" }),
      ).toEqual({ allowed: false });
      await expectRefusal(
        () => roling.revoke({ user: "maya", context: "course", role }),
        refusalErrors.GrantNotFound,
      );
    });

    test("requireCapability accepts a granted capability and refuses its absence", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "instructor", capabilities: ["grade"] });
      await roling.grant({ user: "maya", context: "course", role });
      expect(
        await roling.requireCapability({ user: "maya", context: "course", capability: "grade" }),
      ).toEqual({ allowed: true });
      await roling.revoke({ user: "maya", context: "course", role });
      await expectRefusal(
        () => roling.requireCapability({ user: "maya", context: "course", capability: "grade" }),
        refusalErrors.CapabilityRequired,
      );
    });

    test("ensureGrant reaches the existing grant, adds a missing one, and refuses an unknown role", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "member", capabilities: ["tasks:manage"] });
      const { grant } = await roling.grant({ user: "mara", context: "list-1", role });
      expect(await roling.ensureGrant({ user: "mara", context: "list-1", role })).toEqual({
        grant,
      });
      const added = await roling.ensureGrant({ user: "noah", context: "list-1", role });
      expect(added.grant).not.toBe(grant);
      await expectRefusal(
        () => roling.ensureGrant({ user: "mara", context: "list-1", role: "ghost" }),
        refusalErrors.RoleNotFound,
      );
    });

    test("named-role reads answer a context's holders and a holder's contexts", async () => {
      const roling = await make();
      const { role: member } = await roling.defineRole({ name: "member", capabilities: [] });
      const { role: other } = await roling.defineRole({ name: "other", capabilities: [] });
      await roling.grant({ user: "mara", context: "list-1", role: member });
      await roling.grant({ user: "noah", context: "list-1", role: member });
      await roling.grant({ user: "mara", context: "list-2", role: member });
      await roling.grant({ user: "mara", context: "list-3", role: other });

      expect(await roling._getHoldersOfRoleNamed({ context: "list-1", name: "member" })).toEqual([
        { user: "mara" },
        { user: "noah" },
      ]);
      expect(await roling._getContextsOfRoleNamed({ user: "mara", name: "member" })).toEqual([
        { context: "list-1" },
        { context: "list-2" },
      ]);
      expect(await roling._getContextsOfRoleNamed({ user: "mara", name: "ghost" })).toEqual([]);
      expect(await roling._getHoldersOfRoleNamed({ context: "list-9", name: "member" })).toEqual(
        [],
      );
    });

    test("a second instance keeps its roles and grants in its own store", async () => {
      const database = await testDb();
      const course = new MongoRolingConcept(database);
      const lists = new MongoRolingConcept(database, "TaskListMembership");
      const { role } = await lists.ensureRole({ name: "member", capabilities: ["tasks:manage"] });
      await lists.grant({ user: "mara", context: "list-1", role });

      expect(await course._getRoleByName({ name: "member" })).toEqual([]);
      expect(
        await course._hasCapability({
          user: "mara",
          context: "list-1",
          capability: "tasks:manage",
        }),
      ).toEqual({ allowed: false });
      expect(
        await lists._hasCapability({ user: "mara", context: "list-1", capability: "tasks:manage" }),
      ).toEqual({ allowed: true });
    });
  });
}
