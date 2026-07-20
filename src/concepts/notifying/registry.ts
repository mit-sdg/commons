import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { NotifyingConcept } from "./notifying.ts";
import { MongoNotifyingConcept } from "./notifying.mongo.ts";
import { NotificationNotFound } from "./errors.ts";

export const notifying = registerConcept({
  class: NotifyingConcept,
  spec,
  queries: {
    _getInbox: "many",
    _hasFor: "one",
    _getUnreadCount: "one",
  },
  refusals: {
    NOTIFICATION_NOT_FOUND: {
      error: NotificationNotFound,
      on: ["markRead", "dismiss"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoNotifyingConcept(database) },
});
