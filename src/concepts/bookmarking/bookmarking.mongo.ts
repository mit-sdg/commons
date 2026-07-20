import { BookmarkingConcept } from "./bookmarking.ts";
import type { Collection, Db } from "mongodb";
import { BookmarkAlreadyExists, BookmarkNotFound } from "./errors.ts";

interface BookmarkDoc {
  _id: string;
  user: string;
  item: string;
  savedAt: Date;
  seq: number;
}

export class MongoBookmarkingConcept {
  static readonly queries = BookmarkingConcept.queries;

  private readonly bookmarks: Collection<BookmarkDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.bookmarks = db.collection<BookmarkDoc>("bookmarking.bookmarks");
    this.counters = db.collection("bookmarking.counters");
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "bookmarks" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async save({ user, item, at }: { user: string; item: string; at: Date }) {
    const existing = await this.bookmarks.findOne({ user, item });
    if (existing !== null) {
      throw new BookmarkAlreadyExists(`${user} ${item}`);
    }
    const bookmark = crypto.randomUUID();
    const seq = await this.#nextSeq();
    await this.bookmarks.insertOne({ _id: bookmark, user, item, savedAt: at, seq });
    return { bookmark };
  }

  async unsave({ user, item }: { user: string; item: string }) {
    const removed = await this.bookmarks.findOneAndDelete({ user, item });
    if (removed === null) {
      throw new BookmarkNotFound(`${user} ${item}`);
    }
    return { bookmark: removed._id };
  }

  async clearItem({ item }: { item: string }) {
    await this.bookmarks.deleteMany({ item });
    return { item };
  }

  async _getSaved({ user }: { user: string }) {
    const docs = await this.bookmarks.find({ user }).sort({ savedAt: -1, seq: -1 }).toArray();
    return docs.map((doc) => ({ item: doc.item, savedAt: doc.savedAt }));
  }

  async _isSaved({ user, item }: { user: string; item: string }) {
    const doc = await this.bookmarks.findOne({ user, item });
    return { saved: doc !== null };
  }
}
