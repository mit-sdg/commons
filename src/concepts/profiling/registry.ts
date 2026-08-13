import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Profiling.md" with { type: "text" };
import { ProfilingConcept } from "./profiling.ts";
import { MongoProfilingConcept } from "./profiling.mongo.ts";
import { ProfileAlreadyExists, ProfileNotFound } from "./errors.ts";

export const profiling = registerConcept({
  class: ProfilingConcept,
  spec,
  refusals: {
    PROFILE_ALREADY_EXISTS: ProfileAlreadyExists,
    PROFILE_NOT_FOUND: ProfileNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoProfilingConcept(database) },
});
