import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Locking.md" with { type: "text" };
import { MongoLockingConcept } from "./locking.mongo.ts";
import { TargetAlreadyLocked, TargetNotLocked } from "./errors.ts";

export const locking = registerConcept({
  class: MongoLockingConcept,
  spec,
  refusals: {
    TARGET_ALREADY_LOCKED: TargetAlreadyLocked,
    TARGET_NOT_LOCKED: TargetNotLocked,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoLockingConcept(database) },
});
