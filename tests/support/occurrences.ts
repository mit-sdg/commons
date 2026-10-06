import type { LogSink } from "@mit-sdg/sync-engine/assembly";
import type { inspectAssembly } from "@mit-sdg/sync-engine/tooling";

type Occurrence = ReturnType<typeof inspectAssembly>["occurrences"][number];
export const journals = new WeakMap<object, Map<string, Occurrence>>();

export function occurrenceSink() {
  const records = new Map<string, Occurrence>();
  const sink: LogSink = {
    append(entry) {
      if (entry.kind === "invocation") {
        const { id, concept, action, by } = entry.record;
        records.set(id, {
          concept: concept.name,
          action: action.action.name,
          ...(by === undefined ? {} : { by }),
        });
      } else if (entry.kind === "outcome") {
        const record = records.get(entry.id);
        if (record !== undefined)
          Object.assign(record, { output: entry.output, outcome: entry.outcome });
      }
      return undefined;
    },
  };
  return { records, sink };
}

/** Live, already-redacted outcomes, without rebuilding static design artifacts. */
export function occurrences(app: object): Occurrence[] {
  const records = journals.get(app);
  if (records === undefined) throw new Error("this application has no test occurrence journal");
  return [...records.values()];
}
