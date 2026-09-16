import { isApiError } from "@/lib/api";

/** How long a poll waits for its answer before giving up on it; actions carry no deadline. */
export const POLL_DEADLINE_MS = 10_000;

/** The longest a poller waits between tries once its requests keep failing. */
export const POLL_CAP_MS = 30_000;

/** How old a staff screen's last answer is when the screen says it has stopped hearing. */
export const STALE_MS = 10_000;

/** How old a phone's last answer is, with a round on the screen, when the phone says so. */
export const PHONE_STALE_MS = 42_000;

/** What a screen that has stopped hearing says. */
export const NO_CONNECTION = "No connection.";

/**
 * A result that says nothing about what was asked: the answer never came,
 * came unreadable, or the server could not take the question. A declared
 * refusal is an answer.
 */
const OUT_OF_REACH = new Set([
  "NETWORK_ERROR",
  "TIMED_OUT",
  "ABORTED",
  "TRANSPORT_ERROR",
  "BAD_JSON",
  "BAD_STATUS",
  "RESPONSE_TOO_LARGE",
  "HEADER_RESOLUTION_FAILED",
  "INTERNAL_ERROR",
  "UNAVAILABLE",
]);

export function outOfReach(result: unknown): boolean {
  return isApiError(result) && OUT_OF_REACH.has(result.error);
}

/** The wait after one more result: back to the cadence on an answer, doubled up to the cap on a miss. */
export function nextWait(
  current: number,
  everyMs: number,
  answered: boolean,
  capMs = POLL_CAP_MS,
): number {
  return answered ? everyMs : Math.min(current * 2, capMs);
}

/**
 * Whether a screen has stopped hearing, read from when its answers came: the
 * line stands once the last answer is `staleMs` old, and once it stands it
 * clears only on an answer that came within `staleMs` of the answer before
 * it. A lone answer from a server answering every eleven seconds keeps the
 * line up, steadily; a server that recovers clears it one cadence after its
 * first answer. Nothing blinks.
 */
export function adrift(
  latest: number | null,
  before: number | null,
  now: number,
  staleMs: number,
): boolean {
  if (latest === null) return false;
  if (now - latest >= staleMs) return true;
  return before !== null && latest - before >= staleMs;
}

/** The moments a page learns the world came back: the network, the page, the screen. */
export type WakeEvent = "online" | "pageshow" | "visibilitychange" | "resume";

export interface Timers {
  now: () => number;
  every: (run: () => void, ms: number) => unknown;
  stop: (handle: unknown) => void;
  /** Runs once, `ms` from now; `cancel` takes the handle back. */
  after: (run: () => void, ms: number) => unknown;
  cancel: (handle: unknown) => void;
  /** Hears one of the wake events; answers what stops hearing it. */
  listen: (event: WakeEvent, handler: () => void) => () => void;
  /** Whether the page is on a screen somebody could be looking at. */
  visible: () => boolean;
}

/** Where each wake event is heard; the network and the page on the window, the screen on the document. */
function targetOf(event: WakeEvent): EventTarget {
  return event === "online" || event === "pageshow" ? window : document;
}

const clock: Timers = {
  now: () => Date.now(),
  every: (run, ms) => setInterval(run, ms),
  stop: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
  after: (run, ms) => setTimeout(run, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  // The module is imported on the server too, where there is nothing to hear.
  listen: (event, handler) => {
    if (typeof window === "undefined") return () => {};
    const target = targetOf(event);
    target.addEventListener(event, handler);
    return () => target.removeEventListener(event, handler);
  },
  visible: () =>
    typeof document === "undefined" || document.visibilityState !== "hidden",
};

/** The network and the page coming back, and the screen coming back. */
const WORLD_EVENTS: WakeEvent[] = ["online", "pageshow"];
const SCREEN_EVENTS: WakeEvent[] = ["visibilitychange", "resume"];

/**
 * One poller: `tick` is asked at most once at a time, on the cadence while
 * it answers, and after a longer wait each time it does not, up to the cap.
 * A tick that lands while the last one is still pending is skipped; a poll
 * older than its cadence is worthless. Answers `true` when it was answered.
 * The returned function stops the poller.
 *
 * The timer and the request are the guarantee; the wake events are
 * accelerators. With `wakeOn`, the network or the page coming back asks
 * again after a scattered delay of up to one cadence, so a room of phones
 * unlocked together does not ask in the same instant, at most once per
 * cadence, and never while a request is out (that wake asks when the
 * request settles). The wait goes back to the cadence only when the wake's
 * ask is answered. With `pauseWhileHidden`, a page off the screen asks
 * nothing, and asks again as a wake when it is shown.
 */
export function startPolling(
  tick: () => Promise<boolean>,
  {
    everyMs,
    capMs = POLL_CAP_MS,
    atOnce = true,
    wakeOn = false,
    pauseWhileHidden = false,
    timers = clock,
    scatter = (upToMs) => Math.random() * upToMs,
  }: {
    everyMs: number;
    /** The longest wait after misses, read again at every tick so a screen can shorten it while a line stands. */
    capMs?: number | (() => number);
    /** Whether the first tick runs now rather than one cadence from now. */
    atOnce?: boolean;
    wakeOn?: boolean;
    pauseWhileHidden?: boolean;
    timers?: Timers;
    /** The delay a wake's ask takes, up to the cadence. */
    scatter?: (upToMs: number) => number;
  },
): () => void {
  const cap = () => (typeof capMs === "function" ? capMs() : capMs);
  let pending = false;
  let stopped = false;
  let wait = everyMs;
  /** The cadence is counted from the ask; a longer wait, from the miss. */
  let from = atOnce ? timers.now() - everyMs : timers.now();
  let answeredLast = true;
  /** A wake that found a request out asks when it settles. */
  let wakeQueued = false;
  /** When a wake last asked; another wake within a cadence of it is nothing new. */
  let wokeAt = -Infinity;
  let wakeHandle: unknown = null;
  let handle: unknown = null;
  const dueAt = () => from + (answeredLast ? everyMs : Math.min(wait, cap()));
  const send = () => {
    pending = true;
    const askedAt = timers.now();
    void tick()
      .then(
        (answered) => answered,
        () => false,
      )
      .then((answered) => {
        pending = false;
        if (stopped) return;
        wait = nextWait(wait, everyMs, answered, cap());
        answeredLast = answered;
        from = answered ? askedAt : timers.now();
        if (wakeQueued) {
          wakeQueued = false;
          wake();
        }
      });
  };
  const ask = () => {
    // A tick that lands within half a cadence of the due time is the due
    // tick, so an answer that took a few milliseconds costs no cadence.
    if (stopped || pending || timers.now() + everyMs / 2 < dueAt()) return;
    if (pauseWhileHidden && !timers.visible()) return;
    send();
  };
  const wake = () => {
    if (stopped || wakeHandle !== null || !timers.visible()) return;
    if (timers.now() - wokeAt < everyMs) return;
    wakeHandle = timers.after(() => {
      wakeHandle = null;
      if (stopped || !timers.visible()) return;
      if (pending) {
        wakeQueued = true;
        return;
      }
      wokeAt = timers.now();
      send();
      // The cadence is counted from the ask, so the grid moves to the wake's:
      // the next tick comes one cadence after it, not sooner.
      timers.stop(handle);
      handle = timers.every(ask, everyMs);
    }, scatter(everyMs));
  };
  ask();
  handle = timers.every(ask, everyMs);
  const unlisten = [
    ...(wakeOn ? WORLD_EVENTS : []),
    ...(wakeOn || pauseWhileHidden ? SCREEN_EVENTS : []),
  ].map((event) => timers.listen(event, wake));
  return () => {
    stopped = true;
    timers.stop(handle);
    if (wakeHandle !== null) timers.cancel(wakeHandle);
    for (const stop of unlisten) stop();
  };
}
