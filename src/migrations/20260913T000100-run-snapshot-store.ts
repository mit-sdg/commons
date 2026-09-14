import type { Migration } from "./migration.ts";

/**
 * Snapshotting instances used to share one store, because only live runs
 * captured anything. Forum audience notices now capture too, so each instance
 * keeps its own prefixed store and every row written before the split belongs
 * to RunSnapshotting.
 *
 * Left alone, a preserved deployment's captured run presentations become
 * invisible: a run page finds no snapshot and cannot show the questions its
 * participants answered, while a notice capture could take the subject a run
 * already holds.
 */
export const runSnapshotStore: Migration = {
  id: "20260913T000100-run-snapshot-store",
  description: "Move captured live-run snapshots to RunSnapshotting's own store.",
  async up(database) {
    const shared = database.collection<{ _id: string; subject: string; value: unknown }>(
      "snapshotting.snapshots",
    );
    const runs = database.collection<{ _id: string; subject: string; value: unknown }>(
      "runSnapshotting.snapshots",
    );
    const moving = await shared.find({}).toArray();
    if (moving.length === 0) return { summary: "no snapshots in the shared store" };
    // A row already at the destination is the newer one; it stays as it is.
    const settled = new Set(
      (
        await runs
          .find({ _id: { $in: moving.map((row) => row._id) } }, { projection: { _id: 1 } })
          .toArray()
      ).map((row) => row._id),
    );
    const moved = moving.filter((row) => !settled.has(row._id));
    for (const row of moved) {
      await runs.insertOne(row);
    }
    await shared.deleteMany({ _id: { $in: moving.map((row) => row._id) } });
    const kept = moving.length - moved.length;
    return {
      summary:
        `moved ${moved.length} run snapshot(s) to RunSnapshotting's store` +
        (kept === 0 ? "" : `, ${kept} already there kept`),
    };
  },
};
