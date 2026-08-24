import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Roling.md" with { type: "text" };
import { MongoRolingConcept } from "./roling.mongo.ts";
import {
  AssignmentNotFound,
  CapabilityRequired,
  RoleAlreadyExists,
  RoleInUse,
  RoleNotFound,
} from "./errors.ts";

export const roling = registerConcept({
  class: MongoRolingConcept,
  spec,
  refusals: {
    FORBIDDEN: CapabilityRequired,
    ROLE_ALREADY_EXISTS: RoleAlreadyExists,
    ROLE_NOT_FOUND: RoleNotFound,
    ROLE_IN_USE: RoleInUse,
    ASSIGNMENT_NOT_FOUND: AssignmentNotFound,
  },
  floors: {
    mongo: ({ database }: { database: Db }, instance: string) =>
      new MongoRolingConcept(database, instance),
  },
});
