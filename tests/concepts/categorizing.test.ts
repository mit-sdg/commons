import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/categorizing/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoCategorizingConcept } from "../../src/concepts/categorizing/categorizing.mongo.ts";

const floors: [string, () => Promise<MongoCategorizingConcept>][] = [
  ["on MongoDB", async () => new MongoCategorizingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

for (const [floor, make] of floors) {
  describe(`Categorizing ${floor}`, () => {
    test("createCategory creates a named category", async () => {
      const categorizing = await make();
      const { category } = await categorizing.createCategory({
        name: "Homework",
        description: "Weekly practice",
      });
      expect(await categorizing._getAllCategories({})).toEqual([
        { category, name: "Homework", description: "Weekly practice" },
      ]);
    });

    test("createCategory refuses a duplicate name", async () => {
      const categorizing = await make();
      await categorizing.createCategory({ name: "Homework", description: "a" });
      expect(
        await refusalOf(() => categorizing.createCategory({ name: "Homework", description: "b" })),
      ).toBeInstanceOf(refusalErrors.CategoryAlreadyExists);
    });

    test("assign makes the category the item's only home and replaces the previous home", async () => {
      const categorizing = await make();
      const { category: homework } = await categorizing.createCategory({
        name: "Homework",
        description: "",
      });
      const { category: exams } = await categorizing.createCategory({
        name: "Exams",
        description: "",
      });
      expect(await categorizing.assign({ item: "quiz", category: homework })).toEqual({
        item: "quiz",
      });
      expect(await categorizing._getCategory({ item: "quiz" })).toEqual([
        { category: homework, name: "Homework", description: "" },
      ]);
      await categorizing.assign({ item: "quiz", category: exams });
      await categorizing.assign({ item: "quiz", category: exams });
      expect(await categorizing._getHome({ item: "quiz" })).toEqual([
        { home: { category: exams, name: "Exams", description: "" } },
      ]);
      expect(await categorizing._getItems({ category: homework })).toEqual([]);
      expect(await categorizing._getItems({ category: exams })).toEqual([{ item: "quiz" }]);
    });

    test("assign refuses a category that does not exist", async () => {
      const categorizing = await make();
      expect(
        await refusalOf(() => categorizing.assign({ item: "quiz", category: "ghost" })),
      ).toBeInstanceOf(refusalErrors.CategoryNotFound);
    });

    test("unassign removes the home and refuses when there is none", async () => {
      const categorizing = await make();
      const { category } = await categorizing.createCategory({ name: "Homework", description: "" });
      await categorizing.assign({ item: "quiz", category });
      expect(await categorizing.unassign({ item: "quiz" })).toEqual({ item: "quiz" });
      expect(await categorizing._getCategory({ item: "quiz" })).toEqual([]);
      expect(await refusalOf(() => categorizing.unassign({ item: "quiz" }))).toBeInstanceOf(
        refusalErrors.ItemNotCategorized,
      );
    });

    test("ensureCategory reaches the existing category and creates only when none has the name", async () => {
      const categorizing = await make();
      const { category } = await categorizing.createCategory({
        name: "Homework",
        description: "a",
      });
      expect(await categorizing.ensureCategory({ name: "Homework", description: "b" })).toEqual({
        category,
      });
      const { category: exams } = await categorizing.ensureCategory({
        name: "Exams",
        description: "c",
      });
      expect(exams).not.toBe(category);
      expect(await categorizing._getCategoryDetail({ category })).toEqual([
        { name: "Homework", description: "a" },
      ]);
      expect(await categorizing._getCategoryDetail({ category: "ghost" })).toEqual([]);
    });

    test("renameCategory keeps the items and refuses a name another category already holds", async () => {
      const categorizing = await make();
      const { category } = await categorizing.createCategory({
        name: "Homework",
        description: "a",
      });
      await categorizing.createCategory({ name: "Exams", description: "b" });
      await categorizing.assign({ item: "quiz", category });

      expect(await categorizing.renameCategory({ category, name: "Practice" })).toEqual({
        category,
      });
      expect(await categorizing._getCategoryDetail({ category })).toEqual([
        { name: "Practice", description: "a" },
      ]);
      expect(await categorizing._getItems({ category })).toEqual([{ item: "quiz" }]);
      expect(await categorizing.renameCategory({ category, name: "Practice" })).toEqual({
        category,
      });
      expect(
        await refusalOf(() => categorizing.renameCategory({ category, name: "Exams" })),
      ).toBeInstanceOf(refusalErrors.CategoryAlreadyExists);
      expect(
        await refusalOf(() => categorizing.renameCategory({ category: "ghost", name: "Other" })),
      ).toBeInstanceOf(refusalErrors.CategoryNotFound);
    });

    test("a second instance keeps its categories in its own store", async () => {
      const database = await testDb();
      const forum = new MongoCategorizingConcept(database);
      const lists = new MongoCategorizingConcept(database, "TaskLists");
      await forum.createCategory({ name: "Homework", description: "" });
      const { category } = await lists.createCategory({ name: "Homework", description: "" });
      expect(await lists._getAllCategories({})).toEqual([
        { category, name: "Homework", description: "" },
      ]);
      expect(await forum._getAllCategories({})).toHaveLength(1);
      expect((await forum._getAllCategories({}))[0].category).not.toBe(category);
    });

    test("deleteCategory removes the category and its item memberships", async () => {
      const categorizing = await make();
      const { category } = await categorizing.createCategory({ name: "Exams", description: "" });
      await categorizing.assign({ item: "quiz", category });
      expect(await categorizing.deleteCategory({ category })).toEqual({ category });
      expect(await categorizing._getAllCategories({})).toEqual([]);
      expect(await categorizing._getCategory({ item: "quiz" })).toEqual([]);
      expect(await refusalOf(() => categorizing.deleteCategory({ category }))).toBeInstanceOf(
        refusalErrors.CategoryNotFound,
      );
    });
  });
}
