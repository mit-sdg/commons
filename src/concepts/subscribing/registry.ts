import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Subscribing.md" with { type: "text" };
import { SubscribingConcept } from "./subscribing.ts";
import { MongoSubscribingConcept } from "./subscribing.mongo.ts";
import { AlreadySubscribed, NotSubscribed } from "./errors.ts";

export const subscribing = registerConcept({
  class: SubscribingConcept,
  spec,
  refusals: {
    ALREADY_SUBSCRIBED: AlreadySubscribed,
    NOT_SUBSCRIBED: NotSubscribed,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoSubscribingConcept(database) },
});
