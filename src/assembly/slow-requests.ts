import { AsyncLocalStorage } from "node:async_hooks";
import type { MongoClient } from "mongodb";

/** A request that takes this long or longer is logged unless `SLOW_REQUEST_MS` is set. */
export const SLOW_REQUEST_MS = 1_000;

export interface SlowRequestLog {
  readonly thresholdMs: number;
  /** Follows the connection checkouts of the client's pools. */
  observe(client: MongoClient): void;
  /** Serves a request and logs one line when it took `thresholdMs` or longer. */
  measure(path: string, serve: () => Promise<Response>): Promise<Response>;
}

/** A span of time, in `performance.now()` milliseconds, spent waiting for a pool connection. */
interface Wait {
  start: number;
  end: number;
}

interface Request {
  commands: number;
  waits: Wait[];
}

/** A checkout still waiting, with the whole millisecond the driver stamped on it. */
interface Checkout {
  request: Request | undefined;
  startedMs: number;
}

/** Checkouts kept per pool before the oldest is dropped; reached only if events go missing. */
const PENDING_LIMIT = 10_000;

/** Milliseconds between `from` and `to` covered by at least one wait, so overlapping waits count once. */
function waitedMs(waits: readonly Wait[], from: number, to: number): number {
  let total = 0;
  let reached = from;
  for (const wait of [...waits].sort((a, b) => a.start - b.start)) {
    const start = Math.max(wait.start, reached);
    const end = Math.min(wait.end, to);
    if (end > start) {
      total += end - start;
      reached = end;
    }
  }
  return total;
}

/**
 * Logs each slow request with its logical path, its time, the MongoDB commands
 * issued while serving it, and how much of that time at least one of them was
 * waiting for a pool connection. Each command checks out one connection, and
 * the checkout starts in the async context of the request that issued it, so
 * checkouts are counted and remembered there. The end of a wait is emitted from
 * whatever context freed or opened the connection, and not always in the order
 * the checkouts started, so it is matched back to its checkout by pool and by the
 * millisecond the checkout started, which is the end's time less its duration.
 * Checkouts that started in the same millisecond on one pool are told apart by
 * age only, so their waits can change places between requests.
 */
export function slowRequestLog(
  thresholdMs: number,
  print: (line: string) => void = (line) => console.warn(line),
): SlowRequestLog {
  const requests = new AsyncLocalStorage<Request>();
  const pools = new Map<string, Checkout[]>();

  const settle = (
    address: string,
    durationMS: number,
    eligible: (checkout: Checkout) => boolean = () => true,
  ) => {
    const pending = pools.get(address);
    if (pending === undefined) return;
    const end = performance.now();
    const startedMs = Math.floor(end) - durationMS;
    let index = pending.findIndex(
      (checkout) => checkout.startedMs === startedMs && eligible(checkout),
    );
    if (index === -1) {
      index = pending.findIndex(
        (checkout) => Math.abs(checkout.startedMs - startedMs) <= 1 && eligible(checkout),
      );
    }
    if (index === -1) return;
    const [checkout] = pending.splice(index, 1);
    checkout.request?.waits.push({ start: end - durationMS, end });
  };

  return {
    thresholdMs,
    observe(client) {
      client.on("connectionCheckOutStarted", (event) => {
        const request = requests.getStore();
        if (request !== undefined) request.commands += 1;
        let pending = pools.get(event.address);
        if (pending === undefined) pools.set(event.address, (pending = []));
        pending.push({ request, startedMs: Math.floor(performance.now()) });
        if (pending.length > PENDING_LIMIT) pending.shift();
      });
      client.on("connectionCheckedOut", (event) => settle(event.address, event.durationMS));
      client.on("connectionCheckOutFailed", (event) => {
        if (event.reason !== "timeout") {
          settle(event.address, event.durationMS);
          return;
        }
        const request = requests.getStore();
        settle(event.address, event.durationMS, (checkout) => checkout.request === request);
      });
    },
    async measure(path, serve) {
      const request: Request = { commands: 0, waits: [] };
      const start = performance.now();
      try {
        return await requests.run(request, serve);
      } finally {
        const end = performance.now();
        const ms = end - start;
        if (ms >= thresholdMs) {
          const waited = waitedMs(request.waits, start, end);
          print(
            `commons: slow request ${path} took ${Math.round(ms)} ms and ${request.commands} MongoDB commands, ${Math.round(waited)} ms of it waiting for a connection.`,
          );
        }
      }
    },
  };
}
