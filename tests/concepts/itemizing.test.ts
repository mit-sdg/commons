import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/itemizing/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoItemizingConcept } from "../../src/concepts/itemizing/itemizing.mongo.ts";

const floors: [string, () => Promise<MongoItemizingConcept>][] = [
  ["on MongoDB", async () => new MongoItemizingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

for (const [floor, make] of floors) {
  describe(`Itemizing ${floor}`, () => {
    test("configureItem creates an item and later updates its label and maximum", async () => {
      const c = await make();
      const first = await c.configureItem({ item: "midterm", label: "Midterm", maxPoints: 100 });
      const second = await c.configureItem({
        item: "midterm",
        label: "Midterm (curved)",
        maxPoints: 90,
      });
      expect(second.gradeItem).toBe(first.gradeItem);
      expect(await c._getItem({ item: "midterm" })).toEqual([
        { item: "midterm", label: "Midterm (curved)", maxPoints: 90, status: "ACTIVE" },
      ]);
    });

    test("configureItem refuses a negative maximum", async () => {
      const c = await make();
      expect(
        await refusal(() => c.configureItem({ item: "midterm", label: "Midterm", maxPoints: -1 })),
      ).toBeInstanceOf(refusalErrors.ScoreOutOfRange);
    });

    test("ensureItem finds the existing item and leaves the configured label untouched", async () => {
      const c = await make();
      const { gradeItem } = await c.configureItem({
        item: "hw1",
        label: "Custom label",
        maxPoints: 50,
      });
      const ensured = await c.ensureItem({ item: "hw1", label: "Assignment", maxPoints: 100 });
      expect(ensured.gradeItem).toBe(gradeItem);
      expect(await c._getItem({ item: "hw1" })).toEqual([
        { item: "hw1", label: "Custom label", maxPoints: 50, status: "ACTIVE" },
      ]);
    });

    test("ensureItem makes a fresh item when none is active", async () => {
      const c = await make();
      const made = await c.ensureItem({ item: "hw2", label: "Assignment", maxPoints: 100 });
      expect((await c._getItem({ item: "hw2" }))[0]?.label).toBe("Assignment");

      await c.archiveItem({ item: "hw2" });
      const remade = await c.ensureItem({ item: "hw2", label: "Assignment (redo)", maxPoints: 80 });
      expect(remade.gradeItem).not.toBe(made.gradeItem);
      expect((await c._getItem({ item: "hw2" }))[0]?.label).toBe("Assignment (redo)");
    });

    test("archiveItem retires the active item and refuses when no active item exists", async () => {
      const c = await make();
      expect(await refusal(() => c.archiveItem({ item: "missing" }))).toBeInstanceOf(
        refusalErrors.GradeItemNotFound,
      );
      const { gradeItem } = await c.configureItem({
        item: "final",
        label: "Final",
        maxPoints: 100,
      });
      expect(await c.archiveItem({ item: "final" })).toEqual({ gradeItem });
      expect(await c._getItem({ item: "final" })).toEqual([]);
      expect(await c._getItems({})).toEqual([]);
    });

    test("criteria are added in position order, then revised and removed", async () => {
      const c = await make();
      expect(
        await refusal(() =>
          c.addCriterion({ item: "midterm", name: "Argument", maxPoints: 60, position: 1 }),
        ),
      ).toBeInstanceOf(refusalErrors.GradeItemNotFound);

      await c.configureItem({ item: "midterm", label: "Midterm", maxPoints: 100 });
      const style = await c.addCriterion({
        item: "midterm",
        name: "Style",
        maxPoints: 40,
        position: 2,
      });
      const argument = await c.addCriterion({
        item: "midterm",
        name: "Argument",
        maxPoints: 60,
        position: 1,
      });
      expect((await c._getCriteria({ item: "midterm" })).map((x) => x.name)).toEqual([
        "Argument",
        "Style",
      ]);

      await c.reviseCriterion({
        criterion: style.criterion,
        name: "Clarity",
        maxPoints: 40,
        position: 0,
      });
      expect((await c._getCriteria({ item: "midterm" })).map((x) => x.name)).toEqual([
        "Clarity",
        "Argument",
      ]);
      expect(await c._getCriterion({ criterion: argument.criterion })).toEqual([
        { item: "midterm", name: "Argument", maxPoints: 60 },
      ]);

      expect(await c.removeCriterion({ criterion: argument.criterion })).toEqual({
        criterion: argument.criterion,
      });
      expect(await c._getCriterion({ criterion: argument.criterion })).toEqual([]);
    });

    test("revising or removing an unknown criterion is refused", async () => {
      const c = await make();
      expect(
        await refusal(() =>
          c.reviseCriterion({ criterion: "missing", name: "X", maxPoints: 1, position: 1 }),
        ),
      ).toBeInstanceOf(refusalErrors.CriterionNotFound);
      expect(await refusal(() => c.removeCriterion({ criterion: "missing" }))).toBeInstanceOf(
        refusalErrors.CriterionNotFound,
      );
    });
  });
}
