import { describe, expect, test } from "bun:test";
import {
  cannotCover,
  type LateDayRow,
  type LateDayTerms,
  lateBy,
  lateDayRows,
  moveTo,
} from "./late-days.ts";

type Input = Parameters<typeof lateDayRows>[0];
type Release = Input["releases"][number];
type Attempt = Input["attempts"][number];
type Use = Input["uses"][number];

const HOUR = 3_600_000;
const DUE = "2026-10-01T12:00:00.000Z";
const dueMs = Date.parse(DUE);
const at = (hours: number) => new Date(dueMs + hours * HOUR).toISOString();

function release(assignment: string, fields: Partial<Release> = {}): Release {
  return {
    assignment,
    release: `release-${assignment}`,
    status: "ASSIGNED",
    title: `Title ${assignment}`,
    kind: "PSET",
    dueAt: DUE,
    dueOverride: null,
    closeAt: null,
    acceptsSubmissions: true,
    ...fields,
  } as Release;
}

function attempt(
  assignment: string,
  number: number,
  hours: number,
  status: "SUBMITTED" | "WITHDRAWN" = "SUBMITTED",
): Attempt {
  return {
    assignment,
    submission: `${assignment}-${number}`,
    number,
    submittedAt: at(hours),
    status,
  } as Attempt;
}

function use(
  item: string,
  days: number,
  status: "APPLIED" | "CANCELED" = "APPLIED",
): Use {
  return {
    use: `use-${item}-${status}`,
    item,
    days,
    status,
    appliedAt: DUE,
  } as Use;
}

const terms: LateDayTerms = { unitHours: 24, perItemLimit: 5, remaining: 7 };

function rows(fields: Partial<Input>): LateDayRow[] {
  return lateDayRows({
    releases: [],
    attempts: [],
    uses: [],
    terms,
    ...fields,
  });
}

function row(fields: Partial<LateDayRow> = {}): LateDayRow {
  return {
    assignment: "a",
    title: "Exercise 1",
    dueAt: dueMs,
    handedInAt: null,
    lateMs: 0,
    daysNeeded: 0,
    days: 0,
    standing: false,
    cap: 5,
    ...fields,
  };
}

describe("lateDayRows", () => {
  test("measures a late attempt and the days that cover it", () => {
    const [only] = rows({
      releases: [release("a")],
      attempts: [attempt("a", 1, 27)],
    });
    expect(only).toMatchObject({
      title: "Title a",
      dueAt: dueMs,
      handedInAt: at(27),
      lateMs: 27 * HOUR,
      daysNeeded: 2,
      days: 0,
      standing: false,
      cap: 5,
    });
  });

  test("a late resubmission makes an on-time assignment late", () => {
    const [only] = rows({
      releases: [release("a")],
      attempts: [attempt("a", 1, -2), attempt("a", 2, 3)],
    });
    expect(only?.handedInAt).toBe(at(3));
    expect(only?.daysNeeded).toBe(1);
  });

  test("an on-time later attempt is on time", () => {
    const [only] = rows({
      releases: [release("a")],
      attempts: [attempt("a", 1, 5), attempt("a", 2, -1)],
    });
    expect(only?.lateMs).toBe(0);
    expect(only?.daysNeeded).toBe(0);
  });

  test("a withdrawn-only assignment is not handed in", () => {
    const [only] = rows({
      releases: [release("a")],
      attempts: [attempt("a", 1, 30, "WITHDRAWN")],
    });
    expect(only).toMatchObject({
      handedInAt: null,
      lateMs: 0,
      daysNeeded: 0,
    });
  });

  test("a due override moves the due date and the lateness", () => {
    const override = at(48);
    const [only] = rows({
      releases: [release("a", { dueOverride: override } as Partial<Release>)],
      attempts: [attempt("a", 1, 51)],
    });
    expect(only?.dueAt).toBe(Date.parse(override));
    expect(only?.lateMs).toBe(3 * HOUR);
    expect(only?.daysNeeded).toBe(1);
  });

  test("one late day covers unitHours", () => {
    const [only] = lateDayRows({
      releases: [release("a")],
      attempts: [attempt("a", 1, 50)],
      uses: [],
      terms: { ...terms, unitHours: 48 },
    });
    expect(only?.daysNeeded).toBe(2);
  });

  test("leaves out an assignment that doesn't accept submissions", () => {
    const listed = rows({
      releases: [
        release("a"),
        release("b", { acceptsSubmissions: false } as Partial<Release>),
      ],
    });
    expect(listed.map((each) => each.assignment)).toEqual(["a"]);
  });

  test("a standing 0-day use is standing", () => {
    const [only] = rows({
      releases: [release("a")],
      uses: [use("a", 0)],
    });
    expect(only?.days).toBe(0);
    expect(only?.standing).toBe(true);
  });

  test("a canceled use is not standing", () => {
    const [only] = rows({
      releases: [release("a")],
      uses: [use("a", 2, "CANCELED")],
    });
    expect(only?.days).toBe(0);
    expect(only?.standing).toBe(false);
  });

  test("a standing use on an archived assignment gets its own row, last", () => {
    const listed = rows({
      releases: [release("a")],
      uses: [use("gone", 2), use("old", 1, "CANCELED")],
    });
    expect(listed.map((each) => each.assignment)).toEqual(["a", "gone"]);
    expect(listed[1]).toEqual({
      assignment: "gone",
      title: null,
      dueAt: null,
      handedInAt: null,
      lateMs: 0,
      daysNeeded: 0,
      days: 2,
      standing: true,
      cap: 2,
    });
  });

  test("sorts by the student's due date", () => {
    const listed = rows({
      releases: [
        release("late", { dueAt: at(10) } as Partial<Release>),
        release("early", { dueAt: at(-10) } as Partial<Release>),
      ],
    });
    expect(listed.map((each) => each.assignment)).toEqual(["early", "late"]);
  });

  test("caps the days at the per-assignment limit", () => {
    const [only] = lateDayRows({
      releases: [release("a")],
      attempts: [],
      uses: [use("a", 2)],
      terms: { unitHours: 24, perItemLimit: 3, remaining: 10 },
    });
    expect(only?.cap).toBe(3);
  });

  test("caps the days at the balance plus the days already on it", () => {
    const [only] = lateDayRows({
      releases: [release("a")],
      attempts: [],
      uses: [use("a", 2)],
      terms: { unitHours: 24, perItemLimit: 5, remaining: 1 },
    });
    expect(only?.cap).toBe(3);
  });
});

describe("moveTo", () => {
  const standing = row({ days: 2, standing: true });

  test("+ and − across an existing use change it", () => {
    expect(moveTo(standing, 3)).toEqual({ action: "change", days: 3 });
    expect(moveTo(standing, 1)).toEqual({ action: "change", days: 1 });
  });

  test("down to 0 cancels", () => {
    expect(moveTo(standing, 0)).toEqual({ action: "cancel" });
  });

  test("a standing 0-day use moves by change and leaves by cancel", () => {
    const zero = row({ days: 0, standing: true });
    expect(moveTo(zero, 1)).toEqual({ action: "change", days: 1 });
    expect(moveTo(zero, 0)).toEqual({ action: "cancel" });
  });

  test("from no use, + applies", () => {
    expect(moveTo(row(), 1)).toEqual({ action: "apply", days: 1 });
  });

  test("no move when nothing changes", () => {
    expect(moveTo(row(), 0)).toBeNull();
    expect(moveTo(standing, 2)).toBeNull();
  });
});

describe("cannotCover", () => {
  test("more than one assignment can take", () => {
    expect(
      cannotCover(row({ handedInAt: at(140), daysNeeded: 6 }), terms),
    ).toBe("Needs 6 late days, more than the 5 one assignment can take.");
  });

  test("more than the balance", () => {
    expect(
      cannotCover(row({ handedInAt: at(60), daysNeeded: 3, cap: 2 }), {
        ...terms,
        remaining: 2,
      }),
    ).toBe("Needs 3 late days. You have 2 left.");
  });

  test("null when it can be covered or already is", () => {
    expect(cannotCover(row({ daysNeeded: 2 }), terms)).toBeNull();
    expect(
      cannotCover(row({ daysNeeded: 2, days: 2, standing: true }), terms),
    ).toBeNull();
  });
});

describe("lateBy", () => {
  test("minutes", () => {
    expect(lateBy(1)).toBe("1 minute");
    expect(lateBy(12 * 60_000)).toBe("12 minutes");
  });

  test("hours", () => {
    expect(lateBy(HOUR)).toBe("1 hour");
    expect(lateBy(5 * HOUR)).toBe("5 hours");
  });

  test("days", () => {
    expect(lateBy(24 * HOUR)).toBe("1 day");
    expect(lateBy(48 * HOUR)).toBe("2 days");
  });

  test("days and hours", () => {
    expect(lateBy(27 * HOUR)).toBe("1 day 3 hours");
  });

  test("a part hour counts as an hour, so the text never sits below the days it needs", () => {
    expect(lateBy(24 * HOUR + 20 * 60_000)).toBe("1 day 1 hour");
    expect(lateBy(HOUR + 29 * 60_000)).toBe("2 hours");
  });
});
