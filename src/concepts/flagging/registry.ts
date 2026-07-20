import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { FlaggingConcept } from "./flagging.ts";
import { MongoFlaggingConcept } from "./flagging.mongo.ts";
import { FlagAlreadyExists, FlagNotFound, OutcomeInvalid } from "./errors.ts";

export const flagging = registerConcept({
  class: FlaggingConcept,
  spec,
  refusals: {
    FLAG_ALREADY_EXISTS: {
      error: FlagAlreadyExists,
      on: ["flag"],
      public: PublicError.CONFLICT,
    },
    VALIDATION_FAILED: {
      error: OutcomeInvalid,
      on: ["resolve"],
      public: PublicError.INVALID_REQUEST,
    },
    FLAG_NOT_FOUND: {
      error: FlagNotFound,
      on: ["resolve"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoFlaggingConcept(database) },
});
