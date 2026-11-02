import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/policymaking/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoPolicymakingConcept } from "../../src/concepts/policymaking/policymaking.mongo.ts";

afterAll(stopTestDb);

const at = new Date("2026-11-02T15:00:00Z");
const later = new Date("2026-11-02T15:10:00Z");
const make = async () => new MongoPolicymakingConcept(await testDb());

describe("Policymaking", () => {
  test("a save made from an older version is refused, and a copy keeps the change", async () => {
    const c = await make();
    const { policy } = await c.create({
      name: "Course guide",
      specification: { team: 30 },
      author: "dj",
      at,
    });
    // Ana and Ravi both load version 1; Ravi saves first.
    expect(
      await c.save({ policy, version: 1, specification: { team: 40 }, author: "ravi", at: later }),
    ).toEqual({
      policy,
      version: 2,
    });
    expect(
      await caughtError(() =>
        c.save({ policy, version: 1, specification: { team: 35 }, author: "ana", at: later }),
      ),
    ).toBeInstanceOf(refusalErrors.PolicyStale);
    const copy = await c.create({
      name: "Course guide, Ana",
      specification: { team: 35 },
      author: "ana",
      at: later,
    });
    expect(copy.version).toBe(1);
    expect(await c._policy({ policy })).toEqual([
      {
        name: "Course guide",
        version: 2,
        specification: { team: 40 },
        author: "ravi",
        savedAt: later,
        final: false,
      },
    ]);
    expect(await c._version({ policy, version: 1 })).toEqual([
      { specification: { team: 30 }, author: "dj", savedAt: at },
    ]);
    expect(await c._version({ policy, version: 3 })).toEqual([]);
  });

  test("simultaneous saves from one version accept exactly one", async () => {
    const c = await make();
    const { policy } = await c.create({ name: "Race", specification: {}, author: "a", at });
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, n) =>
        c.save({ policy, version: 1, specification: { n }, author: "a", at }),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await c._policy({ policy }))[0]!.version).toBe(2);
  });

  test("one policy is final at a time, and the final one can't be removed", async () => {
    const c = await make();
    const guide = await c.create({ name: "Guide", specification: { a: 1 }, author: "dj", at });
    const other = await c.create({ name: "Other", specification: { a: 2 }, author: "dj", at });
    expect(await c._final()).toEqual([]);
    await c.markFinal({ policy: guide.policy });
    await c.markFinal({ policy: other.policy });
    expect(await c._final()).toEqual([
      { policy: other.policy, name: "Other", version: 1, specification: { a: 2 } },
    ]);
    expect((await c._policies()).map((row) => [row.name, row.final])).toEqual([
      ["Guide", false],
      ["Other", true],
    ]);
    expect(await caughtError(() => c.remove({ policy: other.policy }))).toBeInstanceOf(
      refusalErrors.PolicyIsFinal,
    );
    expect(await c.remove({ policy: guide.policy })).toEqual({ policy: guide.policy });
    expect(await c._policy({ policy: guide.policy })).toEqual([]);
    expect(await c._version({ policy: guide.policy, version: 1 })).toEqual([]);
  });

  test("names are required and unique, ignoring case and surrounding space", async () => {
    const c = await make();
    const { policy } = await c.create({ name: "Guide", specification: {}, author: "dj", at });
    expect(
      await caughtError(() => c.create({ name: "  ", specification: {}, author: "dj", at })),
    ).toBeInstanceOf(refusalErrors.PolicyNameRequired);
    expect(
      await caughtError(() => c.create({ name: " guide ", specification: {}, author: "dj", at })),
    ).toBeInstanceOf(refusalErrors.PolicyNameTaken);
    const { policy: second } = await c.create({
      name: "Second",
      specification: {},
      author: "dj",
      at,
    });
    expect(await caughtError(() => c.rename({ policy: second, name: "GUIDE" }))).toBeInstanceOf(
      refusalErrors.PolicyNameTaken,
    );
    await c.rename({ policy, name: "Course guide" });
    expect((await c._policy({ policy }))[0]!.name).toBe("Course guide");
    for (const attempt of [
      () => c.save({ policy: "missing", version: 1, specification: {}, author: "dj", at }),
      () => c.rename({ policy: "missing", name: "x" }),
      () => c.remove({ policy: "missing" }),
      () => c.markFinal({ policy: "missing" }),
    ])
      expect(await caughtError(attempt)).toBeInstanceOf(refusalErrors.PolicyNotFound);
  });
});
