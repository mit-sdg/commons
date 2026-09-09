import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Itemizing.md" with { type: "text" };
import { MongoItemizingConcept } from "./itemizing.mongo.ts";
import { CriterionNotFound, GradeItemNotFound, InvalidCriterion } from "./errors.ts";

export const itemizing = registerConcept({
  class: MongoItemizingConcept,
  spec,
  refusals: {
    INVALID_CRITERION: InvalidCriterion,
    GRADE_ITEM_NOT_FOUND: GradeItemNotFound,
    CRITERION_NOT_FOUND: CriterionNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoItemizingConcept(database) },
});
