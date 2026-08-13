import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Resolving.md" with { type: "text" };
import { MongoResolvingConcept } from "./resolving.mongo.ts";
import { ResolutionNotFound } from "./errors.ts";

export const resolving = registerConcept({
  class: MongoResolvingConcept,
  spec,
  refusals: {
    RESOLUTION_NOT_FOUND: ResolutionNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoResolvingConcept(database) },
});
