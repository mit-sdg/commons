import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { SessioningConcept } from "./sessioning.ts";
import { MongoSessioningConcept } from "./sessioning.mongo.ts";
import { SessionNotFound } from "./errors.ts";

export const sessioning = registerConcept({
  class: SessioningConcept,
  spec,
  refusals: {
    SESSION_NOT_FOUND: {
      error: SessionNotFound,
      on: ["end"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoSessioningConcept(database) },
});
