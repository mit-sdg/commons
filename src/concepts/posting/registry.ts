import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { PostingConcept } from "./posting.ts";
import { MongoPostingConcept } from "./posting.mongo.ts";
import { PostNotFound } from "./errors.ts";

export const posting = registerConcept({
  class: PostingConcept,
  spec,
  queries: {
    _getPost: "optional",
    _getByAuthor: "many",
    _getMentions: "many",
    _isMentioned: "one",
  },
  refusals: {
    POST_NOT_FOUND: {
      error: PostNotFound,
      on: ["edit", "delete"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoPostingConcept(database) },
});
