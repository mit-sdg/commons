import { type Output, publicErrorMessage } from "./api";

export type PostControls = Output<"/threads/post-controls">["posts"][number];
export type SharedPostControls = { data: PostControls; refetch: () => void };
export type PostControlResult = {
  data: PostControls | null;
  error: string | null;
};

export function createPostControlsCache(
  load: (posts: string[]) => Promise<PostControls[]>,
  changed: () => void,
) {
  const results = new Map<string, PostControlResult>();
  const pending = new Set<string>();
  const requested = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let loading = false;

  function schedule() {
    if (!loading && timer === undefined && pending.size > 0)
      timer = setTimeout(() => void flush(), 0);
  }

  async function flush() {
    timer = undefined;
    const attempt = generation;
    const posts = [...pending].slice(0, 32);
    for (const post of posts) pending.delete(post);
    loading = true;
    try {
      const rows = await load(posts);
      if (attempt !== generation) return;
      const found = new Map(rows.map((row) => [row.post, row]));
      for (const post of posts) {
        if (pending.has(post)) continue;
        const data = found.get(post) ?? null;
        results.set(post, {
          data,
          error: data ? null : publicErrorMessage("NOT_FOUND"),
        });
      }
    } catch {
      if (attempt !== generation) return;
      for (const post of posts) {
        if (!pending.has(post))
          results.set(post, {
            data: null,
            error: "Post controls are unavailable.",
          });
      }
    } finally {
      if (attempt === generation) {
        for (const post of posts) requested.delete(post);
        loading = false;
        changed();
        schedule();
      }
    }
  }

  function ensure(post: string) {
    if (results.has(post) || requested.has(post)) return;
    pending.add(post);
    requested.add(post);
    schedule();
  }

  return {
    get: (post: string) => results.get(post),
    ensure,
    refresh(post: string) {
      results.delete(post);
      if (requested.has(post)) pending.add(post);
      else ensure(post);
      changed();
    },
    clear() {
      generation += 1;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      loading = false;
      results.clear();
      pending.clear();
      requested.clear();
    },
  };
}
