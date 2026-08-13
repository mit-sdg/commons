import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Reacting.md" with { type: "text" };
import { MongoReactingConcept } from "./reacting.mongo.ts";
import { ReactionAlreadyExists, ReactionNotFound } from "./errors.ts";

export const reacting = registerConcept({
  class: MongoReactingConcept,
  spec,
  refusals: {
    REACTION_ALREADY_EXISTS: ReactionAlreadyExists,
    REACTION_NOT_FOUND: ReactionNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoReactingConcept(database) },
});
