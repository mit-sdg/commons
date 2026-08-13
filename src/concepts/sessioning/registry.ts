import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Sessioning.md" with { type: "text" };
import { SessioningConcept } from "./sessioning.ts";
import { MongoSessioningConcept } from "./sessioning.mongo.ts";
import { SessionNotFound } from "./errors.ts";

export const sessioning = registerConcept({
  class: SessioningConcept,
  spec,
  refusals: {
    SESSION_NOT_FOUND: SessionNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoSessioningConcept(database) },
});
