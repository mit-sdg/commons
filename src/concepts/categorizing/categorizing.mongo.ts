import { CategorizingConcept } from "./categorizing.ts";
import type { Collection, Db } from "mongodb";
import { CategoryAlreadyExists, CategoryNotFound, ItemNotCategorized } from "./errors.ts";

interface CategoryDoc {
  _id: string;
  name: string;
  description: string;
}

interface MembershipDoc {
  _id: string;
  category: string;
}

export class MongoCategorizingConcept {
  static readonly queries = CategorizingConcept.queries;

  private readonly categories: Collection<CategoryDoc>;
  private readonly memberships: Collection<MembershipDoc>;

  constructor(db: Db) {
    this.categories = db.collection<CategoryDoc>("categorizing.categories");
    this.memberships = db.collection<MembershipDoc>("categorizing.memberships");
  }

  async createCategory({ name, description }: { name: string; description: string }) {
    const clash = await this.categories.findOne({ name });
    if (clash !== null) {
      throw new CategoryAlreadyExists(name);
    }
    const category = crypto.randomUUID();
    await this.categories.insertOne({ _id: category, name, description });
    return { category };
  }

  async assign({ item, category }: { item: string; category: string }) {
    const home = await this.categories.findOne({ _id: category });
    if (home === null) {
      throw new CategoryNotFound(category);
    }
    await this.memberships.updateOne({ _id: item }, { $set: { category } }, { upsert: true });
    return { item };
  }

  async unassign({ item }: { item: string }) {
    const removed = await this.memberships.deleteOne({ _id: item });
    if (removed.deletedCount === 0) {
      throw new ItemNotCategorized(item);
    }
    return { item };
  }

  async deleteCategory({ category }: { category: string }) {
    const removed = await this.categories.deleteOne({ _id: category });
    if (removed.deletedCount === 0) {
      throw new CategoryNotFound(category);
    }
    await this.memberships.deleteMany({ category });
    return { category };
  }

  async _getCategory({ item }: { item: string }) {
    const membership = await this.memberships.findOne({ _id: item });
    if (membership === null) return [];
    const doc = await this.categories.findOne({ _id: membership.category });
    return doc === null
      ? []
      : [{ category: doc._id, name: doc.name, description: doc.description }];
  }

  async _getHome({ item }: { item: string }) {
    return (await this._getCategory({ item })).map((row) => ({ home: row }));
  }

  async _getItems({ category }: { category: string }) {
    const docs = await this.memberships.find({ category }).toArray();
    return docs.map((doc) => ({ item: doc._id }));
  }

  async _getAllCategories(_: Record<string, never>) {
    const docs = await this.categories.find({}).toArray();
    return docs.map((doc) => ({ category: doc._id, name: doc.name, description: doc.description }));
  }
}
