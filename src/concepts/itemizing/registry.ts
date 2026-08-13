import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Itemizing.md" with { type: "text" };
import { ItemizingConcept } from "./itemizing.ts";
import { MongoItemizingConcept } from "./itemizing.mongo.ts";
import { CriterionNotFound, GradeItemNotFound, ScoreOutOfRange } from "./errors.ts";

export const itemizing = registerConcept({
  class: ItemizingConcept,
  spec,
  refusals: {
    SCORE_OUT_OF_RANGE: ScoreOutOfRange,
    GRADE_ITEM_NOT_FOUND: GradeItemNotFound,
    CRITERION_NOT_FOUND: CriterionNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoItemizingConcept(database) },
});
