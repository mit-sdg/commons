import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { ReactingConcept } from "./reacting.ts";
import { MongoReactingConcept } from "./reacting.mongo.ts";
import { ReactionAlreadyExists, ReactionNotFound } from "./errors.ts";

export const reacting = registerConcept({
  class: ReactingConcept,
  spec,
  queries: {
    _getReactionsForTarget: "many",
    _getReactionsByUser: "many",
    _countByKind: "many",
    _hasReacted: "one",
  },
  refusals: {
    REACTION_ALREADY_EXISTS: {
      error: ReactionAlreadyExists,
      on: ["react"],
      public: PublicError.CONFLICT,
    },
    REACTION_NOT_FOUND: {
      error: ReactionNotFound,
      on: ["unreact"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoReactingConcept(database) },
});
