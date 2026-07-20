import { ReactingConcept } from "./reacting.ts";
import type { Collection, Db } from "mongodb";
import { ReactionAlreadyExists, ReactionNotFound } from "./errors.ts";

interface ReactionDoc {
  _id: string;
  reactor: string;
  target: string;
  kind: string;
  reactedAt: Date;
  seq: number;
}

export class MongoReactingConcept {
  static readonly queries = ReactingConcept.queries;

  private readonly reactions: Collection<ReactionDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.reactions = db.collection<ReactionDoc>("reacting.reactions");
    this.counters = db.collection("reacting.counters");
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "reactions" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async react({
    reactor,
    target,
    kind,
    at,
  }: {
    reactor: string;
    target: string;
    kind: string;
    at: Date;
  }) {
    const existing = await this.reactions.findOne({ reactor, target, kind });
    if (existing !== null) {
      throw new ReactionAlreadyExists(`${reactor} ${kind} ${target}`);
    }
    const reaction = crypto.randomUUID();
    const seq = await this.#nextSeq();
    await this.reactions.insertOne({ _id: reaction, reactor, target, kind, reactedAt: at, seq });
    return { reaction };
  }

  async unreact({ reactor, target, kind }: { reactor: string; target: string; kind: string }) {
    const removed = await this.reactions.findOneAndDelete({ reactor, target, kind });
    if (removed === null) {
      throw new ReactionNotFound(`${reactor} ${kind} ${target}`);
    }
    return { reaction: removed._id };
  }

  async clearTarget({ target }: { target: string }) {
    await this.reactions.deleteMany({ target });
    return { target };
  }

  async _getReactionsForTarget({ target }: { target: string }) {
    const docs = await this.reactions.find({ target }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ reaction: doc._id, reactor: doc.reactor, kind: doc.kind }));
  }

  async _getReactionsByUser({ reactor }: { reactor: string }) {
    const docs = await this.reactions.find({ reactor }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ reaction: doc._id, target: doc.target, kind: doc.kind }));
  }

  async _countByKind({ target }: { target: string }) {
    const docs = await this.reactions.find({ target }).sort({ seq: 1 }).toArray();
    const counts = new Map<string, number>();
    for (const doc of docs) {
      counts.set(doc.kind, (counts.get(doc.kind) ?? 0) + 1);
    }
    return [...counts].map(([kind, count]) => ({ kind, count }));
  }

  async _hasReacted({ reactor, target, kind }: { reactor: string; target: string; kind: string }) {
    const doc = await this.reactions.findOne({ reactor, target, kind });
    return { hasReacted: doc !== null };
  }
}
