import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Posting.md" with { type: "text" };
import { PostingConcept } from "./posting.ts";
import { MongoPostingConcept } from "./posting.mongo.ts";
import { PostNotFound } from "./errors.ts";

export const posting = registerConcept({
  class: PostingConcept,
  spec,
  refusals: {
    POST_NOT_FOUND: PostNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoPostingConcept(database) },
});
