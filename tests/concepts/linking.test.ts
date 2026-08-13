import { afterAll, describe, expect, test } from "vite-plus/test";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoLinkingConcept } from "../../src/concepts/linking/linking.mongo.ts";

const floors: [string, () => Promise<MongoLinkingConcept>][] = [
  ["on MongoDB", async () => new MongoLinkingConcept(await testDb())],
];

afterAll(stopTestDb);

for (const [floor, make] of floors) {
  describe(`Linking ${floor}`, () => {
    test("setLinks records the targets in order and replaces on repeat", async () => {
      const linking = await make();
      expect(await linking.setLinks({ source: "guide", targets: ["w1", "w2"] })).toEqual({
        source: "guide",
      });
      expect(await linking._getLinks({ source: "guide" })).toEqual([
        { target: "w1" },
        { target: "w2" },
      ]);
      await linking.setLinks({ source: "guide", targets: ["w2"] });
      expect(await linking._getLinks({ source: "guide" })).toEqual([{ target: "w2" }]);
    });

    test("setLinksFrom records the targets named by content", async () => {
      const linking = await make();
      expect(
        await linking.setLinksFrom({
          source: "guide",
          content: "See [[w1]], then [[w2]], then [[w1]]. Empty brackets [[]] are not a target.",
        }),
      ).toEqual({ source: "guide" });
      expect(await linking._getLinks({ source: "guide" })).toEqual([
        { target: "w1" },
        { target: "w2" },
        { target: "w1" },
      ]);
    });

    test("clearLinks drops the source's links and is idempotent", async () => {
      const linking = await make();
      await linking.setLinks({ source: "guide", targets: ["w1"] });
      expect(await linking.clearLinks({ source: "guide" })).toEqual({ source: "guide" });
      expect(await linking._getLinks({ source: "guide" })).toEqual([]);
      expect(await linking.clearLinks({ source: "guide" })).toEqual({ source: "guide" });
    });

    test("clearBacklinks removes the target from every source and is idempotent", async () => {
      const linking = await make();
      await linking.setLinks({ source: "guide", targets: ["w1", "w2"] });
      await linking.setLinks({ source: "syllabus", targets: ["w2", "w3"] });
      expect(await linking.clearBacklinks({ target: "w2" })).toEqual({ target: "w2" });
      expect(await linking._getLinks({ source: "guide" })).toEqual([{ target: "w1" }]);
      expect(await linking._getLinks({ source: "syllabus" })).toEqual([{ target: "w3" }]);
      expect(await linking.clearBacklinks({ target: "w2" })).toEqual({ target: "w2" });
    });

    test("_getBacklinks reads the graph backward, in source order", async () => {
      const linking = await make();
      await linking.setLinks({ source: "guide", targets: [] });
      await linking.setLinks({ source: "r2", targets: ["p1"] });
      await linking.setLinks({ source: "p2", targets: ["p1"] });
      expect(await linking._getBacklinks({ target: "p1" })).toEqual([
        { source: "r2" },
        { source: "p2" },
      ]);
      expect(await linking._getBacklinks({ target: "nobody" })).toEqual([]);
      await linking.clearLinks({ source: "r2" });
      expect(await linking._getBacklinks({ target: "p1" })).toEqual([{ source: "p2" }]);
    });
  });
}
