import type { Collection, Db } from "mongodb";
import { CriterionNotFound, GradeItemNotFound, InvalidCriterion } from "./errors.ts";
interface Criterion {
  criterion: string;
  basis: string;
  position: number;
  active: boolean;
}
interface ItemDoc {
  _id: string;
  label: string;
  status: "ACTIVE" | "ARCHIVED";
  criteria: Criterion[];
}
export class MongoItemizingConcept {
  private readonly items: Collection<ItemDoc>;
  constructor(db: Db) {
    this.items = db.collection("itemizing.assessmentItems");
  }
  async configureItem({ item, label }: { item: string; label: string }) {
    await this.items.updateOne(
      { _id: item },
      { $set: { label, status: "ACTIVE" }, $setOnInsert: { criteria: [] } },
      { upsert: true },
    );
    return { gradeItem: item };
  }
  async ensureItem({ item, label }: { item: string; label: string }) {
    await this.items.updateOne(
      { _id: item },
      { $setOnInsert: { label, status: "ACTIVE", criteria: [] } },
      { upsert: true },
    );
    return { gradeItem: item };
  }
  async archiveItem({ item }: { item: string }) {
    const result = await this.items.updateOne(
      { _id: item, status: "ACTIVE" },
      { $set: { status: "ARCHIVED" } },
    );
    if (!result.modifiedCount) throw new GradeItemNotFound("There is no active item.");
    return { gradeItem: item };
  }
  async addCriterion({ item, basis, position }: { item: string; basis: string; position: number }) {
    if (!basis || !Number.isSafeInteger(position) || position < 0)
      throw new InvalidCriterion("Select a basis and a nonnegative integer position.");
    const criterion = crypto.randomUUID();
    const result = await this.items.updateOne(
      { _id: item, status: "ACTIVE", criteria: { $not: { $elemMatch: { basis, active: true } } } },
      { $push: { criteria: { criterion, basis, position, active: true } } },
    );
    if (!result.modifiedCount) {
      if (!(await this.items.findOne({ _id: item, status: "ACTIVE" })))
        throw new GradeItemNotFound("There is no active item.");
      throw new InvalidCriterion("That basis is already selected.");
    }
    return { criterion };
  }
  async reviseCriterion({ criterion, position }: { criterion: string; position: number }) {
    if (!Number.isSafeInteger(position) || position < 0)
      throw new InvalidCriterion("Use a nonnegative integer position.");
    const result = await this.items.updateOne(
      { status: "ACTIVE", criteria: { $elemMatch: { criterion, active: true } } },
      { $set: { "criteria.$.position": position } },
    );
    if (!result.matchedCount) throw new CriterionNotFound("There is no active criterion.");
    return { criterion };
  }
  async removeCriterion({ criterion }: { criterion: string }) {
    const result = await this.items.updateOne(
      { status: "ACTIVE", criteria: { $elemMatch: { criterion, active: true } } },
      { $set: { "criteria.$.active": false } },
    );
    if (!result.modifiedCount) throw new CriterionNotFound("There is no active criterion.");
    return { criterion };
  }
  async _getItem({ item }: { item: string }) {
    const doc = await this.items.findOne({ _id: item });
    return doc ? [{ item, label: doc.label, status: doc.status }] : [];
  }
  async _getItems() {
    return (await this.items.find({ status: "ACTIVE" }).sort({ label: 1 }).toArray()).map(
      (doc) => ({ item: doc._id, label: doc.label }),
    );
  }
  async _getSelection({ item }: { item: string }) {
    const doc = await this.items.findOne({ _id: item, status: "ACTIVE" });
    return doc
      ? [
          {
            criteria: doc.criteria
              .filter((c) => c.active)
              .sort((a, b) => a.position - b.position)
              .map((c) => ({ criterion: c.criterion })),
          },
        ]
      : [];
  }
  async _getCriteria({ item }: { item: string }) {
    const doc = await this.items.findOne({ _id: item });
    return (doc?.criteria ?? [])
      .filter((c) => c.active)
      .sort((a, b) => a.position - b.position)
      .map(({ criterion, basis, position }) => ({ criterion, basis, position }));
  }
  async _getCriterion({ criterion }: { criterion: string }) {
    const doc = await this.items.findOne({ "criteria.criterion": criterion });
    const entry = doc?.criteria.find((c) => c.criterion === criterion);
    return doc && entry
      ? [{ item: doc._id, basis: entry.basis, position: entry.position, active: entry.active }]
      : [];
  }
}
