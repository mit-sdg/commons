import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Delegating.md" with { type: "text" };
import { MongoDelegatingConcept } from "./delegating.mongo.ts";
import { DelegationNotFound, InvalidSpread } from "./errors.ts";

export const delegating = registerConcept({
  class: MongoDelegatingConcept,
  spec,
  refusals: {
    DELEGATION_NOT_FOUND: DelegationNotFound,
    INVALID_SPREAD: InvalidSpread,
  },
  floors: {
    mongo: ({ database }: { database: Db }) => new MongoDelegatingConcept(database),
  },
});
