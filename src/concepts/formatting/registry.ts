import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Formatting.md" with { type: "text" };
import { MongoFormattingConcept } from "./formatting.mongo.ts";

export const formatting = registerConcept({
  class: MongoFormattingConcept,
  spec,
  floors: {
    mongo: ({ database }: { database: Db }) => new MongoFormattingConcept(database),
  },
});
