import { assemble } from "@mit-sdg/sync-engine/assembly";
import { learningConcepts, mongoImplementations } from "../concepts.ts";
import { composition } from "../compositions/index.ts";

export type CommonsImplementations = ReturnType<typeof mongoImplementations>;

export function assembleCommons(instances: CommonsImplementations, clock?: () => Date) {
  const application = assemble({
    conceptSet: learningConcepts,
    composition,
    instances,
    ...(clock === undefined ? {} : { clock }),
  });
  return application as Omit<typeof application, "concepts"> & {
    concepts: CommonsImplementations;
  };
}

export type CommonsApp = ReturnType<typeof assembleCommons>;
