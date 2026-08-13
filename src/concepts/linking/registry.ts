import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Linking.md" with { type: "text" };
import { LinkingConcept } from "./linking.ts";
import { MongoLinkingConcept } from "./linking.mongo.ts";

export const linking = registerConcept({
  class: LinkingConcept,
  spec,
  floors: {
    mongo: ({ database }: { database: Db }) => new MongoLinkingConcept(database),
  },
});
