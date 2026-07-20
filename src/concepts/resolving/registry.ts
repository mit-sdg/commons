import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { ResolvingConcept } from "./resolving.ts";
import { MongoResolvingConcept } from "./resolving.mongo.ts";
import { ResolutionNotFound } from "./errors.ts";

export const resolving = registerConcept({
  class: ResolvingConcept,
  spec,
  refusals: {
    RESOLUTION_NOT_FOUND: {
      error: ResolutionNotFound,
      on: ["clear"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoResolvingConcept(database) },
});
