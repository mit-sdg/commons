import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Submitting.md" with { type: "text" };
import { SubmittingConcept } from "./submitting.ts";
import { MongoSubmittingConcept } from "./submitting.mongo.ts";
import { SubmissionNotFound, SubmissionNotSubmitted, SubmissionNotWithdrawn } from "./errors.ts";

export const submitting = registerConcept({
  class: SubmittingConcept,
  spec,
  refusals: {
    SUBMISSION_NOT_FOUND: SubmissionNotFound,
    SUBMISSION_NOT_SUBMITTED: SubmissionNotSubmitted,
    SUBMISSION_NOT_WITHDRAWN: SubmissionNotWithdrawn,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoSubmittingConcept(database) },
});
