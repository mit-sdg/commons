import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import { ItemAlreadyTrashed, ItemNotTrashed } from "./errors.ts";

export class TrashingConcept {
  static readonly queries = {
    _isTrashed: "one",
    _getTrashed: "many",
  } as const satisfies Record<string, QueryPromise>;

  private readonly trashed = new Map<string, { by: string; at: Date }>();

  trash({ item, by, at }: { item: string; by: string; at: Date }) {
    if (this.trashed.has(item)) {
      throw new ItemAlreadyTrashed(`${item} is already trashed`);
    }
    this.trashed.set(item, { by, at });
    return { item };
  }

  restore({ item }: { item: string }) {
    if (!this.trashed.has(item)) {
      throw new ItemNotTrashed(`${item} is not trashed`);
    }
    this.trashed.delete(item);
    return { item };
  }

  purge({ item }: { item: string }) {
    if (!this.trashed.has(item)) {
      throw new ItemNotTrashed(`${item} is not trashed`);
    }
    this.trashed.delete(item);
    return { item };
  }

  _isTrashed({ item }: { item: string }): { trashed: boolean } {
    return { trashed: this.trashed.has(item) };
  }

  _getTrashed(_: Record<string, never>): { item: string; trashedBy: string; trashedAt: Date }[] {
    return [...this.trashed.entries()].map(([item, doc]) => ({
      item,
      trashedBy: doc.by,
      trashedAt: doc.at,
    }));
  }
}
