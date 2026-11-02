import { describe, expect, test } from "bun:test";
import {
  type CourseGradeInputs,
  type CoursePolicy,
  changesBetween,
  differsIn,
  endOfDay,
  letterCounts,
  medianGrade,
  nearCutoff,
  policyIsWellFormed,
  type StudentGrade,
  showAverage,
  showGrade,
  startingPolicy,
} from "./course-grades.ts";

function assignment(
  id: string,
  kind: string,
  dueAt: string,
  acceptsSubmissions = true,
) {
  return { assignment: id, title: id, kind, dueAt, acceptsSubmissions };
}

function inputs(
  assignments: ReturnType<typeof assignment>[],
): CourseGradeInputs {
  return {
    assignments,
    releases: [],
    attempts: [],
    assessments: [],
    uses: [],
    unitHours: 24,
    students: [],
    lectureRuns: [],
    timezone: "America/New_York",
    overrides: [],
  };
}

const COURSE = inputs([
  assignment("ex1", "EXERCISE", "2026-09-10T16:00:00Z"),
  assignment("pp", "PERSONAL_PROJECT", "2026-10-20T16:00:00Z"),
  assignment("fp1", "FINAL_PROJECT", "2026-11-20T16:00:00Z"),
  assignment("fp2", "FINAL_PROJECT", "2026-12-08T16:00:00Z"),
  assignment("survey", "ADMIN", "2026-09-05T16:00:00Z", false),
]);

/** A copy of the starting policy, to change one thing in. */
const base = (): CoursePolicy => structuredClone(startingPolicy(COURSE));

function grade(
  average: number | null,
  letter: string | null,
  extra: Partial<StudentGrade> = {},
): StudentGrade {
  return {
    student: "s",
    work: {},
    groups: [],
    average,
    lineGrade: letter,
    policyGrade: letter,
    grade: letter,
    cappedBy: null,
    override: null,
    lectures: { attended: 0, total: 0 },
    ...extra,
  };
}

describe("startingPolicy", () => {
  test("splits Final project work into Team and the rest into Personal", () => {
    const policy = startingPolicy(COURSE);
    expect(policy.groups.map((group) => [group.name, group.weight])).toEqual([
      ["Personal", 70],
      ["Team", 30],
    ]);
    const assignments = (index: number) =>
      policy.groups[index]!.rows.map((row) =>
        row.type === "assignment" ? row.assignment : row.standard,
      );
    expect(assignments(0)).toEqual(["ex1", "pp"]);
    expect(assignments(1)).toEqual(["fp1", "fp2"]);
  });

  test("leaves out assignments that don't accept submissions", () => {
    const rows = startingPolicy(COURSE).groups.flatMap((group) => group.rows);
    expect(
      rows.some(
        (row) => row.type === "assignment" && row.assignment === "survey",
      ),
    ).toBe(false);
  });

  test("is well formed, with unique keys and the course guide's values", () => {
    const policy = startingPolicy(COURSE);
    expect(policyIsWellFormed({ specification: policy })).toBe(true);
    const keys = [
      ...policy.groups.map((group) => group.key),
      ...policy.groups.flatMap((group) => group.rows.map((row) => row.key)),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    expect(policy.ratings).toEqual({
      DEFICIENT: 1,
      EMERGENT: 2,
      COMPETENT: 3,
      EXPERT: 4,
    });
    expect(policy.missing).toBe(0);
    expect(policy.late).toBe("missing");
    expect(policy.gradeSet).toBe("letters");
  });
});

describe("differsIn", () => {
  test("names nothing for the same policy under new keys", () => {
    const left = base();
    const right = startingPolicy(COURSE);
    right.attendance = [];
    expect(differsIn(left, right)).toEqual([]);
  });

  test("names each setting that differs, groups by name", () => {
    const left = base();
    const right = base();
    right.ratings.EXPERT = 5;
    right.missing = 1;
    right.late = "graded";
    right.skillWeights = { ex1: { framing: 3 } };
    right.groups[1]!.weight = 40;
    right.attendance = [{ key: "a1", below: 70, atMost: "B" }];
    right.lines.letters[2]!.at = 2.3;
    expect(differsIn(left, right)).toEqual([
      "Rating values",
      "Missing",
      "Late work",
      "Skill weights",
      "Team",
      "Attendance",
      "Grade lines",
    ]);
  });

  test("names a group only one policy has", () => {
    const right = base();
    right.groups.push({
      key: "g9",
      name: "Design",
      weight: 10,
      combine: "best",
      rows: [],
    });
    expect(differsIn(base(), right)).toEqual(["Design"]);
  });

  test("ignores attendance rule keys", () => {
    const left = base();
    const right = base();
    left.attendance = [{ key: "a1", below: 70, atMost: "B" }];
    right.attendance = [{ key: "a2", below: 70, atMost: "B" }];
    expect(differsIn(left, right)).toEqual([]);
  });

  test("names the grade set, and the lines in use with it", () => {
    const right = base();
    right.gradeSet = "plusMinus";
    expect(differsIn(base(), right)).toEqual(["Grade set", "Grade lines"]);
  });
});

describe("changesBetween", () => {
  test("gives a group's weight, Missing, and a line as before → after", () => {
    const older = base();
    const newer = structuredClone(older);
    newer.groups[1]!.weight = 40;
    newer.missing = 1;
    newer.lines.letters[2]!.at = 2.3;
    expect(changesBetween(older, newer)).toEqual([
      "Team 30 → 40",
      "Missing 0 → 1",
      "C line 2.2 → 2.3",
    ]);
  });

  test("names a setting whose change has no single number", () => {
    const older = base();
    const newer = structuredClone(older);
    newer.late = "graded";
    newer.ratings.EXPERT = 5;
    expect(changesBetween(older, newer)).toEqual([
      "Rating values",
      "Late work",
    ]);
  });

  test("is empty when nothing changed", () => {
    const older = base();
    expect(changesBetween(older, structuredClone(older))).toEqual([]);
  });

  // Fails today: the weight change is matched to differsIn's group name by the
  // first word of "Design skills 30 → 40", so the name is added a second time.
  test("names a group of two words once", () => {
    const older = base();
    older.groups[1]!.name = "Design skills";
    const newer = structuredClone(older);
    newer.groups[1]!.weight = 40;
    expect(changesBetween(older, newer)).toEqual(["Design skills 30 → 40"]);
  });
});

describe("showAverage", () => {
  const policy = base();
  test("shows two decimals for letters, letters with + and −, and MIT GPA", () => {
    expect(showAverage(2.714, policy, "letters")).toBe("2.71");
    expect(showAverage(2.7, policy, "plusMinus")).toBe("2.70");
    expect(showAverage(3, policy, "gpa")).toBe("3.00");
  });

  test("shows a percent of the highest rating value", () => {
    expect(showAverage(2.71, policy, "percent")).toBe("68%");
    expect(showAverage(4, policy, "percent")).toBe("100%");
  });

  test("shows a dash for no average", () => {
    for (const showAs of ["letters", "plusMinus", "percent", "gpa"] as const)
      expect(showAverage(null, policy, showAs)).toBe("–");
  });
});

describe("showGrade", () => {
  const letters = base();
  const plusMinus = { ...base(), gradeSet: "plusMinus" as const };

  test("shows the policy's letter under Letters and Percent", () => {
    expect(showGrade(grade(2.9, "B"), letters, "letters")).toBe("B");
    expect(showGrade(grade(2.9, "B"), letters, "percent")).toBe("B");
  });

  test("shows a plus or minus letter from the average under a letters policy", () => {
    expect(showGrade(grade(3.25, "B"), letters, "plusMinus")).toBe("B+");
    expect(showGrade(grade(2.8, "B"), letters, "plusMinus")).toBe("B−");
  });

  test("keeps an override's or a cap's letter under Letters with + and −", () => {
    const override = {
      subject: "s",
      value: "A",
      reason: "Regrade",
      replaced: "B",
      author: "u",
      setAt: "2026-11-01T00:00:00Z",
    };
    expect(
      showGrade(grade(3.25, "A", { override }), letters, "plusMinus"),
    ).toBe("A");
    const cappedBy = { key: "a1", below: 70, atMost: "C" };
    expect(
      showGrade(grade(3.25, "C", { cappedBy }), letters, "plusMinus"),
    ).toBe("C");
  });

  test("drops the + or − under Letters for a plus-minus policy", () => {
    expect(showGrade(grade(3.25, "B+"), plusMinus, "letters")).toBe("B");
    expect(showGrade(grade(3.25, "B+"), plusMinus, "plusMinus")).toBe("B+");
  });

  test("shows MIT GPA points by the letter", () => {
    expect(showGrade(grade(3.5, "A"), letters, "gpa")).toBe("5.0");
    expect(showGrade(grade(3.4, "A−"), plusMinus, "gpa")).toBe("5.0");
    expect(showGrade(grade(2.3, "C"), letters, "gpa")).toBe("3.0");
    expect(showGrade(grade(1, "F"), letters, "gpa")).toBe("0.0");
  });

  test("shows a dash for no grade", () => {
    for (const showAs of ["letters", "plusMinus", "percent", "gpa"] as const)
      expect(showGrade(grade(null, null), letters, showAs)).toBe("–");
  });
});

describe("the class at a glance", () => {
  const policy = base();
  const class_ = [
    grade(3.5, "A"),
    grade(3.0, "B"),
    grade(2.9, "B"),
    grade(2.3, "C"),
    grade(1.2, "F"),
    grade(null, null),
  ];

  test("letterCounts counts each letter of the policy's set, best first", () => {
    expect(letterCounts(class_, policy)).toEqual([
      { grade: "A", count: 1 },
      { grade: "B", count: 2 },
      { grade: "C", count: 1 },
      { grade: "D", count: 0 },
      { grade: "F", count: 1 },
    ]);
  });

  test("medianGrade takes the middle letter of students with a grade", () => {
    expect(medianGrade(class_, policy)).toBe("B");
    expect(medianGrade(class_.slice(3), policy)).toBe("C");
    expect(medianGrade([grade(null, null)], policy)).toBeNull();
  });

  test("medianGrade takes the better of the two middle letters", () => {
    expect(medianGrade([grade(3.5, "A"), grade(2.3, "C")], policy)).toBe("A");
  });

  test("nearCutoff is true within 0.05 of a line in the policy's set", () => {
    expect(nearCutoff(grade(2.23, "C"), policy)).toBe(true);
    expect(nearCutoff(grade(2.18, "D"), policy)).toBe(true);
    expect(nearCutoff(grade(2.5, "C"), policy)).toBe(false);
    expect(nearCutoff(grade(null, null), policy)).toBe(false);
    expect(nearCutoff(grade(2.42, "C"), policy)).toBe(false);
    expect(
      nearCutoff(grade(2.42, "C"), { ...policy, gradeSet: "plusMinus" }),
    ).toBe(true);
  });
});

describe("endOfDay", () => {
  test("ends the day at 23:59:59 in America/New_York, in winter and summer", () => {
    expect(endOfDay("2026-11-12", "America/New_York")).toBe(
      "2026-11-13T04:59:59.000Z",
    );
    expect(endOfDay("2026-07-01", "America/New_York")).toBe(
      "2026-07-02T03:59:59.000Z",
    );
  });

  test("follows the clock change on the day it happens", () => {
    expect(endOfDay("2026-11-01", "America/New_York")).toBe(
      "2026-11-02T04:59:59.000Z",
    );
    expect(endOfDay("2026-03-08", "America/New_York")).toBe(
      "2026-03-09T03:59:59.000Z",
    );
  });

  test("uses UTC without a time zone", () => {
    expect(endOfDay("2026-11-12", null)).toBe("2026-11-12T23:59:59.000Z");
  });
});
