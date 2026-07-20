import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { ProfilingConcept } from "./profiling.ts";
import { MongoProfilingConcept } from "./profiling.mongo.ts";
import { ProfileAlreadyExists, ProfileNotFound } from "./errors.ts";

export const profiling = registerConcept({
  class: ProfilingConcept,
  spec,
  refusals: {
    PROFILE_ALREADY_EXISTS: {
      error: ProfileAlreadyExists,
      on: ["createProfile"],
      public: PublicError.CONFLICT,
    },
    PROFILE_NOT_FOUND: {
      error: ProfileNotFound,
      on: ["setDisplayName", "setBio", "setAvatar"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoProfilingConcept(database) },
});
