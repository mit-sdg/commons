import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Roling.md" with { type: "text" };
import { RolingConcept } from "./roling.ts";
import { MongoRolingConcept } from "./roling.mongo.ts";
import {
  CapabilityRequired,
  GrantAlreadyExists,
  GrantNotFound,
  RoleAlreadyExists,
  RoleNotFound,
} from "./errors.ts";

export const roling = registerConcept({
  class: RolingConcept,
  spec,
  refusals: {
    FORBIDDEN: CapabilityRequired,
    ROLE_ALREADY_EXISTS: RoleAlreadyExists,
    ROLE_NOT_FOUND: RoleNotFound,
    GRANT_ALREADY_EXISTS: GrantAlreadyExists,
    GRANT_NOT_FOUND: GrantNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoRolingConcept(database) },
});
