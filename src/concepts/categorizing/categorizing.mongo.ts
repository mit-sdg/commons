import type { Collection, Db } from "mongodb";
import {
  CategoryAlreadyExists,
  CategoryNotFound,
  DifferentScopes,
  ItemNotCategorized,
  SameCategory,
} from "./errors.ts";

interface CategoryDoc {
  _id: string;
  scope: string;
  name: string;
  description: string;
  /** Creation order; absent only on categories stored before scopes existed. */
  seq?: number;
}

interface MembershipDoc {
  _id: string;
  category: string;
  /** Assignment order; absent only on memberships stored before scopes existed. */
  seq?: number;
}

export class MongoCategorizingConcept {
  private readonly categories: Collection<CategoryDoc>;
  private readonly memberships: Collection<MembershipDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db, instance = "Categorizing") {
    const prefix = `${instance[0]?.toLowerCase() ?? ""}${instance.slice(1)}`;
    this.categories = db.collection<CategoryDoc>(`${prefix}.categories`);
    this.memberships = db.collection<MembershipDoc>(`${prefix}.memberships`);
    this.counters = db.collection(`${prefix}.counters`);
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async createCategory({
    scope,
    name,
    description,
  }: {
    scope: string;
    name: string;
    description: string;
  }) {
    const clash = await this.categories.findOne({ scope, name });
    if (clash !== null) {
      throw new CategoryAlreadyExists(name);
    }
    return { category: await this.#add({ scope, name, description }) };
  }

  async ensureCategory({
    scope,
    name,
    description,
  }: {
    scope: string;
    name: string;
    description: string;
  }) {
    const existing = await this.categories.findOne({ scope, name });
    if (existing !== null) return { category: existing._id };
    return { category: await this.#add({ scope, name, description }) };
  }

  async #add({
    scope,
    name,
    description,
  }: {
    scope: string;
    name: string;
    description: string;
  }): Promise<string> {
    const category = crypto.randomUUID();
    const seq = await this.#nextSeq("categories");
    await this.categories.insertOne({ _id: category, scope, name, description, seq });
    return category;
  }

  async renameCategory({ category, name }: { category: string; name: string }) {
    const doc = await this.categories.findOne({ _id: category });
    if (doc === null) {
      throw new CategoryNotFound(category);
    }
    // A name is unique within its own scope; the same name in another scope
    // names another category and is no clash at all.
    const clash = await this.categories.findOne({ scope: doc.scope, name, _id: { $ne: category } });
    if (clash !== null) {
      throw new CategoryAlreadyExists(name);
    }
    await this.categories.updateOne({ _id: category }, { $set: { name } });
    return { category };
  }

  async describeCategory({ category, description }: { category: string; description: string }) {
    const doc = await this.categories.findOne({ _id: category });
    if (doc === null) {
      throw new CategoryNotFound(category);
    }
    await this.categories.updateOne({ _id: category }, { $set: { description } });
    return { category };
  }

  async mergeCategory({ category, into }: { category: string; into: string }) {
    const source = await this.categories.findOne({ _id: category });
    const target = await this.categories.findOne({ _id: into });
    if (source === null || target === null) {
      throw new CategoryNotFound(source === null ? category : into);
    }
    if (source._id === target._id) {
      throw new SameCategory("A category cannot be merged into itself.");
    }
    if (source.scope !== target.scope) {
      throw new DifferentScopes("These categories are not in the same scope.");
    }
    // Every item keeps its assignment order, so the merged items take their
    // place among the target's by when each was assigned.
    await this.memberships.updateMany({ category }, { $set: { category: into } });
    await this.categories.deleteOne({ _id: category });
    return { into };
  }

  async assign({ item, category }: { item: string; category: string }) {
    const home = await this.categories.findOne({ _id: category });
    if (home === null) {
      throw new CategoryNotFound(category);
    }
    const existing = await this.memberships.findOne({ _id: item });
    // Assigning an item to the category it already has changes nothing, and in
    // particular does not move it to the end of that category's items.
    if (existing !== null && existing.category === category) return { item };
    const seq = await this.#nextSeq("memberships");
    await this.memberships.updateOne({ _id: item }, { $set: { category, seq } }, { upsert: true });
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

  async _getCategoryDetail({ category }: { category: string }) {
    const doc = await this.categories.findOne({ _id: category });
    return doc === null ? [] : [{ scope: doc.scope, name: doc.name, description: doc.description }];
  }

  async _getHome({ item }: { item: string }) {
    return (await this._getCategory({ item })).map((row) => ({ home: row }));
  }

  async _getItems({ category }: { category: string }) {
    const docs = await this.memberships.find({ category }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ item: doc._id }));
  }

  async _categoriesIn({ scope }: { scope: string }) {
    const docs = await this.categories.find({ scope }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ category: doc._id, name: doc.name, description: doc.description }));
  }

  async _categoriesWithItems({ scope }: { scope: string }) {
    const docs = await this.categories.find({ scope }).sort({ seq: 1 }).toArray();
    if (docs.length === 0) return { categories: [] };
    const memberships = await this.memberships
      .find({ category: { $in: docs.map((doc) => doc._id) } })
      .sort({ seq: 1 })
      .toArray();
    const items = new Map<string, string[]>();
    for (const membership of memberships) {
      const held = items.get(membership.category);
      if (held === undefined) items.set(membership.category, [membership._id]);
      else held.push(membership._id);
    }
    return {
      categories: docs.map((doc) => ({
        category: doc._id,
        name: doc.name,
        description: doc.description,
        items: items.get(doc._id) ?? [],
      })),
    };
  }
}
