import type { Migration } from "./migration.ts";

/**
 * A category now lives in a scope, and its name is unique only within it.
 *
 * Categorizing was a single flat set of names when the forum was the only thing
 * sorting anything. Now that a class sorts its own material, the concept keeps a
 * scope beside each name, and every query that lists categories asks for one
 * scope. A stored category has no scope, so it belongs to none: the forum's
 * category list would come back empty and `createCategory` would let a duplicate
 * name through. Every category written before this release was the forum's, so
 * that is the scope they take.
 */
export const categorizingScope: Migration = {
  id: "20260902T000100-categorizing-scope",
  description: "Place every stored category in the `forum` scope.",
  async up(database) {
    const categories = database.collection("categorizing.categories");
    const result = await categories.updateMany(
      { scope: { $exists: false } },
      { $set: { scope: "forum" } },
    );
    return {
      summary:
        result.modifiedCount === 0
          ? "every stored category already named a scope"
          : `placed ${result.modifiedCount} category(ies) in the \`forum\` scope`,
    };
  },
};
