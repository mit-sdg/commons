import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Guiding.md" with { type: "text" };
import { MongoGuidingConcept } from "./guiding.mongo.ts";
import { GuidanceNotFound, InvalidGuidance, InvalidTitle, InvalidUse } from "./errors.ts";

export const guiding = registerConcept({
  class: MongoGuidingConcept,
  spec,
  refusals: {
    INVALID_USE: InvalidUse,
    INVALID_TITLE: InvalidTitle,
    INVALID_GUIDANCE: InvalidGuidance,
    GUIDANCE_NOT_FOUND: GuidanceNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoGuidingConcept(database) },
});
