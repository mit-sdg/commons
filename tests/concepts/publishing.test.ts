import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/publishing/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoPublishingConcept } from "../../src/concepts/publishing/publishing.mongo.ts";

const floors: [string, () => Promise<MongoPublishingConcept>][] = [
  ["on MongoDB", async () => new MongoPublishingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

for (const [floor, make] of floors) {
  describe(`Publishing ${floor}`, () => {
    const opened = new Date("2026-03-03T09:00:00Z");
    const closed = new Date("2026-03-03T10:00:00Z");

    test("publish opens an edition fixed to the author's material", async () => {
      const publishing = await make();
      const { edition } = await publishing.publish({
        author: "lee",
        material: "quiz-1",
        at: opened,
      });
      expect(await publishing._edition({ edition })).toEqual([
        {
          author: "lee",
          material: "quiz-1",
          open: true,
          openedAt: opened,
          closedAt: null,
        },
      ]);
      expect(await publishing._edition({ edition: "no-such" })).toEqual([]);
    });

    test("publishing the same material again while open is refused", async () => {
      const publishing = await make();
      await publishing.publish({ author: "lee", material: "quiz-1", at: opened });
      const err = await refusal(() =>
        publishing.publish({ author: "lee", material: "quiz-1", at: opened }),
      );
      expect(err).toBeInstanceOf(refusalErrors.MaterialAlreadyShared);
      await publishing.publish({ author: "lee", material: "quiz-2", at: opened });
      expect((await publishing._openEditions()).map((row) => row.material).sort()).toEqual([
        "quiz-1",
        "quiz-2",
      ]);
    });

    test("close records the closing time and frees the material for a later edition", async () => {
      const publishing = await make();
      const first = await publishing.publish({ author: "lee", material: "quiz-1", at: opened });
      await publishing.close({ edition: first.edition, at: closed });
      expect(await publishing._edition({ edition: first.edition })).toEqual([
        {
          author: "lee",
          material: "quiz-1",
          open: false,
          openedAt: opened,
          closedAt: closed,
        },
      ]);
      const second = await publishing.publish({
        author: "lee",
        material: "quiz-1",
        at: closed,
      });
      expect(await publishing._openEditions()).toEqual([
        {
          edition: second.edition,
          author: "lee",
          material: "quiz-1",
          openedAt: closed,
        },
      ]);
    });

    test("closing an unknown or already closed edition refuses", async () => {
      const publishing = await make();
      const missing = await refusal(() => publishing.close({ edition: "none", at: closed }));
      expect(missing).toBeInstanceOf(refusalErrors.EditionNotFound);
      const { edition } = await publishing.publish({
        author: "lee",
        material: "quiz-1",
        at: opened,
      });
      await publishing.close({ edition, at: closed });
      const again = await refusal(() => publishing.close({ edition, at: closed }));
      expect(again).toBeInstanceOf(refusalErrors.AlreadyClosed);
    });

    test("_editionsFor answers a material's editions newest first", async () => {
      const publishing = await make();
      const first = await publishing.publish({ author: "lee", material: "quiz-1", at: opened });
      await publishing.close({ edition: first.edition, at: opened });
      const second = await publishing.publish({ author: "lee", material: "quiz-1", at: opened });
      await publishing.publish({ author: "lee", material: "quiz-2", at: opened });
      expect(await publishing._editionsFor({ material: "quiz-1" })).toEqual([
        { edition: second.edition, open: true, openedAt: opened, closedAt: null },
        { edition: first.edition, open: false, openedAt: opened, closedAt: opened },
      ]);
      expect(await publishing._editionsFor({ material: "no-such" })).toEqual([]);
    });

    test("_openEditions answers only open editions, newest first, and empties when all close", async () => {
      const publishing = await make();
      expect(await publishing._openEditions()).toEqual([]);
      const first = await publishing.publish({ author: "lee", material: "quiz-1", at: opened });
      const second = await publishing.publish({ author: "kim", material: "quiz-2", at: opened });
      expect((await publishing._openEditions()).map((row) => row.edition)).toEqual([
        second.edition,
        first.edition,
      ]);
      await publishing.close({ edition: first.edition, at: closed });
      await publishing.close({ edition: second.edition, at: closed });
      expect(await publishing._openEditions()).toEqual([]);
      expect((await publishing._editionsFor({ material: "quiz-1" })).length).toBe(1);
    });
  });
}
