import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { CategorizingConcept } from "./categorizing.ts";
import { MongoCategorizingConcept } from "./categorizing.mongo.ts";
import { CategoryAlreadyExists, CategoryNotFound, ItemNotCategorized } from "./errors.ts";

export const categorizing = registerConcept({
  class: CategorizingConcept,
  spec,
  queries: {
    _getCategory: "optional",
    _getHome: "optional",
    _getItems: "many",
    _getAllCategories: "many",
  },
  refusals: {
    CATEGORY_ALREADY_EXISTS: {
      error: CategoryAlreadyExists,
      on: ["createCategory"],
      public: PublicError.CONFLICT,
    },
    CATEGORY_NOT_FOUND: {
      error: CategoryNotFound,
      on: ["assign", "deleteCategory"],
      public: PublicError.NOT_FOUND,
    },
    ITEM_NOT_CATEGORIZED: {
      error: ItemNotCategorized,
      on: ["unassign"],
      public: PublicError.CONFLICT,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoCategorizingConcept(database) },
});
