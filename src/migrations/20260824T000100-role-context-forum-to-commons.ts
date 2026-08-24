import type { Migration } from "./migration.ts";

/**
 * Commons renamed its one reserved role context from `forum` to `commons`,
 * because a single context now holds both forum and course capabilities and
 * naming it after the forum had stopped being true.
 *
 * Roling stores a context as an opaque string, so nothing rewrites it on its
 * own. Left alone, every stored assignment keeps saying `forum` while every
 * capability check asks about `commons`: no account holds any capability, no
 * account holds `administer`, and no endpoint can restore one — recovery would
 * need direct database access. This migration is what keeps a preserved
 * deployment reachable across the rename.
 */
export const roleContextForumToCommons: Migration = {
  id: "20260824T000100-role-context-forum-to-commons",
  description: "Move role assignments from the `forum` context to `commons`.",
  async up(database) {
    const assignments = database.collection<{ _id: string; user: string; context: string }>(
      "roling.assignments",
    );

    // A user holds at most one role per context, so an assignment already in
    // `commons` would collide with the one being moved. That only happens if a
    // partly-migrated deployment ran the rename before, which the ledger
    // normally prevents; handle it anyway, since the ledger is an optimisation.
    const existing = new Set(
      (await assignments.find({ context: "commons" }, { projection: { user: 1 } }).toArray()).map(
        (row) => row.user,
      ),
    );
    const stale = await assignments.find({ context: "forum" }).toArray();
    if (stale.length === 0) return { summary: "no role assignments named the `forum` context" };

    const conflicting = stale.filter((row) => existing.has(row.user));
    const movable = stale.filter((row) => !existing.has(row.user));

    if (movable.length > 0) {
      await assignments.updateMany(
        { _id: { $in: movable.map((row) => row._id) } },
        { $set: { context: "commons" } },
      );
    }

    // A conflicting row is a duplicate of an assignment the user already holds
    // in the new context, so dropping it restores the one-role-per-context rule
    // rather than losing a grant.
    if (conflicting.length > 0) {
      await assignments.deleteMany({ _id: { $in: conflicting.map((row) => row._id) } });
    }

    const moved = `moved ${movable.length} role assignment(s) to the \`commons\` context`;
    return {
      summary:
        conflicting.length === 0
          ? moved
          : `${moved}; dropped ${conflicting.length} duplicate(s) already held there`,
    };
  },
};
