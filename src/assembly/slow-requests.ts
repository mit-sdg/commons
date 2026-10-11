import { AsyncLocalStorage } from "node:async_hooks";
import type { MongoClient } from "mongodb";

/** A request that takes this long or longer is logged unless `SLOW_REQUEST_MS` is set. */
export const SLOW_REQUEST_MS = 1_000;

export interface SlowRequestLog {
  readonly thresholdMs: number;
  /** Follows the commands and connection checkouts of a client created with `monitorCommands`. */
  observe(client: MongoClient): void;
  /** Serves a request and logs one line when it took `thresholdMs` or longer. */
  measure(path: string, serve: () => Promise<Response>): Promise<Response>;
}

/** A span of time, in `performance.now()` milliseconds, spent waiting for a pool connection. */
interface Wait {
  start: number;
  end: number;
}

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
 * issued while serving it, and how much of that time at least one of its
 * commands was waiting for a pool connection. A command counts against the
 * request whose async context issued it. The driver emits a finished wait from
 * the context that freed the connection, often another request's, so the wait
 * is held under the connection's id until the first command on that connection
 * starts, and counts against that command's request. Connection ids are
 * numbered per server, so the match is exact with one server; with several
 * serving at once, two waits could change places. A wait that times out is
 * emitted in the waiting request's own context.
 */
export function slowRequestLog(
  thresholdMs: number,
  print: (line: string) => void = (line) => console.warn(line),
): SlowRequestLog {
  const requests = new AsyncLocalStorage<{ commands: number; waits: Wait[] }>();
  const checkedOut = new Map<string | number, Wait & { pool: string }>();
  return {
    thresholdMs,
    observe(client) {
      client.on("connectionCheckedOut", (event) => {
        const end = performance.now();
        checkedOut.set(event.connectionId, {
          pool: event.address,
          start: end - event.durationMS,
          end,
        });
      });
      client.on("connectionCheckedIn", (event) => {
        if (checkedOut.get(event.connectionId)?.pool === event.address) {
          checkedOut.delete(event.connectionId);
        }
      });
      client.on("connectionCheckOutFailed", (event) => {
        if (event.reason !== "timeout") return;
        const end = performance.now();
        requests.getStore()?.waits.push({ start: end - event.durationMS, end });
      });
      client.on("commandStarted", (event) => {
        let wait: Wait | undefined;
        if (event.connectionId !== undefined) {
          wait = checkedOut.get(event.connectionId);
          checkedOut.delete(event.connectionId);
        }
        const request = requests.getStore();
        if (request === undefined) return;
        request.commands += 1;
        if (wait !== undefined) request.waits.push(wait);
      });
    },
    async measure(path, serve) {
      const request = { commands: 0, waits: [] as Wait[] };
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
