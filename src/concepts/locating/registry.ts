import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Locating.md" with { type: "text" };
import { NothingLocated } from "./errors.ts";
import { MongoLocatingConcept } from "./locating.mongo.ts";

export const locating = registerConcept({
  class: MongoLocatingConcept,
  spec,
  refusals: {
    NOTHING_LOCATED: NothingLocated,
  },
  floors: {
    mongo: ({ database }: { database: Db }) => new MongoLocatingConcept(database),
  },
});
