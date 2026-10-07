import { assemble } from "@mit-sdg/sync-engine/assembly";
import { learningConcepts, mongoImplementations } from "../concepts.ts";
import { composition } from "../compositions/index.ts";

export type CommonsImplementations = ReturnType<typeof mongoImplementations>;

/** Field names whose values sign someone in, beyond the engine's own patterns. */
const SIGN_IN_FIELDS = ["credential", "code_verifier", "verifier"];

export function assembleCommons(instances: CommonsImplementations, clock?: () => Date) {
  const application = assemble({
    conceptSet: learningConcepts,
    composition,
    instances,
    redaction: { fields: SIGN_IN_FIELDS },
    ...(clock === undefined ? {} : { clock }),
  });
  return application as Omit<typeof application, "concepts"> & {
    concepts: CommonsImplementations;
  };
}

export type CommonsApp = ReturnType<typeof assembleCommons>;
