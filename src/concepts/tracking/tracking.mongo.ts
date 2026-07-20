import { TrackingConcept } from "./tracking.ts";
import type { Collection, Db } from "mongodb";
import { ItemAlreadyRegistered, ItemAlreadySeen, ItemNotRegistered } from "./errors.ts";

interface RegisteredDoc {
  _id: string;
  scope: string;
  seq: number;
}

interface SeenDoc {
  user: string;
  item: string;
}

export class MongoTrackingConcept {
  static readonly queries = TrackingConcept.queries;

  private readonly registered: Collection<RegisteredDoc>;
  private readonly seen: Collection<SeenDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.registered = db.collection<RegisteredDoc>("tracking.registered");
    this.seen = db.collection<SeenDoc>("tracking.seen");
    this.counters = db.collection("tracking.counters");
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "registered" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async register({ item, scope }: { item: string; scope: string }) {
    const existing = await this.registered.findOne({ _id: item });
    if (existing !== null) {
      throw new ItemAlreadyRegistered(`${item} is already tracked`);
    }
    const seq = await this.#nextSeq();
    await this.registered.insertOne({ _id: item, scope, seq });
    return { item };
  }

  async unregister({ item }: { item: string }) {
    await this.registered.deleteOne({ _id: item });
    await this.seen.deleteMany({ item });
    return { item };
  }

  async markSeen({ user, item }: { user: string; item: string }) {
    const doc = await this.registered.findOne({ _id: item });
    if (doc === null) {
      throw new ItemNotRegistered(`${item} is not tracked`);
    }
    const already = await this.seen.findOne({ user, item });
    if (already !== null) {
      throw new ItemAlreadySeen(`${user} ${item}`);
    }
    await this.seen.insertOne({ user, item });
    return { item };
  }

  async markAllSeen({ user, scope }: { user: string; scope: string }) {
    const docs = await this.registered.find({ scope }).sort({ seq: 1 }).toArray();
    for (const doc of docs) {
      const already = await this.seen.findOne({ user, item: doc._id });
      if (already === null) {
        await this.seen.insertOne({ user, item: doc._id });
      }
    }
    return { user };
  }

  async _inScope({ scope }: { scope: string }) {
    const docs = await this.registered.find({ scope }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ item: doc._id }));
  }

  async _getUnread({ user, scope }: { user: string; scope: string }) {
    const docs = await this.registered.find({ scope }).sort({ seq: 1 }).toArray();
    const rows: { item: string }[] = [];
    for (const doc of docs) {
      const seen = await this.seen.findOne({ user, item: doc._id });
      if (seen === null) rows.push({ item: doc._id });
    }
    return rows;
  }

  async _getUnreadCount({ user, scope }: { user: string; scope: string }) {
    const unread = await this._getUnread({ user, scope });
    return { count: unread.length };
  }
}
