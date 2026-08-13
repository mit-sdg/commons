import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Assigning.md" with { type: "text" };
import { AssigningConcept } from "./assigning.ts";
import { MongoAssigningConcept } from "./assigning.mongo.ts";
import {
  AssignmentAudienceInvalid,
  AssignmentEveryoneNoTargets,
  AssignmentNotDraft,
  AssignmentNotFound,
  AssignmentNotPublished,
  AssignmentNotRevisable,
  AssignmentTargetsRequired,
  ReleaseAlreadyExists,
  ReleaseNotFound,
} from "./errors.ts";

export const assigning = registerConcept({
  class: AssigningConcept,
  spec,
  refusals: {
    ASSIGNMENT_AUDIENCE_INVALID: AssignmentAudienceInvalid,
    ASSIGNMENT_EVERYONE_NO_TARGETS: AssignmentEveryoneNoTargets,
    ASSIGNMENT_TARGETS_REQUIRED: AssignmentTargetsRequired,
    ASSIGNMENT_NOT_FOUND: AssignmentNotFound,
    ASSIGNMENT_NOT_REVISABLE: AssignmentNotRevisable,
    ASSIGNMENT_NOT_DRAFT: AssignmentNotDraft,
    ASSIGNMENT_NOT_PUBLISHED: AssignmentNotPublished,
    RELEASE_ALREADY_EXISTS: ReleaseAlreadyExists,
    RELEASE_NOT_FOUND: ReleaseNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoAssigningConcept(database) },
});
