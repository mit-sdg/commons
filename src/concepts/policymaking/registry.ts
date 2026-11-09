import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Policymaking.md" with { type: "text" };
import {
  PolicyIsFinal,
  PolicyNameRequired,
  PolicyNameTaken,
  PolicyNotFound,
  PolicyStale,
} from "./errors.ts";
import { MongoPolicymakingConcept } from "./policymaking.mongo.ts";

export const policymaking = registerConcept({
  class: MongoPolicymakingConcept,
  spec,
  refusals: {
    POLICY_NAME_REQUIRED: PolicyNameRequired,
    POLICY_NAME_TAKEN: PolicyNameTaken,
    POLICY_NOT_FOUND: PolicyNotFound,
    POLICY_STALE: PolicyStale,
    POLICY_IS_FINAL: PolicyIsFinal,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoPolicymakingConcept(database) },
});
