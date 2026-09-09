import { afterAll, expect, test } from "vite-plus/test";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";
import { MongoItemizingConcept } from "../../src/concepts/itemizing/itemizing.mongo.ts";
import { InvalidCriterion, GradeItemNotFound } from "../../src/concepts/itemizing/errors.ts";
afterAll(stopTestDb);
test("selection changes preserve historical criterion identity and basis", async () => {
  const c = new MongoItemizingConcept(await testDb());
  await c.configureItem({ item: "paper", label: "Paper" });
  const old = await c.addCriterion({ item: "paper", basis: "edition-1", position: 0 });
  await c.removeCriterion(old);
  const current = await c.addCriterion({ item: "paper", basis: "edition-2", position: 0 });
  expect(await c._getCriteria({ item: "paper" })).toEqual([
    { ...current, basis: "edition-2", position: 0 },
  ]);
  expect(await c._getCriterion(old)).toEqual([
    { item: "paper", basis: "edition-1", position: 0, active: false },
  ]);
});
test("duplicate selections are refused even under concurrent creation", async () => {
  const c = new MongoItemizingConcept(await testDb());
  await c.configureItem({ item: "paper", label: "Paper" });
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      c.addCriterion({ item: "paper", basis: "edition", position: 0 }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  await expect(
    c.addCriterion({ item: "paper", basis: "other", position: -1 }),
  ).rejects.toBeInstanceOf(InvalidCriterion);
});
test("ensuring does not overwrite or reactivate; configuration does", async () => {
  const c = new MongoItemizingConcept(await testDb());
  await c.configureItem({ item: "paper", label: "Custom" });
  await c.archiveItem({ item: "paper" });
  await c.ensureItem({ item: "paper", label: "New" });
  expect(await c._getItem({ item: "paper" })).toEqual([
    { item: "paper", label: "Custom", status: "ARCHIVED" },
  ]);
  await expect(
    c.addCriterion({ item: "paper", basis: "edition", position: 0 }),
  ).rejects.toBeInstanceOf(GradeItemNotFound);
  await c.configureItem({ item: "paper", label: "Reopened" });
  expect(await c._getItems()).toEqual([{ item: "paper", label: "Reopened" }]);
});
