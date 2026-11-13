import { bodyExcerpt, titleFromContent } from "../presentation/post-text.ts";

export function validFeedOrder({ order }: { order: "latest" | "activity" }): boolean {
  return order === "latest" || order === "activity";
}

export function validThreadSelection({ conversations }: { conversations: string[] }): boolean {
  return (
    Array.isArray(conversations) &&
    conversations.length <= 25 &&
    conversations.every((id) => typeof id === "string" && id.length > 0 && id.length <= 256)
  );
}

/** Search text is a short literal phrase of at least two characters besides surrounding space. */
export function validSearchText({ text }: { text: string }): boolean {
  return (
    typeof text === "string" &&
    text.trim().length >= 2 &&
    text.length <= 200 &&
    text.isWellFormed() &&
    !text.includes("\0")
  );
}

export function withoutTrashed({
  items,
  trashed,
}: {
  items: string[];
  trashed: string[];
}): string[] {
  const removed = new Set(trashed);
  return items.filter((item) => !removed.has(item));
}

export function metadataOpeningAuthor({
  item,
  posts,
}: {
  item: string;
  posts: { post: string; author: string }[];
}): string | null {
  return posts.find((post) => post.post === item)?.author ?? null;
}

export function postPreview({ content }: { content: string }): { title: string; excerpt: string } {
  return { title: titleFromContent(content), excerpt: bodyExcerpt(content) };
}
