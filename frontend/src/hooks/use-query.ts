"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CommonsError, isApiError, publicErrorMessage } from "@/lib/api";

export interface QueryState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

export function useQuery<T>(
  loader: (() => Promise<T | { error: string }>) | null,
  deps: ReadonlyArray<unknown>,
): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(loader !== null);
  const [nonce, setNonce] = useState(0);
  const reqId = useRef(0);
  const inFlight = useRef(false);
  const queued = useRef(false);

  // Polling callers may ask again before a slow request returns. Coalesce
  // those ticks into one follow-up instead of starting a newer request that
  // makes the useful response in flight look stale forever.
  const refetch = useCallback(() => {
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    setNonce((n) => n + 1);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: callers provide the dependency list that controls loader refreshes; nonce intentionally forces refetch.
  useEffect(() => {
    if (!loader) return;
    const id = ++reqId.current;
    inFlight.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching hook, loading/error set before async call
    setLoading(true);
    setError(null);
    loader()
      .then((result) => {
        if (id !== reqId.current) return;
        if (isApiError(result)) {
          setError(publicErrorMessage(result.error));
        } else {
          setData(result as T);
        }
      })
      .catch((e: unknown) => {
        if (id !== reqId.current) return;
        setError(
          e instanceof CommonsError
            ? e.message
            : publicErrorMessage("INTERNAL_ERROR"),
        );
      })
      .finally(() => {
        if (id !== reqId.current) return;
        inFlight.current = false;
        setLoading(false);
        if (queued.current) {
          queued.current = false;
          setNonce((n) => n + 1);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const effectiveLoading = loader ? loading : false;
  const effectiveData = loader ? data : (null as T | null);
  const effectiveError = loader ? error : null;

  return {
    data: effectiveData,
    error: effectiveError,
    loading: effectiveLoading,
    refetch,
  };
}
