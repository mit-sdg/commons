import type { Collection, Db } from "mongodb";
import { TargetAlreadyLocked, TargetNotLocked } from "./errors.ts";

interface LockDoc {
  _id: string;
  lockedAt: Date;
}

const DUPLICATE_KEY = 11000;

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}

export class MongoLockingConcept {
  private readonly locked: Collection<LockDoc>;

  constructor(db: Db) {
    this.locked = db.collection<LockDoc>("locking.locks");
  }

  async lock({ target, at }: { target: string; at: Date }) {
    try {
      await this.locked.insertOne({ _id: target, lockedAt: at });
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new TargetAlreadyLocked(`${target} is already locked`);
      }
      throw error;
    }
    return { target };
  }

  async unlock({ target }: { target: string }) {
    const deleted = await this.locked.deleteOne({ _id: target });
    if (deleted.deletedCount === 0) {
      throw new TargetNotLocked(`${target} is not locked`);
    }
    return { target };
  }

  async _isLocked({ target }: { target: string }) {
    const doc = await this.locked.findOne({ _id: target });
    return { locked: doc !== null };
  }

  async _getLocked(_: Record<string, never>) {
    const docs = await this.locked.find({}).toArray();
    return docs.map((doc) => ({ target: doc._id, lockedAt: doc.lockedAt }));
  }
}
