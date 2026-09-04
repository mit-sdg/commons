import type { Collection, Db } from "mongodb";
import { ItemAlreadyTrashed, ItemNotTrashed } from "./errors.ts";

interface TrashDoc {
  _id: string;
  by: string;
  at: Date;
}

export class MongoTrashingConcept {
  private readonly trashed: Collection<TrashDoc>;

  constructor(db: Db, instance = "Trashing") {
    const prefix = `${instance[0]?.toLowerCase() ?? ""}${instance.slice(1)}`;
    this.trashed = db.collection<TrashDoc>(`${prefix}.items`);
  }

  async trash({ item, by, at }: { item: string; by: string; at: Date }) {
    const existing = await this.trashed.findOne({ _id: item });
    if (existing !== null) {
      throw new ItemAlreadyTrashed(`${item} is already trashed`);
    }
    await this.trashed.insertOne({ _id: item, by, at });
    return { item };
  }

  async restore({ item }: { item: string }) {
    const deleted = await this.trashed.deleteOne({ _id: item });
    if (deleted.deletedCount === 0) {
      throw new ItemNotTrashed(`${item} is not trashed`);
    }
    return { item };
  }

  async purge({ item }: { item: string }) {
    const deleted = await this.trashed.deleteOne({ _id: item });
    if (deleted.deletedCount === 0) {
      throw new ItemNotTrashed(`${item} is not trashed`);
    }
    return { item };
  }

  async _isTrashed({ item }: { item: string }) {
    const doc = await this.trashed.findOne({ _id: item });
    return { trashed: doc !== null };
  }

  async _getTrashed(_: Record<string, never>) {
    const docs = await this.trashed.find({}).toArray();
    return docs.map((doc) => ({ item: doc._id, trashedBy: doc.by, trashedAt: doc.at }));
  }

  /** The same items `_getTrashed` gives, handed over as one value. */
  async _trashedItems(_: Record<string, never>) {
    const docs = await this.trashed.find({}, { projection: { _id: 1 } }).toArray();
    return { items: docs.map((doc) => doc._id) };
  }
}
