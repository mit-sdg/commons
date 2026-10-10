import { AsyncLocalStorage } from "node:async_hooks";

/** A request that takes this long or longer is logged unless `SLOW_REQUEST_MS` is set. */
export const SLOW_REQUEST_MS = 1_000;

export interface SlowRequestLog {
  readonly thresholdMs: number;
  /** Adds one MongoDB command to the request being served, if there is one. */
  countCommand(): void;
  /** Serves a request and logs one line when it took `thresholdMs` or longer. */
  measure(path: string, serve: () => Promise<Response>): Promise<Response>;
}

/**
 * Logs each slow request with its logical path, its time, and the MongoDB
 * commands issued while serving it. A command is counted against the request
 * whose async context issued it.
 */
export function slowRequestLog(
  thresholdMs: number,
  print: (line: string) => void = (line) => console.warn(line),
): SlowRequestLog {
  const requests = new AsyncLocalStorage<{ commands: number }>();
  return {
    thresholdMs,
    countCommand() {
      const request = requests.getStore();
      if (request !== undefined) request.commands += 1;
    },
    async measure(path, serve) {
      const request = { commands: 0 };
      const start = performance.now();
      try {
        return await requests.run(request, serve);
      } finally {
        const ms = performance.now() - start;
        if (ms >= thresholdMs) {
          print(
            `commons: slow request ${path} took ${Math.round(ms)} ms and ${request.commands} MongoDB commands.`,
          );
        }
      }
    },
  };
}
