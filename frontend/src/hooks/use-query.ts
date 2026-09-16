"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CommonsError, isApiError, publicErrorMessage } from "@/lib/api";

export interface QueryState<T> {
  data: T | null;
  error: string | null;
  refused: string | null;
  loading: boolean;
  /** When the last answer came, whatever has failed since; nothing has answered yet while null. */
  answeredAt: number | null;
  refetch: () => void;
}

export interface QuerySnapshot<T> {
  scope: ReadonlyArray<unknown>;
  data: T | null;
  error: string | null;
  refused: string | null;
  loading: boolean;
  answeredAt: number | null;
}

/**
 * A failed request that says nothing about the resource: the answer never
 * arrived, or arrived unreadable. Every declared refusal says something, and
 * clears what was held.
 */
export const RETAINING_CODES: ReadonlySet<string> = new Set([
  "NETWORK_ERROR",
  "TIMED_OUT",
  "ABORTED",
  "TRANSPORT_ERROR",
  "BAD_JSON",
]);

export function sameScope(
  left: ReadonlyArray<unknown>,
  right: ReadonlyArray<unknown>,
) {
  return (
    left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index]))
  );
}

/** A request goes out: held data stays only within the same identity. */
export function startingQuery<T>(
  previous: QuerySnapshot<T> | null,
  scope: ReadonlyArray<unknown>,
  retain: boolean,
): QuerySnapshot<T> {
  const current =
    previous && sameScope(previous.scope, scope) ? previous : null;
  const held = retain && current?.data != null;
  return {
    scope,
    data: current?.data ?? null,
    // A pending retry has not yet made a held result current again.
    error: held ? current.error : null,
    refused: held ? current.refused : null,
    loading: true,
    answeredAt: current?.answeredAt ?? null,
  };
}

/**
 * A request failed at `at`: a transport fault says nothing about when the
 * server was last heard, and keeps the data when the query retains; a
 * refusal clears the data, and is an answer.
 */
export function failedQuery<T>(
  previous: QuerySnapshot<T> | null,
  scope: ReadonlyArray<unknown>,
  retain: boolean,
  code: string | null,
  message: string,
  at: number,
): QuerySnapshot<T> {
  const current =
    previous && sameScope(previous.scope, scope) ? previous : null;
  const silent = code !== null && RETAINING_CODES.has(code);
  const kept = retain && silent;
  return {
    scope,
    data: kept ? (current?.data ?? null) : null,
    error: message,
    refused: code,
    loading: false,
    answeredAt: silent ? (current?.answeredAt ?? null) : at,
  };
}

/** A request answered at `at`: the answer is the whole state. */
export function answeredQuery<T>(
  scope: ReadonlyArray<unknown>,
  data: T,
  at: number,
): QuerySnapshot<T> {
  return {
    scope,
    data,
    error: null,
    refused: null,
    loading: false,
    answeredAt: at,
  };
}

/**
 * One query's data, refetched on demand and at most one request at a time.
 * `identity` is what the query is about — its inputs and the signed-in
 * session — and a change to it discards what was held; `refreshOn` lists
 * what should only make the query ask again, keeping what it shows until
 * the answer lands. A nulled loader discards.
 */
export function useQuery<T>(
  loader: (() => Promise<T | { error: string }>) | null,
  identity: ReadonlyArray<unknown>,
  {
    retainOnTransportError = false,
    refreshOn = [],
  }: {
    retainOnTransportError?: boolean;
    refreshOn?: ReadonlyArray<unknown>;
  } = {},
): QueryState<T> {
  const enabled = loader !== null;
  const [result, setResult] = useState<QuerySnapshot<T> | null>(null);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: callers declare the identity and the refresh triggers; nonce requests a refresh within them.
  useEffect(() => {
    const id = ++reqId.current;
    queued.current = false;
    inFlight.current = loader !== null;
    if (!loader) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- disabling a query discards its retained presentation.
      setResult(null);
      return;
    }
    const scope = [...identity];
    setResult((previous) =>
      startingQuery(previous, scope, retainOnTransportError),
    );
    const fail = (code: string | null, message: string) => {
      setResult((previous) =>
        failedQuery(
          previous,
          scope,
          retainOnTransportError,
          code,
          message,
          Date.now(),
        ),
      );
    };
    Promise.resolve()
      .then(loader)
      .then((value) => {
        if (id !== reqId.current) return;
        if (isApiError(value)) {
          fail(value.error, publicErrorMessage(value.error));
        } else {
          setResult(answeredQuery(scope, value as T, Date.now()));
        }
      })
      .catch((error: unknown) => {
        if (id !== reqId.current) return;
        fail(
          error instanceof CommonsError ? error.code : null,
          error instanceof CommonsError
            ? error.message
            : publicErrorMessage("INTERNAL_ERROR"),
        );
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
  }, [...identity, ...refreshOn, enabled, nonce, retainOnTransportError]);

  const current =
    enabled && result && sameScope(result.scope, identity) ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    refused: current?.refused ?? null,
    loading: enabled && (current?.loading ?? true),
    answeredAt: current?.answeredAt ?? null,
    refetch,
  };
}
