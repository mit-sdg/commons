import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Linking.md" with { type: "text" };
import { MongoLinkingConcept } from "./linking.mongo.ts";

export const linking = registerConcept({
  class: MongoLinkingConcept,
  spec,
  floors: {
    mongo: ({ database }: { database: Db }, instance: string) =>
      new MongoLinkingConcept(database, instance),
  },
});
