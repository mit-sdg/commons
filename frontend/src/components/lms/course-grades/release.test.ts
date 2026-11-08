import { describe, expect, test } from "bun:test";
import {
  type CourseGradeInputs,
  type CoursePolicy,
  copyInputs,
  courseGradeCard,
  courseGrades,
  releaseSummary,
  releaseValue,
  updateValue,
} from "../../../../../src/computations/course-grades.ts";
import {
  dayIn,
  historyRows,
  lateAsMissingCount,
  lateWarning,
  reviewList,
  settingsFrom,
  settingsWords,
  shortTitle,
  sinceRelease,
  startingForm,
} from "./release-helpers";

const day = (n: number) => new Date(Date.UTC(2026, 8, n, 4)).toISOString();
const DUE_BY = new Date(day(30));
const AT = new Date(day(30));

function policy(): CoursePolicy {
  return {
    ratings: { DEFICIENT: 1, EMERGENT: 2, COMPETENT: 3, EXPERT: 4 },
    missing: 0,
    late: "missing",
    skillWeights: {},
    groups: [
      {
        key: "g",
        name: "Personal",
        weight: 100,
        combine: "average",
        rows: [
          { key: "r1", type: "assignment", assignment: "e1", weight: 1 },
          { key: "r2", type: "assignment", assignment: "e2", weight: 1 },
        ],
      },
    ],
    attendance: [],
    gradeSet: "letters",
    lines: {
      letters: [
        { grade: "A", at: 3.4 },
        { grade: "B", at: 2.8 },
        { grade: "C", at: 2.2 },
        { grade: "D", at: 1.6 },
      ],
      plusMinus: [],
    },
  };
}

const competency = (
  learner: string,
  item: string,
  evidence: string,
  ratings: [string, string][],
  status = "RELEASED",
) => ({
  learner,
  item,
  evidence,
  status,
  method: "COMPETENCY",
  createdAt: day(21),
  updatedAt: day(21),
  criteria: ratings.map(([standard], index) => ({
    criterion: `${item}-c${index}`,
    kind: "COMPETENCY",
    standard,
    name: standard,
    maxPoints: 0,
  })),
  judgments:
    status === "RELEASED"
      ? ratings.map(([, rating], index) => ({
          criterion: `${item}-c${index}`,
          rating,
          score: null,
        }))
      : [],
});

const attempt = (
  assignment: string,
  submitter: string,
  submission: string,
  at: string,
) => ({
  assignment,
  submitter,
  submission,
  number: 1,
  submittedAt: at,
  status: "SUBMITTED",
});

/**
 * Two exercises due Sep 10 and Sep 20. Ana is rated on both, on time. Ben
 * hands in Exercise 1 late without late days and has a draft on Exercise 2.
 * Cam hands nothing in for Exercise 1 and Exercise 2 is not graded yet.
 */
function inputs(): CourseGradeInputs {
  const students = ["ana", "ben", "cam"];
  return {
    assignments: [
      {
        assignment: "e1",
        title: "Exercise 1: Problem Framing",
        kind: "EXERCISE",
        dueAt: day(10),
        acceptsSubmissions: true,
      },
      {
        assignment: "e2",
        title: "Exercise 2",
        kind: "EXERCISE",
        dueAt: day(20),
        acceptsSubmissions: true,
      },
    ],
    releases: students.flatMap((student) => [
      { assignment: "e1", assignee: student, dueOverride: null },
      { assignment: "e2", assignee: student, dueOverride: null },
    ]),
    attempts: [
      attempt("e1", "ana", "a1", day(9)),
      attempt("e2", "ana", "a2", day(19)),
      attempt("e1", "ben", "b1", day(12)),
      attempt("e2", "ben", "b2", day(19)),
      attempt("e2", "cam", "c2", day(19)),
    ],
    assessments: [
      competency("ana", "e1", "a1", [
        ["pf", "COMPETENT"],
        ["tw", "EXPERT"],
      ]),
      competency("ana", "e2", "a2", [["pf", "EMERGENT"]]),
      competency("ben", "e1", "b1", [["pf", "EXPERT"]]),
      competency("ben", "e2", "b2", [["pf", "EXPERT"]], "DRAFT"),
    ],
    uses: [],
    unitHours: 24,
    students: [
      {
        user: "ana",
        section: null,
        email: "ana@example.edu",
        name: "Ana Ruiz",
      },
      { user: "ben", section: null, email: "ben@example.edu", name: "Ben Ito" },
      { user: "cam", section: null, email: "cam@example.edu", name: "Cam Lee" },
    ],
    lectureRuns: [],
    timezone: null,
    overrides: [],
  };
}

describe("the review list", () => {
  test("names each held student's reasons in words, by name", () => {
    const spec = policy();
    const grades = courseGrades(spec, inputs(), DUE_BY, AT);
    expect(reviewList(spec, inputs(), grades)).toEqual([
      {
        student: "ben",
        name: "Ben Ito",
        average: 0,
        grade: "F",
        reasons: [
          "Below C",
          "Exercise 1 late, no late days: 0",
          "Exercise 2 draft",
        ],
      },
      {
        student: "cam",
        name: "Cam Lee",
        average: 0,
        grade: "F",
        reasons: [
          "Below C",
          "Exercise 1 missing: 0",
          "Exercise 2 not graded yet",
        ],
      },
    ]);
  });

  test("holds a student with only a draft, without Below C", () => {
    const spec = policy();
    const data = inputs();
    data.assessments.push(
      competency("cam", "e2", "c2", [["pf", "EXPERT"]], "DRAFT"),
    );
    data.attempts.push(attempt("e1", "cam", "c1", day(9)));
    data.assessments.push(competency("cam", "e1", "c1", [["pf", "EXPERT"]]));
    const row = reviewList(
      spec,
      data,
      courseGrades(spec, data, DUE_BY, AT),
    ).find((entry) => entry.student === "cam");
    expect(row?.reasons).toEqual(["Exercise 2 draft"]);
  });

  test("uses the policy's Missing value", () => {
    const spec = { ...policy(), missing: 0.5 };
    const grades = courseGrades(spec, inputs(), DUE_BY, AT);
    expect(reviewList(spec, inputs(), grades)[1]?.reasons).toContain(
      "Exercise 1 missing: 0.5",
    );
  });

  test("a short title is the part before the colon", () => {
    expect(shortTitle("P4: Code complete")).toBe("P4");
    expect(shortTitle("Final Project")).toBe("Final Project");
  });
});

describe("the late-work warning", () => {
  test("counts students with late work counted as Missing", () => {
    const grades = courseGrades(policy(), inputs(), DUE_BY, AT);
    expect(lateAsMissingCount(grades)).toBe(1);
    expect(lateWarning(1, 0)).toBe("1 student has late work counted as 0");
    expect(lateWarning(4, 0)).toBe("4 students have late work counted as 0");
  });

  test("counts nobody when late work counts as rated", () => {
    const grades = courseGrades(
      { ...policy(), late: "graded" },
      inputs(),
      DUE_BY,
      AT,
    );
    expect(lateAsMissingCount(grades)).toBe(0);
  });
});

describe("settings", () => {
  test("send the end of the chosen day in the class time zone", () => {
    const form = {
      date: "2026-11-12",
      breakdown: true,
      letter: false,
      includeOverrides: true,
    };
    expect(settingsFrom(form, "America/New_York")).toEqual({
      dueBy: "2026-11-13T04:59:59.000Z",
      breakdown: true,
      letter: false,
      includeOverrides: false,
    });
    expect(settingsFrom(form, null).dueBy).toBe("2026-11-12T23:59:59.000Z");
  });

  test("include overrides only with the letter", () => {
    const form = {
      date: "2026-11-12",
      breakdown: false,
      letter: true,
      includeOverrides: true,
    };
    expect(settingsFrom(form, null)).toMatchObject({
      letter: true,
      includeOverrides: true,
    });
    expect(
      settingsFrom({ ...form, includeOverrides: false }, null).includeOverrides,
    ).toBe(false);
  });

  test("a dialog opens with the open release's settings, else today and the defaults", () => {
    const now = new Date("2026-11-02T15:00:00Z");
    expect(startingForm(null, "America/New_York", now)).toEqual({
      date: "2026-11-02",
      breakdown: true,
      letter: false,
      includeOverrides: true,
    });
    const settings = settingsFrom(
      {
        date: "2026-11-12",
        breakdown: false,
        letter: true,
        includeOverrides: false,
      },
      "America/New_York",
    );
    const open = { settings } as Parameters<typeof startingForm>[0];
    expect(startingForm(open, "America/New_York", now)).toEqual({
      date: "2026-11-12",
      breakdown: false,
      letter: true,
      includeOverrides: false,
    });
    expect(dayIn(settings.dueBy, "America/New_York")).toBe("2026-11-12");
  });

  test("words for the switches that were on", () => {
    expect(
      settingsWords({
        dueBy: "",
        breakdown: true,
        letter: true,
        includeOverrides: true,
      }),
    ).toEqual(["Breakdown by group", "Letter grade", "Include overrides"]);
    expect(
      settingsWords({
        dueBy: "",
        breakdown: false,
        letter: false,
        includeOverrides: true,
      }),
    ).toEqual([]);
  });
});

/* ---------- Since the release ---------- */

const SETTINGS = {
  dueBy: DUE_BY.toISOString(),
  breakdown: true,
  letter: true,
  includeOverrides: true,
};
const RELEASED_AT = new Date(day(30));

function released(data: CourseGradeInputs, release: string[] = []) {
  const value = releaseValue({
    policy: {
      policy: "p1",
      name: "Course guide",
      version: 4,
      specification: policy(),
    },
    inputs: data,
    settings: SETTINGS,
    release,
    by: "staff",
    at: RELEASED_AT,
  });
  const summary = releaseSummary({ value });
  return {
    entry: {
      edition: "r1",
      open: true,
      openedAt: RELEASED_AT.toISOString(),
      closedAt: null,
      authorName: "Sam Staff",
      release: summary,
    },
    value,
  };
}

describe("what a release keeps", () => {
  test("each student's copy holds only their own inputs and gives back their card", () => {
    const { value } = released(inputs());
    for (const [student, copy] of Object.entries(value.students)) {
      const { record } = copy;
      expect(record.student.user).toBe(student);
      for (const rows of [
        record.releases.map((row) => row.assignee),
        record.attempts.map((row) => row.submitter),
        record.assessments.map((row) => row.learner),
        record.uses.map((row) => row.learner),
      ])
        expect(rows.every((owner) => owner === student)).toBe(true);
      const again = courseGrades(
        value.policy.specification,
        copyInputs(value.course, record),
        DUE_BY,
        RELEASED_AT,
      )[0]!;
      const card = courseGradeCard(
        value.policy.specification,
        copyInputs(value.course, record),
        again,
        value.settings,
        copy.held !== null,
      );
      expect(card).toEqual(copy.card);
    }
  });

  test("an update keeps one student", () => {
    const { value } = released(inputs());
    const update = updateValue({
      release: value,
      inputs: inputs(),
      student: "ana",
      reason: "Regrade",
      by: "staff",
      at: new Date(day(30)),
    });
    expect(update.copy.record.student.user).toBe("ana");
    expect(
      update.copy.record.assessments.every((row) => row.learner === "ana"),
    ).toBe(true);
    expect(update.copy.card).toEqual(value.students.ana!.card);
  });
});

type Page = Parameters<typeof sinceRelease>[0];
type Entry = Parameters<typeof sinceRelease>[1];

function page(
  data: CourseGradeInputs,
  version = 4,
  updates: unknown[] = [],
): Page {
  return {
    inputs: data,
    policies: [
      {
        policy: "p1",
        name: "Course guide",
        version,
        final: true,
        author: "staff",
        authorName: "Sam Staff",
        savedAt: day(1),
      },
    ],
    updates,
  } as unknown as Page;
}

describe("changed since release", () => {
  test("nothing changed: every copy matches", () => {
    const { entry } = released(inputs());
    expect(sinceRelease(page(inputs()), entry as unknown as Entry, AT)).toEqual(
      {
        policyMoved: false,
        stale: 0,
        changed: false,
      },
    );
  });

  test("a regrade makes one copy stale", () => {
    const { entry } = released(inputs());
    const now = inputs();
    now.assessments[1] = competency("ana", "e2", "a2", [["pf", "EXPERT"]]);
    expect(sinceRelease(page(now), entry as unknown as Entry, AT)).toEqual({
      policyMoved: false,
      stale: 1,
      changed: true,
    });
  });

  test("a held copy stays matching while a reason still holds the student", () => {
    const { entry } = released(inputs());
    const now = inputs();
    // Ben's draft is released, but he is still below C, so his copy stays held.
    now.assessments[3] = competency("ben", "e2", "b2", [["pf", "EXPERT"]]);
    expect(sinceRelease(page(now), entry as unknown as Entry, AT).stale).toBe(
      0,
    );
  });

  test("a held copy goes stale once nothing holds the student", () => {
    const { entry } = released(inputs());
    const now = inputs();
    now.attempts.push(attempt("e1", "cam", "c1", day(9)));
    now.assessments.push(competency("cam", "e1", "c1", [["pf", "EXPERT"]]));
    now.assessments.push(competency("cam", "e2", "c2", [["pf", "EXPERT"]]));
    expect(sinceRelease(page(now), entry as unknown as Entry, AT).stale).toBe(
      1,
    );
  });

  test("a newer update stands in for the release's copy", () => {
    const { entry, value } = released(inputs());
    const now = inputs();
    now.assessments[1] = competency("ana", "e2", "a2", [["pf", "EXPERT"]]);
    const update = updateValue({
      release: value,
      inputs: now,
      student: "ana",
      reason: "Regrade",
      by: "staff",
      at: new Date(day(30)),
    });
    const summary = releaseSummary({ value: update });
    const updates = [
      {
        edition: "u1",
        student: "ana",
        openedAt: new Date(day(30)).toISOString(),
        update: summary,
      },
    ];
    expect(
      sinceRelease(page(now, 4, updates), entry as unknown as Entry, AT).stale,
    ).toBe(0);
  });

  test("a newer final version is a change", () => {
    const { entry } = released(inputs());
    expect(
      sinceRelease(page(inputs(), 5), entry as unknown as Entry, AT),
    ).toEqual({
      policyMoved: true,
      stale: 0,
      changed: true,
    });
  });
});

describe("the release history", () => {
  test("lists releases newest first, replaced or hidden, with the held count", () => {
    const { entry } = released(inputs());
    const older = {
      ...entry,
      edition: "r0",
      open: false,
      openedAt: day(20),
      closedAt: day(25),
    };
    const newer = {
      ...entry,
      open: false,
      openedAt: day(25),
      closedAt: day(28),
    };
    const rows = historyRows({
      releases: [older, newer],
    } as unknown as Parameters<typeof historyRows>[0]);
    expect(rows.map((row) => [row.edition, row.ended?.word, row.held])).toEqual(
      [
        ["r1", "Hidden", 2],
        ["r0", "Replaced", 2],
      ],
    );
    expect(rows[0]).toMatchObject({
      policyName: "Course guide",
      version: 4,
      authorName: "Sam Staff",
    });
  });
});
