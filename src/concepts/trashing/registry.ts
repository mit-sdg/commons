import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Trashing.md" with { type: "text" };
import { MongoTrashingConcept } from "./trashing.mongo.ts";
import { ItemAlreadyTrashed, ItemNotTrashed } from "./errors.ts";

export const trashing = registerConcept({
  class: MongoTrashingConcept,
  spec,
  refusals: {
    ITEM_ALREADY_TRASHED: ItemAlreadyTrashed,
    ITEM_NOT_TRASHED: ItemNotTrashed,
  },
  floors: {
    mongo: ({ database }: { database: Db }, instance: string) =>
      new MongoTrashingConcept(database, instance),
  },
});
