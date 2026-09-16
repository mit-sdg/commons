import type { IndexDescriptionInfo } from "mongodb";
import type { Migration } from "./migration.ts";

function isLegacyAssessmentIndex(index: IndexDescriptionInfo) {
  return (
    index.unique === true &&
    Object.keys(index.key).length === 3 &&
    index.key.learner === 1 &&
    index.key.item === 1 &&
    index.key.evidence === 1
  );
}

export const gradingModes: Migration = {
  id: "20260915T000100-grading-modes",
  description:
    "Give existing competency assessments generation zero and make assessment identity generation-aware.",
  async up(database) {
    const assessments = database.collection("grading.assessments");
    const initialized = await assessments.updateMany(
      { generation: { $exists: false } },
      { $set: { generation: 0 } },
    );
    for (const index of await assessments.listIndexes().toArray()) {
      if (index.name && isLegacyAssessmentIndex(index)) await assessments.dropIndex(index.name);
    }
    await assessments.createIndex(
      { learner: 1, item: 1, evidence: 1, generation: 1 },
      { unique: true },
    );
    await database
      .collection("grading.marks")
      .createIndex({ learner: 1, item: 1, generation: 1 }, { unique: true });
    return {
      summary: `Initialized ${initialized.modifiedCount} competency assessment generation(s); existing grading methods remain competency by default.`,
    };
  },
};
