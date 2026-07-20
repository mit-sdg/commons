import type { Collection, Db } from "mongodb";
import { ResolutionNotFound } from "./errors.ts";

interface ResolutionDoc {
  _id: string;
  answer: string;
  resolvedBy: string;
  resolvedAt: Date;
}

export class MongoResolvingConcept {
  private readonly resolutions: Collection<ResolutionDoc>;

  constructor(db: Db) {
    this.resolutions = db.collection<ResolutionDoc>("resolving.resolutions");
  }

  async accept({
    question,
    answer,
    by,
    at,
  }: {
    question: string;
    answer: string;
    by: string;
    at: Date;
  }) {
    await this.resolutions.updateOne(
      { _id: question },
      { $set: { answer, resolvedBy: by, resolvedAt: at } },
      { upsert: true },
    );
    return { resolution: question };
  }

  async clear({ question }: { question: string }) {
    const removed = await this.resolutions.deleteOne({ _id: question });
    if (removed.deletedCount === 0) {
      throw new ResolutionNotFound(question);
    }
    return { question };
  }

  async _isResolved({ question }: { question: string }) {
    const doc = await this.resolutions.findOne({ _id: question });
    return { resolved: doc !== null };
  }

  async _getResolution({ question }: { question: string }) {
    const doc = await this.resolutions.findOne({ _id: question });
    return doc === null
      ? []
      : [{ answer: doc.answer, resolvedBy: doc.resolvedBy, resolvedAt: doc.resolvedAt }];
  }

  async _getQuestionsAnswered({ answer }: { answer: string }) {
    const docs = await this.resolutions.find({ answer }).toArray();
    return docs.map((doc) => ({ question: doc._id }));
  }
}
