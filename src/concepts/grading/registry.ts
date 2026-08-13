import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Grading.md" with { type: "text" };
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
  class: MongoGradingConcept,
  spec,
  refusals: {
    SCORE_OUT_OF_RANGE: ScoreOutOfRange,
    GRADE_ALREADY_RELEASED: GradeAlreadyReleased,
    LEARNER_EXCUSED: LearnerExcused,
    GRADE_NOT_FOUND: GradeNotFound,
    GRADE_DRAFT_NOT_FOUND: GradeDraftNotFound,
    GRADE_RELEASED_NOT_FOUND: GradeReleasedNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoGradingConcept(database) },
});
