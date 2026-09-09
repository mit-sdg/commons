export function validPostControlSelection({ posts }: { posts: string[] }): boolean {
  return (
    Array.isArray(posts) &&
    posts.length <= 32 &&
    posts.every((post) => typeof post === "string" && post.length > 0 && post.length <= 256)
  );
}
