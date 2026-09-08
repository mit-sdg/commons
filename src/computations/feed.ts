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
