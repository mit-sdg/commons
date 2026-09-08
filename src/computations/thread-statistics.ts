type Node = { node: string; item: string; parent: string | null; depth: number };
type Post = { post: string; author: string; createdAt: Date };
type Visible = Node & { author: string; createdAt: Date };
export function threadPostIds({ nodes }: { nodes: Node[] }): string[] {
  return nodes.map((n) => n.item);
}
export function visibleThreadPosts({
  nodes,
  posts,
  trashed,
}: {
  nodes: Node[] | null;
  posts: Post[] | null;
  trashed: string[] | null;
}): Visible[] {
  if (!Array.isArray(nodes) || !Array.isArray(posts) || !Array.isArray(trashed)) return [];
  const byPost = new Map(posts.map((p) => [p.post, p]));
  const unavailable = new Set(trashed);
  return nodes.flatMap((n) => {
    const p = byPost.get(n.item);
    return p && !unavailable.has(n.item)
      ? [{ ...n, author: p.author, createdAt: p.createdAt }]
      : [];
  });
}
export function threadReplyCount({ posts }: { posts: Visible[] }): number {
  return posts.filter((p) => p.parent !== null).length;
}
export function threadLastActivity({ posts }: { posts: Visible[] }): Date | null {
  return posts.reduce<Date | null>(
    (latest, p) => (latest === null || p.createdAt > latest ? p.createdAt : latest),
    null,
  );
}
export function threadParticipants({ posts }: { posts: Visible[] }): string[] {
  return [...new Set(posts.map((p) => p.author))];
}

export function hasStoredPosts({ posts }: { posts: Post[] }): boolean {
  return posts.length > 0;
}
