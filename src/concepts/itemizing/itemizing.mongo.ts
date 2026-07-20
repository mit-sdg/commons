import { ItemizingConcept } from "./itemizing.ts";
import type { Collection, Db } from "mongodb";
import { CriterionNotFound, GradeItemNotFound, ScoreOutOfRange } from "./errors.ts";

interface ItemDoc {
  _id: string;
  item: string;
  label: string;
  maxPoints: number;
  status: "ACTIVE" | "ARCHIVED";
  seq: number;
}

interface CriterionDoc {
  _id: string;
  item: string;
  name: string;
  maxPoints: number;
  position: number;
  seq: number;
}

export class MongoItemizingConcept {
  static readonly queries = ItemizingConcept.queries;

  private readonly items: Collection<ItemDoc>;
  private readonly criteria: Collection<CriterionDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.items = db.collection<ItemDoc>("itemizing.items");
    this.criteria = db.collection<CriterionDoc>("itemizing.criteria");
    this.counters = db.collection("itemizing.counters");
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  #activeItem(item: string): Promise<ItemDoc | null> {
    return this.items.findOne({ item, status: "ACTIVE" });
  }

  async configureItem({
    item,
    label,
    maxPoints,
  }: {
    item: string;
    label: string;
    maxPoints: number;
  }) {
    if (maxPoints < 0) {
      throw new ScoreOutOfRange(`maxPoints ${maxPoints}`);
    }
    const active = await this.#activeItem(item);
    if (active !== null) {
      await this.items.updateOne({ _id: active._id }, { $set: { label, maxPoints } });
      return { gradeItem: active._id };
    }
    const gradeItem = crypto.randomUUID();
    const seq = await this.#nextSeq("items");
    await this.items.insertOne({ _id: gradeItem, item, label, maxPoints, status: "ACTIVE", seq });
    return { gradeItem };
  }

  async ensureItem({ item, label, maxPoints }: { item: string; label: string; maxPoints: number }) {
    const active = await this.#activeItem(item);
    if (active !== null) return { gradeItem: active._id };
    const gradeItem = crypto.randomUUID();
    const seq = await this.#nextSeq("items");
    await this.items.insertOne({ _id: gradeItem, item, label, maxPoints, status: "ACTIVE", seq });
    return { gradeItem };
  }

  async archiveItem({ item }: { item: string }) {
    const active = await this.#activeItem(item);
    if (active === null) {
      throw new GradeItemNotFound(item);
    }
    await this.items.updateOne({ _id: active._id }, { $set: { status: "ARCHIVED" } });
    return { gradeItem: active._id };
  }

  async addCriterion({
    item,
    name,
    maxPoints,
    position,
  }: {
    item: string;
    name: string;
    maxPoints: number;
    position: number;
  }) {
    if ((await this.#activeItem(item)) === null) {
      throw new GradeItemNotFound(item);
    }
    const criterion = crypto.randomUUID();
    const seq = await this.#nextSeq("criteria");
    await this.criteria.insertOne({ _id: criterion, item, name, maxPoints, position, seq });
    return { criterion };
  }

  async reviseCriterion({
    criterion,
    name,
    maxPoints,
    position,
  }: {
    criterion: string;
    name: string;
    maxPoints: number;
    position: number;
  }) {
    const doc = await this.criteria.findOne({ _id: criterion });
    if (doc === null) {
      throw new CriterionNotFound(criterion);
    }
    await this.criteria.updateOne({ _id: criterion }, { $set: { name, maxPoints, position } });
    return { criterion };
  }

  async removeCriterion({ criterion }: { criterion: string }) {
    const deleted = await this.criteria.deleteOne({ _id: criterion });
    if (deleted.deletedCount === 0) {
      throw new CriterionNotFound(criterion);
    }
    return { criterion };
  }

  async _getItem({ item }: { item: string }) {
    const active = await this.#activeItem(item);
    if (active === null) return [];
    return [{ item, label: active.label, maxPoints: active.maxPoints, status: "ACTIVE" }];
  }

  async _getItems(_: Record<string, never>) {
    const docs = await this.items.find({ status: "ACTIVE" }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ item: doc.item, label: doc.label, maxPoints: doc.maxPoints }));
  }

  async _getCriteria({ item }: { item: string }) {
    const docs = await this.criteria.find({ item }).sort({ position: 1, seq: 1 }).toArray();
    return docs.map((doc) => ({
      criterion: doc._id,
      name: doc.name,
      maxPoints: doc.maxPoints,
      position: doc.position,
    }));
  }

  async _getCriterion({ criterion }: { criterion: string }) {
    const doc = await this.criteria.findOne({ _id: criterion });
    if (doc === null) return [];
    return [{ item: doc.item, name: doc.name, maxPoints: doc.maxPoints }];
  }
}
