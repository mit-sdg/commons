import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import { CategoryAlreadyExists, CategoryNotFound, ItemNotCategorized } from "./errors.ts";

const freshID = () => crypto.randomUUID();

interface CategoryDoc {
  name: string;
  description: string;
}

export class CategorizingConcept {
  static readonly queries = {
    _getCategory: "optional",
    _getHome: "optional",
    _getItems: "many",
    _getAllCategories: "many",
  } as const satisfies Record<string, QueryPromise>;

  private readonly categories = new Map<string, CategoryDoc>();
  private readonly memberships = new Map<string, string>();

  createCategory({ name, description }: { name: string; description: string }) {
    for (const doc of this.categories.values()) {
      if (doc.name === name) {
        throw new CategoryAlreadyExists(name);
      }
    }
    const category = freshID();
    this.categories.set(category, { name, description });
    return { category };
  }

  assign({ item, category }: { item: string; category: string }) {
    if (!this.categories.has(category)) {
      throw new CategoryNotFound(category);
    }
    this.memberships.set(item, category);
    return { item };
  }

  unassign({ item }: { item: string }) {
    if (!this.memberships.has(item)) {
      throw new ItemNotCategorized(item);
    }
    this.memberships.delete(item);
    return { item };
  }

  deleteCategory({ category }: { category: string }) {
    if (!this.categories.has(category)) {
      throw new CategoryNotFound(category);
    }
    for (const [item, home] of this.memberships) {
      if (home === category) this.memberships.delete(item);
    }
    this.categories.delete(category);
    return { category };
  }

  _getCategory({ item }: { item: string }): {
    category: string;
    name: string;
    description: string;
  }[] {
    const category = this.memberships.get(item);
    if (category === undefined) return [];
    const doc = this.categories.get(category);
    return doc === undefined ? [] : [{ category, name: doc.name, description: doc.description }];
  }

  _getHome({ item }: { item: string }): {
    home: { category: string; name: string; description: string };
  }[] {
    return this._getCategory({ item }).map((row) => ({ home: row }));
  }

  _getItems({ category }: { category: string }): { item: string }[] {
    return [...this.memberships.entries()]
      .filter(([, home]) => home === category)
      .map(([item]) => ({ item }));
  }

  _getAllCategories(
    _: Record<string, never>,
  ): { category: string; name: string; description: string }[] {
    return [...this.categories.entries()].map(([category, doc]) => ({
      category,
      name: doc.name,
      description: doc.description,
    }));
  }
}
