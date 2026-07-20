import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { SubscribingConcept } from "./subscribing.ts";
import { MongoSubscribingConcept } from "./subscribing.mongo.ts";
import { AlreadySubscribed, NotSubscribed } from "./errors.ts";

export const subscribing = registerConcept({
  class: SubscribingConcept,
  spec,
  refusals: {
    ALREADY_SUBSCRIBED: {
      error: AlreadySubscribed,
      on: ["subscribe"],
      public: PublicError.CONFLICT,
    },
    NOT_SUBSCRIBED: {
      error: NotSubscribed,
      on: ["unsubscribe"],
      public: PublicError.CONFLICT,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoSubscribingConcept(database) },
});
