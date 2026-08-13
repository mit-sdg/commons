import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Bookmarking.md" with { type: "text" };
import { BookmarkingConcept } from "./bookmarking.ts";
import { MongoBookmarkingConcept } from "./bookmarking.mongo.ts";
import { BookmarkAlreadyExists, BookmarkNotFound } from "./errors.ts";

export const bookmarking = registerConcept({
  class: BookmarkingConcept,
  spec,
  refusals: {
    BOOKMARK_ALREADY_EXISTS: BookmarkAlreadyExists,
    BOOKMARK_NOT_FOUND: BookmarkNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoBookmarkingConcept(database) },
});
