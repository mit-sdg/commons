import type { Collection, Db } from "mongodb";
import { AlreadyClosed, EditionNotFound, MaterialAlreadyShared } from "./errors.ts";

interface EditionDoc {
  _id: string;
  author: string;
  material: string;
  openedAt: Date;
  closedAt: Date | null;
  open: boolean;
  seq: number;
}

export class MongoPublishingConcept {
  private readonly editions: Collection<EditionDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  // One Publishing instance serves the supported backend/database. Order
  // membership changes together so two publishers cannot both find no edition.
  // This is process-local ordering, not a transaction across compositions.
  private writing: Promise<void> = Promise.resolve();

  #write<Result>(action: () => Promise<Result>): Promise<Result> {
    const result = this.writing.then(action);
    this.writing = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  constructor(db: Db) {
    this.editions = db.collection<EditionDoc>("publishing.editions");
    this.counters = db.collection("publishing.counters");
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "editions" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async publish({ author, material, at }: { author: string; material: string; at: Date }) {
    return this.#write(async () => {
      const standing = await this.editions.findOne({ material, open: true });
      if (standing !== null) {
        throw new MaterialAlreadyShared("This is already running; close the open run first.");
      }
      const edition = crypto.randomUUID();
      const seq = await this.#nextSeq();
      await this.editions.insertOne({
        _id: edition,
        author,
        material,
        openedAt: at,
        closedAt: null,
        open: true,
        seq,
      });
      return { edition };
    });
  }

  async close({ edition, at }: { edition: string; at: Date }) {
    return this.#write(async () => {
      const doc = await this.editions.findOne({ _id: edition });
      if (doc === null) {
        throw new EditionNotFound("There is no such edition.");
      }
      if (!doc.open) {
        throw new AlreadyClosed("This edition is already closed.");
      }
      await this.editions.updateOne({ _id: edition }, { $set: { open: false, closedAt: at } });
      return { edition };
    });
  }

  async _edition({ edition }: { edition: string }) {
    const doc = await this.editions.findOne({ _id: edition });
    return doc === null
      ? []
      : [
          {
            author: doc.author,
            material: doc.material,
            open: doc.open,
            openedAt: doc.openedAt,
            closedAt: doc.closedAt,
          },
        ];
  }

  async _hasOpenEditionFor({ material }: { material: string }) {
    const doc = await this.editions.findOne({ material, open: true });
    return { open: doc !== null };
  }

  async _editionsFor({ material }: { material: string }) {
    const docs = await this.editions.find({ material }).sort({ openedAt: -1, seq: -1 }).toArray();
    return docs.map((doc) => ({
      edition: doc._id,
      open: doc.open,
      openedAt: doc.openedAt,
      closedAt: doc.closedAt,
    }));
  }

  async _openEditions() {
    const docs = await this.editions.find({ open: true }).sort({ openedAt: -1, seq: -1 }).toArray();
    return docs.map((doc) => ({
      edition: doc._id,
      author: doc.author,
      material: doc.material,
      openedAt: doc.openedAt,
    }));
  }
}
