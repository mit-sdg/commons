import type { Collection, Db } from "mongodb";
import { GradeNotFound, GradeConflict, InvalidJudgments, GradeIncomplete } from "./errors.ts";

export const RATINGS = ["DEFICIENT", "EMERGENT", "COMPETENT", "EXPERT", "NOT_ASSESSED"] as const;
export interface Judgment {
  criterion: string;
  rating: string;
  feedback: string;
}
interface Release {
  revision: number;
  grader: string;
  feedback: string;
  judgments: Judgment[];
  releasedAt: Date;
  status: "RELEASED" | "EXCUSED";
}
interface RecordDoc {
  _id: string;
  learner: string;
  item: string;
  evidence: string;
  grader: string;
  criteria: { criterion: string }[];
  judgments: Judgment[];
  feedback: string;
  status: "DRAFT" | "RELEASED" | "EXCUSED";
  version: number;
  createdAt: Date;
  updatedAt: Date;
  releasedAt: Date | null;
  history: Release[];
}
export class MongoGradingConcept {
  private readonly records: Collection<RecordDoc>;
  private index: Promise<string> | undefined;
  constructor(db: Db) {
    this.records = db.collection("grading.assessments");
  }
  async #ready() {
    await (this.index ??= this.records.createIndex(
      { learner: 1, item: 1, evidence: 1 },
      { unique: true },
    ));
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
  #complete(doc: RecordDoc) {
    return (
      doc.evidence !== "" &&
      doc.criteria.length > 0 &&
      doc.criteria.every((c) => doc.judgments.some((j) => j.criterion === c.criterion))
    );
  }
  async record({
    learner,
    item,
    evidence,
    grader,
    criteria,
    at,
  }: {
    learner: string;
    item: string;
    evidence: string;
    grader: string;
    criteria: { criterion: string }[];
    at: Date;
  }) {
    await this.#ready();
    if (
      !Array.isArray(criteria) ||
      (evidence !== "" && criteria.length === 0) ||
      criteria.length > 100 ||
      criteria.some((c) => !c || typeof c.criterion !== "string" || !c.criterion) ||
      new Set(criteria.map((c) => c.criterion)).size !== criteria.length
    )
      throw new InvalidJudgments("Select distinct criteria.");
    const existing = await this.records.findOne({ learner, item, evidence });
    if (existing) return { grade: existing._id, version: existing.version };
    const grade = crypto.randomUUID();
    try {
      await this.records.insertOne({
        _id: grade,
        learner,
        item,
        evidence,
        grader,
        criteria,
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
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        const other = await this.records.findOne({ learner, item, evidence });
        if (other) return { grade: other._id, version: other.version };
      }
      throw error;
    }
    return { grade, version: 1 };
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
    if (
      typeof feedback !== "string" ||
      feedback.length > 20000 ||
      !Array.isArray(judgments) ||
      judgments.length > doc.criteria.length ||
      new Set(judgments.map((j) => j?.criterion)).size !== judgments.length ||
      judgments.some(
        (j) =>
          !j ||
          !doc.criteria.some((c) => c.criterion === j.criterion) ||
          !RATINGS.some((r) => r === j.rating) ||
          typeof j.feedback !== "string" ||
          j.feedback.length > 20000,
      )
    )
      throw new InvalidJudgments(
        "Use one valid level or Not assessed per criterion, with feedback of at most 20,000 characters.",
      );
    return this.#change(doc, {
      grader,
      judgments: judgments.map(({ criterion, rating, feedback }) => ({
        criterion,
        rating,
        feedback,
      })),
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
        "Select evidence and assess every criterion, or explicitly mark it Not assessed, before release.",
      );
    const entry: Release = {
      revision: doc.history.length + 1,
      grader,
      feedback: doc.feedback,
      judgments: doc.judgments,
      releasedAt: at,
      status: "RELEASED",
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
    if (typeof feedback !== "string" || feedback.length > 20000)
      throw new InvalidJudgments("Feedback must be at most 20,000 characters.");
    const entry: Release = {
      revision: doc.history.length + 1,
      grader,
      feedback,
      judgments: [],
      releasedAt: at,
      status: "EXCUSED",
    };
    return this.#change(doc, {
      status: "EXCUSED",
      grader,
      feedback,
      updatedAt: at,
      releasedAt: at,
      history: [...doc.history, entry],
    });
  }
  #row(doc: RecordDoc) {
    return {
      grade: doc._id,
      learner: doc.learner,
      item: doc.item,
      evidence: doc.evidence,
      grader: doc.grader,
      criteria: doc.criteria,
      judgments: doc.status === "EXCUSED" ? [] : doc.judgments,
      feedback: doc.feedback,
      status: doc.status,
      version: doc.version,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      releasedAt: doc.releasedAt,
      history: doc.history,
    };
  }
  async _getCriteria({ grade }: { grade: string }) {
    await this.#ready();
    const doc = await this.records.findOne({ _id: grade });
    return doc?.criteria ?? [];
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
