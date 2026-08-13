import { afterAll, describe, expect, test } from "vite-plus/test";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { FormattingConcept } from "../../src/concepts/formatting/formatting.ts";
import { MongoFormattingConcept } from "../../src/concepts/formatting/formatting.mongo.ts";

const floors: [string, () => Promise<FormattingConcept | MongoFormattingConcept>][] = [
  ["in memory", async () => new FormattingConcept()],
  ["on MongoDB", async () => new MongoFormattingConcept(await testDb())],
];

afterAll(stopTestDb);

for (const [floor, make] of floors) {
  describe(`Formatting ${floor}`, () => {
    test("setSource keeps a rendered form with the source, escaped", async () => {
      const formatting = await make();
      const { rendered } = await formatting.setSource({
        target: "note-1",
        source: "2 < 3 & 4 > 1",
      });
      expect(rendered).toBe("<p>2 &lt; 3 &amp; 4 &gt; 1</p>\n");
      expect(await formatting._getRendered({ target: "note-1" })).toEqual([{ rendered }]);
    });

    test("setting the source again replaces the rendering", async () => {
      const formatting = await make();
      await formatting.setSource({ target: "note-1", source: "first draft" });
      await formatting.setSource({ target: "note-1", source: "second draft" });
      expect(await formatting._getRendered({ target: "note-1" })).toEqual([
        { rendered: "<p>second draft</p>\n" },
      ]);
    });

    test("clear leaves no formatting behind, and clearing again changes nothing", async () => {
      const formatting = await make();
      await formatting.setSource({ target: "note-1", source: "draft" });
      expect(await formatting.clear({ target: "note-1" })).toEqual({ target: "note-1" });
      expect(await formatting._getRendered({ target: "note-1" })).toEqual([]);
      expect(await formatting.clear({ target: "note-1" })).toEqual({ target: "note-1" });
      expect(await formatting._getRendered({ target: "note-1" })).toEqual([]);
    });
  });
}
