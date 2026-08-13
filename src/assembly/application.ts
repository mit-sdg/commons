import {
  assemble,
  type ImplementationOverrides,
  type Implementations,
} from "@mit-sdg/sync-engine/assembly";
import { learningConcepts, vocabulary } from "../vocabulary.ts";
import { composition } from "../compositions/index.ts";

export type CommonsOverrides = ImplementationOverrides<typeof vocabulary>;

export function assembleCommons(overrides: CommonsOverrides = {}) {
  const application = assemble({
    vocabulary,
    composition,
    instances: { ...learningConcepts.implementations(), ...overrides },
  });
  return application as Omit<typeof application, "concepts"> & {
    concepts: Implementations<typeof vocabulary>;
  };
}

export type CommonsApp = ReturnType<typeof assembleCommons>;
