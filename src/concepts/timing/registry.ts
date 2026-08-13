import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/Timing.md" with { type: "text" };
import { TimingConcept } from "./timing.ts";

export const timing = registerConcept({
  class: TimingConcept,
  spec,
  floors: { mongo: (_context: unknown) => new TimingConcept() },
});
