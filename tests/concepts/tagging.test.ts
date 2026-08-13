import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/tagging/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoTaggingConcept } from "../../src/concepts/tagging/tagging.mongo.ts";

const floors: [string, () => Promise<MongoTaggingConcept>][] = [
  ["on MongoDB", async () => new MongoTaggingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

for (const [floor, make] of floors) {
  describe(`Tagging ${floor}`, () => {
    test("createTag adds to the vocabulary; duplicate names are refused", async () => {
      const tagging = await make();
      const { tag } = await tagging.createTag({ name: "urgent" });
      expect(await tagging._getAllTags({})).toEqual([{ tag, name: "urgent" }]);
      expect(await tagging._getByName({ name: "urgent" })).toEqual([{ tag }]);
      expect(await tagging._getByName({ name: "missing" })).toEqual([]);
      expect(await refusalOf(() => tagging.createTag({ name: "urgent" }))).toBeInstanceOf(
        refusalErrors.TagAlreadyExists,
      );
    });

    test("addTag applies tags in order and refuses the missing and the repeated", async () => {
      const tagging = await make();
      const { tag: urgent } = await tagging.createTag({ name: "urgent" });
      const { tag: review } = await tagging.createTag({ name: "review" });
      expect(await tagging.addTag({ target: "report", tag: urgent })).toEqual({ target: "report" });
      await tagging.addTag({ target: "report", tag: review });
      expect(await tagging._getTags({ target: "report" })).toEqual([
        { tag: urgent, name: "urgent" },
        { tag: review, name: "review" },
      ]);
      expect(await tagging._getTargets({ tag: urgent })).toEqual([{ target: "report" }]);
      expect(
        await refusalOf(() => tagging.addTag({ target: "report", tag: "ghost" })),
      ).toBeInstanceOf(refusalErrors.TagNotFound);
      expect(
        await refusalOf(() => tagging.addTag({ target: "report", tag: urgent })),
      ).toBeInstanceOf(refusalErrors.TagAlreadyApplied);
    });

    test("removeTag takes the tag off and refuses when it is not applied", async () => {
      const tagging = await make();
      const { tag } = await tagging.createTag({ name: "urgent" });
      await tagging.addTag({ target: "report", tag });
      expect(await tagging.removeTag({ target: "report", tag })).toEqual({ target: "report" });
      expect(await tagging._getTags({ target: "report" })).toEqual([]);
      expect(await refusalOf(() => tagging.removeTag({ target: "report", tag }))).toBeInstanceOf(
        refusalErrors.TagNotApplied,
      );
    });

    test("deleteTag withdraws the tag and all its applications", async () => {
      const tagging = await make();
      const { tag } = await tagging.createTag({ name: "urgent" });
      await tagging.addTag({ target: "report", tag });
      await tagging.addTag({ target: "memo", tag });
      expect(await tagging.deleteTag({ tag })).toEqual({ tag });
      expect(await tagging._getAllTags({})).toEqual([]);
      expect(await tagging._getTags({ target: "report" })).toEqual([]);
      expect(await tagging._getTargets({ tag })).toEqual([]);
      expect(await refusalOf(() => tagging.deleteTag({ tag }))).toBeInstanceOf(
        refusalErrors.TagNotFound,
      );
    });

    test("clearTarget strips every tag and is idempotent", async () => {
      const tagging = await make();
      const { tag } = await tagging.createTag({ name: "urgent" });
      await tagging.addTag({ target: "report", tag });
      expect(await tagging.clearTarget({ target: "report" })).toEqual({ target: "report" });
      expect(await tagging._getTags({ target: "report" })).toEqual([]);
      expect(await tagging.clearTarget({ target: "report" })).toEqual({ target: "report" });
    });
  });
}
