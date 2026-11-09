import { describe, expect, test } from "bun:test";
import {
  type CourseGradeCard,
  type CourseGradeInputs,
  type CourseGradesPage,
  type ReleaseEntry,
  type ReleaseSettings,
  type StudentGrade,
  startingPolicy,
} from "@/lib/course-grades";
import {
  assignmentCaptions,
  bySkill,
  copiesShown,
  copyDiffers,
  copyShows,
  differentLetters,
  differingStudents,
  groupShare,
  headline,
  isFiltered,
  leftOut,
  matchesFilters,
  movedPolicyGrade,
  moveLine,
  NO_FILTERS,
  notCountedHint,
  rankGrades,
  reasonOf,
  shortNames,
  showCopy,
  showLetter,
  stackDots,
  stripRange,
  withDividers,
} from "./class-helpers";

const EMPTY: CourseGradeInputs = {
  assignments: [],
  releases: [],
  attempts: [],
  assessments: [],
  uses: [],
  unitHours: 24,
  students: [],
  lectureRuns: [],
  timezone: null,
  overrides: [],
};
const policy = startingPolicy(EMPTY);

function grade(
  student: string,
  average: number | null,
  extra: Partial<StudentGrade> = {},
): StudentGrade {
  return {
    student,
    work: {},
    groups: [],
    average,
    lineGrade: null,
    policyGrade: null,
    grade: null,
    cappedBy: null,
    override: null,
    lectures: { attended: 0, total: 0 },
    ...extra,
  };
}

const names: Record<string, string> = {
  ana: "Ana Ruiz",
  ben: "Ben Park",
  cy: "Cy Lee",
  dana: "Dana Novak",
};
const nameOf = (student: string) => names[student] ?? student;

describe("ranking and dividers", () => {
  test("ranks by average, highest first, with no average last and ties by name", () => {
    const ranked = rankGrades(
      [
        grade("cy", null),
        grade("ben", 2.5),
        grade("ana", 3.1),
        grade("dana", 2.5),
      ],
      nameOf,
    );
    expect(ranked.map((entry) => entry.student)).toEqual([
      "ana",
      "ben",
      "dana",
      "cy",
    ]);
  });

  test("puts a divider where a cutoff falls between two neighbours", () => {
    const lines = policy.lines.letters; // A 3.4, B 2.8, C 2.2, D 1.6
    const rows = withDividers(
      [
        grade("ana", 3.5),
        grade("ben", 3.4),
        grade("cy", 2.79),
        grade("dana", 1.0),
      ],
      lines,
    );
    expect(
      rows.map((row) =>
        row.kind === "divider" ? `-${row.line.grade}` : row.grade.student,
      ),
    ).toEqual(["ana", "ben", "-A", "-B", "cy", "-C", "-D", "dana"]);
  });

  test("an average exactly on a line stays above its divider", () => {
    const rows = withDividers(
      [grade("ana", 2.8), grade("ben", 2.8)],
      policy.lines.letters,
    );
    expect(rows.every((row) => row.kind === "student")).toBe(true);
  });

  test("no divider next to a student without an average", () => {
    const rows = withDividers(
      [grade("ana", 3.0), grade("cy", null)],
      policy.lines.letters,
    );
    expect(rows.map((row) => row.kind)).toEqual(["student", "student"]);
  });
});

describe("filters", () => {
  const roster = {
    ana: { name: "Ana Ruiz", email: "ana@mit.edu", section: "r1" },
    ben: { name: "Ben Park", email: "bpark@mit.edu", section: "r2" },
  };
  const ana = grade("ana", 2.83, { grade: "B", policyGrade: "B" });
  const ben = grade("ben", 2.0, {
    grade: "C",
    policyGrade: "D",
    override: {
      subject: "ben",
      value: "C",
      reason: "Illness in November",
      replaced: "D",
      author: "staff",
      setAt: "2026-11-02",
    },
  });
  const passes = (entry: StudentGrade, filters = NO_FILTERS) =>
    matchesFilters(
      entry,
      roster[entry.student as keyof typeof roster],
      policy,
      filters,
    );

  test("Everyone lets every student through and is not a filter", () => {
    expect(passes(ana) && passes(ben)).toBe(true);
    expect(isFiltered(NO_FILTERS)).toBe(false);
  });

  test("search matches a name or an email, ignoring case", () => {
    const search = (text: string) => ({ ...NO_FILTERS, search: text });
    expect(passes(ana, search("ruiz"))).toBe(true);
    expect(passes(ben, search("BPARK@"))).toBe(true);
    expect(passes(ben, search("ruiz"))).toBe(false);
    expect(isFiltered(search("x"))).toBe(true);
  });

  test("the section filter keeps that section's students", () => {
    const filters = { ...NO_FILTERS, section: "r2" };
    expect(passes(ana, filters)).toBe(false);
    expect(passes(ben, filters)).toBe(true);
  });

  test("a letter keeps students with that grade, overrides included", () => {
    const filters = { ...NO_FILTERS, filter: { letter: "C" } };
    expect(passes(ana, filters)).toBe(false);
    expect(passes(ben, filters)).toBe(true);
  });

  test("Near a cutoff, Below C, and Overrides and attendance", () => {
    const chip = (name: "near" | "belowC" | "adjusted") => ({
      ...NO_FILTERS,
      filter: { chip: name },
    });
    expect(passes(ana, chip("near"))).toBe(true);
    expect(passes(ben, chip("near"))).toBe(false);
    expect(passes(ana, chip("belowC"))).toBe(false);
    expect(passes(grade("cy", 1.5, { grade: "D" }), chip("belowC"))).toBe(true);
    expect(passes(ben, chip("adjusted"))).toBe(true);
    expect(passes(ana, chip("adjusted"))).toBe(false);
    const capped = grade("cy", 3.5, {
      grade: "B",
      cappedBy: { key: "a", below: 70, atMost: "B" },
    });
    expect(passes(capped, chip("adjusted"))).toBe(true);
    expect(reasonOf(capped)).toBe(
      "Fewer than 70% of lectures, grade at most B",
    );
    expect(reasonOf(ben)).toBe("Illness in November");
  });
});

describe("policy: C", () => {
  const override = {
    subject: "ana",
    value: "B",
    reason: "Regrade",
    replaced: "C",
    author: "staff",
    setAt: "2026-11-02",
  };

  test("shows nothing while the policy grade is the one the override replaced", () => {
    expect(
      movedPolicyGrade(grade("ana", 2.3, { policyGrade: "C", override })),
    ).toBeNull();
  });

  test("names the policy grade once it has moved", () => {
    expect(
      movedPolicyGrade(grade("ana", 2.1, { policyGrade: "D", override })),
    ).toBe("D");
  });

  test("shows nothing without an override or without a policy grade", () => {
    expect(
      movedPolicyGrade(grade("ana", 2.1, { policyGrade: "D" })),
    ).toBeNull();
    expect(
      movedPolicyGrade(grade("ana", null, { policyGrade: null, override })),
    ).toBeNull();
  });
});

describe("the headline", () => {
  test("names the median and the class size", () => {
    expect(
      headline({
        grades: [grade("ana", 3), grade("ben", 3)],
        median: "B",
        comparison: null,
      }),
    ).toBe("B, median of 2 students");
    expect(
      headline({ grades: [grade("ana", 3)], median: "B", comparison: null }),
    ).toBe("B, median of 1 student");
    expect(headline({ grades: [], median: null, comparison: null })).toBe(
      "No students yet",
    );
  });

  test("counts students whose policy letter differs while comparing", () => {
    const mine = [
      grade("ana", 3, { policyGrade: "B" }),
      grade("ben", 2, { policyGrade: "D" }),
      grade("cy", 2.5, { policyGrade: "C" }),
    ];
    const theirs = [
      grade("ana", 3, { policyGrade: "A" }),
      grade("ben", 2, { policyGrade: "C" }),
      grade("cy", 2.5, { policyGrade: "C" }),
    ];
    expect(differentLetters(mine, theirs)).toEqual(new Set(["ana", "ben"]));
    const name = "Latest per skill";
    const differ = (grades: StudentGrade[]) =>
      differingStudents(grades, policy, { grades: theirs, copies: null }).size;
    expect(
      headline({
        grades: mine,
        median: "C",
        comparison: { name, differ: differ(mine) },
      }),
    ).toBe("2 students get a different letter under Latest per skill");
    expect(
      headline({
        grades: mine.slice(2),
        median: "C",
        comparison: { name, differ: differ(mine.slice(2)) },
      }),
    ).toBe("No student gets a different letter under Latest per skill");
    expect(
      headline({
        grades: mine.slice(0, 1),
        median: "B",
        comparison: { name, differ: differ(mine.slice(0, 1)) },
      }),
    ).toBe("1 student gets a different letter under Latest per skill");
    expect(
      headline({
        grades: mine,
        median: "C",
        comparison: { name: "What students see", differ: 3, by: "average" },
      }),
    ).toBe("3 students get a different average under What students see");
  });

  test("the hint names only the counts that aren't zero", () => {
    expect(
      notCountedHint(
        {
          draftStudents: 2,
          ungraded: 3,
          excused: 2,
          notDue: 5,
          missing: 6,
          late: 0,
        },
        0,
      ),
    ).toBe(
      "Not counted: drafts from 2 students, 3 submissions not graded yet, 2 excused, 5 assignments not due yet. 6 missing assignments count as 0.",
    );
    expect(
      notCountedHint(
        {
          draftStudents: 0,
          ungraded: 0,
          excused: 1,
          notDue: 0,
          missing: 0,
          late: 0,
        },
        0,
      ),
    ).toBe("Not counted: 1 excused.");
    expect(
      notCountedHint(
        {
          draftStudents: 0,
          ungraded: 0,
          excused: 0,
          notDue: 0,
          missing: 1,
          late: 0,
        },
        1,
      ),
    ).toBe("1 missing assignment counts as 1.");
    expect(
      notCountedHint(
        {
          draftStudents: 1,
          ungraded: 0,
          excused: 0,
          notDue: 1,
          missing: 2,
          late: 3,
        },
        0,
      ),
    ).toBe(
      "Not counted: drafts from 1 student, 1 assignment not due yet. 2 missing and 3 late assignments count as 0.",
    );
    expect(
      notCountedHint(
        {
          draftStudents: 0,
          ungraded: 0,
          excused: 0,
          notDue: 0,
          missing: 0,
          late: 0,
        },
        0,
      ),
    ).toBeNull();
  });

  test("counts drafts by student and ungraded work apart", () => {
    const work = (assignment: string, status: string) =>
      ({ assignment, status, value: null }) as never;
    expect(
      leftOut([
        grade("ana", 3, {
          work: { a: work("a", "draft"), b: work("b", "ungraded") },
        }),
        grade("ben", 3, {
          work: { a: work("a", "ungraded"), b: work("b", "notDue") },
        }),
        grade("cy", 3, {
          work: { a: work("a", "draft"), b: work("b", "notDue") },
        }),
      ]),
    ).toEqual({
      draftStudents: 2,
      ungraded: 2,
      excused: 0,
      notDue: 1,
      missing: 0,
      late: 0,
    });
  });
});

describe("what students see", () => {
  const settings = (letter: boolean, includeOverrides = true) =>
    ({
      dueBy: "2026-10-16T23:59:59.000Z",
      breakdown: true,
      letter,
      includeOverrides: letter && includeOverrides,
    }) satisfies ReleaseSettings;
  const card = (
    status: "released" | "held",
    average: number | null,
    letter: string | null = null,
  ) =>
    ({
      status,
      dueBy: "2026-10-16T23:59:59.000Z",
      average: status === "held" ? null : average,
      scale: { low: 1, high: 4 },
      letter: status === "held" ? null : letter,
      groups: null,
      lectures: null,
      rules: { ratings: policy.ratings, missing: 0, late: policy.late },
    }) as CourseGradeCard;
  const entry = (
    cards: Record<string, CourseGradeCard>,
    letter = false,
  ): ReleaseEntry =>
    ({
      open: true,
      openedAt: "2026-10-17T12:00:00.000Z",
      release: { kind: "release", settings: settings(letter), cards, held: {} },
    }) as unknown as ReleaseEntry;
  const update = (student: string, at: string, value: CourseGradeCard) => ({
    student,
    openedAt: at,
    update: { kind: "update", settings: settings(false), card: value },
  });
  const page = (updates: unknown[] = []) =>
    ({ updates }) as unknown as Pick<CourseGradesPage, "updates">;

  test("a card shows held, its letter, or its average", () => {
    expect(copyShows(card("held", null), settings(true))).toEqual({
      kind: "held",
    });
    expect(copyShows(card("released", 2.84, "B"), settings(true))).toEqual({
      kind: "letter",
      letter: "B",
      includeOverrides: true,
    });
    expect(copyShows(card("released", 2.63), settings(false))).toEqual({
      kind: "average",
      average: 2.63,
    });
  });

  test("each student's copy is their update when at least as new as the release", () => {
    const release = entry({
      amina: card("released", 2.63),
      jonas: card("held", null),
      rin: card("released", 2.41),
    });
    const copies = copiesShown(
      page([
        update("rin", "2026-10-10T12:00:00.000Z", card("released", 9)),
        update("jonas", "2026-10-17T12:00:00.000Z", card("released", 2.39)),
        update("amina", "2026-10-20T12:00:00.000Z", card("released", 2.68)),
        update("amina", "2026-10-18T12:00:00.000Z", card("released", 2.5)),
      ]),
      release,
    );
    expect(copies.get("amina")).toEqual({ kind: "average", average: 2.68 });
    expect(copies.get("jonas")).toEqual({ kind: "average", average: 2.39 });
    expect(copies.get("rin")).toEqual({ kind: "average", average: 2.41 });
    expect(copies.has("noor")).toBe(false);
    expect(
      copiesShown(page(), {
        ...release,
        release: null,
      } as unknown as ReleaseEntry).size,
    ).toBe(0);
  });

  test("a copy differs by letter, by average, or once a held student is no longer held", () => {
    const today = grade("rin", 2.84, {
      lineGrade: "C",
      policyGrade: "C",
      grade: "B",
    });
    const letter = (includeOverrides: boolean) =>
      copyShows(card("released", 2.84, "C"), settings(true, includeOverrides));
    expect(copyDiffers(letter(false), today, policy)).toBe(false);
    expect(copyDiffers(letter(true), today, policy)).toBe(true);
    const average = copyShows(card("released", 2.63), settings(false));
    expect(copyDiffers(average, today, policy)).toBe(true);
    expect(copyDiffers(average, { ...today, average: 2.63 }, policy)).toBe(
      false,
    );
    const held = copyShows(card("held", null), settings(false));
    const below = grade("jonas", 1.5, { policyGrade: "F", grade: "F" });
    expect(copyDiffers(held, below, policy)).toBe(false);
    expect(copyDiffers(held, today, policy)).toBe(true);
  });

  test("the Compared column and the headline read the copies", () => {
    const copies = copiesShown(
      page(),
      entry({
        ana: card("released", 2.63),
        ben: card("held", null),
        cy: card("released", 3),
      }),
    );
    expect(showCopy(copies.get("ana")!, policy, "letters")).toBe("2.63");
    expect(showCopy(copies.get("ben")!, policy, "letters")).toBe("Held");
    expect(
      showCopy(
        { kind: "letter", letter: "B", includeOverrides: true },
        policy,
        "gpa",
      ),
    ).toBe("4.0");
    const grades = [
      grade("ana", 2.84, { policyGrade: "B", grade: "B" }),
      grade("ben", 1.5, { policyGrade: "F", grade: "F" }),
      grade("cy", 3, { policyGrade: "B", grade: "B" }),
      grade("dana", 3.5, { policyGrade: "A", grade: "A" }),
    ];
    expect(differingStudents(grades, policy, { grades: [], copies })).toEqual(
      new Set(["ana"]),
    );
  });
});

describe("Show as and the strip", () => {
  test("letters follow Show as", () => {
    expect(showLetter("B", policy, "letters")).toBe("B");
    expect(showLetter("B", policy, "gpa")).toBe("4.0");
    expect(
      showLetter("B+", { ...policy, gradeSet: "plusMinus" }, "letters"),
    ).toBe("B");
  });

  test("the strip starts below the lowest average and keeps every cutoff in range", () => {
    expect(stripRange([grade("ana", 2.43), grade("ben", 3.9)], policy)).toEqual(
      {
        low: 1.5,
        high: 4,
      },
    );
    const high = {
      ...policy,
      lines: { ...policy.lines, letters: [{ grade: "A", at: 3.4 }] },
    };
    expect(stripRange([grade("ana", 2.43)], high).low).toBe(2.3);
  });

  test("a dragged cutoff stays between its neighbours", () => {
    const range = { low: 1, high: 4 };
    const moved = (at: number) =>
      moveLine(policy, "B", at, range).lines.letters.find(
        (line) => line.grade === "B",
      )?.at;
    expect(moved(2.9)).toBe(2.9);
    expect(moved(3.6)).toBe(3.35);
    expect(moved(1.0)).toBe(2.25);
    expect(moveLine(policy, "B", 2.9, range).lines.plusMinus).toBe(
      policy.lines.plusMinus,
    );
  });

  test("dots stack in columns from the lowest average", () => {
    const dots = stackDots(
      [
        grade("ana", 3),
        grade("ben", 3.01),
        grade("cy", null),
        grade("dana", 2),
      ],
      (value) => value * 100,
      9,
    );
    expect(dots.map((dot) => [dot.student, dot.layer])).toEqual([
      ["dana", 0],
      ["ana", 0],
      ["ben", 1],
    ]);
  });
});

describe("an opened student", () => {
  test("a group's weight is its share of all group weights", () => {
    expect(groupShare(policy, 70)).toBe(70);
    expect(
      groupShare({ ...policy, groups: policy.groups.slice(0, 1) }, 70),
    ).toBe(100);
  });

  test("short names use initials when they tell names apart", () => {
    expect(shortNames(["Problem framing", "Concept design"])).toEqual(
      new Map([
        ["Problem framing", "PF"],
        ["Concept design", "CD"],
      ]),
    );
    expect(
      shortNames(["Project pitching", "Peer pitching"]).get("Peer pitching"),
    ).toBe("Peer");
  });

  test("assignment captions shorten titles and keep numbers", () => {
    const captions = assignmentCaptions([
      { assignment: "e1", title: "Exercise 1: Problem Framing" },
      { assignment: "p1", title: "P1: Design" },
      { assignment: "pp", title: "Personal Project" },
      { assignment: "pitch", title: "Project Pitch: Teams" },
      { assignment: "fp", title: "Final Project" },
    ]);
    expect([...captions.values()]).toEqual([
      "E1",
      "P1",
      "Personal Project",
      "Project Pitch",
      "FP",
    ]);
  });

  test("By skill lists skills in the order the term first rates them", () => {
    const criterion = (standard: string, name: string) => ({
      criterion: standard,
      kind: "COMPETENCY",
      standard,
      name,
      maxPoints: 0,
    });
    const assessment = (
      item: string,
      criteria: ReturnType<typeof criterion>[],
    ) => ({
      learner: "ana",
      item,
      evidence: "",
      status: "RELEASED",
      method: "COMPETENCY",
      createdAt: "2026-09-01",
      updatedAt: null,
      criteria,
      judgments: [],
    });
    const assignment = (id: string, dueAt: string) => ({
      assignment: id,
      title: id,
      kind: "EXERCISE",
      dueAt,
      acceptsSubmissions: true,
    });
    const grid = bySkill({
      ...EMPTY,
      assignments: [
        assignment("p2", "2026-10-08"),
        assignment("e1", "2026-09-15"),
        assignment("admin", "2026-09-10"),
      ],
      assessments: [
        assessment("p2", [
          criterion("ic", "Implementing concepts"),
          criterion("vd", "Visual design"),
        ]),
        assessment("e1", [
          criterion("pf", "Problem framing"),
          criterion("tw", "Technical writing"),
          criterion("cd", "Concept design"),
        ]),
      ],
    });
    expect(grid.assignments.map((entry) => entry.assignment)).toEqual([
      "e1",
      "p2",
    ]);
    expect(grid.skills.map((skill) => skill.name)).toEqual([
      "Concept design",
      "Problem framing",
      "Technical writing",
      "Implementing concepts",
      "Visual design",
    ]);
  });
});
