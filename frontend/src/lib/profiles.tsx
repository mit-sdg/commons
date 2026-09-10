"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, unwrap } from "@/lib/api";
import { createProfileCache, type ProfileDisplay } from "@/lib/profile-cache";

type RefreshOptions = { users?: string[]; olderThan?: number };

interface ProfilesState {
  get: (user: string) => ProfileDisplay | undefined;
  ensure: (user: string) => void;
  refresh: (options?: RefreshOptions) => void;
}

/**
 * How old a shown identity may be before returning to the tab asks for it
 * again. Another administrator's role change reaches this browser on its next
 * focus rather than never.
 */
const STALE_AFTER = 60_000;

const ProfilesContext = createContext<ProfilesState | null>(null);

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [revision, setRevision] = useState(0);
  const [cache] = useState(() =>
    createProfileCache(
      async (users) => unwrap(await api.profiles.displays({ users })).profiles,
      () => setRevision((previous) => previous + 1),
    ),
  );
  useEffect(() => () => cache.clear(), [cache]);
  useEffect(() => {
    const revisit = () => {
      if (document.visibilityState === "visible")
        cache.refresh({ olderThan: STALE_AFTER });
    };
    document.addEventListener("visibilitychange", revisit);
    window.addEventListener("focus", revisit);
    return () => {
      document.removeEventListener("visibilitychange", revisit);
      window.removeEventListener("focus", revisit);
    };
  }, [cache]);
  const value = useMemo(
    () => ({
      get: cache.get,
      ensure: cache.ensure,
      refresh: cache.refresh,
      revision,
    }),
    [cache, revision],
  );
  return (
    <ProfilesContext.Provider value={value}>
      {children}
    </ProfilesContext.Provider>
  );
}

function useProfiles(): ProfilesState {
  const ctx = useContext(ProfilesContext);
  if (!ctx)
    throw new Error("useProfile must be used within <ProfilesProvider>");
  return ctx;
}

export function useProfile(
  user: string | null | undefined,
): ProfileDisplay | undefined {
  const { get, ensure } = useProfiles();
  useEffect(() => {
    if (user) ensure(user);
  });
  return user ? get(user) : undefined;
}

/**
 * Ask for shown identities again after something changed them, such as a role
 * assigned or revoked from the console. Without users, every identity shown
 * is refreshed.
 */
export function useProfilesRefresh(): (options?: RefreshOptions) => void {
  return useProfiles().refresh;
}
