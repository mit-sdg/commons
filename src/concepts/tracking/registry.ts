import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Tracking.md" with { type: "text" };
import { TrackingConcept } from "./tracking.ts";
import { MongoTrackingConcept } from "./tracking.mongo.ts";
import { ItemAlreadyRegistered, ItemAlreadySeen, ItemNotRegistered } from "./errors.ts";

export const tracking = registerConcept({
  class: TrackingConcept,
  spec,
  refusals: {
    ITEM_ALREADY_REGISTERED: ItemAlreadyRegistered,
    ITEM_NOT_REGISTERED: ItemNotRegistered,
    ITEM_ALREADY_SEEN: ItemAlreadySeen,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoTrackingConcept(database) },
});
