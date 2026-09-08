import type { Output } from "./api";

type ProfileRow = Output<"/profiles/displays">["profiles"][number];
export type ProfileDisplay = Pick<ProfileRow, "displayName" | "avatar">;

export function createProfileCache(
  load: (users: string[]) => Promise<ProfileRow[]>,
  changed: () => void,
) {
  const profiles = new Map<string, ProfileDisplay | null>();
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
      for (const user of users) {
        const profile = found.get(user);
        profiles.set(
          user,
          profile
            ? { displayName: profile.displayName, avatar: profile.avatar }
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
    clear() {
      generation += 1;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      loading = false;
      profiles.clear();
      pending.clear();
      requested.clear();
    },
  };
}
