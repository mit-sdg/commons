import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
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
    FORBIDDEN: {
      error: CapabilityRequired,
      on: ["requireCapability"],
      public: PublicError.FORBIDDEN,
    },
    ROLE_ALREADY_EXISTS: {
      error: RoleAlreadyExists,
      on: ["defineRole"],
      public: PublicError.CONFLICT,
    },
    ROLE_NOT_FOUND: {
      error: RoleNotFound,
      on: ["grant"],
      public: PublicError.NOT_FOUND,
    },
    GRANT_ALREADY_EXISTS: {
      error: GrantAlreadyExists,
      on: ["grant"],
      public: PublicError.CONFLICT,
    },
    GRANT_NOT_FOUND: {
      error: GrantNotFound,
      on: ["revoke"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoRolingConcept(database) },
});
