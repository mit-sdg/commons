import {
  type AssignedLearner,
  type AvailableGrader,
  type DelegationRow,
  type ItemAssessment,
  type LearnerAttempt,
  selectExportAssessment,
  selectSubmissionAttempt,
} from "@/lib/submissions-export";

/**
 * How one assignment stands for a grading meeting: which learners are ready,
 * how each criterion was rated, and which papers sit at each rating level.
 */

export const LEVELS = ["DEFICIENT", "EMERGENT", "COMPETENT", "EXPERT"] as const;
export type Level = (typeof LEVELS)[number];
export const NOT_ASSESSED = "NOT_ASSESSED";

export type LearnerState =
  | "complete"
  | "incomplete"
  | "not-started"
  | "new-attempt"
  | "excused";

export interface GradeAnalysisSource {
  assigned: readonly AssignedLearner[];
  submissions: readonly LearnerAttempt[];
  grades: readonly ItemAssessment[];
  delegations: readonly DelegationRow[];
  graders: readonly AvailableGrader[];
}

export interface Grader {
  grader: string;
  letter: string;
  name: string;
}

export interface LearnerResult {
  learner: string;
  name: string;
  grader: string | null;
  state: LearnerState;
  assessment: ItemAssessment | undefined;
  attempt: LearnerAttempt | undefined;
  released: boolean;
  withoutFeedback: boolean;
}

export interface Readiness {
  counted: number;
  gradable: number;
  complete: string[];
  released: string[];
  drafts: string[];
  incomplete: string[];
  notStarted: string[];
  newAttempts: string[];
  toFinish: string[];
  excused: string[];
  withoutFeedback: string[];
  withoutGrader: string[];
}

export interface Paper {
  learner: string;
  name: string;
  grader: string | null;
  submission: string;
  feedback: string;
}

export interface CompetencyPaper extends Paper {
  rating: Level | typeof NOT_ASSESSED;
}

export interface PointPaper extends Paper {
  score: number;
}

export interface CompetencyTally {
  levels: Record<Level, number>;
  competentOrAbove: number;
  rated: number;
  notAssessed: number;
}

export interface CompetencyRow {
  kind: "COMPETENCY";
  key: string;
  basis: string;
  standard: string;
  name: string;
  edition: number | null;
  descriptions: Record<Level, string>;
  papers: CompetencyPaper[];
  unrated: string[];
  tally: CompetencyTally;
  byGrader: { grader: string | null; tally: CompetencyTally }[];
}

export interface PointsRow {
  kind: "POINTS";
  key: string;
  name: string;
  maxPoints: number;
  papers: PointPaper[];
  unrated: string[];
  scores: Scores;
  byGrader: Spread[];
}

export interface TotalRow {
  kind: "TOTAL";
  key: string;
  outOf: number;
  papers: PointPaper[];
  scores: Scores;
  byGrader: Spread[];
  withoutTotal: string[];
}

export type CriterionRow = CompetencyRow | PointsRow | TotalRow;

export interface Scores {
  count: number;
  median: number | null;
  mean: number | null;
  lowest: number | null;
  highest: number | null;
  full: number;
  zero: number;
}

export interface Spread extends Scores {
  grader: string | null;
}

export interface GradeAnalysis {
  learners: LearnerResult[];
  graders: Grader[];
  readiness: Readiness;
  readinessByGrader: { grader: string | null; readiness: Readiness }[];
  rows: CriterionRow[];
  dropped: string[];
}

export function isBlank(text: string | null | undefined): boolean {
  return (text ?? "").trim() === "";
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function graderLetter(index: number): string {
  let letters = "";
  let rest = index;
  do {
    letters = String.fromCharCode(65 + (rest % 26)) + letters;
    rest = Math.floor(rest / 26) - 1;
  } while (rest >= 0);
  return letters;
}

function gradersOf(
  delegations: readonly DelegationRow[],
  available: readonly AvailableGrader[],
): Grader[] {
  const availableById = new Map(
    available.map((grader) => [String(grader.grader), grader] as const),
  );
  const named = new Map<string, string>();
  for (const row of delegations) {
    const id = String(row.grader);
    const current = availableById.get(id);
    named.set(
      id,
      current?.displayName ??
        row.graderName ??
        current?.username ??
        row.graderUsername ??
        id,
    );
  }
  return [...named.keys()].sort().map((grader, index) => ({
    grader,
    letter: graderLetter(index),
    name: named.get(grader) ?? grader,
  }));
}

function learnerName(learner: AssignedLearner): string {
  return (
    learner.displayName ??
    learner.username ??
    learner.email ??
    String(learner.assignee)
  );
}

type Graded = Pick<
  ItemAssessment,
  "evidence" | "status" | "createdAt" | "updatedAt" | "judgments" | "criteria"
>;

function hasRatings(assessment: Graded): boolean {
  return assessment.judgments.length > 0 || assessment.status !== "DRAFT";
}

function rated(assessment: Graded): boolean {
  return (
    assessment.criteria.length > 0 &&
    assessment.criteria.every(({ criterion }) =>
      assessment.judgments.some((judgment) => judgment.criterion === criterion),
    )
  );
}

function feedbackless(assessment: ItemAssessment): boolean {
  return (
    isBlank(assessment.feedback) &&
    assessment.judgments.every(
      (judgment) =>
        judgment.kind !== "COMPETENCY" || isBlank(judgment.feedback),
    )
  );
}

export function learnerState<T extends Graded>(
  attempts: readonly LearnerAttempt[],
  grades: readonly T[],
): {
  state: LearnerState;
  attempt: LearnerAttempt | undefined;
  assessment: T | undefined;
} | null {
  const attempt = selectSubmissionAttempt(attempts);
  const assessment = selectExportAssessment(grades, attempt).record;
  const found = { attempt, assessment };
  if (assessment?.status === "EXCUSED") return { ...found, state: "excused" };
  if (attempt?.status !== "SUBMITTED") return null;
  if (!assessment || !hasRatings(assessment)) {
    const before = new Set(
      attempts
        .filter((earlier) => earlier.number < attempt.number)
        .map((earlier) => String(earlier.submission)),
    );
    const earlier = grades.some(
      (grade) =>
        before.has(String(grade.evidence)) &&
        grade.status !== "EXCUSED" &&
        hasRatings(grade),
    );
    return { ...found, state: earlier ? "new-attempt" : "not-started" };
  }
  return { ...found, state: rated(assessment) ? "complete" : "incomplete" };
}

function classify(
  learner: AssignedLearner,
  attempts: readonly LearnerAttempt[],
  grades: readonly ItemAssessment[],
  owner: string | null,
): LearnerResult | null {
  const standing = learnerState(attempts, grades);
  if (!standing) return null;
  const { state, attempt, assessment } = standing;
  const complete = state === "complete" && assessment !== undefined;
  return {
    learner: String(learner.assignee),
    name: learnerName(learner),
    grader: owner,
    state,
    assessment,
    attempt,
    released: complete && assessment.status === "RELEASED",
    withoutFeedback: complete && feedbackless(assessment),
  };
}

function readinessOf(learners: readonly LearnerResult[]): Readiness {
  const ids = (keep: (learner: LearnerResult) => boolean) =>
    learners.filter(keep).map((learner) => learner.learner);
  const incomplete = ids((learner) => learner.state === "incomplete");
  const notStarted = ids((learner) => learner.state === "not-started");
  const newAttempts = ids((learner) => learner.state === "new-attempt");
  const excused = ids((learner) => learner.state === "excused");
  return {
    counted: learners.length,
    gradable: learners.length - excused.length,
    complete: ids((learner) => learner.state === "complete"),
    released: ids((learner) => learner.released),
    drafts: ids((learner) => learner.state === "complete" && !learner.released),
    incomplete,
    notStarted,
    newAttempts,
    toFinish: [...incomplete, ...notStarted, ...newAttempts],
    excused,
    withoutFeedback: ids((learner) => learner.withoutFeedback),
    withoutGrader: ids(
      (learner) => learner.grader === null && learner.state !== "excused",
    ),
  };
}

function emptyTally(): CompetencyTally {
  return {
    levels: { DEFICIENT: 0, EMERGENT: 0, COMPETENT: 0, EXPERT: 0 },
    competentOrAbove: 0,
    rated: 0,
    notAssessed: 0,
  };
}

function tallyOf(papers: readonly CompetencyPaper[]): CompetencyTally {
  const tally = emptyTally();
  for (const paper of papers) {
    if (paper.rating === NOT_ASSESSED) {
      tally.notAssessed += 1;
      continue;
    }
    tally.levels[paper.rating] += 1;
    tally.rated += 1;
    if (paper.rating === "COMPETENT" || paper.rating === "EXPERT")
      tally.competentOrAbove += 1;
  }
  return tally;
}

function isRating(value: string): value is Level | typeof NOT_ASSESSED {
  return (
    value === NOT_ASSESSED || (LEVELS as readonly string[]).includes(value)
  );
}

function splitByGrader<P extends Paper, T>(
  papers: readonly P[],
  graders: readonly Grader[],
  summarize: (papers: P[]) => T,
): ({ grader: string | null } & T)[] {
  const owners: (string | null)[] = [
    ...graders.map((grader) => grader.grader),
    null,
  ];
  return owners.flatMap((grader) => {
    const own = papers.filter((paper) => paper.grader === grader);
    return own.length === 0 ? [] : [{ grader, ...summarize(own) }];
  });
}

function paperOrder(graders: readonly Grader[]) {
  const rank = new Map(graders.map((grader, index) => [grader.grader, index]));
  return (left: Paper, right: Paper) =>
    (rank.get(left.grader ?? "") ?? graders.length) -
      (rank.get(right.grader ?? "") ?? graders.length) ||
    Number(!isBlank(left.feedback)) - Number(!isBlank(right.feedback)) ||
    left.name.localeCompare(right.name) ||
    left.learner.localeCompare(right.learner);
}

function scoresOf(papers: readonly PointPaper[], max: number): Scores {
  const scores = papers.map((paper) => paper.score);
  return {
    count: scores.length,
    median: median(scores),
    mean: mean(scores),
    lowest: scores.length > 0 ? Math.min(...scores) : null,
    highest: scores.length > 0 ? Math.max(...scores) : null,
    full: scores.filter((score) => score === max).length,
    zero: scores.filter((score) => score === 0).length,
  };
}

interface Building {
  row: CompetencyRow | PointsRow;
  position: number;
  firstSeen: number;
}

function rowsOf(
  learners: readonly LearnerResult[],
  graders: readonly Grader[],
): CriterionRow[] {
  const building = new Map<string, Building>();
  const totals = new Map<number, TotalRow>();
  const order = paperOrder(graders);

  for (const learner of learners) {
    const assessment = learner.assessment;
    const attempt = learner.attempt;
    if (
      !assessment ||
      !attempt ||
      (learner.state !== "complete" && learner.state !== "incomplete")
    )
      continue;
    const paper = {
      learner: learner.learner,
      name: learner.name,
      grader: learner.grader,
      submission: String(attempt.submission),
    };
    const seen = new Date(assessment.createdAt).getTime();

    for (const criterion of assessment.criteria) {
      const judgment = assessment.judgments.find(
        (entry) => entry.criterion === criterion.criterion,
      );
      if (criterion.kind === "COMPETENCY") {
        const key = `competency:${criterion.basis}`;
        const entry = building.get(key) ?? {
          row: {
            kind: "COMPETENCY",
            key,
            basis: criterion.basis,
            standard: criterion.standard,
            name: criterion.name,
            edition: null,
            descriptions: {
              DEFICIENT: criterion.deficient,
              EMERGENT: criterion.emergent,
              COMPETENT: criterion.competent,
              EXPERT: criterion.expert,
            },
            papers: [],
            unrated: [],
            tally: emptyTally(),
            byGrader: [],
          },
          position: criterion.position,
          firstSeen: seen,
        };
        entry.position = Math.min(entry.position, criterion.position);
        entry.firstSeen = Math.min(entry.firstSeen, seen);
        building.set(key, entry);
        if (
          judgment?.kind === "COMPETENCY" &&
          entry.row.kind === "COMPETENCY" &&
          isRating(judgment.rating)
        )
          entry.row.papers.push({
            ...paper,
            rating: judgment.rating,
            feedback: judgment.feedback,
          });
        else if (!judgment) entry.row.unrated.push(learner.learner);
      } else {
        const key = `points:${criterion.criterion}:${criterion.maxPoints}`;
        const entry = building.get(key) ?? {
          row: {
            kind: "POINTS",
            key,
            name: criterion.name,
            maxPoints: criterion.maxPoints,
            papers: [],
            unrated: [],
            scores: scoresOf([], criterion.maxPoints),
            byGrader: [],
          },
          position: criterion.position,
          firstSeen: seen,
        };
        entry.position = Math.min(entry.position, criterion.position);
        entry.firstSeen = Math.min(entry.firstSeen, seen);
        building.set(key, entry);
        if (judgment?.kind === "POINTS" && entry.row.kind === "POINTS")
          entry.row.papers.push({
            ...paper,
            score: judgment.score,
            feedback: assessment.feedback,
          });
        else if (!judgment) entry.row.unrated.push(learner.learner);
      }
    }

    if (assessment.method === "POINTS") {
      const total = totals.get(assessment.outOf) ?? {
        kind: "TOTAL",
        key: `total:${assessment.outOf}`,
        outOf: assessment.outOf,
        papers: [],
        scores: scoresOf([], assessment.outOf),
        byGrader: [],
        withoutTotal: [],
      };
      totals.set(assessment.outOf, total);
      if (assessment.scored)
        total.papers.push({
          ...paper,
          score: assessment.score,
          feedback: assessment.feedback,
        });
      else total.withoutTotal.push(learner.learner);
    }
  }

  const editions = new Map<string, Building[]>();
  for (const entry of building.values())
    if (entry.row.kind === "COMPETENCY")
      editions.set(entry.row.standard, [
        ...(editions.get(entry.row.standard) ?? []),
        entry,
      ]);
  for (const shared of editions.values())
    if (shared.length > 1)
      shared
        .sort((left, right) => left.firstSeen - right.firstSeen)
        .forEach((entry, index) => {
          if (entry.row.kind === "COMPETENCY") entry.row.edition = index + 1;
        });

  const methodSeen = new Map<string, number>();
  for (const entry of building.values())
    methodSeen.set(
      entry.row.kind,
      Math.min(
        methodSeen.get(entry.row.kind) ?? entry.firstSeen,
        entry.firstSeen,
      ),
    );
  const criteria = [...building.values()]
    .sort(
      (left, right) =>
        (methodSeen.get(left.row.kind) ?? 0) -
          (methodSeen.get(right.row.kind) ?? 0) ||
        left.position - right.position ||
        left.firstSeen - right.firstSeen,
    )
    .map(({ row }): CriterionRow => {
      if (row.kind === "COMPETENCY") {
        const papers = [...row.papers].sort(order);
        return {
          ...row,
          papers,
          tally: tallyOf(papers),
          byGrader: splitByGrader(papers, graders, (own) => ({
            tally: tallyOf(own),
          })),
        };
      }
      const papers = [...row.papers].sort(order);
      return {
        ...row,
        papers,
        scores: scoresOf(papers, row.maxPoints),
        byGrader: splitByGrader(papers, graders, (own) =>
          scoresOf(own, row.maxPoints),
        ),
      };
    });

  const totalRows = [...totals.values()]
    .sort((left, right) => left.outOf - right.outOf)
    .map((total): TotalRow => {
      const papers = [...total.papers].sort(order);
      return {
        ...total,
        papers,
        scores: scoresOf(papers, total.outOf),
        byGrader: splitByGrader(papers, graders, (own) =>
          scoresOf(own, total.outOf),
        ),
      };
    });

  return [...criteria, ...totalRows];
}

export function analyzeGrades(source: GradeAnalysisSource): GradeAnalysis {
  const owners = new Map(
    source.delegations.map(
      (row) => [String(row.learner), String(row.grader)] as const,
    ),
  );
  const graders = gradersOf(source.delegations, source.graders);
  const learners = source.assigned.flatMap((learner) => {
    const id = String(learner.assignee);
    if (learner.enrolment === "DROPPED") return [];
    const result = classify(
      learner,
      source.submissions.filter((attempt) => String(attempt.submitter) === id),
      source.grades.filter((grade) => String(grade.learner) === id),
      owners.get(id) ?? null,
    );
    return result ? [result] : [];
  });
  const owned = (grader: string | null) =>
    learners.filter((learner) => learner.grader === grader);
  return {
    learners,
    graders,
    readiness: readinessOf(learners),
    readinessByGrader: [
      ...graders.map((grader) => grader.grader),
      null,
    ].flatMap((grader) => {
      const own = owned(grader);
      return own.length === 0 ? [] : [{ grader, readiness: readinessOf(own) }];
    }),
    rows: rowsOf(learners, graders),
    dropped: source.assigned
      .filter((learner) => learner.enrolment === "DROPPED")
      .map((learner) => String(learner.assignee)),
  };
}

export function scoreText(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(2)));
}
