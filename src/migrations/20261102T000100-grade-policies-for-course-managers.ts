import type { Migration } from "./migration.ts";

export const gradePoliciesForCourseManagers: Migration = {
  id: "20261102T000100-grade-policies-for-course-managers",
  description: "Give every role that carries course:manage the grade-policies capability.",
  async up(database) {
    const granted = await database
      .collection("roling.roles")
      .updateMany(
        { capabilities: "course:manage" },
        { $addToSet: { capabilities: "grade-policies" } },
      );
    return {
      summary: `Gave grade-policies to ${granted.modifiedCount} role(s) that manage the course.`,
    };
  },
};
