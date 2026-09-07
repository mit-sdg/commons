import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Commissioning.md" with { type: "text" };
import { MongoCommissioningConcept } from "./commissioning.mongo.ts";
import { CommissionNotFound, CommissionNotPrepared } from "./errors.ts";

export const commissioning = registerConcept({
  class: MongoCommissioningConcept,
  spec,
  refusals: {
    COMMISSION_NOT_FOUND: CommissionNotFound,
    COMMISSION_NOT_PREPARED: CommissionNotPrepared,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoCommissioningConcept(database) },
});
