import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { TrackingConcept } from "./tracking.ts";
import { MongoTrackingConcept } from "./tracking.mongo.ts";
import { ItemAlreadyRegistered, ItemAlreadySeen, ItemNotRegistered } from "./errors.ts";

export const tracking = registerConcept({
  class: TrackingConcept,
  spec,
  refusals: {
    ITEM_ALREADY_REGISTERED: {
      error: ItemAlreadyRegistered,
      on: ["register"],
      public: PublicError.CONFLICT,
    },
    ITEM_NOT_REGISTERED: {
      error: ItemNotRegistered,
      on: ["markSeen"],
      public: PublicError.CONFLICT,
    },
    ITEM_ALREADY_SEEN: {
      error: ItemAlreadySeen,
      on: ["markSeen"],
      public: PublicError.CONFLICT,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoTrackingConcept(database) },
});
