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

    test("deleteRole removes an unheld role and refuses one still assigned", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "instructor", capabilities: ["grade"] });
      await roling.assign({ user: "maya", context: "course", role });
      await expectRefusal(() => roling.deleteRole({ role }), refusalErrors.RoleInUse);

      await roling.revoke({ user: "maya", context: "course" });
      expect(await roling.deleteRole({ role })).toEqual({ role });
      expect(await roling._getRoleDetail({ role })).toEqual([]);
      await expectRefusal(() => roling.deleteRole({ role }), refusalErrors.RoleNotFound);
    });

    test("denoted roles always resolve to one identity", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "instructor", capabilities: ["grade"] });

      expect(await roling._denotedRole({ ref: role })).toEqual({ role });
      expect(await roling._denotedRole({ ref: "instructor" })).toEqual({ role });
      expect(await roling._denotedRole({ ref: "opaque-role" })).toEqual({ role: "opaque-role" });
    });

    test("assign records the holding and refuses an unknown role", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "instructor", capabilities: ["grade"] });
      const { assignment } = await roling.assign({ user: "maya", context: "course", role });
      expect(assignment).toBeDefined();
      expect(await roling._getRole({ user: "maya", context: "course" })).toEqual([{ role }]);
      await expectRefusal(
        () => roling.assign({ user: "maya", context: "course", role: "no-such-role" }),
        refusalErrors.RoleNotFound,
      );
      expect(
        await roling._holdsRoleNamed({ user: "maya", context: "course", name: "instructor" }),
      ).toEqual({ held: true });
      expect(
        await roling._holdsRoleNamed({ user: "maya", context: "course", name: "student" }),
      ).toEqual({ held: false });
    });

    test("assigning again replaces the role rather than adding a second", async () => {
      const roling = await make();
      const { role: instructor } = await roling.defineRole({
        name: "instructor",
        capabilities: ["grade"],
      });
      const { role: grader } = await roling.defineRole({
        name: "grader",
        capabilities: ["grade:only"],
      });
      const first = await roling.assign({ user: "maya", context: "course", role: instructor });
      const second = await roling.assign({ user: "maya", context: "course", role: grader });

      expect(second.assignment).toBe(first.assignment);
      expect(await roling._getRole({ user: "maya", context: "course" })).toEqual([
        { role: grader },
      ]);
      expect(
        await roling._hasCapability({ user: "maya", context: "course", capability: "grade" }),
      ).toEqual({ allowed: false });
      expect(
        await roling._hasCapability({ user: "maya", context: "course", capability: "grade:only" }),
      ).toEqual({ allowed: true });
    });

    test("assigning in another context leaves the first context untouched", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "instructor", capabilities: ["grade"] });
      await roling.assign({ user: "maya", context: "course-1", role });
      await roling.assign({ user: "maya", context: "course-2", role });

      expect(await roling._getRole({ user: "maya", context: "course-1" })).toEqual([{ role }]);
      expect(await roling._getRole({ user: "maya", context: "course-2" })).toEqual([{ role }]);
    });

    test("revoke removes the holding; revoking an absent assignment is refused", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "instructor", capabilities: ["grade"] });
      await roling.assign({ user: "maya", context: "course", role });
      expect(
        await roling._hasCapability({ user: "maya", context: "course", capability: "grade" }),
      ).toEqual({ allowed: true });
      await roling.revoke({ user: "maya", context: "course" });
      expect(
        await roling._hasCapability({ user: "maya", context: "course", capability: "grade" }),
      ).toEqual({ allowed: false });
      expect(await roling._getRole({ user: "maya", context: "course" })).toEqual([]);
      await expectRefusal(
        () => roling.revoke({ user: "maya", context: "course" }),
        refusalErrors.AssignmentNotFound,
      );
    });

    test("requireCapability accepts a held capability and refuses its absence", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "instructor", capabilities: ["grade"] });
      await roling.assign({ user: "maya", context: "course", role });
      expect(
        await roling.requireCapability({ user: "maya", context: "course", capability: "grade" }),
      ).toEqual({ allowed: true });
      await roling.revoke({ user: "maya", context: "course" });
      await expectRefusal(
        () => roling.requireCapability({ user: "maya", context: "course", capability: "grade" }),
        refusalErrors.CapabilityRequired,
      );
    });

    test("sole-holder reads distinguish the last holder from one of several", async () => {
      const roling = await make();
      const { role } = await roling.defineRole({ name: "admin", capabilities: ["administer"] });
      const { role: plain } = await roling.defineRole({ name: "member", capabilities: [] });

      expect(
        await roling._isSoleCapabilityHolder({
          user: "mara",
          context: "forum",
          capability: "administer",
        }),
      ).toEqual({ sole: false });

      await roling.assign({ user: "mara", context: "forum", role });
      expect(
        await roling._isSoleCapabilityHolder({
          user: "mara",
          context: "forum",
          capability: "administer",
        }),
      ).toEqual({ sole: true });

      await roling.assign({ user: "noah", context: "forum", role: plain });
      expect(
        await roling._isSoleCapabilityHolder({
          user: "mara",
          context: "forum",
          capability: "administer",
        }),
      ).toEqual({ sole: true });

      await roling.assign({ user: "noah", context: "forum", role });
      expect(
        await roling._isSoleCapabilityHolder({
          user: "mara",
          context: "forum",
          capability: "administer",
        }),
      ).toEqual({ sole: false });
      expect(
        await roling._hasCapabilityHolder({ context: "forum", capability: "administer" }),
      ).toEqual({ present: true });
    });

    test("named-role reads answer a context's holders and a holder's contexts", async () => {
      const roling = await make();
      const { role: member } = await roling.defineRole({ name: "member", capabilities: [] });
      const { role: other } = await roling.defineRole({ name: "other", capabilities: [] });
      await roling.assign({ user: "mara", context: "list-1", role: member });
      await roling.assign({ user: "noah", context: "list-1", role: member });
      await roling.assign({ user: "mara", context: "list-2", role: member });
      await roling.assign({ user: "mara", context: "list-3", role: other });

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

    test("a second instance keeps its roles and assignments in its own store", async () => {
      const database = await testDb();
      const course = new MongoRolingConcept(database);
      const lists = new MongoRolingConcept(database, "TaskListMembership");
      const { role } = await lists.ensureRole({ name: "member", capabilities: ["tasks:manage"] });
      await lists.assign({ user: "mara", context: "list-1", role });

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
