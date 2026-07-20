import type { Collection, Db } from "mongodb";
import { ItemAlreadyPinned, ItemNotPinned } from "./errors.ts";

interface PinDoc {
  _id: string;
  item: string;
  scope: string;
  priority: number;
  pinnedAt: Date;
  seq: number;
}

export class MongoPinningConcept {
  private readonly pins: Collection<PinDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.pins = db.collection<PinDoc>("pinning.pins");
    this.counters = db.collection("pinning.counters");
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "pins" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async pin({
    item,
    scope,
    priority,
    at,
  }: {
    item: string;
    scope: string;
    priority: number;
    at: Date;
  }) {
    const existing = await this.pins.findOne({ item, scope });
    if (existing !== null) {
      throw new ItemAlreadyPinned(`${item} ${scope}`);
    }
    const pin = crypto.randomUUID();
    const seq = await this.#nextSeq();
    await this.pins.insertOne({ _id: pin, item, scope, priority, pinnedAt: at, seq });
    return { pin };
  }

  async unpin({ item, scope }: { item: string; scope: string }) {
    const doc = await this.pins.findOne({ item, scope });
    if (doc === null) {
      throw new ItemNotPinned(`${item} ${scope}`);
    }
    await this.pins.deleteOne({ _id: doc._id });
    return { pin: doc._id };
  }

  async setPriority({ item, scope, priority }: { item: string; scope: string; priority: number }) {
    const doc = await this.pins.findOne({ item, scope });
    if (doc === null) {
      throw new ItemNotPinned(`${item} ${scope}`);
    }
    await this.pins.updateOne({ _id: doc._id }, { $set: { priority } });
    return { pin: doc._id };
  }

  async clearItem({ item }: { item: string }) {
    await this.pins.deleteMany({ item });
    return { item };
  }

  async _getPinned({ scope }: { scope: string }) {
    const docs = await this.pins.find({ scope }).sort({ priority: -1, seq: -1 }).toArray();
    return docs.map((doc) => ({ item: doc.item, priority: doc.priority }));
  }

  async _isPinned({ item, scope }: { item: string; scope: string }) {
    const doc = await this.pins.findOne({ item, scope });
    return { pinned: doc !== null };
  }
}
