import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Categorizing.md" with { type: "text" };
import { MongoCategorizingConcept } from "./categorizing.mongo.ts";
import {
  CategoryAlreadyExists,
  CategoryNotFound,
  DifferentScopes,
  ItemNotCategorized,
  SameCategory,
} from "./errors.ts";

export const categorizing = registerConcept({
  class: MongoCategorizingConcept,
  spec,
  refusals: {
    CATEGORY_ALREADY_EXISTS: CategoryAlreadyExists,
    CATEGORY_NOT_FOUND: CategoryNotFound,
    ITEM_NOT_CATEGORIZED: ItemNotCategorized,
    SAME_CATEGORY: SameCategory,
    DIFFERENT_SCOPES: DifferentScopes,
  },
  floors: {
    mongo: ({ database }: { database: Db }, instance: string) =>
      new MongoCategorizingConcept(database, instance),
  },
});
