import type { Collection, Db } from "mongodb";
import { speedIndexes } from "../indexes.ts";
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

/** The item of each row, or a refusal to guess when the rows are malformed. */
function itemsOf(rows: unknown): string[] {
  if (!Array.isArray(rows)) throw new TypeError("markEachSeen: items must be a list of rows.");
  return rows.map((row: unknown) => {
    const item = (row as { item?: unknown } | null)?.item;
    if (typeof item !== "string") throw new TypeError("markEachSeen: every row needs an item.");
    return item;
  });
}

export class MongoTrackingConcept {
  private readonly registered: Collection<RegisteredDoc>;
  private readonly seen: Collection<SeenDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;
  readonly #ready: () => Promise<void>;

  constructor(db: Db) {
    this.registered = db.collection<RegisteredDoc>("tracking.registered");
    this.seen = db.collection<SeenDoc>("tracking.seen");
    this.counters = db.collection("tracking.counters");
    this.#ready = speedIndexes("Tracking", () =>
      Promise.all([
        this.registered.createIndex({ scope: 1, seq: 1 }),
        this.seen.createIndex({ user: 1, item: 1 }),
      ]),
    );
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
    await this.#ready();
    const existing = await this.registered.findOne({ _id: item });
    if (existing !== null) {
      throw new ItemAlreadyRegistered(`${item} is already tracked`);
    }
    const seq = await this.#nextSeq();
    await this.registered.insertOne({ _id: item, scope, seq });
    return { item };
  }

  async unregister({ item }: { item: string }) {
    await this.#ready();
    await this.registered.deleteOne({ _id: item });
    await this.seen.deleteMany({ item });
    return { item };
  }

  async markSeen({ user, item }: { user: string; item: string }) {
    await this.#ready();
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
    await this.#ready();
    const docs = await this.registered.find({ scope }).sort({ seq: 1 }).toArray();
    for (const doc of docs) {
      const already = await this.seen.findOne({ user, item: doc._id });
      if (already === null) {
        await this.seen.insertOne({ user, item: doc._id });
      }
    }
    return { user };
  }

  /**
   * Mark every listed item seen at once; unregistered and already seen items
   * are skipped. `items` is typed loosely because compositions pass a former,
   * which the engine's types do not yet accept for a typed list.
   */
  async markEachSeen({ user, items }: { user: string; items: unknown }) {
    const wanted = [...new Set(itemsOf(items))];
    if (wanted.length === 0) return { user };
    const registered = await this.registered
      .find({ _id: { $in: wanted } }, { projection: { _id: 1 } })
      .toArray();
    if (registered.length === 0) return { user };
    await this.seen.bulkWrite(
      registered.map(({ _id: item }) => ({
        updateOne: {
          filter: { user, item },
          update: { $setOnInsert: { user, item } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    return { user };
  }

  async _inScope({ scope }: { scope: string }) {
    await this.#ready();
    const docs = await this.registered.find({ scope }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ item: doc._id }));
  }

  async _getUnread({ user, scope }: { user: string; scope: string }) {
    await this.#ready();
    const docs = await this.registered.find({ scope }).sort({ seq: 1 }).toArray();
    if (docs.length === 0) return [];
    const marks = await this.seen
      .find(
        { user, item: { $in: docs.map((doc) => doc._id) } },
        { projection: { _id: 0, item: 1 } },
      )
      .toArray();
    const seen = new Set(marks.map((mark) => mark.item));
    return docs.filter((doc) => !seen.has(doc._id)).map((doc) => ({ item: doc._id }));
  }

  async _getUnreadCount({ user, scope }: { user: string; scope: string }) {
    const unread = await this._getUnread({ user, scope });
    return { count: unread.length };
  }
}
