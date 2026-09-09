import { afterAll, expect, test } from "vite-plus/test";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";
import { competencyAssessments } from "../../src/migrations/20260909T000100-competency-assessments.ts";
afterAll(stopTestDb);
test("upgrade preserves item labels and repeat startup leaves selected rubrics intact", async () => {
  const db = await testDb();
  await db
    .collection("itemizing.items")
    .insertOne({ item: "paper", label: "Paper", maxPoints: 100, status: "ACTIVE" });
  await competencyAssessments.up(db);
  const items = db.collection<{ _id: string; criteria: unknown[] }>("itemizing.assessmentItems");
  await items.updateOne(
    { _id: "paper" },
    { $set: { criteria: [{ criterion: "c", basis: "edition" }] } },
  );
  await competencyAssessments.up(db);
  expect((await items.findOne({ _id: "paper" }))?.criteria).toHaveLength(1);
});
test("unexpected numerical records block upgrade without deleting or guessing", async () => {
  const db = await testDb();
  await db.collection("grading.records").insertOne({ score: 82 });
  expect((await competencyAssessments.up(db)).blocked).toBeTruthy();
  expect(await db.collection("grading.records").countDocuments()).toBe(1);
});
