import type { OperationalEvent, OperationalObserver } from "@mit-sdg/sync-engine/boundary";

/** A request held longer than this is reported. */
export const SLOW_REQUEST_MS = 2_000;

/** Which requests the edge is spending its time on. */
export function slowRequestObserver(
  print: (line: string) => void = (line) => console.warn(line),
  thresholdMs = SLOW_REQUEST_MS,
): OperationalObserver {
  return (event: OperationalEvent) => {
    if (event.type !== "invocation-settled" || event.durationMs <= thresholdMs) return;
    const outcome =
      event.result === "framework-error" && event.frameworkCode !== undefined
        ? event.frameworkCode
        : event.result;
    print(
      `commons: slow request ${event.route ?? "?"} took ${Math.round(event.durationMs)} ms (${outcome}, correlation ${event.correlationId ?? "?"})`,
    );
  };
}
