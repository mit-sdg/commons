import { describe, expect, test } from "bun:test";
import { assessmentForEvidence } from "./grading";

describe("assessment selection", () => {
  const assignmentExcusal = {
    learner: "learner",
    item: "assignment",
    evidence: "",
    status: "EXCUSED" as const,
    result: "assignment excusal",
  };
  const firstAttemptExcusal = {
    learner: "learner",
    item: "assignment",
    evidence: "attempt-1",
    status: "EXCUSED" as const,
    result: "attempt excusal",
  };

  test("uses the exact attempt before an assignment excusal", () => {
    expect(
      assessmentForEvidence(
        [assignmentExcusal, firstAttemptExcusal],
        "learner",
        "assignment",
        "attempt-1",
      )?.result,
    ).toBe("attempt excusal");
  });

  test("falls back only to the empty-evidence assignment excusal", () => {
    expect(
      assessmentForEvidence(
        [firstAttemptExcusal, assignmentExcusal],
        "learner",
        "assignment",
        "attempt-2",
      )?.result,
    ).toBe("assignment excusal");
    expect(
      assessmentForEvidence(
        [firstAttemptExcusal],
        "learner",
        "assignment",
        "attempt-2",
      ),
    ).toBeUndefined();
  });

  test("never crosses learner scope", () => {
    expect(
      assessmentForEvidence(
        [{ ...assignmentExcusal, learner: "someone-else" }],
        "learner",
        "assignment",
        "attempt-2",
      ),
    ).toBeUndefined();
  });

  test("never borrows an assignment excusal from another item", () => {
    expect(
      assessmentForEvidence(
        [{ ...assignmentExcusal, item: "another-assignment" }],
        "learner",
        "assignment",
        "attempt-2",
      ),
    ).toBeUndefined();
  });
});
