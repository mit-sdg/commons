import { describe, expect, test } from "vite-plus/test";
import {
  type CourseGradeInputs,
  type CoursePolicy,
  copyInputs,
  courseGradeCard,
  courseGradeInputs,
  courseGrades,
  courseGradesCsv,
  holdReasons,
  ownCourseGrade,
  policyIsWellFormed,
  releaseValue,
  round2,
  studentGrade,
  updateValue,
} from "../../src/computations/course-grades.ts";

const day = (n: number) => new Date(Date.UTC(2026, 8, n, 4)).toISOString();
const DUE_BY = new Date(day(30));
const AT = new Date(day(30));

function policy(overrides: Partial<CoursePolicy> = {}): CoursePolicy {
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
      plusMinus: [
        { grade: "A", at: 3.6 },
        { grade: "B", at: 3 },
        { grade: "C", at: 2.4 },
        { grade: "C−", at: 2.2 },
      ],
    },
    ...overrides,
  };
}

/** Two exercises due Sep 10 and Sep 20, assigned to Ana, each handed in on time and rated. */
function inputs(): CourseGradeInputs {
  const competency = (
    item: string,
    evidence: string,
    ratings: [string, string][],
    status = "RELEASED",
  ) => ({
    learner: "ana",
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
      name: standard === "pf" ? "Problem framing" : "Technical writing",
      maxPoints: 0,
    })),
    judgments: ratings.map(([, rating], index) => ({
      criterion: `${item}-c${index}`,
      rating,
      score: null,
    })),
  });
  return {
    assignments: [
      {
        assignment: "e1",
        title: "Exercise 1",
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
    releases: [
      { assignment: "e1", assignee: "ana", dueOverride: null },
      { assignment: "e2", assignee: "ana", dueOverride: null },
    ],
    attempts: [
      {
        assignment: "e1",
        submitter: "ana",
        submission: "s1",
        number: 1,
        submittedAt: day(9),
        status: "SUBMITTED",
      },
      {
        assignment: "e2",
        submitter: "ana",
        submission: "s2",
        number: 1,
        submittedAt: day(19),
        status: "SUBMITTED",
      },
    ],
    assessments: [
      competency("e1", "s1", [
        ["pf", "COMPETENT"],
        ["tw", "EXPERT"],
      ]),
      competency("e2", "s2", [["pf", "EMERGENT"]]),
    ],
    uses: [],
    unitHours: 24,
    students: [{ user: "ana", section: null, email: "ana@example.edu", name: "Ana Ruiz" }],
    lectureRuns: [],
    timezone: null,
    overrides: [],
  };
}

const grade = (p: CoursePolicy, i: CourseGradeInputs, dueBy = DUE_BY, at = AT) =>
  studentGrade(p, i, "ana", dueBy, at);

describe("work that counts", () => {
  test("a rated assignment averages its skills by their weights", () => {
    const g = grade(policy({ skillWeights: { e1: { pf: 3 } } }), inputs());
    expect(g.work.e1!.value).toBe((3 * 3 + 4) / 4);
    expect(g.average).toBe(2.63);
  });

  test("excused, draft, ungraded, not due, and not assigned work are left out", () => {
    const i = inputs();
    i.assessments[1]!.status = "EXCUSED";
    expect(grade(policy(), i).work.e2!.status).toBe("excused");
    i.assessments[1]!.status = "DRAFT";
    expect(grade(policy(), i).work.e2!.status).toBe("draft");
    i.assessments.pop();
    expect(grade(policy(), i).work.e2!.status).toBe("ungraded");
    expect(grade(policy(), i).average).toBe(3.5);
    expect(grade(policy(), inputs(), new Date(day(15))).work.e2!.status).toBe("notDue");
    const unassigned = inputs();
    unassigned.releases.pop();
    expect(grade(policy(), unassigned).work.e2!.status).toBe("notAssigned");
  });

  test("an assignment-wide excusal leaves the work out even with nothing handed in", () => {
    const i = inputs();
    i.attempts.pop();
    i.assessments[1] = { ...i.assessments[1]!, evidence: "", status: "EXCUSED", judgments: [] };
    expect(grade(policy(), i).work.e2!.status).toBe("excused");
  });

  test("missing work counts as Missing once the student's own due date, with late days, has passed", () => {
    const i = inputs();
    i.attempts.pop();
    expect(grade(policy(), i).work.e2).toMatchObject({ status: "missing", value: 0 });
    i.releases[1]!.dueOverride = day(29);
    i.uses.push({ learner: "ana", item: "e2", days: 2 });
    expect(grade(policy(), i).work.e2!.status).toBe("notDue");
  });

  test("late work without late days follows the policy's rule", () => {
    const i = inputs();
    i.attempts[1]!.submittedAt = day(21);
    expect(grade(policy({ late: "missing" }), i).work.e2).toMatchObject({
      status: "late",
      value: 0,
    });
    expect(grade(policy({ late: "graded" }), i).work.e2).toMatchObject({
      status: "lateRated",
      value: 2,
    });
    i.uses.push({ learner: "ana", item: "e2", days: 1 });
    expect(grade(policy({ late: "missing" }), i).work.e2!.status).toBe("rated");
  });

  test("NOT_ASSESSED is left out of its assignment's average", () => {
    const i = inputs();
    i.assessments[0]!.judgments[1]!.rating = "NOT_ASSESSED";
    expect(grade(policy(), i).work.e1!.value).toBe(3);
  });

  test("a points assignment counts its share of the rating range", () => {
    const i = inputs();
    i.assessments[1] = {
      ...i.assessments[1]!,
      method: "POINTS",
      criteria: [{ criterion: "p", kind: "POINTS", standard: "", name: "Points", maxPoints: 10 }],
      judgments: [{ criterion: "p", rating: null, score: 8 }],
    };
    expect(grade(policy(), i).work.e2!.value).toBeCloseTo(3.4);
  });
});

describe("skills followed across the term", () => {
  const skillPolicy = (count: "latest" | "best" | "average", from: "personal" | "all") =>
    policy({
      groups: [
        {
          key: "g",
          name: "Skills",
          weight: 100,
          combine: "average",
          rows: [{ key: "pf", type: "skill", standard: "pf", weight: 1, count, from }],
        },
      ],
    });

  test("Latest, Best, and Average", () => {
    expect(grade(skillPolicy("latest", "all"), inputs()).average).toBe(2);
    expect(grade(skillPolicy("best", "all"), inputs()).average).toBe(3);
    expect(grade(skillPolicy("average", "all"), inputs()).average).toBe(2.5);
    expect(grade(skillPolicy("latest", "all"), inputs()).groups[0]!.rows[0]!.counted).toEqual([
      "e2",
    ]);
  });

  test("personal work leaves out team work", () => {
    const i = inputs();
    i.assignments[1]!.kind = "FINAL_PROJECT";
    expect(grade(skillPolicy("latest", "personal"), i).average).toBe(3);
    expect(grade(skillPolicy("latest", "all"), i).average).toBe(2);
  });
});

describe("groups and grades", () => {
  test("Drop lowest drops one row", () => {
    const p = policy();
    p.groups[0]!.combine = "dropLowest";
    expect(grade(p, inputs()).average).toBe(3.5);
    expect(grade(p, inputs()).groups[0]!.rows.find((row) => row.dropped)?.key).toBe("r2");
  });

  test("an average is rounded once and graded from the rounded value", () => {
    const i = inputs();
    // (3 * 2 + 2.2) / 3 = 2.7333 rounds to 2.73: a B line at 2.73 includes it.
    i.assessments[0]!.judgments = [{ criterion: "e1-c0", rating: "COMPETENT", score: null }];
    const p = policy({ ratings: { DEFICIENT: 1, EMERGENT: 2.2, COMPETENT: 3, EXPERT: 4 } });
    p.groups[0]!.rows[0]!.weight = 2;
    p.lines.letters[1]!.at = 2.73;
    const g = grade(p, i);
    expect(g.average).toBe(2.73);
    expect(g.grade).toBe("B");
  });

  test("the attendance rule caps the letter, and an override replaces it", () => {
    const i = inputs();
    i.assessments[1]!.judgments[0]!.rating = "EXPERT";
    i.lectureRuns = Array.from({ length: 10 }, (_, n) => ({
      run: `l${n}`,
      openedAt: day(n + 1),
      joined: n < 6 ? ["ana"] : ["someone"],
    }));
    const p = policy({ attendance: [{ key: "a", below: 70, atMost: "B" }] });
    const capped = grade(p, i);
    expect(capped.lineGrade).toBe("A");
    expect(capped.policyGrade).toBe("B");
    expect(capped.cappedBy?.atMost).toBe("B");
    i.overrides.push({
      subject: "ana",
      value: "A",
      reason: "excused absences",
      replaced: "B",
      author: "t",
      setAt: day(30),
    });
    expect(grade(p, i)).toMatchObject({ policyGrade: "B", grade: "A" });
  });

  test("a student below C, or with drafts or ungraded work, is held", () => {
    const i = inputs();
    i.assessments[0]!.judgments = [{ criterion: "e1-c0", rating: "DEFICIENT", score: null }];
    i.assessments[1]!.status = "DRAFT";
    const [g] = courseGrades(policy(), i, DUE_BY, AT);
    expect(holdReasons(policy(), g!)).toEqual(["below C", "draft"]);
  });

  test("a draft on work no row of the policy reads holds no one", () => {
    const i = inputs();
    i.assessments[1]!.status = "DRAFT";
    const only = policy();
    only.groups[0]!.rows = [only.groups[0]!.rows[0]!];
    const [g] = courseGrades(only, i, DUE_BY, AT);
    expect(g!.work.e2!.status).toBe("draft");
    expect(holdReasons(only, g!)).toEqual([]);
  });

  test("an exact half-cent rounds up, so a student shown 2.20 is graded C", () => {
    expect(round2(0.7 * 1.85 + 0.3 * 3)).toBe(2.2);
    expect(round2(0.7 * 2.25 + 0.3 * 2)).toBe(2.18);
    expect(round2(2.194)).toBe(2.19);
    expect(round2(3)).toBe(3);
  });
});

describe("what a student sees", () => {
  const settings = {
    dueBy: DUE_BY.toISOString(),
    breakdown: true,
    letter: false,
    includeOverrides: false,
  };
  const final = { policy: "p", name: "Course guide", version: 4, specification: policy() };

  test("the card carries the breakdown, a note on every zeroed or left-out row, and no letter unless asked", () => {
    const i = inputs();
    i.attempts.pop();
    const card = courseGradeCard(policy(), i, grade(policy(), i), settings, false);
    expect(card).toMatchObject({ status: "released", average: 1.75, letter: null, lectures: null });
    expect(card.groups![0]!.rows).toEqual([
      { title: "Exercise 1", value: 3.5, points: null, note: null },
      { title: "Exercise 2", value: 0, points: null, note: "missing: 0" },
    ]);
    expect(
      courseGradeCard(policy(), i, grade(policy(), i), { ...settings, breakdown: false }, false)
        .groups,
    ).toBeNull();
  });

  test("overrides reach the card only with the letter and Include overrides on", () => {
    const i = inputs();
    i.overrides.push({
      subject: "ana",
      value: "A",
      reason: "r",
      replaced: "B",
      author: "t",
      setAt: day(30),
    });
    const g = grade(policy(), i);
    const card = (letter: boolean, includeOverrides: boolean) =>
      courseGradeCard(policy(), i, g, { ...settings, letter, includeOverrides }, false).letter;
    expect(card(false, true)).toBeNull();
    expect(card(true, false)).toBe("C");
    expect(card(true, true)).toBe("A");
  });

  test("a release holds students below C unless released by name, and a student reads only their own card", () => {
    const i = inputs();
    i.students.push({ user: "ben", section: null, email: "ben@example.edu", name: "Ben" });
    i.releases.push({ assignment: "e1", assignee: "ben", dueOverride: null });
    const held = releaseValue({
      policy: final,
      inputs: i,
      settings,
      release: [],
      by: "dj",
      at: AT,
    });
    expect(held.students.ben!.held).toEqual(["below C"]);
    expect(held.students.ana!.held).toBeNull();
    expect(held.students.ben!.card.status).toBe("held");
    const released = releaseValue({
      policy: final,
      inputs: i,
      settings,
      release: ["ben"],
      by: "dj",
      at: AT,
    });
    expect(Object.values(released.students).every((copy) => copy.held === null)).toBe(true);
    const own = (student: string, open = true) =>
      ownCourseGrade({
        student,
        release: held,
        releaseOpen: open,
        releaseOpenedAt: AT,
        update: null,
        updateOpen: null,
        updateOpenedAt: null,
      });
    expect(own("ana").card).toEqual(held.students.ana!.card);
    expect(own("ben").card!.status).toBe("held");
    expect(own("someone-else")).toEqual({ state: "none", card: null });
    expect(own("ana", false)).toEqual({ state: "withdrawn", card: null });
  });

  test("an update replaces one student's card while it is newer than the class release", () => {
    const i = inputs();
    const release = releaseValue({
      policy: final,
      inputs: i,
      settings,
      release: [],
      by: "dj",
      at: AT,
    });
    i.assessments[1]!.judgments[0]!.rating = "EXPERT";
    const update = updateValue({
      release,
      inputs: i,
      student: "ana",
      reason: "regrade",
      by: "dj",
      at: AT,
    });
    const read = (updateOpenedAt: string) =>
      ownCourseGrade({
        student: "ana",
        release,
        releaseOpen: true,
        releaseOpenedAt: day(30),
        update,
        updateOpen: true,
        updateOpenedAt,
      }).card!.average;
    expect(read(day(30))).toBe(3.75);
    expect(read(day(29))).toBe(release.students.ana!.card.average);
  });
});

describe("the download and the policy's shape", () => {
  test("the CSV names groups once each and quotes text", () => {
    const p = policy();
    p.groups.push({ ...p.groups[0]!, key: "g2", name: "Personal" });
    const csv = courseGradesCsv({
      policy: { policy: "p", name: "Guide, v2", version: 2, specification: p },
      inputs: inputs(),
      sections: [],
      at: AT,
    });
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toBe(
      "Student name,Email,Section,Personal,Personal (2),Average,Grade,Policy grade,Reason,Lectures attended,Lectures,Policy,Version,As of",
    );
    expect(row).toContain('Ana Ruiz,ana@example.edu,,2.75,2.75,2.75,C,C,,0,0,"Guide, v2",2,');
  });

  test("a policy with an empty entry is refused, not thrown on", () => {
    const broken = (change: (spec: Record<string, unknown>) => void) => {
      const spec = structuredClone(policy()) as unknown as Record<string, unknown>;
      change(spec);
      return policyIsWellFormed({ specification: spec as never });
    };
    expect(broken((spec) => ((spec.lines as { letters: unknown[] }).letters = [null]))).toBe(false);
    expect(broken((spec) => (spec.groups = [null]))).toBe(false);
    expect(broken((spec) => (spec.attendance = [null]))).toBe(false);
    expect(broken((spec) => ((spec.groups as { rows: unknown[] }[])[0]!.rows = [null]))).toBe(
      false,
    );
    expect(broken((spec) => (spec.skillWeights = { x: 3 }))).toBe(false);
    expect(broken((spec) => ((spec.lines as Record<string, unknown>).extra = 1))).toBe(true);
  });

  test("a policy is checked before it is saved", () => {
    expect(policyIsWellFormed({ specification: policy() })).toBe(true);
    expect(policyIsWellFormed({ specification: { ...policy(), late: "sometimes" } as never })).toBe(
      false,
    );
    const p = policy();
    p.groups[0]!.rows.push({
      key: "x",
      type: "skill",
      standard: "pf",
      weight: 1,
      count: "most",
      from: "all",
    } as never);
    expect(policyIsWellFormed({ specification: p })).toBe(false);
    expect(policyIsWellFormed({ specification: null as never })).toBe(false);
  });
});

describe("work submitted by each section", () => {
  /**
   * Exercise 2 is submitted by each section. Ana and Bea are in t1, Cal in
   * t2, and Dee in none. t1's attempt is rated Expert and t2's Deficient; Dee
   * handed in her own and was rated Competent. Bea's own earlier attempt on
   * the exercise was rated Deficient.
   */
  function sectionInputs(): CourseGradeInputs {
    const i = inputs();
    i.assignments[1]!.submittedBy = "SECTION";
    const template = i.assessments[1]!;
    const rated = (learner: string, evidence: string, rating: string) => ({
      ...template,
      learner,
      evidence,
      judgments: [{ ...template.judgments[0]!, rating }],
    });
    const attempt = (submitter: string, submission: string) => ({
      ...i.attempts[1]!,
      submitter,
      submission,
    });
    i.students.push(
      { user: "bea", section: "t1", email: "bea@example.edu", name: "Bea" },
      { user: "cal", section: "t2", email: "cal@example.edu", name: "Cal" },
      { user: "dee", section: null, email: "dee@example.edu", name: "Dee" },
    );
    i.students[0]!.section = "t1";
    for (const student of ["bea", "cal", "dee"])
      i.releases.push({ assignment: "e2", assignee: student, dueOverride: null });
    i.attempts.splice(1, 1, attempt("t1", "st1"), attempt("t2", "st2"), attempt("dee", "sd"));
    i.attempts.push(attempt("bea", "sb"));
    i.assessments.splice(
      1,
      1,
      rated("t1", "st1", "EXPERT"),
      rated("t2", "st2", "DEFICIENT"),
      rated("dee", "sd", "COMPETENT"),
      rated("bea", "sb", "DEFICIENT"),
    );
    return i;
  }
  const onE2 = (i: CourseGradeInputs, student: string) =>
    studentGrade(policy(), i, student, DUE_BY, AT).work.e2!;

  test("a student's work is their section's, and a student in no section is graded on their own", () => {
    const i = sectionInputs();
    expect(onE2(i, "ana")).toMatchObject({ status: "rated", value: 4 });
    expect(onE2(i, "bea")).toMatchObject({ status: "rated", value: 4 });
    expect(onE2(i, "cal")).toMatchObject({ status: "rated", value: 1 });
    expect(onE2(i, "dee")).toMatchObject({ status: "rated", value: 3 });
  });

  test("a student moved to another section is graded on that section's work", () => {
    const i = sectionInputs();
    i.students.find((student) => student.user === "bea")!.section = "t2";
    expect(onE2(i, "bea")).toMatchObject({ status: "rated", value: 1 });
  });

  test("late days standing on the assignment are ignored", () => {
    const i = sectionInputs();
    for (const row of i.attempts) if (row.assignment === "e2") row.submittedAt = day(21);
    i.uses.push({ learner: "ana", item: "e2", days: 2 }, { learner: "dee", item: "e2", days: 2 });
    expect(onE2(i, "ana").status).toBe("late");
    i.assignments[1]!.submittedBy = "STUDENT";
    expect(onE2(i, "dee").status).toBe("rated");
  });

  test("a member's due date is the latest override among the section's current members", () => {
    const raw = sectionInputs();
    for (const row of raw.attempts) if (row.assignment === "e2") row.submittedAt = day(21);
    const override = (student: string, at: string) => {
      raw.releases.find(
        (release) => release.assignment === "e2" && release.assignee === student,
      )!.dueOverride = at;
    };
    override("ana", day(22));
    override("cal", day(20));
    const built = courseGradeInputs({
      assignments: raw.assignments,
      releases: raw.releases,
      attempts: raw.attempts,
      ratings: raw.assessments,
      uses: raw.uses,
      unitHours: raw.unitHours,
      students: raw.students,
      names: [],
      lectures: [],
      editions: [],
      parts: [],
      participation: [],
      detail: null,
      overrides: [],
    });
    const dueOf = (student: string) =>
      built.releases.find((release) => release.assignment === "e2" && release.assignee === student)!
        .dueOverride;
    expect([dueOf("ana"), dueOf("bea"), dueOf("cal"), dueOf("dee")]).toEqual([
      day(22),
      day(22),
      day(20),
      null,
    ]);
    expect(onE2(built, "bea").status).toBe("rated");
    expect(onE2(built, "cal").status).toBe("late");
  });

  test("a release keeps the rows that stand for each student and gives back their card", () => {
    const i = sectionInputs();
    const settings = {
      dueBy: DUE_BY.toISOString(),
      breakdown: true,
      letter: true,
      includeOverrides: false,
    };
    const value = releaseValue({
      policy: { policy: "p", name: "Course guide", version: 1, specification: policy() },
      inputs: i,
      settings,
      release: [],
      by: "dj",
      at: AT,
    });
    const record = value.students.bea!.record;
    expect(record.attempts.map((row) => row.submission)).toEqual(["st1"]);
    expect(record.assessments.map((row) => row.learner)).toEqual(["t1"]);
    for (const copy of Object.values(value.students)) {
      const again = courseGrades(policy(), copyInputs(value.course, copy.record), DUE_BY, AT)[0]!;
      expect(
        courseGradeCard(
          policy(),
          copyInputs(value.course, copy.record),
          again,
          settings,
          copy.held !== null,
        ),
      ).toEqual(copy.card);
    }
  });
});
