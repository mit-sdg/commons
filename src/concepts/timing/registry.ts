import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "./spec.md" with { type: "text" };
import { TimingConcept } from "./timing.ts";

export const timing = registerConcept({
  class: TimingConcept,
  spec,
  queries: {
    _now: "one",
  },
  floors: { mongo: () => new TimingConcept() },
});
