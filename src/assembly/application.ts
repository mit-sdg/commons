import { assemble, type ImplementationOverrides } from "@mit-sdg/sync-engine/assembly";
import { vocabulary } from "../concepts/index.ts";
import { composition } from "../composition/index.ts";

export type CommonsOverrides = ImplementationOverrides<typeof vocabulary>;

export function assembleCommons(overrides: CommonsOverrides = {}) {
  return assemble({ vocabulary, composition, instances: overrides });
}

export type CommonsApp = ReturnType<typeof assembleCommons>;
