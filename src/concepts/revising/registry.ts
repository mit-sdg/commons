import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Revising.md" with { type: "text" };
import { RevisingConcept } from "./revising.ts";
import { MongoRevisingConcept } from "./revising.mongo.ts";

export const revising = registerConcept({
  class: RevisingConcept,
  spec,
  floors: {
    mongo: ({ database }: { database: Db }) => new MongoRevisingConcept(database),
  },
});
