import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Sharing.md" with { type: "text" };
import { MongoSharingConcept } from "./sharing.mongo.ts";
import { NothingShared } from "./errors.ts";

export const sharing = registerConcept({
  class: MongoSharingConcept,
  spec,
  refusals: {
    NOTHING_SHARED: NothingShared,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoSharingConcept(database) },
});
