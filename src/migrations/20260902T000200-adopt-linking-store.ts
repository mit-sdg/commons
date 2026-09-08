import type { Migration } from "./migration.ts";

/**
 * Linking instances used to share one store, so AdoptLinking's rows — a
 * drafting brief linked to the questionnaire it composed — sat beside the
 * forum's post links. Each instance now keeps its own prefixed store, and the
 * rows whose source is a brief move to AdoptLinking's.
 */
export const adoptLinkingStore: Migration = {
  id: "20260902T000200-adopt-linking-store",
  description: "Move drafting-brief links from the shared Linking store to AdoptLinking's own.",
  async up(database) {
    const links = database.collection<{ _id: string; targets: string[]; seq: number }>(
      "linking.links",
    );
    const adoptLinks = database.collection<{ _id: string; targets: string[]; seq: number }>(
      "adoptLinking.links",
    );
    const briefs = database.collection<{ _id: string }>("drafting.briefs");
    const briefIds = new Set(
      (await briefs.find({}, { projection: { _id: 1 } }).toArray()).map((row) => row._id),
    );
    const moving = (await links.find({}).toArray()).filter((row) => briefIds.has(row._id));
    // A row already at the destination is the newer one; it stays as it is.
    const settled = new Set(
      (
        await adoptLinks
          .find({ _id: { $in: moving.map((row) => row._id) } }, { projection: { _id: 1 } })
          .toArray()
      ).map((row) => row._id),
    );
    const moved = moving.filter((row) => !settled.has(row._id));
    for (const row of moved) {
      await adoptLinks.insertOne(row);
    }
    // Include rows copied before an interrupted attempt, and any newer row
    // retained at the destination. A retry may have no new rows to insert.
    const latest = await adoptLinks.find().sort({ seq: -1 }).limit(1).next();
    const highest = latest?.seq ?? 0;
    if (highest > 0) {
      await database
        .collection<{ _id: string; value: number }>("adoptLinking.counters")
        .updateOne({ _id: "links" }, { $max: { value: highest } }, { upsert: true });
    }
    if (moving.length === 0) return { summary: "no drafting-brief links in the shared store" };
    await links.deleteMany({ _id: { $in: moving.map((row) => row._id) } });
    const kept = moving.length - moved.length;
    return {
      summary:
        `moved ${moved.length} drafting-brief link(s) to AdoptLinking's store` +
        (kept === 0 ? "" : `, ${kept} already there kept`),
    };
  },
};
