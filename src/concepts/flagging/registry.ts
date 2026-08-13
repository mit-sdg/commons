import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Flagging.md" with { type: "text" };
import { MongoFlaggingConcept } from "./flagging.mongo.ts";
import { FlagAlreadyExists, FlagNotFound, OutcomeInvalid } from "./errors.ts";

export const flagging = registerConcept({
  class: MongoFlaggingConcept,
  spec,
  refusals: {
    FLAG_ALREADY_EXISTS: FlagAlreadyExists,
    VALIDATION_FAILED: OutcomeInvalid,
    FLAG_NOT_FOUND: FlagNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoFlaggingConcept(database) },
});
