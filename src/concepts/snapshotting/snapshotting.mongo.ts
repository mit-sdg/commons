import type { Collection, Db } from "mongodb";
import { SnapshotExists } from "./errors.ts";

interface SnapshotDoc {
  _id: string;
  subject: string;
  value: unknown;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11_000;
}

export class MongoSnapshottingConcept {
  private readonly snapshots: Collection<SnapshotDoc>;
  private indexes: Promise<string[]> | undefined;

  constructor(db: Db) {
    this.snapshots = db.collection<SnapshotDoc>("snapshotting.snapshots");
  }

  async #ready(): Promise<void> {
    await (this.indexes ??= this.snapshots.createIndexes([
      { key: { subject: 1 }, name: "subject_1", unique: true },
    ]));
  }

  async capture({ subject, value }: { subject: string; value: unknown }) {
    await this.#ready();
    const snapshot = crypto.randomUUID();
    try {
      await this.snapshots.insertOne({ _id: snapshot, subject, value });
      return { snapshot };
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new SnapshotExists("This subject already has a snapshot.");
      }
      throw error;
    }
  }

  async _snapshot({ subject }: { subject: string }) {
    await this.#ready();
    const doc = await this.snapshots.findOne({ subject });
    return doc === null ? [] : [{ snapshot: doc._id, value: doc.value }];
  }
}
