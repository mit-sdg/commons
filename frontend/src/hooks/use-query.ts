"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CommonsError, isApiError, publicErrorMessage } from "@/lib/api";

export interface QueryState<T> {
  data: T | null;
  error: string | null;
  refused: string | null;
  loading: boolean;
  refetch: () => void;
}

interface QueryResult<T> {
  scope: ReadonlyArray<unknown>;
  data: T | null;
  error: string | null;
  refused: string | null;
  loading: boolean;
}

function sameScope(
  left: ReadonlyArray<unknown>,
  right: ReadonlyArray<unknown>,
) {
  return (
    left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index]))
  );
}

export function useQuery<T>(
  loader: (() => Promise<T | { error: string }>) | null,
  deps: ReadonlyArray<unknown>,
): QueryState<T> {
  const enabled = loader !== null;
  const [result, setResult] = useState<QueryResult<T> | null>(null);
  const [nonce, setNonce] = useState(0);
  const reqId = useRef(0);
  const inFlight = useRef(false);
  const queued = useRef(false);

  const refetch = useCallback(() => {
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    setNonce((n) => n + 1);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: callers declare the query scope; nonce requests a refresh within it.
  useEffect(() => {
    const id = ++reqId.current;
    queued.current = false;
    inFlight.current = loader !== null;
    if (!loader) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- disabling a query discards its retained presentation.
      setResult(null);
      return;
    }
    const scope = [...deps];
    setResult((previous) => ({
      scope,
      data: previous && sameScope(previous.scope, scope) ? previous.data : null,
      error: null,
      refused: null,
      loading: true,
    }));
    Promise.resolve()
      .then(loader)
      .then((value) => {
        if (id !== reqId.current) return;
        setResult(
          isApiError(value)
            ? {
                scope,
                data: null,
                error: publicErrorMessage(value.error),
                refused: value.error,
                loading: false,
              }
            : {
                scope,
                data: value as T,
                error: null,
                refused: null,
                loading: false,
              },
        );
      })
      .catch((error: unknown) => {
        if (id !== reqId.current) return;
        setResult({
          scope,
          data: null,
          error:
            error instanceof CommonsError
              ? error.message
              : publicErrorMessage("INTERNAL_ERROR"),
          refused: error instanceof CommonsError ? error.code : null,
          loading: false,
        });
      })
      .finally(() => {
        if (id !== reqId.current) return;
        inFlight.current = false;
        if (queued.current) {
          queued.current = false;
          setNonce((n) => n + 1);
        }
      });
    return () => {
      if (id !== reqId.current) return;
      reqId.current += 1;
      inFlight.current = false;
      queued.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  const current =
    enabled && result && sameScope(result.scope, deps) ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    refused: current?.refused ?? null,
    loading: enabled && (current?.loading ?? true),
    refetch,
  };
}
