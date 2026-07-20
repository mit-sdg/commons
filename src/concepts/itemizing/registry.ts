import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { ItemizingConcept } from "./itemizing.ts";
import { MongoItemizingConcept } from "./itemizing.mongo.ts";
import { CriterionNotFound, GradeItemNotFound, ScoreOutOfRange } from "./errors.ts";

export const itemizing = registerConcept({
  class: ItemizingConcept,
  spec,
  queries: {
    _getItem: "optional",
    _getItems: "many",
    _getCriteria: "many",
    _getCriterion: "optional",
  },
  refusals: {
    SCORE_OUT_OF_RANGE: {
      error: ScoreOutOfRange,
      on: ["configureItem"],
      public: PublicError.INVALID_REQUEST,
    },
    GRADE_ITEM_NOT_FOUND: {
      error: GradeItemNotFound,
      on: ["archiveItem", "addCriterion"],
      public: PublicError.NOT_FOUND,
    },
    CRITERION_NOT_FOUND: {
      error: CriterionNotFound,
      on: ["reviseCriterion", "removeCriterion"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoItemizingConcept(database) },
});
