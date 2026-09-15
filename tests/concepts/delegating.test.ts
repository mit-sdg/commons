import { afterAll, describe, expect, test } from "vite-plus/test";
import { MongoDelegatingConcept } from "../../src/concepts/delegating/delegating.mongo.ts";
import { DelegationNotFound, InvalidSpread } from "../../src/concepts/delegating/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

describe("Delegating on MongoDB", () => {
  test("one subject has one replaceable delegation", async () => {
    const concept = new MongoDelegatingConcept(await testDb());
    const first = await concept.delegate({ item: "paper", subject: "maya", delegate: "mara" });
    const second = await concept.delegate({ item: "paper", subject: "maya", delegate: "noah" });

    expect(second).toEqual(first);
    expect(await concept._getDelegations({ item: "paper" })).toEqual([
      { delegation: first.delegation, subject: "maya", delegate: "noah" },
    ]);
    expect(await concept.withdraw({ item: "paper", subject: "maya" })).toEqual(first);
    expect(
      await caughtError(() => concept.withdraw({ item: "paper", subject: "maya" })),
    ).toBeInstanceOf(DelegationNotFound);
  });

  test("spread balances against standing load and explicit replacement redistributes", async () => {
    const concept = new MongoDelegatingConcept(await testDb());
    await concept.delegate({ item: "paper", subject: "standing", delegate: "mara" });

    expect(
      await concept.spread({
        item: "paper",
        subjects: ["maya", "omar", "priya"],
        delegates: ["mara", "noah"],
        replace: false,
      }),
    ).toEqual({
      assigned: [
        { subject: "maya", delegate: "noah" },
        { subject: "omar", delegate: "mara" },
        { subject: "priya", delegate: "noah" },
      ],
    });

    expect(
      await concept.spread({
        item: "paper",
        subjects: ["standing", "maya", "omar", "priya"],
        delegates: ["mara", "noah"],
        replace: true,
      }),
    ).toEqual({
      assigned: [
        { subject: "standing", delegate: "mara" },
        { subject: "maya", delegate: "noah" },
        { subject: "omar", delegate: "mara" },
        { subject: "priya", delegate: "noah" },
      ],
    });
  });

  test("default spread rechecks current ownership and never overwrites a concurrent manual choice", async () => {
    const database = await testDb();
    const manual = new MongoDelegatingConcept(database);
    const bulk = new MongoDelegatingConcept(database);

    await manual.delegate({ item: "paper", subject: "maya", delegate: "dana" });
    const result = await bulk.spread({
      item: "paper",
      subjects: ["maya", "omar"],
      delegates: ["mara", "noah"],
      replace: false,
    });

    expect(result).toEqual({ assigned: [{ subject: "omar", delegate: "mara" }] });
    expect(await bulk._getDelegations({ item: "paper" })).toEqual([
      expect.objectContaining({ subject: "maya", delegate: "dana" }),
      expect.objectContaining({ subject: "omar", delegate: "mara" }),
    ]);
  });

  test("overlapping spreads commit as whole versions instead of mixing batches", async () => {
    const database = await testDb();
    const left = new MongoDelegatingConcept(database);
    const right = new MongoDelegatingConcept(database);
    const subjects = ["a", "b", "c", "d", "e", "f"];

    await Promise.all([
      left.spread({ item: "paper", subjects, delegates: ["mara", "noah"], replace: true }),
      right.spread({ item: "paper", subjects, delegates: ["dana", "lee"], replace: true }),
    ]);

    const delegates = new Set(
      (await left._getDelegations({ item: "paper" })).map((row) => row.delegate),
    );
    expect(
      (delegates.has("mara") && delegates.has("noah") && delegates.size === 2) ||
        (delegates.has("dana") && delegates.has("lee") && delegates.size === 2),
    ).toBe(true);
  });

  test("invalid spread selections change nothing", async () => {
    const concept = new MongoDelegatingConcept(await testDb());
    await concept.delegate({ item: "paper", subject: "maya", delegate: "mara" });

    for (const input of [
      { subjects: [], delegates: ["mara"] },
      { subjects: ["omar"], delegates: [] },
      { subjects: ["omar", "omar"], delegates: ["mara"] },
      { subjects: ["omar"], delegates: ["mara", "mara"] },
    ]) {
      expect(
        await caughtError(() => concept.spread({ item: "paper", ...input, replace: false })),
      ).toBeInstanceOf(InvalidSpread);
    }
    expect(await concept._getDelegations({ item: "paper" })).toEqual([
      expect.objectContaining({ subject: "maya", delegate: "mara" }),
    ]);

    expect(
      await caughtError(() =>
        concept.spread({
          item: "paper",
          subjects: ["maya"],
          delegates: ["noah"],
          replace: "false" as unknown as boolean,
        }),
      ),
    ).toBeInstanceOf(InvalidSpread);
    expect(await concept._getDelegation({ item: "paper", subject: "maya" })).toEqual([
      expect.objectContaining({ delegate: "mara" }),
    ]);
  });
});
