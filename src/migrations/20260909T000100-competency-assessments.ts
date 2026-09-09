import type { Migration } from "./migration.ts";
export const competencyAssessments: Migration = {
  id: "20260909T000100-competency-assessments",
  description:
    "Preserve assignment labels and initialize categorical assessments without translating numerical grades.",
  async up(database) {
    if ((await database.collection("grading.records").countDocuments({})) > 0)
      return {
        summary: "",
        blocked:
          "Numerical grades exist. This release requires an explicit preservation plan; no points were converted or deleted.",
      };
    const items = database.collection<{
      _id: string;
      label: string;
      status: string;
      criteria: unknown[];
    }>("itemizing.assessmentItems");
    let preserved = 0;
    for await (const item of database
      .collection<{ _id: string; item: string; label: string; status: string }>("itemizing.items")
      .find({ status: "ACTIVE" })) {
      await items.updateOne(
        { _id: item.item },
        { $setOnInsert: { label: item.label, status: "ACTIVE", criteria: [] } },
        { upsert: true },
      );
      preserved++;
    }
    await database
      .collection("grading.assessments")
      .createIndex({ learner: 1, item: 1, evidence: 1 }, { unique: true });
    return {
      summary: `Preserved ${preserved} item label(s). Select described rubric editions before assessing work; legacy configuration is retained unchanged.`,
    };
  },
};
