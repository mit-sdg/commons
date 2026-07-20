import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { RevisingConcept } from "./revising.ts";
import { MongoRevisingConcept } from "./revising.mongo.ts";

export const revising = registerConcept({
  class: RevisingConcept,
  spec,
  queries: {
    _getRevisions: "many",
    _getRevision: "optional",
    _getLatest: "optional",
  },
  floors: {
    mongo: ({ database }: { database: Db }) => new MongoRevisingConcept(database),
  },
});
