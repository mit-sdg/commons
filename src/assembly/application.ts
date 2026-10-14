import { assemble } from "@mit-sdg/sync-engine/assembly";
import { learningConcepts, mongoImplementations } from "../concepts.ts";
import { composition } from "../compositions/index.ts";
import { configuredQueryCache, configuredReadAhead } from "../deployment.ts";

export type CommonsImplementations = ReturnType<typeof mongoImplementations>;

/** Field names whose values sign someone in, beyond the engine's own patterns. */
const SIGN_IN_FIELDS = ["credential", "code_verifier", "verifier"];

export function assembleCommons(instances: CommonsImplementations, clock?: () => Date) {
  // A list's rows are read together and used in order; READ_AHEAD=off reads one at a time.
  const rowsAtOnce = configuredReadAhead();
  const application = assemble({
    conceptSet: learningConcepts,
    composition,
    instances,
    redaction: { fields: SIGN_IN_FIELDS },
    // A request reuses only answers read since it arrived; QUERY_CACHE=memoize clears them all instead.
    queryCache: configuredQueryCache(),
    ...(rowsAtOnce > 1 ? { concurrentReads: { rowsAtOnce } } : {}),
    ...(clock === undefined ? {} : { clock }),
  });
  return application as Omit<typeof application, "concepts"> & {
    concepts: CommonsImplementations;
  };
}

export type CommonsApp = ReturnType<typeof assembleCommons>;
