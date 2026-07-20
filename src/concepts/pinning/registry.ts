import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { PinningConcept } from "./pinning.ts";
import { MongoPinningConcept } from "./pinning.mongo.ts";
import { ItemAlreadyPinned, ItemNotPinned } from "./errors.ts";

export const pinning = registerConcept({
  class: PinningConcept,
  spec,
  refusals: {
    ITEM_ALREADY_PINNED: {
      error: ItemAlreadyPinned,
      on: ["pin"],
      public: PublicError.CONFLICT,
    },
    ITEM_NOT_PINNED: {
      error: ItemNotPinned,
      on: ["unpin", "setPriority"],
      public: PublicError.CONFLICT,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoPinningConcept(database) },
});
