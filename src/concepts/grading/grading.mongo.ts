import { sumDecimals } from "../../computations/decimal-sum.ts";
import type { Collection, Db } from "mongodb";
import { GradeConflict, GradeIncomplete, GradeNotFound, InvalidJudgments } from "./errors.ts";

export const RATINGS = ["DEFICIENT", "EMERGENT", "COMPETENT", "EXPERT", "NOT_ASSESSED"] as const;
export const GRADING_METHODS = ["COMPETENCY", "POINTS"] as const;
export type GradingMethod = (typeof GRADING_METHODS)[number];

export interface CompetencyCriterion {
  kind: "COMPETENCY";
  criterion: string;
  position: number;
  basis: string;
  standard: string;
  number: number;
  name: string;
  description: string;
  deficient: string;
  emergent: string;
  competent: string;
  expert: string;
  referenceUrl: string;
}

export interface PointCriterion {
  kind: "POINTS";
  criterion: string;
  position: number;
  name: string;
  maxPoints: number;
}

export type Criterion = CompetencyCriterion | PointCriterion;

export interface CompetencyJudgment {
  kind: "COMPETENCY";
  criterion: string;
  rating: string;
  feedback: string;
}

export interface PointJudgment {
  kind: "POINTS";
  criterion: string;
  score: number;
}

export type Judgment = CompetencyJudgment | PointJudgment;

interface Release {
  revision: number;
  grader: string;
  feedback: string;
  judgments: Judgment[];
  releasedAt: Date;
  status: "RELEASED" | "EXCUSED";
  score: number;
  outOf: number;
  scored: boolean;
}

interface RecordDoc {
  _id: string;
  learner: string;
  item: string;
  evidence: string;
  grader: string;
  method: GradingMethod;
  setupRevision: number;
  criteria: Criterion[];
  judgments: Judgment[];
  feedback: string;
  status: "DRAFT" | "RELEASED" | "EXCUSED";
  version: number;
  createdAt: Date;
  updatedAt: Date;
  releasedAt: Date | null;
  history: Release[];
}

const MAX_FEEDBACK = 20_000;
const MAX_CRITERIA = 100;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validText(value: unknown, maximum = MAX_FEEDBACK): value is string {
  return typeof value === "string" && value.length <= maximum;
}

export class MongoGradingConcept {
  private readonly records: Collection<RecordDoc>;
  private indexes: Promise<unknown> | undefined;

  constructor(db: Db) {
    this.records = db.collection("grading.assessments");
  }

  async #ready() {
    await (this.indexes ??= this.records.createIndex(
      { learner: 1, item: 1, evidence: 1 },
      { unique: true },
    ));
  }

  #validateCriteria(method: GradingMethod, criteria: unknown, evidence: string): Criterion[] {
    if (
      !Array.isArray(criteria) ||
      criteria.length > MAX_CRITERIA ||
      (evidence !== "" && criteria.length === 0)
    )
      throw new InvalidJudgments("Select at least one valid, distinct criterion.");

    const parsed = criteria as Criterion[];
    if (
      parsed.some(
        (criterion) =>
          !isObject(criterion) ||
          criterion.kind !== method ||
          typeof criterion.criterion !== "string" ||
          !criterion.criterion ||
          !Number.isSafeInteger(criterion.position) ||
          criterion.position < 0,
      ) ||
      new Set(parsed.map(({ criterion }) => criterion)).size !== parsed.length ||
      new Set(parsed.map(({ position }) => position)).size !== parsed.length
    )
      throw new InvalidJudgments("Select valid, distinct, ordered criteria.");

    if (method === "POINTS") {
      if (
        parsed.some(
          (criterion) =>
            criterion.kind !== "POINTS" ||
            typeof criterion.name !== "string" ||
            !criterion.name.trim() ||
            criterion.name.length > 1_000 ||
            typeof criterion.maxPoints !== "number" ||
            !Number.isFinite(criterion.maxPoints) ||
            criterion.maxPoints <= 0,
        )
      )
        throw new InvalidJudgments("Point criteria need a name and a positive finite maximum.");
      const outOf = sumDecimals(parsed.map((criterion) => (criterion as PointCriterion).maxPoints));
      if (!Number.isFinite(outOf) || outOf <= 0)
        throw new InvalidJudgments("The total point maximum must be positive and finite.");
    } else {
      const textFields = [
        "basis",
        "standard",
        "name",
        "description",
        "deficient",
        "emergent",
        "competent",
        "expert",
        "referenceUrl",
      ] as const;
      if (
        parsed.some(
          (criterion) =>
            criterion.kind !== "COMPETENCY" ||
            !Number.isSafeInteger(criterion.number) ||
            criterion.number < 1 ||
            textFields.some(
              (field) =>
                typeof criterion[field] !== "string" ||
                (["basis", "standard", "name"].includes(field) && !criterion[field]),
            ),
        )
      )
        throw new InvalidJudgments("Competency criteria need complete immutable rubric editions.");
    }
    return structuredClone(parsed);
  }

  async #get(grade: string) {
    await this.#ready();
    const doc = await this.records.findOne({ _id: grade });
    if (!doc) throw new GradeNotFound("There is no assessment.");
    return doc;
  }

  #version(doc: RecordDoc, version: number, status: string) {
    if (doc.version !== version || doc.status !== status)
      throw new GradeConflict("This assessment changed or is locked. Reload before editing.");
  }

  #summary(doc: Pick<RecordDoc, "method" | "criteria" | "judgments">) {
    if (doc.method !== "POINTS") return { score: 0, outOf: 0, scored: false };
    const criteria = doc.criteria as PointCriterion[];
    const judgments = doc.judgments as PointJudgment[];
    const score = sumDecimals(judgments.map((judgment) => judgment.score));
    const outOf = sumDecimals(criteria.map((criterion) => criterion.maxPoints));
    if (!Number.isFinite(score) || !Number.isFinite(outOf))
      throw new InvalidJudgments("The point total must be finite.");
    return {
      score,
      outOf,
      scored:
        criteria.length > 0 &&
        criteria.every(({ criterion }) =>
          judgments.some((judgment) => judgment.criterion === criterion),
        ),
    };
  }

  #complete(doc: RecordDoc) {
    if (doc.evidence === "" || doc.criteria.length === 0) return false;
    if (doc.method === "POINTS") return this.#summary(doc).scored;
    return doc.criteria.every(({ criterion }) =>
      doc.judgments.some((judgment) => judgment.criterion === criterion),
    );
  }

  async record({
    learner,
    item,
    evidence,
    grader,
    method,
    setupRevision,
    criteria,
    at,
  }: {
    learner: string;
    item: string;
    evidence: string;
    grader: string;
    method: string;
    setupRevision: number;
    criteria: Criterion[];
    at: Date;
  }) {
    await this.#ready();
    const existing = await this.records.findOne({ learner, item, evidence });
    if (existing)
      return { grade: existing._id, version: existing.version, method: existing.method };
    if (
      !GRADING_METHODS.some((candidate) => candidate === method) ||
      !Number.isSafeInteger(setupRevision) ||
      setupRevision < 0
    )
      throw new InvalidJudgments("Use a valid grading setup revision.");
    const gradingMethod = method as GradingMethod;
    const snapshot = this.#validateCriteria(gradingMethod, criteria, evidence);
    const grade = crypto.randomUUID();
    try {
      await this.records.insertOne({
        _id: grade,
        learner,
        item,
        evidence,
        grader,
        method: gradingMethod,
        setupRevision,
        criteria: snapshot,
        judgments: [],
        feedback: "",
        status: "DRAFT",
        version: 1,
        createdAt: at,
        updatedAt: at,
        releasedAt: null,
        history: [],
      });
    } catch (error) {
      if (isObject(error) && error.code === 11000) {
        const other = await this.records.findOne({ learner, item, evidence });
        if (other) return { grade: other._id, version: other.version, method: other.method };
      }
      throw error;
    }
    return { grade, version: 1, method: gradingMethod };
  }

  #validateJudgments(doc: RecordDoc, judgments: Judgment[], feedback: unknown): Judgment[] {
    if (
      !validText(feedback) ||
      !Array.isArray(judgments) ||
      judgments.length > doc.criteria.length ||
      judgments.some((judgment) => !isObject(judgment))
    )
      throw new InvalidJudgments("Use valid judgments and feedback of at most 20,000 characters.");
    const parsed = judgments as Judgment[];
    if (
      new Set(parsed.map(({ criterion }) => criterion)).size !== parsed.length ||
      parsed.some(
        (judgment) =>
          typeof judgment.criterion !== "string" ||
          !doc.criteria.some(({ criterion }) => criterion === judgment.criterion) ||
          judgment.kind !== doc.method,
      )
    )
      throw new InvalidJudgments("Use at most one matching judgment per criterion.");

    if (doc.method === "COMPETENCY") {
      if (
        parsed.some(
          (judgment) =>
            judgment.kind !== "COMPETENCY" ||
            !RATINGS.some((rating) => rating === judgment.rating) ||
            !validText(judgment.feedback),
        )
      )
        throw new InvalidJudgments(
          "Use one valid level or Not assessed per criterion, with feedback of at most 20,000 characters.",
        );
    } else {
      if (
        parsed.some((judgment) => {
          if (judgment.kind !== "POINTS" || !Number.isFinite(judgment.score)) return true;
          const criterion = doc.criteria.find(
            (candidate) => candidate.criterion === judgment.criterion,
          ) as PointCriterion;
          return judgment.score < 0 || judgment.score > criterion.maxPoints;
        })
      )
        throw new InvalidJudgments("Use a finite score from zero through each criterion maximum.");
      this.#summary({ ...doc, judgments: parsed });
    }
    return structuredClone(parsed);
  }

  async save({
    grade,
    version,
    grader,
    judgments,
    feedback,
    at,
  }: {
    grade: string;
    version: number;
    grader: string;
    judgments: Judgment[];
    feedback: string;
    at: Date;
  }) {
    const doc = await this.#get(grade);
    this.#version(doc, version, "DRAFT");
    const validated = this.#validateJudgments(doc, judgments, feedback);
    return this.#change(doc, {
      grader,
      judgments: validated,
      feedback,
      updatedAt: at,
    });
  }

  async #change(doc: RecordDoc, fields: Partial<RecordDoc>) {
    const result = await this.records.updateOne(
      { _id: doc._id, version: doc.version, status: doc.status },
      { $set: fields, $inc: { version: 1 } },
    );
    if (!result.modifiedCount)
      throw new GradeConflict("This assessment changed. Reload before editing.");
    return { grade: doc._id, version: doc.version + 1 };
  }

  async release({
    grade,
    version,
    grader,
    at,
  }: {
    grade: string;
    version: number;
    grader: string;
    at: Date;
  }) {
    const doc = await this.#get(grade);
    this.#version(doc, version, "DRAFT");
    if (!this.#complete(doc))
      throw new GradeIncomplete(
        doc.method === "POINTS"
          ? "Enter a score for every criterion before release."
          : "Select evidence and assess every criterion, or explicitly mark it Not assessed, before release.",
      );
    const summary = this.#summary(doc);
    const entry: Release = {
      revision: doc.history.length + 1,
      grader,
      feedback: doc.feedback,
      judgments: structuredClone(doc.judgments),
      releasedAt: at,
      status: "RELEASED",
      ...summary,
    };
    return this.#change(doc, {
      status: "RELEASED",
      grader,
      releasedAt: at,
      updatedAt: at,
      history: [...doc.history, entry],
    });
  }

  async releaseItem({ item, grader, at }: { item: string; grader: string; at: Date }) {
    await this.#ready();
    const docs = await this.records.find({ item, status: "DRAFT" }).toArray();
    const released: { grade: string; learner: string }[] = [];
    const skipped: { grade: string; reason: string }[] = [];
    const unconfirmed: { grade: string; reason: string }[] = [];
    for (const doc of docs) {
      try {
        await this.release({ grade: doc._id, version: doc.version, grader, at });
        released.push({ grade: doc._id, learner: doc.learner });
      } catch (error) {
        if (error instanceof GradeIncomplete || error instanceof GradeConflict)
          skipped.push({
            grade: doc._id,
            reason: error instanceof GradeIncomplete ? "INCOMPLETE" : "CONFLICT",
          });
        else unconfirmed.push({ grade: doc._id, reason: "OUTCOME_UNKNOWN" });
      }
    }
    return { released, skipped, unconfirmed };
  }

  async retract({
    grade,
    version,
    grader,
    at,
  }: {
    grade: string;
    version: number;
    grader: string;
    at: Date;
  }) {
    const doc = await this.#get(grade);
    this.#version(doc, version, "RELEASED");
    return this.#change(doc, { status: "DRAFT", grader, releasedAt: null, updatedAt: at });
  }

  async restoreExcused({
    grade,
    version,
    grader,
    at,
  }: {
    grade: string;
    version: number;
    grader: string;
    at: Date;
  }) {
    const doc = await this.#get(grade);
    this.#version(doc, version, "EXCUSED");
    return this.#change(doc, { status: "DRAFT", grader, releasedAt: null, updatedAt: at });
  }

  async excuse({
    grade,
    version,
    grader,
    feedback,
    at,
  }: {
    grade: string;
    version: number;
    grader: string;
    feedback: string;
    at: Date;
  }) {
    const doc = await this.#get(grade);
    this.#version(doc, version, "DRAFT");
    if (!validText(feedback))
      throw new InvalidJudgments("Feedback must be at most 20,000 characters.");
    const summary = this.#summary(doc);
    const entry: Release = {
      revision: doc.history.length + 1,
      grader,
      feedback,
      judgments: [],
      releasedAt: at,
      status: "EXCUSED",
      score: 0,
      outOf: summary.outOf,
      scored: false,
    };
    return this.#change(doc, {
      status: "EXCUSED",
      grader,
      updatedAt: at,
      releasedAt: at,
      history: [...doc.history, entry],
    });
  }

  #releaseRow(release: Release) {
    return release.status === "EXCUSED"
      ? { ...release, judgments: [], score: 0, scored: false }
      : release;
  }

  #row(doc: RecordDoc) {
    const summary = this.#summary(doc);
    const excused = doc.status === "EXCUSED";
    const excusal = excused
      ? [...doc.history].reverse().find(({ status }) => status === "EXCUSED")
      : undefined;
    return {
      grade: doc._id,
      learner: doc.learner,
      item: doc.item,
      evidence: doc.evidence,
      grader: doc.grader,
      method: doc.method,
      setupRevision: doc.setupRevision,
      criteria: doc.criteria,
      judgments: excused ? [] : doc.judgments,
      feedback: excusal?.feedback ?? doc.feedback,
      status: doc.status,
      version: doc.version,
      score: excused ? 0 : summary.score,
      outOf: summary.outOf,
      scored: excused ? false : summary.scored,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      releasedAt: doc.releasedAt,
      history: doc.history.map((release) => this.#releaseRow(release)),
    };
  }

  async _getAssessment({
    learner,
    item,
    evidence,
  }: {
    learner: string;
    item: string;
    evidence: string;
  }) {
    await this.#ready();
    const doc = await this.records.findOne({ learner, item, evidence });
    return doc
      ? [{ grade: doc._id, version: doc.version, method: doc.method, status: doc.status }]
      : [];
  }

  async _getGrade({ grade }: { grade: string }) {
    await this.#ready();
    const doc = await this.records.findOne({ _id: grade });
    return doc ? [this.#row(doc)] : [];
  }

  async _getGradesForLearner({ learner }: { learner: string }) {
    await this.#ready();
    return (await this.records.find({ learner }).sort({ createdAt: 1, _id: 1 }).toArray()).map(
      (doc) => this.#row(doc),
    );
  }

  async _getGradesForItem({ item }: { item: string }) {
    await this.#ready();
    return (await this.records.find({ item }).sort({ createdAt: 1, _id: 1 }).toArray()).map((doc) =>
      this.#row(doc),
    );
  }
}
