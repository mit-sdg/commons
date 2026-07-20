import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
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
  queries: {
    _getDetail: "optional",
    _getAssignments: "many",
    _getAssigned: "many",
    _getAssignees: "many",
    _isAssigned: "one",
    _getPublishedForAudience: "many",
    _getPublishedInWindow: "many",
  },
  refusals: {
    ASSIGNMENT_AUDIENCE_INVALID: {
      error: AssignmentAudienceInvalid,
      on: ["createDraft", "revise"],
      public: PublicError.INVALID_REQUEST,
    },
    ASSIGNMENT_EVERYONE_NO_TARGETS: {
      error: AssignmentEveryoneNoTargets,
      on: ["createDraft", "revise"],
      public: PublicError.INVALID_REQUEST,
    },
    ASSIGNMENT_TARGETS_REQUIRED: {
      error: AssignmentTargetsRequired,
      on: ["createDraft", "revise"],
      public: PublicError.INVALID_REQUEST,
    },
    ASSIGNMENT_NOT_FOUND: {
      error: AssignmentNotFound,
      on: ["revise", "publish", "archive", "assign"],
      public: PublicError.NOT_FOUND,
    },
    ASSIGNMENT_NOT_REVISABLE: {
      error: AssignmentNotRevisable,
      on: ["revise"],
      public: PublicError.CONFLICT,
    },
    ASSIGNMENT_NOT_DRAFT: {
      error: AssignmentNotDraft,
      on: ["publish"],
      public: PublicError.CONFLICT,
    },
    ASSIGNMENT_NOT_PUBLISHED: {
      error: AssignmentNotPublished,
      on: ["assign"],
      public: PublicError.CONFLICT,
    },
    RELEASE_ALREADY_EXISTS: {
      error: ReleaseAlreadyExists,
      on: ["assign"],
      public: PublicError.CONFLICT,
    },
    RELEASE_NOT_FOUND: {
      error: ReleaseNotFound,
      on: ["setDueOverride", "clearDueOverride"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoAssigningConcept(database) },
});
