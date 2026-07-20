import { RevisingConcept } from "./revising.ts";
import type { Collection, Db } from "mongodb";

interface RevisionDoc {
  _id: string;
  item: string;
  number: number;
  content: string;
  savedAt: Date;
}

type Row = { revision: string; number: number; content: string; savedAt: Date };

export class MongoRevisingConcept {
  static readonly queries = RevisingConcept.queries;

  private readonly revisions: Collection<RevisionDoc>;

  constructor(db: Db) {
    this.revisions = db.collection<RevisionDoc>("revising.revisions");
  }

  async #highestNumber(item: string): Promise<number> {
    const top = await this.revisions.find({ item }).sort({ number: -1 }).limit(1).toArray();
    return top[0]?.number ?? 0;
  }

  async record({ item, content, at }: { item: string; content: string; at: Date }) {
    const number = (await this.#highestNumber(item)) + 1;
    const revision = crypto.randomUUID();
    await this.revisions.insertOne({ _id: revision, item, number, content, savedAt: at });
    return { revision, number };
  }

  async clearItem({ item }: { item: string }) {
    await this.revisions.deleteMany({ item });
    return { item };
  }

  async _getRevisions({ item }: { item: string }): Promise<Row[]> {
    const docs = await this.revisions.find({ item }).sort({ number: 1 }).toArray();
    return docs.map((doc) => ({
      revision: doc._id,
      number: doc.number,
      content: doc.content,
      savedAt: doc.savedAt,
    }));
  }

  async _getRevision({ item, number }: { item: string; number: number }): Promise<Row[]> {
    const doc = await this.revisions.findOne({ item, number });
    return doc === null
      ? []
      : [{ revision: doc._id, number: doc.number, content: doc.content, savedAt: doc.savedAt }];
  }

  async _getLatest({ item }: { item: string }): Promise<Row[]> {
    const top = await this.revisions.find({ item }).sort({ number: -1 }).limit(1).toArray();
    return top.length === 0
      ? []
      : [
          {
            revision: top[0]._id,
            number: top[0].number,
            content: top[0].content,
            savedAt: top[0].savedAt,
          },
        ];
  }
}
