import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { TaggingConcept } from "./tagging.ts";
import { MongoTaggingConcept } from "./tagging.mongo.ts";
import { TagAlreadyApplied, TagAlreadyExists, TagNotApplied, TagNotFound } from "./errors.ts";

export const tagging = registerConcept({
  class: TaggingConcept,
  spec,
  refusals: {
    TAG_ALREADY_EXISTS: {
      error: TagAlreadyExists,
      on: ["createTag"],
      public: PublicError.CONFLICT,
    },
    TAG_NOT_FOUND: {
      error: TagNotFound,
      on: ["addTag", "deleteTag"],
      public: PublicError.NOT_FOUND,
    },
    TAG_ALREADY_APPLIED: {
      error: TagAlreadyApplied,
      on: ["addTag"],
      public: PublicError.CONFLICT,
    },
    TAG_NOT_APPLIED: {
      error: TagNotApplied,
      on: ["removeTag"],
      public: PublicError.CONFLICT,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoTaggingConcept(database) },
});
