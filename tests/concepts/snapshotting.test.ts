import { afterAll, describe, expect, test } from "vite-plus/test";
import { SnapshotExists } from "../../src/concepts/snapshotting/errors.ts";
import { MongoSnapshottingConcept } from "../../src/concepts/snapshotting/snapshotting.mongo.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

describe("Snapshotting on MongoDB", () => {
  test("capture preserves one structured value without interpreting it", async () => {
    const snapshotting = new MongoSnapshottingConcept(await testDb());
    const value = { title: "Plant check", questions: [{ prompt: "Which gas?" }] };
    const { snapshot } = await snapshotting.capture({ subject: "run-1", value });

    expect(await snapshotting._snapshot({ subject: "run-1" })).toEqual([{ snapshot, value }]);
    expect(await snapshotting._snapshot({ subject: "missing" })).toEqual([]);
  });

  test("capture never replaces a subject's standing snapshot", async () => {
    const snapshotting = new MongoSnapshottingConcept(await testDb());
    await snapshotting.capture({ subject: "run-1", value: { title: "First" } });

    const error = await caughtError(() =>
      snapshotting.capture({ subject: "run-1", value: { title: "Second" } }),
    );
    expect(error).toBeInstanceOf(SnapshotExists);
    expect((await snapshotting._snapshot({ subject: "run-1" }))[0]?.value).toEqual({
      title: "First",
    });
  });

  test("concurrent captures admit exactly one value", async () => {
    const database = await testDb();
    const first = new MongoSnapshottingConcept(database);
    const second = new MongoSnapshottingConcept(database);
    const settled = await Promise.allSettled([
      first.capture({ subject: "run-1", value: "first" }),
      second.capture({ subject: "run-1", value: "second" }),
    ]);

    expect(settled.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const refused = settled.find(({ status }) => status === "rejected");
    expect(refused?.status === "rejected" ? refused.reason : null).toBeInstanceOf(SnapshotExists);
    expect(await first._snapshot({ subject: "run-1" })).toHaveLength(1);
  });
});
