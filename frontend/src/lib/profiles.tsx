"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, unwrap } from "@/lib/api";
import { createProfileCache, type ProfileDisplay } from "@/lib/profile-cache";

interface ProfilesState {
  get: (user: string) => ProfileDisplay | undefined;
  ensure: (user: string) => void;
}

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
  const value = useMemo(
    () => ({ get: cache.get, ensure: cache.ensure, revision }),
    [cache, revision],
  );
  return (
    <ProfilesContext.Provider value={value}>
      {children}
    </ProfilesContext.Provider>
  );
}

export function useProfile(
  user: string | null | undefined,
): ProfileDisplay | undefined {
  const ctx = useContext(ProfilesContext);
  if (!ctx)
    throw new Error("useProfile must be used within <ProfilesProvider>");
  const { get, ensure } = ctx;
  useEffect(() => {
    if (user) ensure(user);
  });
  return user ? get(user) : undefined;
}
