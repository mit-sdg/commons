import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import { BookmarkAlreadyExists, BookmarkNotFound } from "./errors.ts";

const freshID = () => crypto.randomUUID();

interface BookmarkDoc {
  user: string;
  item: string;
  savedAt: Date;
}

export class BookmarkingConcept {
  static readonly queries = {
    _getSaved: "many",
    _isSaved: "one",
  } as const satisfies Record<string, QueryPromise>;

  private readonly bookmarks = new Map<string, BookmarkDoc>();

  #findKey(user: string, item: string): string | undefined {
    for (const [bookmark, doc] of this.bookmarks) {
      if (doc.user === user && doc.item === item) return bookmark;
    }
    return undefined;
  }

  save({ user, item, at }: { user: string; item: string; at: Date }) {
    if (this.#findKey(user, item) !== undefined) {
      throw new BookmarkAlreadyExists(`${user} ${item}`);
    }
    const bookmark = freshID();
    this.bookmarks.set(bookmark, { user, item, savedAt: at });
    return { bookmark };
  }

  unsave({ user, item }: { user: string; item: string }) {
    const bookmark = this.#findKey(user, item);
    if (bookmark === undefined) {
      throw new BookmarkNotFound(`${user} ${item}`);
    }
    this.bookmarks.delete(bookmark);
    return { bookmark };
  }

  clearItem({ item }: { item: string }) {
    for (const [bookmark, doc] of this.bookmarks) {
      if (doc.item === item) this.bookmarks.delete(bookmark);
    }
    return { item };
  }

  _getSaved({ user }: { user: string }): { item: string; savedAt: Date }[] {
    const rows: { item: string; savedAt: Date }[] = [];
    for (const doc of this.bookmarks.values()) {
      if (doc.user === user) rows.push({ item: doc.item, savedAt: doc.savedAt });
    }
    rows.reverse();
    rows.sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
    return rows;
  }

  _isSaved({ user, item }: { user: string; item: string }): { saved: boolean } {
    return { saved: this.#findKey(user, item) !== undefined };
  }
}
