import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Tagging.md" with { type: "text" };
import { MongoTaggingConcept } from "./tagging.mongo.ts";
import { TagAlreadyApplied, TagAlreadyExists, TagNotApplied, TagNotFound } from "./errors.ts";

export const tagging = registerConcept({
  class: MongoTaggingConcept,
  spec,
  refusals: {
    TAG_ALREADY_EXISTS: TagAlreadyExists,
    TAG_NOT_FOUND: TagNotFound,
    TAG_ALREADY_APPLIED: TagAlreadyApplied,
    TAG_NOT_APPLIED: TagNotApplied,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoTaggingConcept(database) },
});
