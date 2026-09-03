import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Suggesting.md" with { type: "text" };
import {
  InvalidSuggestion,
  NothingOffered,
  SuggestionNotFound,
  SuggestionSettled,
} from "./errors.ts";
import { MongoSuggestingConcept } from "./suggesting.mongo.ts";

export const suggesting = registerConcept({
  class: MongoSuggestingConcept,
  spec,
  refusals: {
    NOTHING_OFFERED: NothingOffered,
    INVALID_SUGGESTION: InvalidSuggestion,
    SUGGESTION_NOT_FOUND: SuggestionNotFound,
    SUGGESTION_SETTLED: SuggestionSettled,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoSuggestingConcept(database) },
});
