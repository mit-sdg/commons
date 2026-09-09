import { describe, expect, test } from "bun:test";
import {
  coursePrimaryNavigation,
  courseSectionNavigation,
  lmsAccess,
  lmsNavigation,
} from "./lms-navigation";

describe("Commons navigation", () => {
  test("staff links stay on staff-authorized routes", () => {
    const assignments = lmsNavigation(true).find(
      ({ label }) => label === "Assignments",
    );
    expect(assignments?.href).toBe("/staff/assignments");
    expect(
      lmsNavigation(true).some(({ href }) => href === "/assignments"),
    ).toBe(false);
  });

  test("learner links stay on learner-authorized routes", () => {
    const assignments = lmsNavigation(false).find(
      ({ label }) => label === "Assignments",
    );
    expect(assignments?.href).toBe("/assignments");
  });

  test("class settings is offered only to a course manager", () => {
    const manager = lmsNavigation(
      true,
      (capability) => capability === "course:manage",
    );
    expect(manager.some(({ href }) => href === "/staff/class")).toBe(true);

    const grader = lmsNavigation(true, (capability) => capability === "grade");
    expect(grader.some(({ href }) => href === "/staff/class")).toBe(false);
  });

  test("a seat identifier and assignment capability identify course staff", () => {
    expect(lmsAccess("seat-1", true)).toEqual({
      hasRosterSeat: true,
      isStaff: true,
    });
    expect(lmsAccess("seat-2", false)).toEqual({
      hasRosterSeat: true,
      isStaff: false,
    });
    expect(lmsAccess(null, false)).toEqual({
      hasRosterSeat: false,
      isStaff: false,
    });
  });
});

test("grouped navigation keeps late-day staff and graders on authorized destinations", () => {
  const records = (c: string) => c === "student-records";
  expect(
    coursePrimaryNavigation(true, records).some(
      (i) => i.href === "/staff/late-days",
    ),
  ).toBe(true);
  expect(
    courseSectionNavigation("/staff/late-days", records).map((i) => i.href),
  ).toEqual(["/staff/late-days"]);
  expect(
    courseSectionNavigation("/staff/skills", (c) => c === "grade").map(
      (i) => i.href,
    ),
  ).toEqual(["/staff/gradebook", "/staff/skills"]);
  expect(
    coursePrimaryNavigation(true, () => true).some(
      (i) => i.href === "/staff/skills" || i.href === "/staff/class",
    ),
  ).toBe(false);
});
