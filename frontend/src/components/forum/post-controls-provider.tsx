"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { createPostControlsCache } from "@/lib/post-controls";

const Context = createContext<ReturnType<
  typeof createPostControlsCache
> | null>(null);

export function PostControlsProvider({
  conversation,
  observation,
  enabled,
  children,
}: {
  conversation: string;
  observation: unknown;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const { session, me } = useAuth();
  const [revision, setRevision] = useState(0);
  const cache = useMemo(
    () =>
      enabled && session && me
        ? createPostControlsCache(
            async (posts) =>
              unwrap(
                await api["/threads/post-controls"]({ conversation, posts }),
              ).posts,
            () => setRevision((value) => value + 1),
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversation, observation, enabled, session, me?.user],
  );
  useEffect(() => () => cache?.clear(), [cache]);
  const value = useMemo(
    () => (cache ? { ...cache, revision } : null),
    [cache, revision],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePostControls(post: string) {
  const cache = useContext(Context);
  const ensure = cache?.ensure;
  useEffect(() => ensure?.(post), [ensure, post]);
  if (!cache) return null;
  return {
    data: cache.get(post)?.data ?? null,
    error: cache.get(post)?.error ?? null,
    refetch: () => cache.refresh(post),
  };
}
