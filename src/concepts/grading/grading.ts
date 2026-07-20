import {
  GradeAlreadyReleased,
  GradeDraftNotFound,
  GradeNotFound,
  GradeReleasedNotFound,
  LearnerExcused,
  ScoreOutOfRange,
} from "./errors.ts";

const freshID = () => crypto.randomUUID();

export class GradingConcept {
  private readonly records = new Map<
    string,
    {
      learner: string;
      item: string;
      evidence: string;
      grader: string;
      score: number;
      outOf: number;
      feedback: string;
      status: "DRAFT" | "RELEASED" | "EXCUSED";
      updatedAt: Date;
      releasedAt: Date | null;
    }
  >();
  private readonly criterionScores = new Map<
    string,
    { record: string; criterion: string; points: number; outOf: number; feedback: string }
  >();

  #recordOf(learner: string, item: string) {
    for (const [grade, doc] of this.records) {
      if (doc.learner === learner && doc.item === item) return [grade, doc] as const;
    }
    return null;
  }

  record({
    learner,
    item,
    evidence,
    grader,
    score,
    outOf,
    feedback,
    at,
  }: {
    learner: string;
    item: string;
    evidence: string;
    grader: string;
    score: number;
    outOf: number;
    feedback: string;
    at: Date;
  }) {
    if (score < 0 || score > outOf) {
      throw new ScoreOutOfRange(`Score must be between 0 and ${outOf}.`);
    }
    const existing = this.#recordOf(learner, item);
    if (existing !== null) {
      const [grade, doc] = existing;
      if (doc.status === "RELEASED") {
        throw new GradeAlreadyReleased(grade);
      }
      if (doc.status === "EXCUSED") {
        throw new LearnerExcused(grade);
      }
      doc.evidence = evidence;
      doc.grader = grader;
      doc.score = score;
      doc.outOf = outOf;
      doc.feedback = feedback;
      doc.updatedAt = at;
      return { grade };
    }
    const grade = freshID();
    this.records.set(grade, {
      learner,
      item,
      evidence,
      grader,
      score,
      outOf,
      feedback,
      status: "DRAFT",
      updatedAt: at,
      releasedAt: null,
    });
    return { grade };
  }

  scoreCriterion({
    learner,
    item,
    criterion,
    points,
    outOf,
    feedback,
  }: {
    learner: string;
    item: string;
    criterion: string;
    points: number;
    outOf: number;
    feedback: string;
  }) {
    const existing = this.#recordOf(learner, item);
    if (existing === null) {
      throw new GradeNotFound(`${learner}/${item}`);
    }
    const [grade, doc] = existing;
    if (doc.status === "RELEASED") {
      throw new GradeAlreadyReleased(grade);
    }
    if (doc.status === "EXCUSED") {
      throw new LearnerExcused(grade);
    }
    if (points < 0 || points > outOf) {
      throw new ScoreOutOfRange(`Points must be between 0 and ${outOf}.`);
    }
    for (const [criterionScore, cs] of this.criterionScores) {
      if (cs.record === grade && cs.criterion === criterion) {
        cs.points = points;
        cs.outOf = outOf;
        cs.feedback = feedback;
        return { criterionScore };
      }
    }
    const criterionScore = freshID();
    this.criterionScores.set(criterionScore, {
      record: grade,
      criterion,
      points,
      outOf,
      feedback,
    });
    return { criterionScore };
  }

  release({ learner, item, at }: { learner: string; item: string; at: Date }) {
    const existing = this.#recordOf(learner, item);
    if (existing === null || existing[1].status !== "DRAFT") {
      throw new GradeDraftNotFound(`${learner}/${item}`);
    }
    const [grade, doc] = existing;
    doc.status = "RELEASED";
    doc.releasedAt = at;
    doc.updatedAt = at;
    return { grade };
  }

  releaseItem({ item, at }: { item: string; at: Date }) {
    const released: { learner: string; grade: string }[] = [];
    for (const [grade, doc] of this.records) {
      if (doc.item === item && doc.status === "DRAFT") {
        doc.status = "RELEASED";
        doc.releasedAt = at;
        doc.updatedAt = at;
        released.push({ learner: doc.learner, grade });
      }
    }
    return { released };
  }

  retract({ learner, item, at }: { learner: string; item: string; at: Date }) {
    const existing = this.#recordOf(learner, item);
    if (existing === null || existing[1].status !== "RELEASED") {
      throw new GradeReleasedNotFound(`${learner}/${item}`);
    }
    const [grade, doc] = existing;
    doc.status = "DRAFT";
    doc.releasedAt = null;
    doc.updatedAt = at;
    return { grade };
  }

  excuse({
    learner,
    item,
    grader,
    feedback,
    at,
  }: {
    learner: string;
    item: string;
    grader: string;
    feedback: string;
    at: Date;
  }) {
    const existing = this.#recordOf(learner, item);
    if (existing === null) {
      throw new GradeNotFound(`${learner}/${item}`);
    }
    const [grade, doc] = existing;
    doc.status = "EXCUSED";
    doc.score = 0;
    doc.grader = grader;
    doc.feedback = feedback;
    doc.releasedAt = null;
    doc.updatedAt = at;
    return { grade };
  }

  clearCriterionScores({ criterion }: { criterion: string }) {
    for (const [criterionScore, cs] of this.criterionScores) {
      if (cs.criterion === criterion) this.criterionScores.delete(criterionScore);
    }
    return { criterion };
  }

  _getGrade({ learner, item }: { learner: string; item: string }): {
    grade: string;
    score: number;
    outOf: number;
    status: string;
    feedback: string;
  }[] {
    const existing = this.#recordOf(learner, item);
    if (existing === null) return [];
    const [grade, doc] = existing;
    return [
      {
        grade,
        score: doc.score,
        outOf: doc.outOf,
        status: doc.status,
        feedback: doc.feedback,
      },
    ];
  }

  _getGradesForLearner({ learner }: { learner: string }): {
    item: string;
    grade: string;
    score: number;
    outOf: number;
    status: string;
    feedback: string;
  }[] {
    return [...this.records.entries()]
      .filter(([, doc]) => doc.learner === learner)
      .map(([grade, doc]) => ({
        item: doc.item,
        grade,
        score: doc.score,
        outOf: doc.outOf,
        status: doc.status,
        feedback: doc.feedback,
      }));
  }

  _getGradesForItem({ item }: { item: string }): {
    learner: string;
    grade: string;
    score: number;
    status: string;
  }[] {
    return [...this.records.entries()]
      .filter(([, doc]) => doc.item === item)
      .map(([grade, doc]) => ({
        learner: doc.learner,
        grade,
        score: doc.score,
        status: doc.status,
      }));
  }

  _getCriterionScores({ learner, item }: { learner: string; item: string }): {
    criterion: string;
    points: number;
    feedback: string;
  }[] {
    const existing = this.#recordOf(learner, item);
    if (existing === null) return [];
    const [grade] = existing;
    return [...this.criterionScores.values()]
      .filter((cs) => cs.record === grade)
      .map((cs) => ({ criterion: cs.criterion, points: cs.points, feedback: cs.feedback }));
  }
}
