import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Overriding.md" with { type: "text" };
import { OverrideReasonRequired, OverrideValueRequired } from "./errors.ts";
import { MongoOverridingConcept } from "./overriding.mongo.ts";

export const overriding = registerConcept({
  class: MongoOverridingConcept,
  spec,
  refusals: {
    OVERRIDE_VALUE_REQUIRED: OverrideValueRequired,
    OVERRIDE_REASON_REQUIRED: OverrideReasonRequired,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoOverridingConcept(database) },
});
