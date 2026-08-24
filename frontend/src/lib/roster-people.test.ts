import { describe, expect, test } from "bun:test";
import {
  isSelfAddRequest,
  SELF_ADD_HREF,
  SELF_ADD_PARAM,
  seatKindOptions,
  seatStandingAt,
} from "./roster-people.ts";

const seats = {
  active: ["ada@school.edu"],
  pending: ["grace@school.edu"],
  dropped: ["alan@school.edu"],
};

describe("the seat standing at an address", () => {
  test("each list answers for its own seats", () => {
    expect(seatStandingAt("ada@school.edu", seats)).toBe("ACTIVE");
    expect(seatStandingAt("grace@school.edu", seats)).toBe("PENDING");
    expect(seatStandingAt("alan@school.edu", seats)).toBe("DROPPED");
  });

  test("an address with no seat anywhere stands alone", () => {
    expect(seatStandingAt("nobody@school.edu", seats)).toBe("NONE");
  });

  test("space and letter case do not change the answer", () => {
    expect(seatStandingAt("  ADA@School.edu ", seats)).toBe("ACTIVE");
  });
});

describe("the kinds a seat may be created with", () => {
  test("the two Commons uses are always offered", () => {
    expect(seatKindOptions([])).toEqual(["STUDENT", "STAFF"]);
  });

  test("a kind the roster already holds joins them once", () => {
    expect(seatKindOptions(["STUDENT", "AUDITOR", "AUDITOR", " "])).toEqual([
      "STUDENT",
      "STAFF",
      "AUDITOR",
    ]);
  });
});

describe("adding yourself from the home page", () => {
  test("the link carries the intent and nobody's details", () => {
    expect(SELF_ADD_HREF).toBe("/staff/roster?add=self");
    expect(SELF_ADD_HREF).not.toContain("@");
  });

  test("only the intent the home page sends opens the form filled in", () => {
    expect(SELF_ADD_PARAM).toBe("add");
    expect(isSelfAddRequest("self")).toBe(true);
    expect(isSelfAddRequest("somebody-else")).toBe(false);
    expect(isSelfAddRequest(null)).toBe(false);
  });
});
