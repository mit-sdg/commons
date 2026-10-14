import { assemble } from "@mit-sdg/sync-engine/assembly";
import { learningConcepts, mongoImplementations } from "../concepts.ts";
import { composition } from "../compositions/index.ts";
import {
  configuredQueryCache,
  configuredReadAhead,
  MONGODB_POOL,
  rowsAheadFor,
} from "../deployment.ts";

export type CommonsImplementations = ReturnType<typeof mongoImplementations>;

/** Field names whose values sign someone in, beyond the engine's own patterns. */
const SIGN_IN_FIELDS = ["credential", "code_verifier", "verifier"];

export function assembleCommons(
  instances: CommonsImplementations,
  clock?: () => Date,
  maxPoolSize: number = MONGODB_POOL,
) {
  // A list's rows are read together and used in order; READ_AHEAD=off reads one at a time.
  // Rows read ahead across requests hold at most half the pool's connections.
  const rowsAtOnce = configuredReadAhead();
  const maxRowsAhead = rowsAheadFor(maxPoolSize);
  const application = assemble({
    conceptSet: learningConcepts,
    composition,
    instances,
    redaction: { fields: SIGN_IN_FIELDS },
    // A request reuses only answers read since it arrived; QUERY_CACHE=memoize clears them all instead.
    queryCache: configuredQueryCache(),
    ...(rowsAtOnce > 1 ? { concurrentReads: { rowsAtOnce, maxRowsAhead } } : {}),
    ...(clock === undefined ? {} : { clock }),
  });
  return application as Omit<typeof application, "concepts"> & {
    concepts: CommonsImplementations;
  };
}

export type CommonsApp = ReturnType<typeof assembleCommons>;
