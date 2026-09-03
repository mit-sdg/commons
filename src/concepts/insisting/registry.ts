import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Insisting.md" with { type: "text" };
import { MongoInsistingConcept } from "./insisting.mongo.ts";
import { NoPatience, NotInsisting, PatienceSpent } from "./errors.ts";

export const insisting = registerConcept({
  class: MongoInsistingConcept,
  spec,
  refusals: {
    NO_PATIENCE: NoPatience,
    PATIENCE_SPENT: PatienceSpent,
    NOT_INSISTING: NotInsisting,
  },
  floors: {
    mongo: ({ database }: { database: Db }, instance: string) =>
      new MongoInsistingConcept(database, instance),
  },
});
