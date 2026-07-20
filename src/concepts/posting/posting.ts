import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import { PostNotFound } from "./errors.ts";

const freshID = () => crypto.randomUUID();

interface PostDoc {
  author: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
}

export class PostingConcept {
  static readonly queries = {
    _getPost: "optional",
    _getByAuthor: "many",
    _getMentions: "many",
    _isMentioned: "one",
  } as const satisfies Record<string, QueryPromise>;

  private readonly posts = new Map<string, PostDoc>();

  create({ author, content, at }: { author: string; content: string; at: Date }) {
    const post = freshID();
    this.posts.set(post, { author, content, createdAt: at, editedAt: null });
    return { post };
  }

  edit({ post, content, at }: { post: string; content: string; at: Date }) {
    const doc = this.posts.get(post);
    if (doc === undefined) {
      throw new PostNotFound(`No post named ${post}`);
    }
    doc.content = content;
    doc.editedAt = at;
    return { post };
  }

  delete({ post }: { post: string }) {
    if (!this.posts.has(post)) {
      throw new PostNotFound(`No post named ${post}`);
    }
    this.posts.delete(post);
    return { post };
  }

  _getPost({ post }: { post: string }): PostDoc[] {
    const doc = this.posts.get(post);
    return doc === undefined ? [] : [{ ...doc }];
  }

  _getByAuthor({ author }: { author: string }): { post: string }[] {
    const rows: { post: string; createdAt: Date; seq: number }[] = [];
    let seq = 0;
    for (const [post, doc] of this.posts) {
      seq += 1;
      if (doc.author === author) rows.push({ post, createdAt: doc.createdAt, seq });
    }
    return rows
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.seq - a.seq)
      .map(({ post }) => ({ post }));
  }

  _getMentions({ post }: { post: string }): { handle: string }[] {
    const doc = this.posts.get(post);
    if (doc === undefined) return [];
    const found = [...doc.content.matchAll(/@([a-zA-Z0-9_]+)/g)].map((match) => match[1]);
    return [...new Set(found)].map((handle) => ({ handle }));
  }

  _isMentioned({ post, handle }: { post: string; handle: string }): { mentioned: boolean } {
    const doc = this.posts.get(post);
    const mentioned =
      doc !== undefined &&
      [...doc.content.matchAll(/@([a-zA-Z0-9_]+)/g)].some((match) => match[1] === handle);
    return { mentioned };
  }
}
