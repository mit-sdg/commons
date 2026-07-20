import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { BookmarkingConcept } from "./bookmarking.ts";
import { MongoBookmarkingConcept } from "./bookmarking.mongo.ts";
import { BookmarkAlreadyExists, BookmarkNotFound } from "./errors.ts";

export const bookmarking = registerConcept({
  class: BookmarkingConcept,
  spec,
  queries: {
    _getSaved: "many",
    _isSaved: "one",
  },
  refusals: {
    BOOKMARK_ALREADY_EXISTS: {
      error: BookmarkAlreadyExists,
      on: ["save"],
      public: PublicError.CONFLICT,
    },
    BOOKMARK_NOT_FOUND: {
      error: BookmarkNotFound,
      on: ["unsave"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoBookmarkingConcept(database) },
});
