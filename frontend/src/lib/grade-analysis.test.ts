import { describe, expect, test } from "bun:test";
import type {
  CompetencyRow,
  CriterionRow,
  GradeAnalysis,
  GradeAnalysisSource,
  Level,
  NOT_ASSESSED,
  PointsRow,
  TotalRow,
} from "./grade-analysis.ts";
import {
  analyzeGrades,
  graderLetter,
  learnerState,
  mean,
  median,
  scoreText,
} from "./grade-analysis.ts";
import type {
  AssignedLearner,
  AvailableGrader,
  DelegationRow,
  ItemAssessment,
  LearnerAttempt,
} from "./submissions-export.ts";

type CompetencyCriterion = Extract<
  ItemAssessment["criteria"][number],
  { kind: "COMPETENCY" }
>;
type PointCriterion = Extract<
  ItemAssessment["criteria"][number],
  { kind: "POINTS" }
>;
type Rating = Level | typeof NOT_ASSESSED;
/** An assessment for one learner's attempt, built once the attempt is known. */
type GradeFor = (learner: string, evidence: string) => ItemAssessment;

interface AssessmentOptions {
  status?: ItemAssessment["status"];
  feedback?: string;
  /** Day of September 2026 the assessment was opened. */
  day?: number;
  grader?: string;
  setupRevision?: number;
}

const on = (day: number) =>
  `2026-09-${String(day).padStart(2, "0")}T12:00:00.000Z`;

function learner(name: string): AssignedLearner {
  return {
    assignee: name.toLowerCase(),
    displayName: name,
    username: null,
    email: null,
    section: null,
    enrolment: "ACTIVE",
    release: `release-${name.toLowerCase()}`,
    dueOverride: null,
    status: "ASSIGNED",
  };
}

function attempt(
  submitter: string,
  number = 1,
  status: LearnerAttempt["status"] = "SUBMITTED",
): LearnerAttempt {
  return {
    submitter,
    submitterName: null,
    submission: `${submitter}-a${number}`,
    artifacts: [],
    submittedAt: on(10 + number),
    number,
    status,
  };
}

function competency(
  criterion: string,
  overrides: Partial<CompetencyCriterion> = {},
): CompetencyCriterion {
  return {
    kind: "COMPETENCY",
    criterion,
    position: 0,
    basis: criterion,
    standard: `standard-${criterion}`,
    number: 1,
    name: criterion,
    description: "",
    deficient: `${criterion} deficient`,
    emergent: `${criterion} emergent`,
    competent: `${criterion} competent`,
    expert: `${criterion} expert`,
    referenceUrl: "",
    ...overrides,
  };
}

function points(
  criterion: string,
  maxPoints: number,
  position = 0,
): PointCriterion {
  return { kind: "POINTS", criterion, name: criterion, maxPoints, position };
}

function record(
  learnerId: string,
  evidence: string,
  fields: Pick<
    ItemAssessment,
    "method" | "criteria" | "judgments" | "score" | "outOf" | "scored"
  >,
  options: AssessmentOptions,
): ItemAssessment {
  const status = options.status ?? "DRAFT";
  return {
    grade: `grade-${learnerId}-${evidence || "excusal"}`,
    learner: learnerId,
    item: "assignment-1",
    evidence,
    attempt: null,
    displayName: null,
    submittedAt: null,
    grader: options.grader ?? "grader-last-actor",
    setupRevision: options.setupRevision ?? 1,
    feedback: options.feedback ?? "Overall feedback.",
    status,
    version: 1,
    createdAt: on(options.day ?? 12),
    updatedAt: on(options.day ?? 12),
    releasedAt: status === "DRAFT" ? null : on(options.day ?? 12),
    history: [],
    ...fields,
  };
}

/** Ratings by criterion id; a pair carries the criterion's feedback. */
function competencyGrade(
  criteria: CompetencyCriterion[],
  ratings: Record<string, Rating | [Rating, string]>,
  options: AssessmentOptions = {},
): GradeFor {
  return (learnerId, evidence) =>
    record(
      learnerId,
      evidence,
      {
        method: "COMPETENCY",
        criteria,
        judgments: Object.entries(ratings).map(([criterion, rating]) => {
          const [value, feedback] = Array.isArray(rating)
            ? rating
            : [rating, "Criterion feedback."];
          return { kind: "COMPETENCY", criterion, rating: value, feedback };
        }),
        score: 0,
        outOf: 0,
        scored: false,
      },
      options,
    );
}

/** Scores by criterion id; the total exists once every criterion is scored. */
function pointsGrade(
  criteria: PointCriterion[],
  scores: Record<string, number>,
  options: AssessmentOptions = {},
): GradeFor {
  return (learnerId, evidence) =>
    record(
      learnerId,
      evidence,
      {
        method: "POINTS",
        criteria,
        judgments: Object.entries(scores).map(([criterion, score]) => ({
          kind: "POINTS",
          criterion,
          score,
        })),
        score: Object.values(scores).reduce((sum, score) => sum + score, 0),
        outOf: criteria.reduce((sum, { maxPoints }) => sum + maxPoints, 0),
        scored: criteria.every(({ criterion }) => criterion in scores),
      },
      { status: "RELEASED", ...options },
    );
}

/** The server masks an excused row: no judgments, score 0, an excusal note. */
function excusal(
  criteria: ItemAssessment["criteria"] = [],
  feedback = "",
): GradeFor {
  return (learnerId, evidence) =>
    record(
      learnerId,
      evidence,
      {
        method: "COMPETENCY",
        criteria,
        judgments: [],
        score: 0,
        outOf: 0,
        scored: false,
      },
      { status: "EXCUSED", feedback },
    );
}

function delegation(
  learnerId: string,
  grader: string,
  graderName: string | null = null,
  graderUsername: string | null = null,
): DelegationRow {
  return { learner: learnerId, grader, graderName, graderUsername };
}

function available(
  grader: string,
  displayName: string | null,
): AvailableGrader {
  return { grader, displayName, username: `${grader}-username` };
}

type Part = Partial<
  Pick<
    GradeAnalysisSource,
    "assigned" | "submissions" | "grades" | "delegations"
  >
>;

/** One assigned learner with one submitted attempt, its assessment, and its grader. */
function submitted(
  name: string,
  grade?: GradeFor,
  grader?: string,
): Required<Part> {
  const work = attempt(name.toLowerCase());
  return {
    assigned: [learner(name)],
    submissions: [work],
    grades: grade ? [grade(work.submitter, work.submission)] : [],
    delegations: grader ? [delegation(work.submitter, grader)] : [],
  };
}

function analyze(
  parts: Part[],
  extra: Partial<GradeAnalysisSource> = {},
): GradeAnalysis {
  return analyzeGrades({
    assigned: parts.flatMap((part) => part.assigned ?? []),
    submissions: parts.flatMap((part) => part.submissions ?? []),
    grades: parts.flatMap((part) => part.grades ?? []),
    delegations: parts.flatMap((part) => part.delegations ?? []),
    graders: [],
    ...extra,
  });
}

function competencyRows(analysis: GradeAnalysis): CompetencyRow[] {
  return analysis.rows.filter(
    (row): row is CompetencyRow => row.kind === "COMPETENCY",
  );
}

function pointsRows(analysis: GradeAnalysis): PointsRow[] {
  return analysis.rows.filter((row): row is PointsRow => row.kind === "POINTS");
}

function totalRows(analysis: GradeAnalysis): TotalRow[] {
  return analysis.rows.filter((row): row is TotalRow => row.kind === "TOTAL");
}

function stateOf(analysis: GradeAnalysis, learnerId: string) {
  return analysis.learners.find((entry) => entry.learner === learnerId)?.state;
}

const explains = competency("explains");
const cites = competency("cites", { position: 1 });

describe("one result per learner (rule 1)", () => {
  test("the latest submitted attempt wins over earlier and withdrawn ones", () => {
    const first = attempt("amy", 1);
    const second = attempt("amy", 2);
    const withdrawn = attempt("amy", 3, "WITHDRAWN");
    const analysis = analyze([
      {
        assigned: [learner("Amy")],
        submissions: [withdrawn, second, first],
        grades: [
          competencyGrade(
            [explains, cites],
            { explains: "EXPERT", cites: "EXPERT" },
            { status: "RELEASED" },
          )("amy", first.submission),
          competencyGrade([explains, cites], { explains: "EMERGENT" })(
            "amy",
            second.submission,
          ),
          competencyGrade(
            [explains, cites],
            { explains: "EXPERT", cites: "EXPERT" },
            { status: "RELEASED" },
          )("amy", withdrawn.submission),
        ],
      },
    ]);
    expect(analysis.learners).toHaveLength(1);
    expect(analysis.learners[0]).toMatchObject({
      state: "incomplete",
      attempt: { submission: "amy-a2" },
      assessment: { evidence: "amy-a2" },
      released: false,
    });
    expect(analysis.readiness).toMatchObject({
      counted: 1,
      complete: [],
      released: [],
      incomplete: ["amy"],
    });
  });

  test("a learner with only withdrawn work, or none, is not counted", () => {
    const analysis = analyze([
      {
        assigned: [learner("Bob"), learner("Cid")],
        submissions: [attempt("bob", 1, "WITHDRAWN")],
      },
    ]);
    expect(analysis.learners).toEqual([]);
    expect(analysis.readiness.counted).toBe(0);
    expect(analysis.readinessByGrader).toEqual([]);
  });

  test("an assignment excusal is the fallback, even beside an unassessed attempt", () => {
    const eve = attempt("eve");
    const analysis = analyze([
      { assigned: [learner("Dee")], grades: [excusal()("dee", "")] },
      {
        assigned: [learner("Eve")],
        submissions: [eve],
        grades: [excusal()("eve", "")],
      },
    ]);
    expect(analysis.learners.map((entry) => entry.state)).toEqual([
      "excused",
      "excused",
    ]);
    expect(analysis.readiness).toMatchObject({
      counted: 2,
      excused: ["dee", "eve"],
      notStarted: [],
    });
  });

  test("an excusal of an earlier attempt is not an assignment excusal", () => {
    const first = attempt("amy", 1);
    const analysis = analyze([
      {
        assigned: [learner("Amy")],
        submissions: [first, attempt("amy", 2)],
        grades: [excusal()("amy", first.submission)],
      },
    ]);
    expect(stateOf(analysis, "amy")).toBe("not-started");
  });
});

describe("grader is the delegated owner (rule 2)", () => {
  test("an assessment last touched by someone else stays with the delegation", () => {
    const analysis = analyze([
      submitted(
        "Amy",
        competencyGrade(
          [explains],
          { explains: "COMPETENT" },
          { status: "RELEASED", grader: "grader-b" },
        ),
        "grader-a",
      ),
    ]);
    expect(analysis.learners[0]?.grader).toBe("grader-a");
    expect(analysis.graders.map((grader) => grader.grader)).toEqual([
      "grader-a",
    ]);
    expect(competencyRows(analysis)[0]?.papers[0]?.grader).toBe("grader-a");
    expect(analysis.readinessByGrader.map((entry) => entry.grader)).toEqual([
      "grader-a",
    ]);
  });

  test("a learner without a delegation is without a grader and in the null split", () => {
    const analysis = analyze([
      submitted(
        "Amy",
        competencyGrade([explains], { explains: "EXPERT" }),
        "grader-a",
      ),
      submitted("Bob", competencyGrade([explains], { explains: "EXPERT" })),
    ]);
    expect(analysis.learners[1]?.grader).toBeNull();
    expect(analysis.readiness.withoutGrader).toEqual(["bob"]);
    expect(analysis.readinessByGrader.at(-1)).toMatchObject({
      grader: null,
      readiness: { counted: 1, complete: ["bob"], withoutGrader: ["bob"] },
    });
  });
});

describe("rows come from each assessment's snapshot (rule 3)", () => {
  test("one points criterion snapshotted with two maxima makes two rows", () => {
    const analysis = analyze([
      submitted("Amy", pointsGrade([points("q1", 10)], { q1: 7 })),
      submitted("Bob", pointsGrade([points("q1", 20)], { q1: 15 })),
    ]);
    expect(pointsRows(analysis).map((row) => [row.key, row.maxPoints])).toEqual(
      [
        ["points:q1:10", 10],
        ["points:q1:20", 20],
      ],
    );
    expect(
      pointsRows(analysis).map((row) => row.papers.map((paper) => paper.score)),
    ).toEqual([[7], [15]]);
    expect(totalRows(analysis).map((row) => row.outOf)).toEqual([10, 20]);
  });

  test("two editions of one standard make two rows numbered by first assessment, not roster order; a lone edition has none", () => {
    const first = competency("explains-v1", {
      basis: "explains-e1",
      standard: "explains",
    });
    const second = competency("explains-v2", {
      basis: "explains-e2",
      standard: "explains",
    });
    const analysis = analyze([
      submitted(
        "Amy",
        competencyGrade(
          [second, cites],
          { "explains-v2": "EXPERT", cites: "COMPETENT" },
          { day: 5 },
        ),
      ),
      submitted(
        "Bob",
        competencyGrade(
          [first, cites],
          { "explains-v1": "EMERGENT", cites: "EXPERT" },
          { day: 3 },
        ),
      ),
    ]);
    expect(
      competencyRows(analysis).map((row) => [row.basis, row.edition]),
    ).toEqual([
      ["explains-e1", 1],
      ["explains-e2", 2],
      ["cites", null],
    ]);
    expect(
      competencyRows(analysis).map((row) =>
        row.papers.map((paper) => paper.learner),
      ),
    ).toEqual([["bob"], ["amy"], ["amy", "bob"]]);
  });

  test("a changed setup revision alone never splits a row", () => {
    const analysis = analyze([
      submitted(
        "Amy",
        competencyGrade(
          [explains],
          { explains: "EXPERT" },
          { setupRevision: 1 },
        ),
      ),
      submitted(
        "Bob",
        competencyGrade(
          [explains],
          { explains: "EMERGENT" },
          { setupRevision: 4 },
        ),
      ),
      submitted(
        "Cid",
        pointsGrade([points("q1", 10)], { q1: 3 }, { setupRevision: 2 }),
      ),
      submitted(
        "Dee",
        pointsGrade([points("q1", 10)], { q1: 5 }, { setupRevision: 7 }),
      ),
    ]);
    expect(analysis.rows.map((row) => row.key)).toEqual([
      "competency:explains",
      "points:q1:10",
      "total:10",
    ]);
    expect(competencyRows(analysis)[0]?.papers).toHaveLength(2);
    expect(pointsRows(analysis)[0]?.papers).toHaveLength(2);
  });

  test("rows sort by rubric position, with totals last", () => {
    const analysis = analyze([
      submitted(
        "Amy",
        pointsGrade([points("b", 5, 1), points("c", 5, 2), points("a", 5, 0)], {
          a: 1,
          b: 2,
          c: 3,
        }),
      ),
    ]);
    expect(analysis.rows.map((row) => row.key)).toEqual([
      "points:a:5",
      "points:b:5",
      "points:c:5",
      "total:15",
    ]);
  });
});

describe("mixed methods (rule 4)", () => {
  test("one assignment holds competency and points rows, with a total only for points", () => {
    const analysis = analyze([
      submitted(
        "Amy",
        competencyGrade([explains], { explains: "COMPETENT" }, { day: 2 }),
      ),
      submitted("Bob", pointsGrade([points("q1", 10)], { q1: 6 }, { day: 4 })),
    ]);
    expect(analysis.rows.map((row) => row.kind)).toEqual([
      "COMPETENCY",
      "POINTS",
      "TOTAL",
    ]);
    expect(
      competencyRows(analysis)[0]?.papers.map((paper) => paper.learner),
    ).toEqual(["amy"]);
    expect(totalRows(analysis)).toHaveLength(1);
    expect(totalRows(analysis)[0]).toMatchObject({
      outOf: 10,
      papers: [{ learner: "bob", score: 6 }],
      withoutTotal: [],
    });
  });
});

describe("excused rows (rule 5)", () => {
  test("excused learners are counted as excused, never in rows or without feedback", () => {
    const cid = attempt("cid");
    const analysis = analyze([
      submitted(
        "Amy",
        competencyGrade(
          [explains],
          { explains: "COMPETENT" },
          { status: "RELEASED" },
        ),
      ),
      { assigned: [learner("Bob")], grades: [excusal([explains])("bob", "")] },
      {
        assigned: [learner("Cid")],
        submissions: [cid],
        grades: [excusal([explains, points("q1", 10)])("cid", cid.submission)],
      },
    ]);
    expect(analysis.readiness).toMatchObject({
      counted: 3,
      excused: ["bob", "cid"],
      complete: ["amy"],
      released: ["amy"],
      withoutFeedback: [],
    });
    expect(analysis.readiness.gradable).toBe(1);
    expect(analysis.rows.map((row) => row.key)).toEqual([
      "competency:explains",
    ]);
    expect(competencyRows(analysis)[0]?.tally.rated).toBe(1);
  });
});

describe("zero is a score, blank is not (rule 6)", () => {
  test("a scored zero is a paper and counts in the median", () => {
    const analysis = analyze([
      submitted("Amy", pointsGrade([points("q1", 10)], { q1: 0 })),
      submitted("Bob", pointsGrade([points("q1", 10)], { q1: 8 })),
      submitted("Cid", pointsGrade([points("q1", 10)], { q1: 4 })),
    ]);
    const row = pointsRows(analysis)[0];
    expect(row?.papers.find((paper) => paper.learner === "amy")?.score).toBe(0);
    expect(row?.scores.median).toBe(4);
    const total = totalRows(analysis)[0];
    expect(total?.papers.map((paper) => paper.score)).toEqual([0, 8, 4]);
    expect(total?.scores.median).toBe(4);
    expect(total?.withoutTotal).toEqual([]);
  });

  test("an unscored points assessment is without a total, not a zero", () => {
    const criteria = [points("q1", 10), points("q2", 10, 1)];
    const analysis = analyze([
      submitted("Amy", pointsGrade(criteria, { q1: 9, q2: 9 })),
      submitted("Dee", pointsGrade(criteria, { q1: 2 }, { status: "DRAFT" })),
    ]);
    expect(stateOf(analysis, "dee")).toBe("incomplete");
    const total = totalRows(analysis)[0];
    expect(total?.withoutTotal).toEqual(["dee"]);
    expect(total?.papers.map((paper) => paper.learner)).toEqual(["amy"]);
    expect(total?.scores.median).toBe(18);
    expect(
      pointsRows(analysis)[0]?.papers.map((paper) => [
        paper.learner,
        paper.score,
      ]),
    ).toEqual([
      ["amy", 9],
      ["dee", 2],
    ]);
  });

  test("competency score and outOf are never read", () => {
    const grade = competencyGrade([explains], { explains: "EMERGENT" });
    const junk: GradeFor = (learnerId, evidence) => ({
      ...grade(learnerId, evidence),
      score: 99,
      outOf: 7,
      scored: true,
    });
    const plain = analyze([submitted("Amy", grade)]);
    const withJunk = analyze([submitted("Amy", junk)]);
    expect(withJunk.rows).toEqual(plain.rows);
    expect(withJunk.readiness).toEqual(plain.readiness);
    expect(totalRows(withJunk)).toEqual([]);
  });
});

describe("complete means every criterion rated (rule 7)", () => {
  test("empty draft, some ratings, every rating, and a released record", () => {
    const both = [explains, cites];
    const analysis = analyze([
      submitted("Amy", competencyGrade(both, {})),
      submitted("Bob", competencyGrade(both, { explains: "EXPERT" })),
      submitted(
        "Cid",
        competencyGrade(both, {
          explains: "NOT_ASSESSED",
          cites: "NOT_ASSESSED",
        }),
      ),
      submitted(
        "Dee",
        competencyGrade(
          both,
          { explains: "EXPERT", cites: "EMERGENT" },
          { status: "RELEASED" },
        ),
      ),
    ]);
    expect(analysis.learners.map((entry) => entry.state)).toEqual([
      "not-started",
      "incomplete",
      "complete",
      "complete",
    ]);
    expect(analysis.readiness).toMatchObject({
      notStarted: ["amy"],
      incomplete: ["bob"],
      complete: ["cid", "dee"],
      released: ["dee"],
    });
  });
});

describe("dropped learners (rule 8)", () => {
  const parts = [
    submitted("Amy", competencyGrade([explains], { explains: "EXPERT" })),
    submitted("Bob", competencyGrade([explains], { explains: "DEFICIENT" })),
  ];

  const standing = (bob: AssignedLearner["enrolment"]) =>
    parts.map((part) => ({
      ...part,
      assigned: part.assigned?.map((entry) =>
        entry.assignee === "bob" ? { ...entry, enrolment: bob } : entry,
      ),
    }));

  test("a dropped learner is not counted", () => {
    const analysis = analyze(standing("DROPPED"));
    expect(analysis.readiness.counted).toBe(1);
    expect(analysis.learners.map((entry) => entry.learner)).toEqual(["amy"]);
    expect(
      competencyRows(analysis)[0]?.papers.map((paper) => paper.learner),
    ).toEqual(["amy"]);
  });

  test("a learner without a seat counts, as in the Submissions list", () => {
    expect(analyze(standing("PENDING")).readiness.counted).toBe(2);
    expect(analyze(standing(null)).readiness.counted).toBe(2);
  });

  test("every active learner counts", () => {
    expect(analyze(standing("ACTIVE")).readiness.counted).toBe(2);
  });

  test("dropped learners are listed apart, and pending ones are not", () => {
    expect(analyze(standing("DROPPED")).dropped).toEqual(["bob"]);
    expect(analyze(standing("PENDING")).dropped).toEqual([]);
  });
});

describe("a former grader's name (rule 9)", () => {
  test("an absent grader takes graderName, then graderUsername, then the id", () => {
    const analysis = analyze(
      [
        {
          delegations: [
            delegation("amy", "grader-a", "Former TA", "former"),
            delegation("bob", "grader-b", null, "gone"),
            delegation("cid", "grader-c"),
            delegation("dee", "grader-d", "Stale Name", "stale"),
          ],
        },
      ],
      { graders: [available("grader-d", "Current Name")] },
    );
    expect(analysis.graders).toEqual([
      { grader: "grader-a", letter: "A", name: "Former TA" },
      { grader: "grader-b", letter: "B", name: "gone" },
      { grader: "grader-c", letter: "C", name: "grader-c" },
      { grader: "grader-d", letter: "D", name: "Current Name" },
    ]);
  });
});

describe("new attempts", () => {
  const assessed = competencyGrade(
    [explains],
    { explains: "COMPETENT" },
    { status: "RELEASED" },
  );

  function resubmitted(
    earlier: GradeFor,
    latest?: GradeFor,
    latestStatus: LearnerAttempt["status"] = "SUBMITTED",
  ): Part {
    const first = attempt("amy", 1);
    const second = attempt("amy", 2, latestStatus);
    return {
      assigned: [learner("Amy")],
      submissions: [first, second],
      grades: [
        earlier("amy", first.submission),
        ...(latest ? [latest("amy", second.submission)] : []),
      ],
    };
  }

  test("an assessed earlier attempt and an unassessed latest one is a new attempt", () => {
    const analysis = analyze([resubmitted(assessed)]);
    expect(stateOf(analysis, "amy")).toBe("new-attempt");
    expect(analysis.readiness.newAttempts).toEqual(["amy"]);
    expect(analysis.rows).toEqual([]);
  });

  test("an empty draft opened on the latest attempt is still a new attempt", () => {
    const analysis = analyze([
      resubmitted(assessed, competencyGrade([explains], {})),
    ]);
    expect(stateOf(analysis, "amy")).toBe("new-attempt");
  });

  test("an earlier attempt holding only an empty draft is not started", () => {
    const analysis = analyze([resubmitted(competencyGrade([explains], {}))]);
    expect(stateOf(analysis, "amy")).toBe("not-started");
    expect(analysis.readiness.notStarted).toEqual(["amy"]);
  });

  test("an assessed later withdrawn attempt does not make the submitted one a new attempt", () => {
    const first = attempt("amy", 1);
    const withdrawn = attempt("amy", 2, "WITHDRAWN");
    const analysis = analyze([
      {
        assigned: [learner("Amy")],
        submissions: [first, withdrawn],
        grades: [assessed("amy", withdrawn.submission)],
      },
    ]);
    expect(stateOf(analysis, "amy")).toBe("not-started");
  });
});

describe("without feedback", () => {
  test("counts complete work whose overall and criterion feedback are all blank", () => {
    const both = [explains, cites];
    const analysis = analyze([
      submitted(
        "Amy",
        competencyGrade(
          both,
          { explains: ["EXPERT", "  "], cites: ["EMERGENT", "\n\t"] },
          { feedback: " " },
        ),
      ),
      submitted(
        "Bob",
        competencyGrade(
          both,
          { explains: ["EXPERT", ""], cites: ["EMERGENT", "Clear diagram."] },
          { feedback: "" },
        ),
      ),
      submitted(
        "Cid",
        competencyGrade(both, { explains: ["EXPERT", ""] }, { feedback: "" }),
      ),
      submitted(
        "Dee",
        pointsGrade([points("q1", 10)], { q1: 4 }, { feedback: "   " }),
      ),
      submitted(
        "Eve",
        pointsGrade([points("q1", 10)], { q1: 4 }, { feedback: "Good." }),
      ),
    ]);
    expect(stateOf(analysis, "cid")).toBe("incomplete");
    expect(analysis.readiness.withoutFeedback).toEqual(["amy", "dee"]);
  });
});

describe("competency tally", () => {
  test("counts levels, keeps not assessed out of the denominator, and splits by grader, leaving out a grader with nothing submitted", () => {
    const rate = (rating: Rating) =>
      competencyGrade([explains], { explains: rating });
    const analysis = analyze([
      submitted("Amy", rate("EXPERT"), "grader-b"),
      submitted("Bob", rate("COMPETENT"), "grader-a"),
      submitted("Cid", rate("EMERGENT"), "grader-a"),
      submitted("Dee", rate("DEFICIENT")),
      submitted("Eve", rate("NOT_ASSESSED"), "grader-b"),
      {
        assigned: [learner("Fay")],
        delegations: [delegation("fay", "grader-c")],
      },
    ]);
    const row = competencyRows(analysis)[0];
    expect(row?.tally).toEqual({
      levels: { DEFICIENT: 1, EMERGENT: 1, COMPETENT: 1, EXPERT: 1 },
      competentOrAbove: 2,
      rated: 4,
      notAssessed: 1,
    });
    expect(row?.byGrader).toEqual([
      {
        grader: "grader-a",
        tally: {
          levels: { DEFICIENT: 0, EMERGENT: 1, COMPETENT: 1, EXPERT: 0 },
          competentOrAbove: 1,
          rated: 2,
          notAssessed: 0,
        },
      },
      {
        grader: "grader-b",
        tally: {
          levels: { DEFICIENT: 0, EMERGENT: 0, COMPETENT: 0, EXPERT: 1 },
          competentOrAbove: 1,
          rated: 1,
          notAssessed: 1,
        },
      },
      {
        grader: null,
        tally: {
          levels: { DEFICIENT: 1, EMERGENT: 0, COMPETENT: 0, EXPERT: 0 },
          competentOrAbove: 0,
          rated: 1,
          notAssessed: 0,
        },
      },
    ]);
    expect(row?.descriptions.COMPETENT).toBe("explains competent");
  });

  test("points rows split by grader with their own count, median, and mean", () => {
    const score = (value: number) =>
      pointsGrade([points("q1", 10)], { q1: value });
    const analysis = analyze([
      submitted("Amy", score(2), "grader-b"),
      submitted("Bob", score(9), "grader-a"),
      submitted("Cid", score(7), "grader-a"),
      {
        assigned: [learner("Fay")],
        delegations: [delegation("fay", "grader-c")],
      },
    ]);
    expect(pointsRows(analysis)[0]?.byGrader).toEqual([
      {
        grader: "grader-a",
        count: 2,
        median: 8,
        mean: 8,
        lowest: 7,
        highest: 9,
        full: 0,
        zero: 0,
      },
      {
        grader: "grader-b",
        count: 1,
        median: 2,
        mean: 2,
        lowest: 2,
        highest: 2,
        full: 0,
        zero: 0,
      },
    ]);
    expect(pointsRows(analysis)[0]?.scores).toEqual({
      count: 3,
      median: 7,
      mean: 6,
      lowest: 2,
      highest: 9,
      full: 0,
      zero: 0,
    });
    expect(totalRows(analysis)[0]?.byGrader).toEqual([
      {
        grader: "grader-a",
        count: 2,
        median: 8,
        mean: 8,
        lowest: 7,
        highest: 9,
        full: 0,
        zero: 0,
      },
      {
        grader: "grader-b",
        count: 1,
        median: 2,
        mean: 2,
        lowest: 2,
        highest: 2,
        full: 0,
        zero: 0,
      },
    ]);
  });
});

describe("grader letters", () => {
  test("letters follow grader id, whatever the delegation order", () => {
    const rows = [
      delegation("amy", "grader-c"),
      delegation("bob", "grader-a"),
      delegation("cid", "grader-b"),
      delegation("dee", "grader-a"),
    ];
    const letters = (delegations: DelegationRow[]) =>
      analyze([{ delegations }]).graders.map((grader) => [
        grader.grader,
        grader.letter,
      ]);
    const expected = [
      ["grader-a", "A"],
      ["grader-b", "B"],
      ["grader-c", "C"],
    ];
    expect(letters(rows)).toEqual(expected);
    expect(letters([...rows].reverse())).toEqual(expected);
  });

  test("letters run on past Z like spreadsheet columns", () => {
    expect(graderLetter(0)).toBe("A");
    expect(graderLetter(25)).toBe("Z");
    expect(graderLetter(26)).toBe("AA");
    expect(graderLetter(27)).toBe("AB");
    expect(graderLetter(701)).toBe("ZZ");
    expect(graderLetter(702)).toBe("AAA");
  });
});

describe("median", () => {
  test("empty, odd, even, and unsorted input", () => {
    expect(median([])).toBeNull();
    expect(median([5])).toBe(5);
    expect(median([1, 2, 9])).toBe(2);
    expect(median([1, 2, 4, 9])).toBe(3);
    expect(median([9, 1, 7, 3, 5])).toBe(5);
    expect(median([10, 0, 4, 8])).toBe(6);
  });

  test("does not reorder its input", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("mean", () => {
  test("is null for no scores and the plain average otherwise", () => {
    expect(mean([])).toBeNull();
    expect(mean([5])).toBe(5);
    expect(mean([0, 10, 8])).toBe(6);
    expect(mean([7.5, 2.5])).toBe(5);
  });
});

describe("readiness by grader", () => {
  test("one entry per grader with counted learners in letter order, then work without a grader", () => {
    const analysis = analyze([
      submitted(
        "Amy",
        competencyGrade([explains], { explains: "EXPERT" }),
        "grader-b",
      ),
      submitted("Bob", competencyGrade([explains], {}), "grader-a"),
      {
        assigned: [learner("Cid")],
        delegations: [delegation("cid", "grader-c")],
      },
      submitted("Dee", competencyGrade([explains], { explains: "EXPERT" })),
    ]);
    expect(analysis.graders.map((grader) => grader.grader)).toEqual([
      "grader-a",
      "grader-b",
      "grader-c",
    ]);
    expect(
      analysis.readinessByGrader.map(({ grader, readiness }) => [
        grader,
        readiness.counted,
        readiness.complete,
        readiness.notStarted,
      ]),
    ).toEqual([
      ["grader-a", 1, [], ["bob"]],
      ["grader-b", 1, ["amy"], []],
      [null, 1, ["dee"], []],
    ]);
  });

  test("no null entry when every counted learner has a grader", () => {
    const analysis = analyze([
      submitted(
        "Amy",
        competencyGrade([explains], { explains: "EXPERT" }),
        "grader-a",
      ),
      { assigned: [learner("Bob")] },
    ]);
    expect(analysis.readinessByGrader.map((entry) => entry.grader)).toEqual([
      "grader-a",
    ]);
  });
});

describe("papers", () => {
  test("read by grader letter, then student name", () => {
    const rate = competencyGrade([explains], { explains: "COMPETENT" });
    const analysis = analyze([
      submitted("Zed", rate, "grader-a"),
      submitted("Bob", rate),
      submitted("Amy", rate, "grader-b"),
      submitted("Cat", rate, "grader-a"),
    ]);
    const order = (row: CriterionRow | undefined) =>
      row && "papers" in row ? row.papers.map((paper) => paper.name) : [];
    expect(order(analysis.rows[0])).toEqual(["Cat", "Zed", "Amy", "Bob"]);
  });

  test("within a grader, papers without feedback come first", () => {
    const said = competencyGrade([explains], {
      explains: ["COMPETENT", "Names both forces."],
    });
    const silent = competencyGrade([explains], {
      explains: ["COMPETENT", "  "],
    });
    const analysis = analyze([
      submitted("Amy", said, "grader-a"),
      submitted("Zed", silent, "grader-a"),
      submitted("Bob", said, "grader-b"),
      submitted("Cat", silent, "grader-b"),
    ]);
    const row = analysis.rows[0];
    expect(
      row && "papers" in row ? row.papers.map((paper) => paper.name) : [],
    ).toEqual(["Zed", "Amy", "Cat", "Bob"]);
  });

  test("points papers carry the overall feedback, competency papers the criterion's", () => {
    const analysis = analyze([
      submitted(
        "Amy",
        competencyGrade(
          [explains],
          { explains: ["EXPERT", "Names both forces."] },
          { feedback: "Overall for Amy." },
        ),
      ),
      submitted(
        "Bob",
        pointsGrade(
          [points("q1", 10)],
          { q1: 6 },
          { feedback: "Overall for Bob." },
        ),
      ),
    ]);
    expect(competencyRows(analysis)[0]?.papers[0]).toEqual({
      learner: "amy",
      name: "Amy",
      grader: null,
      submission: "amy-a1",
      rating: "EXPERT",
      feedback: "Names both forces.",
    });
    expect(pointsRows(analysis)[0]?.papers[0]).toMatchObject({
      learner: "bob",
      submission: "bob-a1",
      score: 6,
      feedback: "Overall for Bob.",
    });
    expect(totalRows(analysis)[0]?.papers[0]?.feedback).toBe(
      "Overall for Bob.",
    );
  });
});

describe("learner state", () => {
  const both = [explains, cites];
  const state = (
    attempts: LearnerAttempt[],
    grades: ((attempts: LearnerAttempt[]) => ItemAssessment)[] = [],
  ) =>
    learnerState(
      attempts,
      grades.map((grade) => grade(attempts)),
    )?.state ?? null;
  const on =
    (number: number, grade: GradeFor) => (attempts: LearnerAttempt[]) =>
      grade(
        "amy",
        attempts.find((entry) => entry.number === number)?.submission ?? "",
      );
  const excused = () => excusal()("amy", "");
  const rated = competencyGrade(both, {
    explains: "EXPERT",
    cites: "EMERGENT",
  });

  test("is null with no attempt, or only withdrawn ones", () => {
    expect(learnerState([], [])).toBeNull();
    expect(state([attempt("amy", 1, "WITHDRAWN")])).toBeNull();
  });

  test("is excused under an assignment excusal, with or without an attempt", () => {
    expect(state([], [excused])).toBe("excused");
    expect(state([attempt("amy")], [excused])).toBe("excused");
  });

  test("is not started with no assessment, or an empty draft, on the latest attempt", () => {
    expect(state([attempt("amy")])).toBe("not-started");
    expect(state([attempt("amy")], [on(1, competencyGrade(both, {}))])).toBe(
      "not-started",
    );
  });

  test("is incomplete with some criteria rated, and complete with every one", () => {
    expect(
      state(
        [attempt("amy")],
        [on(1, competencyGrade(both, { cites: "EXPERT" }))],
      ),
    ).toBe("incomplete");
    expect(state([attempt("amy")], [on(1, rated)])).toBe("complete");
    expect(
      state(
        [attempt("amy")],
        [
          on(
            1,
            competencyGrade(both, {
              explains: "NOT_ASSESSED",
              cites: "NOT_ASSESSED",
            }),
          ),
        ],
      ),
    ).toBe("complete");
  });

  test("is a new attempt after an assessed earlier one, even with an empty draft on the latest", () => {
    const attempts = [attempt("amy", 1), attempt("amy", 2)];
    expect(state(attempts, [on(1, rated)])).toBe("new-attempt");
    expect(
      state(attempts, [on(1, rated), on(2, competencyGrade(both, {}))]),
    ).toBe("new-attempt");
  });

  test("is not started when the earlier attempt holds only an empty draft", () => {
    const attempts = [attempt("amy", 1), attempt("amy", 2)];
    expect(state(attempts, [on(1, competencyGrade(both, {}))])).toBe(
      "not-started",
    );
    expect(
      state(attempts, [
        on(1, competencyGrade(both, {})),
        on(2, competencyGrade(both, {})),
      ]),
    ).toBe("not-started");
  });

  test("returns the latest submitted attempt and its assessment", () => {
    const attempts = [attempt("amy", 1), attempt("amy", 2)];
    const standing = learnerState(attempts, [
      rated("amy", "amy-a1"),
      competencyGrade(both, { explains: "EXPERT" })("amy", "amy-a2"),
    ]);
    expect(standing).toMatchObject({
      state: "incomplete",
      attempt: { submission: "amy-a2" },
      assessment: { evidence: "amy-a2" },
    });
  });
});

describe("not rated and not scored", () => {
  test("a competency row lists learners holding the criterion with no rating, and Not assessed is a paper", () => {
    const both = [explains, cites];
    const analysis = analyze([
      submitted("Amy", competencyGrade(both, { explains: "EXPERT" })),
      submitted(
        "Bob",
        competencyGrade(both, { explains: "EMERGENT", cites: "NOT_ASSESSED" }),
      ),
      submitted(
        "Cid",
        competencyGrade(both, { explains: "COMPETENT", cites: "EXPERT" }),
      ),
    ]);
    const [explainsRow, citesRow] = competencyRows(analysis);
    expect(explainsRow?.unrated).toEqual([]);
    expect(citesRow?.unrated).toEqual(["amy"]);
    expect(citesRow?.tally.notAssessed).toBe(1);
    expect(citesRow?.papers.map((paper) => paper.learner)).toEqual([
      "bob",
      "cid",
    ]);
  });

  test("a points row lists learners holding the criterion with no score", () => {
    const criteria = [points("q1", 10), points("q2", 10, 1)];
    const analysis = analyze([
      submitted("Amy", pointsGrade(criteria, { q1: 4, q2: 0 })),
      submitted("Dee", pointsGrade(criteria, { q1: 2 }, { status: "DRAFT" })),
    ]);
    expect(pointsRows(analysis).map((row) => [row.key, row.unrated])).toEqual([
      ["points:q1:10", []],
      ["points:q2:10", ["dee"]],
    ]);
  });
});

describe("rows of two methods", () => {
  const rated = (day: number) =>
    competencyGrade(
      [explains, cites],
      { explains: "COMPETENT", cites: "EXPERT" },
      { day },
    );
  const scored = (day: number) =>
    pointsGrade(
      [points("q1", 10), points("q2", 10, 1)],
      { q1: 6, q2: 4 },
      { day },
    );

  test("rows of the method first assessed come first, whatever the roster order", () => {
    const analysis = analyze([
      submitted("Amy", scored(4)),
      submitted("Bob", rated(2)),
    ]);
    expect(analysis.rows.map((row) => row.key)).toEqual([
      "competency:explains",
      "competency:cites",
      "points:q1:10",
      "points:q2:10",
      "total:20",
    ]);
  });

  test("points first assessed put points rows first, with the total still last", () => {
    const analysis = analyze([
      submitted("Amy", rated(4)),
      submitted("Bob", scored(2)),
    ]);
    expect(analysis.rows.map((row) => row.key)).toEqual([
      "points:q1:10",
      "points:q2:10",
      "competency:explains",
      "competency:cites",
      "total:20",
    ]);
  });
});

describe("readiness", () => {
  test("gradable leaves out the excused, drafts are complete and unreleased, and to finish joins incomplete, not started, and new attempts", () => {
    const both = [explains, cites];
    const first = attempt("eve", 1);
    const analysis = analyze([
      submitted(
        "Amy",
        competencyGrade(
          both,
          { explains: "EXPERT", cites: "EXPERT" },
          { status: "RELEASED" },
        ),
      ),
      submitted(
        "Bob",
        competencyGrade(both, { explains: "EXPERT", cites: "EMERGENT" }),
      ),
      submitted("Cid", competencyGrade(both, { explains: "EXPERT" })),
      submitted("Dee"),
      {
        assigned: [learner("Eve")],
        submissions: [first, attempt("eve", 2)],
        grades: [
          competencyGrade(
            both,
            { explains: "EXPERT", cites: "EXPERT" },
            { status: "RELEASED" },
          )("eve", first.submission),
        ],
      },
      { assigned: [learner("Fay")], grades: [excusal()("fay", "")] },
    ]);
    expect(analysis.readiness).toMatchObject({
      counted: 6,
      gradable: 5,
      complete: ["amy", "bob"],
      released: ["amy"],
      drafts: ["bob"],
      incomplete: ["cid"],
      notStarted: ["dee"],
      newAttempts: ["eve"],
      toFinish: ["cid", "dee", "eve"],
      excused: ["fay"],
    });
  });
});

describe("scores", () => {
  test("a points row and its total carry lowest, highest, full marks, and zeros", () => {
    const criteria = [points("q1", 10), points("q2", 5, 1)];
    const analysis = analyze([
      submitted("Amy", pointsGrade(criteria, { q1: 10, q2: 5 })),
      submitted("Bob", pointsGrade(criteria, { q1: 0, q2: 0 })),
      submitted("Cid", pointsGrade(criteria, { q1: 10, q2: 1 })),
    ]);
    expect(pointsRows(analysis)[0]?.scores).toEqual({
      count: 3,
      median: 10,
      mean: 20 / 3,
      lowest: 0,
      highest: 10,
      full: 2,
      zero: 1,
    });
    expect(totalRows(analysis)[0]?.scores).toEqual({
      count: 3,
      median: 11,
      mean: 26 / 3,
      lowest: 0,
      highest: 15,
      full: 1,
      zero: 1,
    });
  });

  test("an empty row has no lowest or highest", () => {
    const analysis = analyze([
      submitted(
        "Amy",
        pointsGrade(
          [points("q1", 10), points("q2", 10, 1)],
          { q1: 3 },
          { status: "DRAFT" },
        ),
      ),
    ]);
    expect(totalRows(analysis)[0]?.scores).toEqual({
      count: 0,
      median: null,
      mean: null,
      lowest: null,
      highest: null,
      full: 0,
      zero: 0,
    });
  });
});

describe("score text", () => {
  test("whole scores stay whole, and others round to two decimals at most", () => {
    expect(scoreText(7)).toBe("7");
    expect(scoreText(0)).toBe("0");
    expect(scoreText(6.5)).toBe("6.5");
    expect(scoreText(7.1)).toBe("7.1");
    expect(scoreText(2 / 3)).toBe("0.67");
    expect(scoreText(26 / 3)).toBe("8.67");
  });
});
