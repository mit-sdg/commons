import { expect, test } from "vite-plus/test";
import {
  effectiveDue,
  handedInAttempt,
  handedInLate,
  lateDayCap,
  lateness,
  overdue,
  selectAttemptAssessment,
  selectSubmissionAttempt,
} from "../../src/computations/coursework.ts";

const due = "2026-10-01T04:00:00.000Z";
const hours = (n: number) => new Date(Date.parse(due) + n * 3_600_000).toISOString();
const attempt = (number: number, submittedAt: string, status = "SUBMITTED") => ({
  submission: `s${number}`,
  number,
  submittedAt,
  status,
});

test("a late attempt needs the late days that cover the time past the due date", () => {
  const late = lateness({ submittedAt: hours(27), dueAt: due, dueOverride: null, unitHours: 24 });
  expect(late).toEqual({ lateMs: 27 * 3_600_000, daysNeeded: 2 });
  expect(
    handedInLate({
      submittedAt: hours(27),
      dueAt: due,
      dueOverride: null,
      lateDays: 1,
      unitHours: 24,
    }),
  ).toBe(true);
  expect(
    handedInLate({
      submittedAt: hours(27),
      dueAt: due,
      dueOverride: null,
      lateDays: 2,
      unitHours: 24,
    }),
  ).toBe(false);
});

test("an on-time attempt needs no late days", () => {
  expect(
    lateness({ submittedAt: hours(-1), dueAt: due, dueOverride: null, unitHours: 24 }),
  ).toEqual({
    lateMs: 0,
    daysNeeded: 0,
  });
  expect(
    lateness({ submittedAt: due, dueAt: due, dueOverride: null, unitHours: 24 }).daysNeeded,
  ).toBe(0);
});

test("the latest submitted attempt sets lateness, so a late resubmission makes the work late", () => {
  const attempts = [attempt(1, hours(-5)), attempt(2, hours(30))];
  const chosen = handedInAttempt(attempts)!;
  expect(chosen.submission).toBe("s2");
  expect(
    lateness({ submittedAt: chosen.submittedAt, dueAt: due, dueOverride: null, unitHours: 24 })
      .daysNeeded,
  ).toBe(2);
});

test("an on-time later attempt replaces an earlier late one", () => {
  const attempts = [attempt(1, hours(-30)), attempt(2, hours(-2))];
  const chosen = handedInAttempt(attempts)!;
  expect(
    lateness({ submittedAt: chosen.submittedAt, dueAt: due, dueOverride: null, unitHours: 24 })
      .daysNeeded,
  ).toBe(0);
});

test("withdrawn attempts are not handed in, though the export still links the latest one", () => {
  const attempts = [attempt(1, hours(-5), "WITHDRAWN"), attempt(2, hours(10), "WITHDRAWN")];
  expect(handedInAttempt(attempts)).toBeUndefined();
  expect(selectSubmissionAttempt(attempts)?.submission).toBe("s2");
  expect(
    handedInAttempt([attempt(1, hours(-5)), attempt(2, hours(10), "WITHDRAWN")])?.submission,
  ).toBe("s1");
  expect(handedInAttempt([])).toBeUndefined();
});

test("a per-student due override replaces the due date", () => {
  const override = hours(48);
  expect(
    lateness({ submittedAt: hours(50), dueAt: due, dueOverride: override, unitHours: 24 }),
  ).toEqual({
    lateMs: 2 * 3_600_000,
    daysNeeded: 1,
  });
  expect(effectiveDue({ dueAt: due, dueOverride: override, lateDays: 1, unitHours: 24 })).toBe(
    Date.parse(hours(72)),
  );
});

test("a late day covers the configured hours", () => {
  expect(
    lateness({ submittedAt: hours(47), dueAt: due, dueOverride: null, unitHours: 48 }).daysNeeded,
  ).toBe(1);
  expect(
    lateness({ submittedAt: hours(49), dueAt: due, dueOverride: null, unitHours: 48 }).daysNeeded,
  ).toBe(2);
  expect(effectiveDue({ dueAt: due, dueOverride: null, lateDays: 2, unitHours: 48 })).toBe(
    Date.parse(hours(96)),
  );
});

test("work is overdue once nothing is handed in past the due date with late days", () => {
  const at = new Date(hours(30));
  expect(
    overdue({ handedIn: false, dueAt: due, dueOverride: null, lateDays: 0, unitHours: 24, at }),
  ).toBe(true);
  expect(
    overdue({ handedIn: false, dueAt: due, dueOverride: null, lateDays: 2, unitHours: 24, at }),
  ).toBe(false);
  expect(
    overdue({ handedIn: true, dueAt: due, dueOverride: null, lateDays: 0, unitHours: 24, at }),
  ).toBe(false);
});

test("an assignment holds at most the per-assignment limit or what the balance covers", () => {
  expect(lateDayCap({ perItemLimit: 5, remaining: 7, applied: 0 })).toBe(5);
  expect(lateDayCap({ perItemLimit: 5, remaining: 1, applied: 2 })).toBe(3);
  expect(lateDayCap({ perItemLimit: 5, remaining: 0, applied: 0 })).toBe(0);
});

test("the selected attempt's assessment stands, else an assignment-wide excusal", () => {
  const record = (evidence: string, status: string, updatedAt: string) => ({
    evidence,
    status,
    createdAt: hours(0),
    updatedAt,
  });
  const older = record("s2", "DRAFT", hours(1));
  const newer = record("s2", "RELEASED", hours(2));
  const excusal = record("", "EXCUSED", hours(3));
  expect(selectAttemptAssessment([older, newer, excusal], { submission: "s2" })).toEqual({
    record: newer,
    scope: "attempt",
  });
  expect(selectAttemptAssessment([older, excusal], { submission: "s9" })).toEqual({
    record: excusal,
    scope: "excusal",
  });
  expect(selectAttemptAssessment([older], undefined)).toEqual({ record: undefined, scope: null });
});
