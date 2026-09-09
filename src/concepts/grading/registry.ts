import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Grading.md" with { type: "text" };
import { MongoGradingConcept } from "./grading.mongo.ts";
import { GradeNotFound, GradeConflict, InvalidJudgments, GradeIncomplete } from "./errors.ts";
export const grading = registerConcept({
  class: MongoGradingConcept,
  spec,
  refusals: {
    GRADE_NOT_FOUND: GradeNotFound,
    GRADE_CONFLICT: GradeConflict,
    INVALID_JUDGMENTS: InvalidJudgments,
    GRADE_INCOMPLETE: GradeIncomplete,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoGradingConcept(database) },
});
