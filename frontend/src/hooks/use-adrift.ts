"use client";

import { useEffect, useRef, useState } from "react";
import { adrift, STALE_MS } from "@/lib/poll";

/** One polled query as the line reads it: when it last answered, and whether it is still asking. */
export interface Heard {
  answeredAt: number | null;
  /** A query that has stopped asking on purpose (a closed run) has nothing to be late with. */
  polling: boolean;
}

/**
 * The screen's clock while it polls: a tick every cadence, and one more at
 * each moment the screen names with `at`, so a rule that falls due between
 * ticks is read the moment it does. A tick that finds itself more than two
 * cadences late is a resume (the laptop slept, the tab was frozen), not a
 * stall, and it is said as such so a closed lid never opens onto the line.
 */
export function useClock(
  polling: boolean,
  everyMs: number,
  at: ReadonlyArray<number | null> = [],
): { now: number; resumedAt: number } {
  const [now, setNow] = useState(() => Date.now());
  const [resumedAt, setResumedAt] = useState(() => Date.now());
  const last = useRef(now);
  useEffect(() => {
    if (!polling) return;
    last.current = Date.now();
    const timer = setInterval(() => {
      const at = Date.now();
      if (at - last.current > everyMs * 2) setResumedAt(at);
      last.current = at;
      setNow(at);
    }, everyMs);
    return () => clearInterval(timer);
  }, [polling, everyMs]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the moments are the dependency, spread so a fresh array each render does not rearm them.
  useEffect(() => {
    if (!polling) return;
    const timers = at
      .filter((moment): moment is number => moment !== null)
      .map((moment) =>
        // A millisecond past the moment, so the reading is never a hair short.
        setTimeout(
          () => setNow(Date.now()),
          Math.max(0, moment - Date.now()) + 1,
        ),
      );
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, ...at]);
  return { now, resumedAt };
}

/** The moment a query's last answer turns `staleMs` old, when it has one. */
export function dueAt(latest: number | null, staleMs: number): number | null {
  return latest === null ? null : latest + staleMs;
}

/**
 * The last two answers of one query, as the line's hysteresis reads them: a
 * resume counts as an answer, and a query that starts over (a new identity)
 * has no answer before its first.
 */
export function useHeard(
  answeredAt: number | null,
  resumedAt: number,
): { latest: number | null; before: number | null } {
  const [heard, setHeard] = useState<{
    /** The answer the pair was last moved for; a resume moves the pair without one. */
    seen: number | null;
    latest: number | null;
    before: number | null;
  }>({ seen: answeredAt, latest: answeredAt, before: null });
  let next = heard;
  if (answeredAt !== next.seen) {
    next = {
      seen: answeredAt,
      latest: answeredAt,
      before: answeredAt === null ? null : next.latest,
    };
  }
  if (next.latest !== null && resumedAt > next.latest) {
    next = { ...next, latest: resumedAt, before: resumedAt };
  }
  if (next !== heard) setHeard(next);
  return next;
}

/**
 * Whether a screen has stopped hearing: the line stands when any of its
 * polled queries last answered `staleMs` ago, with the hysteresis `adrift`
 * states, and never once every query has stopped asking on purpose. The
 * screen's clock comes with it, since the line is read against the clock
 * that lives exactly as long as the polling.
 */
export function useAdrift(
  heard: [Heard, Heard] | [Heard],
  everyMs: number,
  staleMs = STALE_MS,
): { adrift: boolean; now: number } {
  const [first, second = { answeredAt: null, polling: false }] = heard;
  const polling = first.polling || second.polling;
  // The line falls due `staleMs` after the last answer, between ticks; the
  // clock ticks once more at that moment. The moment is read off the answer,
  // since a resume moves the pair only after the clock has ticked.
  const { now, resumedAt } = useClock(polling, everyMs, [
    dueAt(first.answeredAt, staleMs),
    dueAt(second.answeredAt, staleMs),
  ]);
  const one = useHeard(first.answeredAt, resumedAt);
  const two = useHeard(second.answeredAt, resumedAt);
  return {
    adrift:
      (first.polling && adrift(one.latest, one.before, now, staleMs)) ||
      (second.polling && adrift(two.latest, two.before, now, staleMs)),
    now,
  };
}
