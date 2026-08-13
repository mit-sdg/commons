import { assemble, type Implementations } from "@mit-sdg/sync-engine/assembly";
import { vocabulary } from "../vocabulary.ts";
import { composition } from "../compositions/index.ts";

export type CommonsImplementations = Implementations<typeof vocabulary>;

export function assembleCommons(instances: CommonsImplementations) {
  const application = assemble({
    vocabulary,
    composition,
    instances,
  });
  return application as Omit<typeof application, "concepts"> & {
    concepts: Implementations<typeof vocabulary>;
  };
}

export type CommonsApp = ReturnType<typeof assembleCommons>;
