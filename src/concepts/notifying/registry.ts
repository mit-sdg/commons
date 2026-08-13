import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Notifying.md" with { type: "text" };
import { NotifyingConcept } from "./notifying.ts";
import { MongoNotifyingConcept } from "./notifying.mongo.ts";
import { NotificationNotFound } from "./errors.ts";

export const notifying = registerConcept({
  class: NotifyingConcept,
  spec,
  refusals: {
    NOTIFICATION_NOT_FOUND: NotificationNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoNotifyingConcept(database) },
});
