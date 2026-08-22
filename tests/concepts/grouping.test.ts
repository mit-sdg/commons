import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/grouping/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoGroupingConcept } from "../../src/concepts/grouping/grouping.mongo.ts";

const floors: [string, () => Promise<MongoGroupingConcept>][] = [
  ["on MongoDB", async () => new MongoGroupingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

const at = new Date("2026-08-19T12:00:00.000Z");
const later = new Date("2026-08-25T12:00:00.000Z");

for (const [floor, make] of floors) {
  describe(`Grouping ${floor}`, () => {
    test("create establishes a group with its creator as sole member", async () => {
      const grouping = await make();
      const { group } = await grouping.create({ title: "Project", creator: "priya", at });
      expect(await grouping._getGroup({ group })).toEqual([
        { title: "Project", createdAt: at, updatedAt: at },
      ]);
      expect(await grouping._getMembers({ group })).toEqual([{ member: "priya" }]);
      expect(await grouping._isMember({ group, member: "priya" })).toEqual({ isMember: true });
      expect(await grouping._isMember({ group, member: "omar" })).toEqual({ isMember: false });
      expect(await grouping._getGroupsOf({ member: "priya" })).toEqual([
        { group, title: "Project", createdAt: at, updatedAt: at },
      ]);
    });

    test("rename changes the title and refuses non-members or missing group", async () => {
      const grouping = await make();
      const { group } = await grouping.create({ title: "Project", creator: "priya", at });
      expect(
        await grouping.rename({ group, member: "priya", title: "Final Project", at: later }),
      ).toEqual({ group });
      expect((await grouping._getGroup({ group }))[0]?.title).toBe("Final Project");

      expect(
        await refusalOf(() => grouping.rename({ group: "ghost", member: "priya", title: "X", at })),
      ).toBeInstanceOf(refusalErrors.GroupNotFound);

      expect(
        await refusalOf(() => grouping.rename({ group, member: "omar", title: "X", at })),
      ).toBeInstanceOf(refusalErrors.NotAMember);
    });

    test("addMember adds a person and refuses duplicates or non-member actors", async () => {
      const grouping = await make();
      const { group } = await grouping.create({ title: "Project", creator: "priya", at });
      expect(
        await grouping.addMember({ group, member: "priya", candidate: "omar", at: later }),
      ).toEqual({ group });
      expect(await grouping._getMembers({ group })).toEqual([
        { member: "priya" },
        { member: "omar" },
      ]);

      expect(
        await refusalOf(() =>
          grouping.addMember({ group, member: "priya", candidate: "omar", at }),
        ),
      ).toBeInstanceOf(refusalErrors.AlreadyAMember);

      expect(
        await refusalOf(() => grouping.addMember({ group, member: "ana", candidate: "ben", at })),
      ).toBeInstanceOf(refusalErrors.NotAMember);
    });

    test("removeMember removes another person and refuses removing the last member", async () => {
      const grouping = await make();
      const { group } = await grouping.create({ title: "Project", creator: "priya", at });
      await grouping.addMember({ group, member: "priya", candidate: "omar", at });

      expect(
        await grouping.removeMember({ group, member: "omar", target: "priya", at: later }),
      ).toEqual({ group });
      expect(await grouping._getMembers({ group })).toEqual([{ member: "omar" }]);

      expect(
        await refusalOf(() => grouping.removeMember({ group, member: "omar", target: "omar", at })),
      ).toBeInstanceOf(refusalErrors.LastMember);

      expect(
        await refusalOf(() =>
          grouping.removeMember({ group, member: "omar", target: "ghost", at }),
        ),
      ).toBeInstanceOf(refusalErrors.TargetNotAMember);
    });

    test("leave withdraws membership and refuses when last member", async () => {
      const grouping = await make();
      const { group } = await grouping.create({ title: "Project", creator: "priya", at });
      expect(await refusalOf(() => grouping.leave({ group, member: "priya", at }))).toBeInstanceOf(
        refusalErrors.LastMember,
      );

      await grouping.addMember({ group, member: "priya", candidate: "omar", at });
      expect(await grouping.leave({ group, member: "priya", at: later })).toEqual({ group });
      expect(await grouping._getMembers({ group })).toEqual([{ member: "omar" }]);
      expect(await grouping._isMember({ group, member: "priya" })).toEqual({ isMember: false });
    });
  });
}
