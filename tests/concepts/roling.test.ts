import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/roling/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoRolingConcept } from "../../src/concepts/roling/roling.mongo.ts";
import { RolingConcept } from "../../src/concepts/roling/roling.ts";

const floors: [string, () => Promise<RolingConcept | MongoRolingConcept>][] = [
  ["in memory", async () => new RolingConcept()],
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
  });
}
