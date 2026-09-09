import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/StandardSetting.md" with { type: "text" };
import { MongoStandardSettingConcept } from "./standardSetting.mongo.ts";
import { InvalidStandard, StandardConflict, StandardNotFound } from "./errors.ts";
export const standardSetting = registerConcept({
  class: MongoStandardSettingConcept,
  spec,
  refusals: {
    INVALID_STANDARD: InvalidStandard,
    STANDARD_CONFLICT: StandardConflict,
    STANDARD_NOT_FOUND: StandardNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoStandardSettingConcept(database) },
});
