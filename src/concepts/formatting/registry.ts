import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { FormattingConcept } from "./formatting.ts";
import { MongoFormattingConcept } from "./formatting.mongo.ts";

export const formatting = registerConcept({
  class: FormattingConcept,
  spec,
  queries: {
    _getRendered: "optional",
  },
  floors: {
    mongo: ({ database }: { database: Db }) => new MongoFormattingConcept(database),
  },
});
