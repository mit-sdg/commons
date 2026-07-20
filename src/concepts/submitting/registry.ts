import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { SubmittingConcept } from "./submitting.ts";
import { MongoSubmittingConcept } from "./submitting.mongo.ts";
import { SubmissionNotFound, SubmissionNotSubmitted, SubmissionNotWithdrawn } from "./errors.ts";

export const submitting = registerConcept({
  class: SubmittingConcept,
  spec,
  refusals: {
    SUBMISSION_NOT_FOUND: {
      error: SubmissionNotFound,
      on: ["withdraw", "restore"],
      public: PublicError.NOT_FOUND,
    },
    SUBMISSION_NOT_SUBMITTED: {
      error: SubmissionNotSubmitted,
      on: ["withdraw"],
      public: PublicError.CONFLICT,
    },
    SUBMISSION_NOT_WITHDRAWN: {
      error: SubmissionNotWithdrawn,
      on: ["restore"],
      public: PublicError.CONFLICT,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoSubmittingConcept(database) },
});
