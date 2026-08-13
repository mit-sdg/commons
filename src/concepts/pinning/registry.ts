import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Pinning.md" with { type: "text" };
import { MongoPinningConcept } from "./pinning.mongo.ts";
import { ItemAlreadyPinned, ItemNotPinned } from "./errors.ts";

export const pinning = registerConcept({
  class: MongoPinningConcept,
  spec,
  refusals: {
    ITEM_ALREADY_PINNED: ItemAlreadyPinned,
    ITEM_NOT_PINNED: ItemNotPinned,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoPinningConcept(database) },
});
