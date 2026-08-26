import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/insisting/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoInsistingConcept } from "../../src/concepts/insisting/insisting.mongo.ts";

const floors: [string, () => Promise<MongoInsistingConcept>][] = [
  ["on MongoDB", async () => new MongoInsistingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

for (const [floor, make] of floors) {
  describe(`Insisting ${floor}`, () => {
    test("the first complaint opens the insistence and spends one patience", async () => {
      const insisting = await make();
      const { complaint, insistence, remaining } = await insisting.complain({
        aim: "figure",
        patience: 2,
        offering: "a bar chart",
        account: "the format is wrong",
      });
      expect(remaining).toBe(1);
      expect(await insisting._unsettledFor({ aim: "figure" })).toEqual([
        { insistence, patience: 2, remaining: 1 },
      ]);
      expect(await insisting._complaints({ insistence })).toEqual([
        { complaint, offering: "a bar chart", account: "the format is wrong" },
      ]);
      expect(await insisting._unsettledFor({ aim: "other" })).toEqual([]);
      expect(await insisting._complaints({ insistence: "no-such" })).toEqual([]);
    });

    test("insisting takes at least one complaint", async () => {
      const insisting = await make();
      const err = await refusal(() =>
        insisting.complain({ aim: "figure", patience: 0, offering: "x", account: "y" }),
      );
      expect(err).toBeInstanceOf(refusalErrors.NoPatience);
      expect(await insisting._unsettledFor({ aim: "figure" })).toEqual([]);
    });

    test("a later complaint joins the open insistence without changing its patience", async () => {
      const insisting = await make();
      const first = await insisting.complain({
        aim: "figure",
        patience: 3,
        offering: "one",
        account: "wrong format",
      });
      const second = await insisting.complain({
        aim: "figure",
        patience: 99,
        offering: "two",
        account: "still wrong",
      });
      expect(second.insistence).toBe(first.insistence);
      expect(second.remaining).toBe(1);
      expect(await insisting._unsettledFor({ aim: "figure" })).toEqual([
        { insistence: first.insistence, patience: 3, remaining: 1 },
      ]);
      expect(
        (await insisting._complaints({ insistence: first.insistence })).map((row) => row.offering),
      ).toEqual(["one", "two"]);
    });

    test("_standingFor and _spentFor hand over when the patience runs out", async () => {
      const insisting = await make();
      const { insistence } = await insisting.complain({
        aim: "figure",
        patience: 2,
        offering: "one",
        account: "wrong",
      });
      expect(await insisting._standingFor({ aim: "figure" })).toEqual([
        { insistence, remaining: 1 },
      ]);
      expect(await insisting._spentFor({ aim: "figure" })).toEqual([]);
      const last = await insisting.complain({
        aim: "figure",
        patience: 2,
        offering: "two",
        account: "still wrong",
      });
      expect(last.remaining).toBe(0);
      expect(await insisting._standingFor({ aim: "figure" })).toEqual([]);
      expect(await insisting._spentFor({ aim: "figure" })).toEqual([{ insistence, complaints: 2 }]);
      const err = await refusal(() =>
        insisting.complain({ aim: "figure", patience: 2, offering: "three", account: "again" }),
      );
      expect(err).toBeInstanceOf(refusalErrors.PatienceSpent);
      expect((await insisting._complaints({ insistence })).map((row) => row.offering)).toEqual([
        "one",
        "two",
      ]);
    });

    test("neither standing question answers for an aim nobody is insisting on", async () => {
      const insisting = await make();
      expect(await insisting._standingFor({ aim: "figure" })).toEqual([]);
      expect(await insisting._spentFor({ aim: "figure" })).toEqual([]);
      expect(await insisting._for({ aim: "figure" })).toEqual([]);
    });

    test("giving up settles the insistence as exhausted, keeping every complaint", async () => {
      const insisting = await make();
      const { insistence } = await insisting.complain({
        aim: "figure",
        patience: 1,
        offering: "one",
        account: "wrong",
      });
      expect(await insisting.giveUp({ aim: "figure" })).toEqual({ insistence });
      expect(await insisting._unsettledFor({ aim: "figure" })).toEqual([]);
      expect(await insisting._standingFor({ aim: "figure" })).toEqual([]);
      expect(await insisting._spentFor({ aim: "figure" })).toEqual([]);
      expect(await insisting._for({ aim: "figure" })).toEqual([
        {
          insistence,
          patience: 1,
          settled: true,
          satisfied: false,
          exhausted: true,
          remaining: 0,
        },
      ]);
      expect((await insisting._complaints({ insistence })).length).toBe(1);
    });

    test("satisfying settles the insistence and closes the matter", async () => {
      const insisting = await make();
      const { insistence } = await insisting.complain({
        aim: "figure",
        patience: 2,
        offering: "one",
        account: "wrong",
      });
      expect(await insisting.satisfy({ aim: "figure" })).toEqual({ insistence });
      expect(await insisting._unsettledFor({ aim: "figure" })).toEqual([]);
      expect(await insisting._for({ aim: "figure" })).toEqual([
        {
          insistence,
          patience: 2,
          settled: true,
          satisfied: true,
          exhausted: false,
          remaining: 1,
        },
      ]);
    });

    test("settling twice, or settling nothing, refuses", async () => {
      const insisting = await make();
      expect(await refusal(() => insisting.giveUp({ aim: "figure" }))).toBeInstanceOf(
        refusalErrors.NotInsisting,
      );
      expect(await refusal(() => insisting.satisfy({ aim: "figure" }))).toBeInstanceOf(
        refusalErrors.NotInsisting,
      );
      await insisting.complain({ aim: "figure", patience: 1, offering: "x", account: "y" });
      await insisting.satisfy({ aim: "figure" });
      expect(await refusal(() => insisting.satisfy({ aim: "figure" }))).toBeInstanceOf(
        refusalErrors.NotInsisting,
      );
      expect(await refusal(() => insisting.giveUp({ aim: "figure" }))).toBeInstanceOf(
        refusalErrors.NotInsisting,
      );
    });

    test("a settled aim can be insisted on again, opening a second insistence", async () => {
      const insisting = await make();
      const first = await insisting.complain({
        aim: "figure",
        patience: 1,
        offering: "one",
        account: "wrong",
      });
      await insisting.giveUp({ aim: "figure" });
      const second = await insisting.complain({
        aim: "figure",
        patience: 2,
        offering: "two",
        account: "wrong again",
      });
      expect(second.insistence).not.toBe(first.insistence);
      expect(second.remaining).toBe(1);
      expect((await insisting._for({ aim: "figure" })).map((row) => row.insistence)).toEqual([
        first.insistence,
        second.insistence,
      ]);
      expect(await insisting._standingFor({ aim: "figure" })).toEqual([
        { insistence: second.insistence, remaining: 1 },
      ]);
    });
  });
}
