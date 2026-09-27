import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Attending.md" with { type: "text" };
import { MongoAttendingConcept } from "./attending.mongo.ts";
import { NotAttending } from "./errors.ts";

export const attending = registerConcept({
  class: MongoAttendingConcept,
  spec,
  refusals: {
    NOT_ATTENDING: NotAttending,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoAttendingConcept(database) },
});
