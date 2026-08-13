import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Bookmarking.md" with { type: "text" };
import { MongoBookmarkingConcept } from "./bookmarking.mongo.ts";
import { BookmarkAlreadyExists, BookmarkNotFound } from "./errors.ts";

export const bookmarking = registerConcept({
  class: MongoBookmarkingConcept,
  spec,
  refusals: {
    BOOKMARK_ALREADY_EXISTS: BookmarkAlreadyExists,
    BOOKMARK_NOT_FOUND: BookmarkNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoBookmarkingConcept(database) },
});
