import type { Migration } from "./migration.ts";

/**
 * A round's take names how the picked piles are used, not how they were picked.
 *
 * A draw's shape used to say which piles a round carried — the ones tapped,
 * every one, or the fullest three — and every shape filled the round's
 * choices. Picking is now the dashboard's at run time, and the shape says what
 * the round does with what was picked: `context`, `choices`, or `parts`. Every
 * draw written before this release filled choices, so that is the use it takes.
 */
export const carryUses: Migration = {
  id: "20260903T000100-carry-uses",
  description: "Name every stored draw's use `choices`.",
  async up(database) {
    const draws = database.collection("relaying.draws");
    const result = await draws.updateMany(
      { shape: { $in: ["picked", "every", "top"] } },
      { $set: { shape: "choices" } },
    );
    return {
      summary:
        result.modifiedCount === 0
          ? "every stored draw already named a use"
          : `named the use of ${result.modifiedCount} draw(s) \`choices\``,
    };
  },
};
