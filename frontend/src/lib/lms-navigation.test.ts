import { describe, expect, test } from "bun:test";
import { lmsAccess, lmsNavigation } from "./lms-navigation";

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
