import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/categorizing/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoCategorizingConcept } from "../../src/concepts/categorizing/categorizing.mongo.ts";

const floors: [string, () => Promise<MongoCategorizingConcept>][] = [
  ["on MongoDB", async () => new MongoCategorizingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;
const forum = "forum";

for (const [floor, make] of floors) {
  describe(`Categorizing ${floor}`, () => {
    test("createCategory creates a named category in its scope", async () => {
      const categorizing = await make();
      const { category } = await categorizing.createCategory({
        scope: forum,
        name: "Homework",
        description: "Weekly practice",
      });
      expect(await categorizing._categoriesIn({ scope: forum })).toEqual([
        { category, name: "Homework", description: "Weekly practice" },
      ]);
      expect(await categorizing._categoriesIn({ scope: "course" })).toEqual([]);
    });

    test("createCategory refuses a duplicate name", async () => {
      const categorizing = await make();
      await categorizing.createCategory({ scope: forum, name: "Homework", description: "a" });
      expect(
        await refusalOf(() =>
          categorizing.createCategory({ scope: forum, name: "Homework", description: "b" }),
        ),
      ).toBeInstanceOf(refusalErrors.CategoryAlreadyExists);
    });

    test("a name is unique within its scope, so two scopes may each hold it", async () => {
      const categorizing = await make();
      const { category: inForum } = await categorizing.createCategory({
        scope: forum,
        name: "Homework",
        description: "the forum's",
      });
      const { category: inCourse } = await categorizing.createCategory({
        scope: "course",
        name: "Homework",
        description: "the course's",
      });
      expect(inCourse).not.toBe(inForum);
      expect(await categorizing._categoriesIn({ scope: forum })).toEqual([
        { category: inForum, name: "Homework", description: "the forum's" },
      ]);
      expect(await categorizing._categoriesIn({ scope: "course" })).toEqual([
        { category: inCourse, name: "Homework", description: "the course's" },
      ]);
      // Ensuring reaches the one in the named scope rather than the other.
      expect(
        await categorizing.ensureCategory({ scope: "course", name: "Homework", description: "x" }),
      ).toEqual({ category: inCourse });
      // And renaming across a scope boundary is no clash at all.
      expect(await categorizing.renameCategory({ category: inCourse, name: "Exams" })).toEqual({
        category: inCourse,
      });
      await categorizing.createCategory({ scope: forum, name: "Exams", description: "" });
      expect(await categorizing.renameCategory({ category: inCourse, name: "Exams" })).toEqual({
        category: inCourse,
      });
    });

    test("assign makes the category the item's only home and replaces the previous home", async () => {
      const categorizing = await make();
      const { category: homework } = await categorizing.createCategory({
        scope: forum,
        name: "Homework",
        description: "",
      });
      const { category: exams } = await categorizing.createCategory({
        scope: forum,
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
      const { category } = await categorizing.createCategory({
        scope: forum,
        name: "Homework",
        description: "",
      });
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
        scope: forum,
        name: "Homework",
        description: "a",
      });
      expect(
        await categorizing.ensureCategory({ scope: forum, name: "Homework", description: "b" }),
      ).toEqual({ category });
      const { category: exams } = await categorizing.ensureCategory({
        scope: forum,
        name: "Exams",
        description: "c",
      });
      expect(exams).not.toBe(category);
      expect(await categorizing._getCategoryDetail({ category })).toEqual([
        { scope: forum, name: "Homework", description: "a" },
      ]);
      expect(await categorizing._getCategoryDetail({ category: "ghost" })).toEqual([]);
    });

    test("describeCategory replaces the description and refuses an unknown category", async () => {
      const categorizing = await make();
      const { category } = await categorizing.createCategory({
        scope: forum,
        name: "Exams",
        description: "",
      });
      expect(await categorizing.describeCategory({ category, description: "Sat papers" })).toEqual({
        category,
      });
      expect(await categorizing._getCategoryDetail({ category })).toEqual([
        { scope: forum, name: "Exams", description: "Sat papers" },
      ]);
      expect(
        await refusalOf(() =>
          categorizing.describeCategory({ category: "ghost", description: "x" }),
        ),
      ).toBeInstanceOf(refusalErrors.CategoryNotFound);
    });

    test("renameCategory keeps the items and refuses a name another category already holds", async () => {
      const categorizing = await make();
      const { category } = await categorizing.createCategory({
        scope: forum,
        name: "Homework",
        description: "a",
      });
      await categorizing.createCategory({ scope: forum, name: "Exams", description: "b" });
      await categorizing.assign({ item: "quiz", category });

      expect(await categorizing.renameCategory({ category, name: "Practice" })).toEqual({
        category,
      });
      expect(await categorizing._getCategoryDetail({ category })).toEqual([
        { scope: forum, name: "Practice", description: "a" },
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

    test("mergeCategory moves every item into the target and leaves the source gone", async () => {
      const categorizing = await make();
      const { category: tests } = await categorizing.createCategory({
        scope: forum,
        name: "Tests",
        description: "the old name",
      });
      const { category: exams } = await categorizing.createCategory({
        scope: forum,
        name: "Exams",
        description: "the one that stays",
      });
      await categorizing.assign({ item: "midterm", category: exams });
      await categorizing.assign({ item: "pop-quiz", category: tests });
      await categorizing.assign({ item: "final", category: exams });

      expect(await categorizing.mergeCategory({ category: tests, into: exams })).toEqual({
        into: exams,
      });
      expect(await categorizing._categoriesIn({ scope: forum })).toEqual([
        { category: exams, name: "Exams", description: "the one that stays" },
      ]);
      // Every item keeps the order it was assigned in, merged items included.
      expect(await categorizing._getItems({ category: exams })).toEqual([
        { item: "midterm" },
        { item: "pop-quiz" },
        { item: "final" },
      ]);
      expect(await categorizing._getCategory({ item: "pop-quiz" })).toEqual([
        { category: exams, name: "Exams", description: "the one that stays" },
      ]);
    });

    test("mergeCategory refuses an unknown category, itself, and a category in another scope", async () => {
      const categorizing = await make();
      const { category: exams } = await categorizing.createCategory({
        scope: forum,
        name: "Exams",
        description: "",
      });
      const { category: elsewhere } = await categorizing.createCategory({
        scope: "course",
        name: "Exams",
        description: "",
      });
      for (const pair of [
        { category: "ghost", into: exams },
        { category: exams, into: "ghost" },
        { category: "ghost", into: "ghost" },
      ]) {
        expect(await refusalOf(() => categorizing.mergeCategory(pair))).toBeInstanceOf(
          refusalErrors.CategoryNotFound,
        );
      }
      expect(
        await refusalOf(() => categorizing.mergeCategory({ category: exams, into: exams })),
      ).toBeInstanceOf(refusalErrors.SameCategory);
      expect(
        await refusalOf(() => categorizing.mergeCategory({ category: exams, into: elsewhere })),
      ).toBeInstanceOf(refusalErrors.DifferentScopes);
      // Nothing was merged, so both categories still stand.
      expect(await categorizing._categoriesIn({ scope: forum })).toHaveLength(1);
      expect(await categorizing._categoriesIn({ scope: "course" })).toHaveLength(1);
    });

    test("_categoriesWithItems hands over one scope, in creation order, items in assignment order", async () => {
      const categorizing = await make();
      expect(await categorizing._categoriesWithItems({ scope: forum })).toEqual({ categories: [] });

      const { category: homework } = await categorizing.createCategory({
        scope: forum,
        name: "Homework",
        description: "Weekly practice",
      });
      const { category: exams } = await categorizing.createCategory({
        scope: forum,
        name: "Exams",
        description: "",
      });
      await categorizing.createCategory({ scope: "course", name: "Reading", description: "" });
      await categorizing.assign({ item: "final", category: exams });
      await categorizing.assign({ item: "week-2", category: homework });
      await categorizing.assign({ item: "midterm", category: exams });
      await categorizing.assign({ item: "week-1", category: homework });

      expect(await categorizing._categoriesWithItems({ scope: forum })).toEqual({
        categories: [
          {
            category: homework,
            name: "Homework",
            description: "Weekly practice",
            items: ["week-2", "week-1"],
          },
          { category: exams, name: "Exams", description: "", items: ["final", "midterm"] },
        ],
      });
      expect(await categorizing._categoriesWithItems({ scope: "no-such" })).toEqual({
        categories: [],
      });
    });

    test("a second instance keeps its categories in its own store", async () => {
      const database = await testDb();
      const forumStore = new MongoCategorizingConcept(database);
      const lists = new MongoCategorizingConcept(database, "TaskLists");
      await forumStore.createCategory({ scope: forum, name: "Homework", description: "" });
      const { category } = await lists.createCategory({
        scope: forum,
        name: "Homework",
        description: "",
      });
      expect(await lists._categoriesIn({ scope: forum })).toEqual([
        { category, name: "Homework", description: "" },
      ]);
      expect(await forumStore._categoriesIn({ scope: forum })).toHaveLength(1);
      expect((await forumStore._categoriesIn({ scope: forum }))[0].category).not.toBe(category);
    });

    test("deleteCategory removes the category and its item memberships", async () => {
      const categorizing = await make();
      const { category } = await categorizing.createCategory({
        scope: forum,
        name: "Exams",
        description: "",
      });
      await categorizing.assign({ item: "quiz", category });
      expect(await categorizing.deleteCategory({ category })).toEqual({ category });
      expect(await categorizing._categoriesIn({ scope: forum })).toEqual([]);
      expect(await categorizing._getCategory({ item: "quiz" })).toEqual([]);
      expect(await refusalOf(() => categorizing.deleteCategory({ category }))).toBeInstanceOf(
        refusalErrors.CategoryNotFound,
      );
    });
  });
}
