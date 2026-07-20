import type { Collection, Db } from "mongodb";
import { FlagAlreadyExists, FlagNotFound, OutcomeInvalid } from "./errors.ts";

interface FlagDoc {
  _id: string;
  reporter: string;
  target: string;
  reason: string;
  createdAt: Date;
  status: "open" | "upheld" | "dismissed";
  seq: number;
}

export class MongoFlaggingConcept {
  private readonly flags: Collection<FlagDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.flags = db.collection<FlagDoc>("flagging.flags");
    this.counters = db.collection("flagging.counters");
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "flags" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async flag({
    reporter,
    target,
    reason,
    at,
  }: {
    reporter: string;
    target: string;
    reason: string;
    at: Date;
  }) {
    const existing = await this.flags.findOne({ reporter, target, status: "open" });
    if (existing !== null) {
      throw new FlagAlreadyExists(`${reporter} already has an open flag on ${target}`);
    }
    const flag = crypto.randomUUID();
    const seq = await this.#nextSeq();
    await this.flags.insertOne({
      _id: flag,
      reporter,
      target,
      reason,
      createdAt: at,
      status: "open",
      seq,
    });
    return { flag };
  }

  async resolve({ target, outcome }: { target: string; outcome: string }) {
    if (outcome !== "upheld" && outcome !== "dismissed") {
      throw new OutcomeInvalid('Outcome must be "upheld" or "dismissed".');
    }
    const updated = await this.flags.updateMany(
      { target, status: "open" },
      { $set: { status: outcome } },
    );
    if (updated.matchedCount === 0) {
      throw new FlagNotFound(`No open flag on ${target}`);
    }
    return { target };
  }

  async clearTarget({ target }: { target: string }) {
    await this.flags.deleteMany({ target });
    return { target };
  }

  async _getOpenTargets(_: Record<string, never>) {
    const docs = await this.flags.find({ status: "open" }).sort({ seq: 1 }).toArray();
    const counts = new Map<string, number>();
    for (const doc of docs) {
      counts.set(doc.target, (counts.get(doc.target) ?? 0) + 1);
    }
    return [...counts]
      .map(([target, count]) => ({ target, count }))
      .sort((a, b) => b.count - a.count);
  }

  async _getFlags({ target }: { target: string }) {
    const docs = await this.flags.find({ target }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      flag: doc._id,
      reporter: doc.reporter,
      reason: doc.reason,
      status: doc.status,
      createdAt: doc.createdAt,
    }));
  }
}
