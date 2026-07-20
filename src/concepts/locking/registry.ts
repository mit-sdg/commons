import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { LockingConcept } from "./locking.ts";
import { MongoLockingConcept } from "./locking.mongo.ts";
import { TargetAlreadyLocked, TargetNotLocked } from "./errors.ts";

export const locking = registerConcept({
  class: LockingConcept,
  spec,
  refusals: {
    TARGET_ALREADY_LOCKED: {
      error: TargetAlreadyLocked,
      on: ["lock"],
      public: PublicError.CONFLICT,
    },
    TARGET_NOT_LOCKED: {
      error: TargetNotLocked,
      on: ["unlock"],
      public: PublicError.CONFLICT,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoLockingConcept(database) },
});
