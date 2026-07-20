import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { GradingConcept } from "./grading.ts";
import { MongoGradingConcept } from "./grading.mongo.ts";
import {
  GradeAlreadyReleased,
  GradeDraftNotFound,
  GradeNotFound,
  GradeReleasedNotFound,
  LearnerExcused,
  ScoreOutOfRange,
} from "./errors.ts";

export const grading = registerConcept({
  class: GradingConcept,
  spec,
  queries: {
    _getGrade: "optional",
    _getGradesForLearner: "many",
    _getGradesForItem: "many",
    _getCriterionScores: "many",
  },
  refusals: {
    SCORE_OUT_OF_RANGE: {
      error: ScoreOutOfRange,
      on: ["record", "scoreCriterion"],
      public: PublicError.INVALID_REQUEST,
    },
    GRADE_ALREADY_RELEASED: {
      error: GradeAlreadyReleased,
      on: ["record", "scoreCriterion"],
      public: PublicError.CONFLICT,
    },
    LEARNER_EXCUSED: {
      error: LearnerExcused,
      on: ["record", "scoreCriterion"],
      public: PublicError.CONFLICT,
    },
    GRADE_NOT_FOUND: {
      error: GradeNotFound,
      on: ["scoreCriterion", "excuse"],
      public: PublicError.NOT_FOUND,
    },
    GRADE_DRAFT_NOT_FOUND: {
      error: GradeDraftNotFound,
      on: ["release"],
      public: PublicError.NOT_FOUND,
    },
    GRADE_RELEASED_NOT_FOUND: {
      error: GradeReleasedNotFound,
      on: ["retract"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoGradingConcept(database) },
});
