import type { Input, Output } from "@/lib/api";

export type GradingSetup = Output<"/grades/item">;
export type GradingMethod = GradingSetup["method"];
export type Criterion = GradingSetup["criteria"][number];
export type CompetencyCriterion = Extract<Criterion, { kind: "COMPETENCY" }>;
export type PointCriterion = Extract<Criterion, { kind: "POINTS" }>;

export type SetupCriterionInput =
  Input<"/grades/configure-setup">["criteria"][number];
export type CompetencyCriterionInput = Extract<
  SetupCriterionInput,
  { kind: "COMPETENCY" }
>;
export type PointCriterionInput = Extract<
  SetupCriterionInput,
  { kind: "POINTS" }
>;

type LearnerAssessment = Output<"/grades/for-me">["grades"][number];
type ItemAssessment = Output<"/grades/for-item">["grades"][number];
export type Assessment = (LearnerAssessment | ItemAssessment) & {
  label?: string | null;
  displayName?: string | null;
};
export type GradeStatus = Assessment["status"];
export type Judgment = Assessment["judgments"][number];
export type CompetencyJudgment = Extract<Judgment, { kind: "COMPETENCY" }>;
export type PointJudgment = Extract<Judgment, { kind: "POINTS" }>;
export type Rating = CompetencyJudgment["rating"];
export type GradeRelease = Assessment["history"][number];

export function competencyCriteria(
  criteria: Criterion[],
): CompetencyCriterion[] {
  return criteria.filter(
    (criterion): criterion is CompetencyCriterion =>
      criterion.kind === "COMPETENCY",
  );
}

export function pointCriteria(criteria: Criterion[]): PointCriterion[] {
  return criteria.filter(
    (criterion): criterion is PointCriterion => criterion.kind === "POINTS",
  );
}

export function competencyJudgments(
  judgments: Judgment[],
): CompetencyJudgment[] {
  return judgments.filter(
    (judgment): judgment is CompetencyJudgment =>
      judgment.kind === "COMPETENCY",
  );
}

export function pointJudgments(judgments: Judgment[]): PointJudgment[] {
  return judgments.filter(
    (judgment): judgment is PointJudgment => judgment.kind === "POINTS",
  );
}

/** Exact attempt results win; only an assignment-wide excusal can fall back. */
export function assessmentForEvidence<
  T extends Pick<Assessment, "learner" | "item" | "evidence" | "status">,
>(
  assessments: T[],
  learner: string,
  item: string,
  evidence: string,
): T | undefined {
  const learnerAssessments = assessments.filter(
    (assessment) => assessment.learner === learner && assessment.item === item,
  );
  return (
    learnerAssessments.find((assessment) => assessment.evidence === evidence) ??
    (evidence
      ? learnerAssessments.find(
          (assessment) =>
            assessment.evidence === "" && assessment.status === "EXCUSED",
        )
      : undefined)
  );
}
