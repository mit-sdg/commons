import type { Collection, Db } from "mongodb";
import { PostNotFound } from "./errors.ts";

interface PostDoc {
  _id: string;
  author: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  seq: number;
}

export class MongoPostingConcept {
  private readonly posts: Collection<PostDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.posts = db.collection<PostDoc>("posting.posts");
    this.counters = db.collection("posting.counters");
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "posts" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async create({ author, content, at }: { author: string; content: string; at: Date }) {
    const post = crypto.randomUUID();
    const seq = await this.#nextSeq();
    await this.posts.insertOne({
      _id: post,
      author,
      content,
      createdAt: at,
      editedAt: null,
      seq,
    });
    return { post };
  }

  async edit({ post, content, at }: { post: string; content: string; at: Date }) {
    const updated = await this.posts.updateOne({ _id: post }, { $set: { content, editedAt: at } });
    if (updated.matchedCount === 0) {
      throw new PostNotFound(`No post named ${post}`);
    }
    return { post };
  }

  async delete({ post }: { post: string }) {
    const deleted = await this.posts.deleteOne({ _id: post });
    if (deleted.deletedCount === 0) {
      throw new PostNotFound(`No post named ${post}`);
    }
    return { post };
  }

  async _getPost({ post }: { post: string }) {
    const doc = await this.posts.findOne({ _id: post });
    return doc === null
      ? []
      : [
          {
            author: doc.author,
            content: doc.content,
            createdAt: doc.createdAt,
            editedAt: doc.editedAt,
          },
        ];
  }

  async _getByAuthor({ author }: { author: string }) {
    const docs = await this.posts.find({ author }).sort({ createdAt: -1, seq: -1 }).toArray();
    return docs.map((doc) => ({ post: doc._id }));
  }

  async _getMentions({ post }: { post: string }) {
    const doc = await this.posts.findOne({ _id: post });
    if (doc === null) return [];
    const found = [...doc.content.matchAll(/@([a-zA-Z0-9_]+)/g)].map((match) => match[1]);
    return [...new Set(found)].map((handle) => ({ handle }));
  }

  async _isMentioned({ post, handle }: { post: string; handle: string }) {
    const doc = await this.posts.findOne({ _id: post });
    const mentioned =
      doc !== null &&
      [...doc.content.matchAll(/@([a-zA-Z0-9_]+)/g)].some((match) => match[1] === handle);
    return { mentioned };
  }
}
