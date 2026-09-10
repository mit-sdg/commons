import type { Output } from "./api";

type ProfileRow = Output<"/profiles/displays">["profiles"][number];
export type ProfileDisplay = Pick<
  ProfileRow,
  "displayName" | "avatar" | "role"
>;

export function createProfileCache(
  load: (users: string[]) => Promise<ProfileRow[]>,
  changed: () => void,
) {
  const profiles = new Map<string, ProfileDisplay | null>();
  const loadedAt = new Map<string, number>();
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
    const users = [...pending].slice(0, 64);
    for (const user of users) pending.delete(user);
    loading = true;
    try {
      const rows = await load(users);
      if (attempt !== generation) return;
      const found = new Map(rows.map((row) => [row.user, row]));
      const now = Date.now();
      for (const user of users) {
        const profile = found.get(user);
        loadedAt.set(user, now);
        profiles.set(
          user,
          profile
            ? {
                displayName: profile.displayName,
                avatar: profile.avatar,
                role: profile.role,
              }
            : null,
        );
      }
      changed();
    } catch {
    } finally {
      if (attempt === generation) {
        for (const user of users) requested.delete(user);
        loading = false;
        schedule();
      }
    }
  }

  return {
    get(user: string) {
      return profiles.get(user) ?? undefined;
    },
    ensure(user: string) {
      if (!user || profiles.has(user) || requested.has(user)) return;
      pending.add(user);
      requested.add(user);
      schedule();
    },
    /**
     * Ask again for identities already shown, keeping what is on screen until
     * the fresh answer lands. A role change is the usual reason: the name and
     * avatar rarely move, but a badge granted or revoked elsewhere must not
     * outlive the assignment. Given users are refreshed unconditionally;
     * otherwise every known identity older than `olderThan` milliseconds is.
     */
    refresh(options: { users?: string[]; olderThan?: number } = {}) {
      const candidates = options.users ?? [...profiles.keys()];
      const cutoff = Date.now() - (options.olderThan ?? 0);
      for (const user of candidates) {
        if (!user || requested.has(user)) continue;
        if (options.users === undefined && (loadedAt.get(user) ?? 0) > cutoff)
          continue;
        pending.add(user);
        requested.add(user);
      }
      schedule();
    },
    clear() {
      generation += 1;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      loading = false;
      profiles.clear();
      loadedAt.clear();
      pending.clear();
      requested.clear();
    },
  };
}
