import type { Collection, Db } from "mongodb";
import {
  GradeAlreadyReleased,
  GradeDraftNotFound,
  GradeNotFound,
  GradeReleasedNotFound,
  LearnerExcused,
  ScoreOutOfRange,
} from "./errors.ts";

interface RecordDoc {
  _id: string;
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
  seq: number;
}

interface CriterionScoreDoc {
  _id: string;
  record: string;
  criterion: string;
  points: number;
  outOf: number;
  feedback: string;
  seq: number;
}

export class MongoGradingConcept {
  private readonly records: Collection<RecordDoc>;
  private readonly criterionScores: Collection<CriterionScoreDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.records = db.collection<RecordDoc>("grading.records");
    this.criterionScores = db.collection<CriterionScoreDoc>("grading.criterionScores");
    this.counters = db.collection("grading.counters");
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  #recordOf(learner: string, item: string): Promise<RecordDoc | null> {
    return this.records.findOne({ learner, item });
  }

  async record({
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
    const existing = await this.#recordOf(learner, item);
    if (existing !== null) {
      if (existing.status === "RELEASED") {
        throw new GradeAlreadyReleased(existing._id);
      }
      if (existing.status === "EXCUSED") {
        throw new LearnerExcused(existing._id);
      }
      await this.records.updateOne(
        { _id: existing._id },
        { $set: { evidence, grader, score, outOf, feedback, updatedAt: at } },
      );
      return { grade: existing._id };
    }
    const grade = crypto.randomUUID();
    const seq = await this.#nextSeq("records");
    await this.records.insertOne({
      _id: grade,
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
      seq,
    });
    return { grade };
  }

  async scoreCriterion({
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
    const existing = await this.#recordOf(learner, item);
    if (existing === null) {
      throw new GradeNotFound(`${learner}/${item}`);
    }
    if (existing.status === "RELEASED") {
      throw new GradeAlreadyReleased(existing._id);
    }
    if (existing.status === "EXCUSED") {
      throw new LearnerExcused(existing._id);
    }
    if (points < 0 || points > outOf) {
      throw new ScoreOutOfRange(`Points must be between 0 and ${outOf}.`);
    }
    const cs = await this.criterionScores.findOne({ record: existing._id, criterion });
    if (cs !== null) {
      await this.criterionScores.updateOne({ _id: cs._id }, { $set: { points, outOf, feedback } });
      return { criterionScore: cs._id };
    }
    const criterionScore = crypto.randomUUID();
    const seq = await this.#nextSeq("criterionScores");
    await this.criterionScores.insertOne({
      _id: criterionScore,
      record: existing._id,
      criterion,
      points,
      outOf,
      feedback,
      seq,
    });
    return { criterionScore };
  }

  async release({ learner, item, at }: { learner: string; item: string; at: Date }) {
    const existing = await this.#recordOf(learner, item);
    if (existing === null || existing.status !== "DRAFT") {
      throw new GradeDraftNotFound(`${learner}/${item}`);
    }
    await this.records.updateOne(
      { _id: existing._id },
      { $set: { status: "RELEASED", releasedAt: at, updatedAt: at } },
    );
    return { grade: existing._id };
  }

  async releaseItem({ item, at }: { item: string; at: Date }) {
    const drafts = await this.records.find({ item, status: "DRAFT" }).sort({ seq: 1 }).toArray();
    const released: { learner: string; grade: string }[] = [];
    for (const doc of drafts) {
      await this.records.updateOne(
        { _id: doc._id },
        { $set: { status: "RELEASED", releasedAt: at, updatedAt: at } },
      );
      released.push({ learner: doc.learner, grade: doc._id });
    }
    return { released };
  }

  async retract({ learner, item, at }: { learner: string; item: string; at: Date }) {
    const existing = await this.#recordOf(learner, item);
    if (existing === null || existing.status !== "RELEASED") {
      throw new GradeReleasedNotFound(`${learner}/${item}`);
    }
    await this.records.updateOne(
      { _id: existing._id },
      { $set: { status: "DRAFT", releasedAt: null, updatedAt: at } },
    );
    return { grade: existing._id };
  }

  async excuse({
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
    const existing = await this.#recordOf(learner, item);
    if (existing === null) {
      throw new GradeNotFound(`${learner}/${item}`);
    }
    await this.records.updateOne(
      { _id: existing._id },
      { $set: { status: "EXCUSED", score: 0, grader, feedback, releasedAt: null, updatedAt: at } },
    );
    return { grade: existing._id };
  }

  async clearCriterionScores({ criterion }: { criterion: string }) {
    await this.criterionScores.deleteMany({ criterion });
    return { criterion };
  }

  async _getGrade({ learner, item }: { learner: string; item: string }) {
    const existing = await this.#recordOf(learner, item);
    if (existing === null) return [];
    return [
      {
        grade: existing._id,
        score: existing.score,
        outOf: existing.outOf,
        status: existing.status,
        feedback: existing.feedback,
      },
    ];
  }

  async _getGradesForLearner({ learner }: { learner: string }) {
    const docs = await this.records.find({ learner }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      item: doc.item,
      grade: doc._id,
      score: doc.score,
      outOf: doc.outOf,
      status: doc.status,
      feedback: doc.feedback,
    }));
  }

  async _getGradesForItem({ item }: { item: string }) {
    const docs = await this.records.find({ item }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      learner: doc.learner,
      grade: doc._id,
      score: doc.score,
      feedback: doc.feedback,
      status: doc.status,
    }));
  }

  async _getCriterionScores({ learner, item }: { learner: string; item: string }) {
    const existing = await this.#recordOf(learner, item);
    if (existing === null) return [];
    const docs = await this.criterionScores
      .find({ record: existing._id })
      .sort({ seq: 1 })
      .toArray();
    return docs.map((cs) => ({
      criterion: cs.criterion,
      points: cs.points,
      feedback: cs.feedback,
    }));
  }
}
