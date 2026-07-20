import { LockingConcept } from "./locking.ts";
import type { Collection, Db } from "mongodb";
import { TargetAlreadyLocked, TargetNotLocked } from "./errors.ts";

interface LockDoc {
  _id: string;
  lockedAt: Date;
}

export class MongoLockingConcept {
  static readonly queries = LockingConcept.queries;

  private readonly locked: Collection<LockDoc>;

  constructor(db: Db) {
    this.locked = db.collection<LockDoc>("locking.locks");
  }

  async lock({ target, at }: { target: string; at: Date }) {
    const existing = await this.locked.findOne({ _id: target });
    if (existing !== null) {
      throw new TargetAlreadyLocked(`${target} is already locked`);
    }
    await this.locked.insertOne({ _id: target, lockedAt: at });
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
