import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "./errors.ts";
import { caughtError, stopTestDb, testDb } from "../testing.ts";
import { FlaggingConcept } from "./flagging.ts";
import { MongoFlaggingConcept } from "./flagging.mongo.ts";

const floors: [string, () => Promise<FlaggingConcept | MongoFlaggingConcept>][] = [
  ["in memory", async () => new FlaggingConcept()],
  ["on MongoDB", async () => new MongoFlaggingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;

const at = new Date("2026-01-01T00:00:00Z");

for (const [floor, make] of floors) {
  describe(`Flagging ${floor}`, () => {
    test("flag opens a concern and the queue counts busiest first", async () => {
      const flagging = await make();
      const { flag } = await flagging.flag({
        reporter: "sam",
        target: "post-1",
        reason: "spam",
        at,
      });
      await flagging.flag({ reporter: "rita", target: "post-1", reason: "off-topic", at });
      await flagging.flag({ reporter: "sam", target: "post-2", reason: "spam", at });
      expect(await flagging._getFlags({ target: "post-1" })).toContainEqual({
        flag,
        reporter: "sam",
        reason: "spam",
        status: "open",
        createdAt: at,
      });
      expect(await flagging._getOpenTargets({})).toEqual([
        { target: "post-1", count: 2 },
        { target: "post-2", count: 1 },
      ]);
    });

    test("flag refuses a second open flag from the same reporter on the same target", async () => {
      const flagging = await make();
      await flagging.flag({ reporter: "sam", target: "post-1", reason: "spam", at });
      expect(
        await refusalOf(() =>
          flagging.flag({ reporter: "sam", target: "post-1", reason: "again", at }),
        ),
      ).toBeInstanceOf(refusalErrors.FlagAlreadyExists);
    });

    test("resolve settles all open flags on the target", async () => {
      const flagging = await make();
      await flagging.flag({ reporter: "sam", target: "post-1", reason: "spam", at });
      await flagging.flag({ reporter: "rita", target: "post-1", reason: "off-topic", at });
      expect(await flagging.resolve({ target: "post-1", outcome: "dismissed" })).toEqual({
        target: "post-1",
      });
      const statuses = (await flagging._getFlags({ target: "post-1" })).map((f) => f.status);
      expect(statuses).toEqual(["dismissed", "dismissed"]);
      expect(await flagging._getOpenTargets({})).toEqual([]);
      expect(
        await flagging.flag({ reporter: "sam", target: "post-1", reason: "still spam", at }),
      ).toEqual({
        flag: expect.any(String),
      });
    });

    test("resolve refuses an outcome other than upheld or dismissed", async () => {
      const flagging = await make();
      await flagging.flag({ reporter: "sam", target: "post-1", reason: "spam", at });
      expect(
        await refusalOf(() => flagging.resolve({ target: "post-1", outcome: "shrugged" })),
      ).toBeInstanceOf(refusalErrors.OutcomeInvalid);
    });

    test("resolve refuses a target with no open flags", async () => {
      const flagging = await make();
      expect(
        await refusalOf(() => flagging.resolve({ target: "post-1", outcome: "upheld" })),
      ).toBeInstanceOf(refusalErrors.FlagNotFound);
    });

    test("clearTarget removes every flag on one target and is idempotent", async () => {
      const flagging = await make();
      await flagging.flag({ reporter: "sam", target: "post-1", reason: "spam", at });
      await flagging.flag({ reporter: "rita", target: "post-1", reason: "off-topic", at });
      await flagging.flag({ reporter: "sam", target: "post-2", reason: "spam", at });
      expect(await flagging.clearTarget({ target: "post-1" })).toEqual({ target: "post-1" });
      expect(await flagging._getFlags({ target: "post-1" })).toEqual([]);
      expect(await flagging._getFlags({ target: "post-2" })).toHaveLength(1);
      expect(await flagging.clearTarget({ target: "post-1" })).toEqual({ target: "post-1" });
    });
  });
}
