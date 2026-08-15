import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet, mongoImplementations } from "../concepts.ts";
import { composition } from "../compositions/index.ts";

export type CommonsImplementations = ReturnType<typeof mongoImplementations>;

export function assembleCommons(instances: CommonsImplementations) {
  const application = assemble({
    conceptSet: applicationConceptSet,
    composition,
    instances,
  });
  return application as Omit<typeof application, "concepts"> & {
    concepts: CommonsImplementations;
  };
}

export type CommonsApp = ReturnType<typeof assembleCommons>;
