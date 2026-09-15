import type { Collection, Db, Filter } from "mongodb";
import {
  GradeConflict,
  GradeIncomplete,
  GradeNotFound,
  GradingRecordsExist,
  InvalidGradingConfiguration,
  InvalidJudgments,
  InvalidMark,
  MarkConflict,
  MarkIncomplete,
  MarkNotFound,
} from "./errors.ts";

export const RATINGS = ["DEFICIENT", "EMERGENT", "COMPETENT", "EXPERT", "NOT_ASSESSED"] as const;
export const GRADING_METHODS = ["COMPETENCY", "POINTS"] as const;
type GradingMethod = (typeof GRADING_METHODS)[number];

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
interface ConfigurationDoc {
  _id: string;
  method: GradingMethod;
  generation: number;
  maxPoints: number;
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
  generation?: number;
  createdAt: Date;
  updatedAt: Date;
  releasedAt: Date | null;
  history: Release[];
}
interface MarkDoc {
  _id: string;
  learner: string;
  item: string;
  evidence: string;
  grader: string;
  score: number;
  scored: boolean;
  outOf: number;
  feedback: string;
  status: "DRAFT" | "RELEASED" | "EXCUSED";
  version: number;
  generation: number;
  createdAt: Date;
  updatedAt: Date;
  releasedAt: Date | null;
}

const DEFAULT_CONFIGURATION = {
  method: "COMPETENCY" as const,
  generation: 0,
  maxPoints: 100,
};
const MAX_FEEDBACK = 20_000;

function generationFilter<T extends { generation?: number }>(generation: number): Filter<T> {
  return (
    generation === 0
      ? { $or: [{ generation: 0 }, { generation: { $exists: false } }] }
      : { generation }
  ) as Filter<T>;
}

export class MongoGradingConcept {
  private readonly configurations: Collection<ConfigurationDoc>;
  private readonly records: Collection<RecordDoc>;
  private readonly marks: Collection<MarkDoc>;
  private indexes: Promise<unknown> | undefined;

  constructor(db: Db) {
    this.configurations = db.collection("grading.configurations");
    this.records = db.collection("grading.assessments");
    this.marks = db.collection("grading.marks");
  }

  async #ready() {
    await (this.indexes ??= Promise.all([
      this.records.createIndex(
        { learner: 1, item: 1, evidence: 1, generation: 1 },
        { unique: true },
      ),
      this.marks.createIndex({ learner: 1, item: 1, generation: 1 }, { unique: true }),
    ]));
  }

  async #configuration(item: string) {
    return (
      (await this.configurations.findOne({ _id: item })) ?? {
        _id: item,
        ...DEFAULT_CONFIGURATION,
      }
    );
  }

  async #requireConfiguration(item: string, method: GradingMethod, generation: number) {
    const configuration = await this.#configuration(item);
    if (configuration.method !== method || configuration.generation !== generation)
      throw method === "COMPETENCY"
        ? new GradeConflict("The grading method changed. Reload before editing this assessment.")
        : new MarkConflict("The grading method changed. Reload before editing this grade.");
    return configuration;
  }

  async configure({
    item,
    method,
    maxPoints,
    generation,
    discard,
    expectedCount,
  }: {
    item: string;
    method: string;
    maxPoints: number;
    generation: number;
    discard: boolean;
    expectedCount: number;
  }) {
    await this.#ready();
    if (
      !GRADING_METHODS.some((candidate) => candidate === method) ||
      !Number.isSafeInteger(generation) ||
      generation < 0 ||
      !Number.isSafeInteger(expectedCount) ||
      expectedCount < 0 ||
      (method === "POINTS" &&
        (typeof maxPoints !== "number" || !Number.isFinite(maxPoints) || maxPoints <= 0))
    )
      throw new InvalidGradingConfiguration(
        "Choose competency or points grading with a positive finite maximum.",
      );
    const current = await this.#configuration(item);
    if (current.generation !== generation)
      throw new GradeConflict("The grading method changed. Reload before trying again.");
    const nextMethod = method as GradingMethod;
    const nextMaximum = nextMethod === "POINTS" ? maxPoints : current.maxPoints;
    if (current.method === nextMethod && current.maxPoints === nextMaximum)
      return {
        item,
        method: current.method,
        maxPoints: current.maxPoints,
        generation: current.generation,
        discarded: 0,
      };

    const count =
      current.method === "COMPETENCY"
        ? await this.records.countDocuments({
            item,
            ...generationFilter<RecordDoc>(current.generation),
          })
        : await this.marks.countDocuments({
            item,
            ...generationFilter<MarkDoc>(current.generation),
          });
    if (count > 0 && discard !== true)
      throw new GradingRecordsExist(
        "Changing this grading setup will delete existing grades. Confirm the deletion and try again.",
      );
    if (discard === true && count !== expectedCount)
      throw new GradeConflict(
        "The grades changed after review. Reload and confirm the current deletion count.",
      );

    const removed =
      current.method === "COMPETENCY"
        ? await this.records.deleteMany({
            item,
            ...generationFilter<RecordDoc>(current.generation),
          })
        : await this.marks.deleteMany({
            item,
            ...generationFilter<MarkDoc>(current.generation),
          });
    const nextGeneration = current.generation + 1;
    await this.configurations.updateOne(
      { _id: item },
      {
        $set: {
          method: nextMethod,
          generation: nextGeneration,
          maxPoints: nextMaximum,
        },
      },
      { upsert: true },
    );
    return {
      item,
      method: nextMethod,
      maxPoints: nextMaximum,
      generation: nextGeneration,
      discarded: removed.deletedCount,
    };
  }

  async #get(grade: string) {
    await this.#ready();
    const doc = await this.records.findOne({ _id: grade });
    if (!doc) throw new GradeNotFound("There is no assessment.");
    await this.#requireConfiguration(doc.item, "COMPETENCY", doc.generation ?? 0);
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
    generation,
    at,
  }: {
    learner: string;
    item: string;
    evidence: string;
    grader: string;
    criteria: { criterion: string }[];
    generation: number;
    at: Date;
  }) {
    await this.#ready();
    await this.#requireConfiguration(item, "COMPETENCY", generation);
    if (
      !Array.isArray(criteria) ||
      (evidence !== "" && criteria.length === 0) ||
      criteria.length > 100 ||
      criteria.some((c) => !c || typeof c.criterion !== "string" || !c.criterion) ||
      new Set(criteria.map((c) => c.criterion)).size !== criteria.length
    )
      throw new InvalidJudgments("Select distinct criteria.");
    const active = generationFilter<RecordDoc>(generation);
    const existing = await this.records.findOne({ learner, item, evidence, ...active });
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
        generation,
        createdAt: at,
        updatedAt: at,
        releasedAt: null,
        history: [],
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        const other = await this.records.findOne({ learner, item, evidence, generation });
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
      feedback.length > MAX_FEEDBACK ||
      !Array.isArray(judgments) ||
      judgments.length > doc.criteria.length ||
      new Set(judgments.map((j) => j?.criterion)).size !== judgments.length ||
      judgments.some(
        (j) =>
          !j ||
          !doc.criteria.some((c) => c.criterion === j.criterion) ||
          !RATINGS.some((r) => r === j.rating) ||
          typeof j.feedback !== "string" ||
          j.feedback.length > MAX_FEEDBACK,
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

  async releaseItem({
    item,
    generation,
    grader,
    at,
  }: {
    item: string;
    generation: number;
    grader: string;
    at: Date;
  }) {
    await this.#ready();
    await this.#requireConfiguration(item, "COMPETENCY", generation);
    const docs = await this.records
      .find({ item, status: "DRAFT", ...generationFilter<RecordDoc>(generation) })
      .toArray();
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
    if (typeof feedback !== "string" || feedback.length > MAX_FEEDBACK)
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

  async #currentAssessmentFilter(item: string) {
    const configuration = await this.#configuration(item);
    if (configuration.method !== "COMPETENCY") return null;
    return { item, ...generationFilter<RecordDoc>(configuration.generation) };
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

  async _getConfiguration({ item }: { item: string }) {
    const { method, generation, maxPoints } = await this.#configuration(item);
    return [{ item, method, generation, maxPoints }];
  }

  async _getCriteria({ grade }: { grade: string }) {
    await this.#ready();
    const doc = await this.records.findOne({ _id: grade });
    if (!doc) return [];
    const configuration = await this.#configuration(doc.item);
    return configuration.method === "COMPETENCY" &&
      configuration.generation === (doc.generation ?? 0)
      ? doc.criteria
      : [];
  }

  async _getGrade({ grade }: { grade: string }) {
    await this.#ready();
    const doc = await this.records.findOne({ _id: grade });
    if (!doc) return [];
    const configuration = await this.#configuration(doc.item);
    return configuration.method === "COMPETENCY" &&
      configuration.generation === (doc.generation ?? 0)
      ? [this.#row(doc)]
      : [];
  }

  async _getGradesForLearner({ learner }: { learner: string }) {
    await this.#ready();
    const docs = await this.records.find({ learner }).sort({ createdAt: 1, _id: 1 }).toArray();
    const rows = [];
    for (const doc of docs) {
      const configuration = await this.#configuration(doc.item);
      if (
        configuration.method === "COMPETENCY" &&
        configuration.generation === (doc.generation ?? 0)
      )
        rows.push(this.#row(doc));
    }
    return rows;
  }

  async _getGradesForItem({ item }: { item: string }) {
    await this.#ready();
    const filter = await this.#currentAssessmentFilter(item);
    if (!filter) return [];
    return (await this.records.find(filter).sort({ createdAt: 1, _id: 1 }).toArray()).map((doc) =>
      this.#row(doc),
    );
  }

  async #getMark(mark: string) {
    await this.#ready();
    const doc = await this.marks.findOne({ _id: mark });
    if (!doc) throw new MarkNotFound("There is no point grade.");
    await this.#requireConfiguration(doc.item, "POINTS", doc.generation);
    return doc;
  }

  #markVersion(doc: MarkDoc, version: number, status: string) {
    if (doc.version !== version || doc.status !== status)
      throw new MarkConflict("This point grade changed or is locked. Reload before editing.");
  }

  #validFeedback(feedback: unknown) {
    if (typeof feedback !== "string" || feedback.length > MAX_FEEDBACK)
      throw new InvalidMark("Feedback must be at most 20,000 characters.");
  }

  async recordMark({
    learner,
    item,
    evidence,
    grader,
    score,
    feedback,
    generation,
    version,
    at,
  }: {
    learner: string;
    item: string;
    evidence: string;
    grader: string;
    score: number;
    feedback: string;
    generation: number;
    version: number;
    at: Date;
  }) {
    await this.#ready();
    const configuration = await this.#requireConfiguration(item, "POINTS", generation);
    if (
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > configuration.maxPoints
    )
      throw new InvalidMark(`The score must be between 0 and ${configuration.maxPoints}.`);
    this.#validFeedback(feedback);
    const existing = await this.marks.findOne({ learner, item, generation });
    if (existing) {
      this.#markVersion(existing, version, "DRAFT");
      const result = await this.marks.updateOne(
        { _id: existing._id, version, status: "DRAFT" },
        {
          $set: { evidence, grader, score, scored: true, feedback, updatedAt: at },
          $inc: { version: 1 },
        },
      );
      if (!result.modifiedCount)
        throw new MarkConflict("This point grade changed. Reload before editing.");
      return { mark: existing._id, version: version + 1 };
    }
    if (version !== 0) throw new MarkConflict("This point grade changed. Reload before editing.");
    const mark = crypto.randomUUID();
    await this.marks.insertOne({
      _id: mark,
      learner,
      item,
      evidence,
      grader,
      score,
      scored: true,
      outOf: configuration.maxPoints,
      feedback,
      status: "DRAFT",
      version: 1,
      generation,
      createdAt: at,
      updatedAt: at,
      releasedAt: null,
    });
    return { mark, version: 1 };
  }

  async releaseMark({ mark, version, at }: { mark: string; version: number; at: Date }) {
    const doc = await this.#getMark(mark);
    this.#markVersion(doc, version, "DRAFT");
    if (!doc.scored) throw new MarkIncomplete("Enter a score before releasing this grade.");
    return this.#changeMark(doc, { status: "RELEASED", releasedAt: at, updatedAt: at });
  }

  async retractMark({ mark, version, at }: { mark: string; version: number; at: Date }) {
    const doc = await this.#getMark(mark);
    this.#markVersion(doc, version, "RELEASED");
    return this.#changeMark(doc, { status: "DRAFT", releasedAt: null, updatedAt: at });
  }

  async restoreExcusedMark({ mark, version, at }: { mark: string; version: number; at: Date }) {
    const doc = await this.#getMark(mark);
    this.#markVersion(doc, version, "EXCUSED");
    return this.#changeMark(doc, { status: "DRAFT", releasedAt: null, updatedAt: at });
  }

  async excuseMark({
    learner,
    item,
    evidence,
    grader,
    feedback,
    generation,
    mark,
    version,
    at,
  }: {
    learner: string;
    item: string;
    evidence: string;
    grader: string;
    feedback: string;
    generation: number;
    mark: string;
    version: number;
    at: Date;
  }) {
    await this.#ready();
    const configuration = await this.#requireConfiguration(item, "POINTS", generation);
    this.#validFeedback(feedback);
    if (mark) {
      const doc = await this.#getMark(mark);
      if (doc.learner !== learner || doc.item !== item)
        throw new MarkNotFound("There is no point grade.");
      this.#markVersion(doc, version, "DRAFT");
      return this.#changeMark(doc, {
        status: "EXCUSED",
        evidence,
        grader,
        feedback,
        releasedAt: at,
        updatedAt: at,
      });
    }
    if (version !== 0 || (await this.marks.findOne({ learner, item, generation })))
      throw new MarkConflict("This point grade changed. Reload before editing.");
    const created = crypto.randomUUID();
    await this.marks.insertOne({
      _id: created,
      learner,
      item,
      evidence,
      grader,
      score: 0,
      scored: false,
      outOf: configuration.maxPoints,
      feedback,
      status: "EXCUSED",
      version: 1,
      generation,
      createdAt: at,
      updatedAt: at,
      releasedAt: at,
    });
    return { mark: created, version: 1 };
  }

  async #changeMark(doc: MarkDoc, fields: Partial<MarkDoc>) {
    const result = await this.marks.updateOne(
      { _id: doc._id, version: doc.version, status: doc.status },
      { $set: fields, $inc: { version: 1 } },
    );
    if (!result.modifiedCount)
      throw new MarkConflict("This point grade changed. Reload before editing.");
    return { mark: doc._id, version: doc.version + 1 };
  }

  async releaseMarks({ item, generation, at }: { item: string; generation: number; at: Date }) {
    await this.#ready();
    await this.#requireConfiguration(item, "POINTS", generation);
    const docs = await this.marks.find({ item, generation, status: "DRAFT" }).toArray();
    const released: { mark: string; learner: string }[] = [];
    const skipped: { mark: string; reason: string }[] = [];
    const unconfirmed: { mark: string; reason: string }[] = [];
    for (const doc of docs) {
      if (!doc.scored) {
        skipped.push({ mark: doc._id, reason: "INCOMPLETE" });
        continue;
      }
      try {
        const result = await this.marks.updateOne(
          { _id: doc._id, version: doc.version, status: "DRAFT" },
          {
            $set: { status: "RELEASED", releasedAt: at, updatedAt: at },
            $inc: { version: 1 },
          },
        );
        if (result.modifiedCount) released.push({ mark: doc._id, learner: doc.learner });
        else skipped.push({ mark: doc._id, reason: "CONFLICT" });
      } catch {
        unconfirmed.push({ mark: doc._id, reason: "OUTCOME_UNKNOWN" });
      }
    }
    return { released, skipped, unconfirmed };
  }

  #markRow(doc: MarkDoc) {
    const excused = doc.status === "EXCUSED";
    return {
      mark: doc._id,
      learner: doc.learner,
      item: doc.item,
      evidence: doc.evidence,
      grader: doc.grader,
      score: excused ? 0 : doc.score,
      scored: excused ? false : doc.scored,
      outOf: doc.outOf,
      feedback: doc.feedback,
      status: doc.status,
      version: doc.version,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      releasedAt: doc.releasedAt,
    };
  }

  async _getMark({ mark }: { mark: string }) {
    await this.#ready();
    const doc = await this.marks.findOne({ _id: mark });
    if (!doc) return [];
    const configuration = await this.#configuration(doc.item);
    return configuration.method === "POINTS" && configuration.generation === doc.generation
      ? [this.#markRow(doc)]
      : [];
  }

  async _getMarksForLearner({ learner }: { learner: string }) {
    await this.#ready();
    const docs = await this.marks.find({ learner }).sort({ createdAt: 1, _id: 1 }).toArray();
    const rows = [];
    for (const doc of docs) {
      const configuration = await this.#configuration(doc.item);
      if (configuration.method === "POINTS" && configuration.generation === doc.generation)
        rows.push(this.#markRow(doc));
    }
    return rows;
  }

  async _getMarksForItem({ item }: { item: string }) {
    await this.#ready();
    const configuration = await this.#configuration(item);
    if (configuration.method !== "POINTS") return [];
    return (
      await this.marks
        .find({ item, generation: configuration.generation })
        .sort({ createdAt: 1, _id: 1 })
        .toArray()
    ).map((doc) => this.#markRow(doc));
  }
}
