import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Connecting.md" with { type: "text" };
import { MongoConnectingConcept } from "./connecting.mongo.ts";
import { ConnectionNotFound } from "./errors.ts";

export const connecting = registerConcept({
  class: MongoConnectingConcept,
  spec,
  refusals: {
    CONNECTION_NOT_FOUND: ConnectionNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoConnectingConcept(database) },
});
