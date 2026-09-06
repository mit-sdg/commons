import type { Migration } from "./migration.ts";

/** Preserve existing drafting context while making future selections explicit. */
export const referenceSelections: Migration = {
  id: "20260906T000100-reference-selections",
  description: "Move drafting documents to the library and retain existing activity selections.",
  async up(database) {
    const documents = database.collection<{
      _id: string;
      subject: string;
      use: string;
      seq: number;
      previousSubject?: string;
    }>("guiding.guidance");
    const all = await documents.find({ use: "drafting" }).sort({ seq: 1 }).toArray();
    const shared = all
      .filter((doc) => (doc.previousSubject ?? doc.subject) === "commons")
      .map((doc) => doc._id);
    const selections = database.collection<{
      _id: string;
      subject: string;
      use: string;
      guidances: string[];
    }>("guiding.selections");
    let count = 0;
    for (const name of ["relaying.relays", "questioning.questionnaires"]) {
      for await (const activity of database.collection<{ _id: string }>(name).find({})) {
        const guidances = [
          ...shared,
          ...all
            .filter((doc) => (doc.previousSubject ?? doc.subject) === activity._id)
            .map((doc) => doc._id),
        ];
        await selections.updateOne(
          { _id: JSON.stringify([activity._id, "drafting"]) },
          { $setOnInsert: { subject: activity._id, use: "drafting", guidances } },
          { upsert: true },
        );
        count++;
      }
    }
    // Save the old owner before moving; a retry can still reconstruct selections.
    for (const doc of all) {
      if (doc.subject === "commons") continue;
      await documents.updateOne(
        { _id: doc._id },
        { $set: { subject: "commons", previousSubject: doc.subject } },
      );
    }
    await database
      .collection("drafting.briefs")
      .updateMany(
        { context: { $exists: false } },
        { $set: { context: JSON.stringify({ references: shared, kind: "" }) } },
      );
    return { summary: `Preserved references for ${count} existing activities.` };
  },
};
