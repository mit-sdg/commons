import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { TrashingConcept } from "./trashing.ts";
import { MongoTrashingConcept } from "./trashing.mongo.ts";
import { ItemAlreadyTrashed, ItemNotTrashed } from "./errors.ts";

export const trashing = registerConcept({
  class: TrashingConcept,
  spec,
  queries: {
    _isTrashed: "one",
    _getTrashed: "many",
  },
  refusals: {
    ITEM_ALREADY_TRASHED: {
      error: ItemAlreadyTrashed,
      on: ["trash"],
      public: PublicError.NOT_FOUND,
    },
    ITEM_NOT_TRASHED: {
      error: ItemNotTrashed,
      on: ["restore", "purge"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoTrashingConcept(database) },
});
