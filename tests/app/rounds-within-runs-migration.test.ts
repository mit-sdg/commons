import type { Db } from "mongodb";
import { afterAll, describe, expect, test, vi } from "vite-plus/test";
import { runCommonsProcess } from "../../src/assembly/process.ts";
import { PartOpen } from "../../src/concepts/publishing/errors.ts";
import {
  EDITION_INDEXES,
  MongoPublishingConcept,
} from "../../src/concepts/publishing/publishing.mongo.ts";
import { caughtError, stopTestDb, testDb, testDbUri } from "../../src/concepts/testing.ts";
import { roundsWithinRuns } from "../../src/migrations/20260923T000100-rounds-within-runs.ts";
import { commonsMigrations, runMigrations } from "../../src/migrations/index.ts";

afterAll(stopTestDb);

// Stored shapes as the concepts wrote them before rounds had a whole.
interface EditionDoc {
  _id: string;
  author: string;
  material: string;
  whole?: string;
  openedAt: Date;
  closedAt: Date | null;
  open: boolean;
  seq: number;
}
interface LinkDoc {
  _id: string;
  targets: string[];
  seq: number;
}

const editionsOf = (database: Db) => database.collection<EditionDoc>("publishing.editions");
const linksOf = (database: Db) => database.collection<LinkDoc>("linking.links");
const locksOf = (database: Db) =>
  database.collection<{ _id: string; lockedAt: Date }>("locking.locks");

const monday = new Date("2026-09-21T14:00:00Z");
const tuesday = new Date("2026-09-22T14:00:00Z");

let seq = 0;
const edition = (
  _id: string,
  material: string,
  open: boolean,
  extra: Partial<EditionDoc> = {},
): EditionDoc => ({
  _id,
  author: "lee",
  material,
  openedAt: monday,
  closedAt: open ? null : tuesday,
  open,
  seq: ++seq,
  ...extra,
});
const tie = (round: string, run: string): LinkDoc => ({ _id: round, targets: [run], seq: ++seq });

async function seedRelay(database: Db) {
  await database
    .collection<{ _id: string; author: string; title: string; createdAt: Date; seq: number }>(
      "relaying.relays",
    )
    .insertOne({ _id: "relay", author: "lee", title: "Sorting", createdAt: monday, seq: 1 });
  await database
    .collection<{
      _id: string;
      relay: string;
      material: string;
      position: number;
      kind: string;
    }>("relaying.legs")
    .insertMany([
      { _id: "leg-1", relay: "relay", material: "q-leg-1", position: 1, kind: "" },
      { _id: "leg-2", relay: "relay", material: "q-leg-2", position: 2, kind: "" },
    ]);
}

async function seedClass(database: Db) {
  await seedRelay(database);
  await editionsOf(database).insertMany([
    edition("run-closed", "relay", false),
    edition("round-closed", "q-leg-1", false),
    edition("round-stranded", "q-leg-2", true),
    edition("run-open", "relay", true),
    edition("round-open", "q-leg-1", true),
    edition("orphan", "q-leg-2", true),
    edition("quiz-run", "q-solo", true),
  ]);
  await linksOf(database).insertMany([
    tie("round-closed", "run-closed"),
    tie("round-stranded", "run-closed"),
    tie("round-open", "run-open"),
    { _id: "post-1", targets: ["post-2"], seq: ++seq },
  ]);
  await locksOf(database).insertOne({ _id: "run-closed", lockedAt: monday });
}

async function everything(database: Db) {
  return {
    editions: await editionsOf(database).find({}).sort({ _id: 1 }).toArray(),
    links: await linksOf(database).find({}).sort({ _id: 1 }).toArray(),
    locks: await locksOf(database).find({}).sort({ _id: 1 }).toArray(),
  };
}

async function indexNames(database: Db) {
  return (await editionsOf(database).indexes())
    .map((index) => index.name ?? "")
    .sort((a, b) => a.localeCompare(b));
}

describe("rounds held within their runs", () => {
  test("every tied round gets its run as whole, the orphan and the closed run's open round close, and the indexes hold", async () => {
    const database = await testDb();
    await seedClass(database);
    const before = await everything(database);

    const outcome = await roundsWithinRuns.up(database);

    expect(outcome.blocked).toBeUndefined();
    expect(outcome.summary).toBe(
      "gave 3 round(s) their run as whole, closed 1 round edition(s) no run held, " +
        "closed 1 round(s) left open in closed runs, built 3 Publishing index(es); " +
        "1 lock(s) on runs left in place, read by nothing",
    );

    const publishing = new MongoPublishingConcept(database);
    expect(await publishing._edition({ edition: "round-closed" })).toMatchObject([
      { whole: "run-closed", open: false },
    ]);
    expect(await publishing._edition({ edition: "round-open" })).toMatchObject([
      { whole: "run-open", open: true },
    ]);
    expect(await publishing._parts({ whole: "run-open" })).toMatchObject([
      { edition: "round-open", material: "q-leg-1", open: true },
    ]);
    expect(await publishing._openPart({ whole: "run-open" })).toEqual([
      { edition: "round-open", material: "q-leg-1" },
    ]);

    const orphan = await editionsOf(database).findOne({ _id: "orphan" });
    expect(orphan).toMatchObject({ open: false, material: "q-leg-2" });
    expect(orphan?.closedAt).toBeInstanceOf(Date);
    expect(orphan).not.toHaveProperty("whole");

    const stranded = await editionsOf(database).findOne({ _id: "round-stranded" });
    expect(stranded).toMatchObject({ open: false, whole: "run-closed", material: "q-leg-2" });
    expect(stranded?.closedAt).toBeInstanceOf(Date);
    expect(await publishing._openPart({ whole: "run-closed" })).toEqual([]);

    const after = await everything(database);
    const unchanged = ["run-closed", "run-open", "quiz-run"];
    expect(after.editions.filter((row) => unchanged.includes(row._id))).toEqual(
      before.editions.filter((row) => unchanged.includes(row._id)),
    );
    expect(after.links).toEqual(before.links);
    expect(after.locks).toEqual(before.locks);

    const indexes = await editionsOf(database).indexes();
    for (const expected of EDITION_INDEXES) {
      expect(indexes.find((index) => index.name === expected.name)).toMatchObject({
        key: expected.key,
        unique: true,
        partialFilterExpression: expected.partialFilterExpression,
      });
    }

    const refused = await caughtError(() =>
      publishing.publishWithin({
        whole: "run-open",
        author: "lee",
        material: "q-leg-2",
        at: tuesday,
      }),
    );
    expect(refused).toBeInstanceOf(PartOpen);
  });

  test("running it again changes nothing and says so", async () => {
    const database = await testDb();
    await seedClass(database);
    await roundsWithinRuns.up(database);
    const settled = await everything(database);
    const names = await indexNames(database);

    const again = await roundsWithinRuns.up(database);

    expect(again).toEqual({
      summary:
        "rounds already sit within their runs; nothing to do; " +
        "1 lock(s) on runs left in place, read by nothing",
    });
    expect(await everything(database)).toEqual(settled);
    expect(await indexNames(database)).toEqual(names);
  });

  test("a database with no editions has nothing to do and gains no collection", async () => {
    const database = await testDb();
    expect(await roundsWithinRuns.up(database)).toEqual({
      summary: "no editions stored; nothing to do",
    });
    expect(await database.listCollections({ name: "publishing.editions" }).toArray()).toHaveLength(
      0,
    );
  });

  test("an orphan beside its material's tied open round closes rather than blocking", async () => {
    const database = await testDb();
    await seedRelay(database);
    await editionsOf(database).insertMany([
      edition("run", "relay", true),
      edition("round", "q-leg-1", true),
      edition("orphan", "q-leg-1", true),
    ]);
    await linksOf(database).insertOne(tie("round", "run"));

    const outcome = await roundsWithinRuns.up(database);

    expect(outcome.blocked).toBeUndefined();
    expect(await editionsOf(database).findOne({ _id: "orphan" })).toMatchObject({ open: false });
    expect(await editionsOf(database).findOne({ _id: "round" })).toMatchObject({
      open: true,
      whole: "run",
    });
  });

  test("a closed run's open round beside its material's open round in a live run closes rather than blocking", async () => {
    const database = await testDb();
    await seedRelay(database);
    await editionsOf(database).insertMany([
      edition("old-run", "relay", false),
      edition("old-round", "q-leg-1", true, { whole: "old-run" }),
      edition("run", "relay", true),
      edition("round", "q-leg-1", true),
    ]);
    await linksOf(database).insertOne(tie("round", "run"));

    const outcome = await roundsWithinRuns.up(database);

    expect(outcome.blocked).toBeUndefined();
    expect(await editionsOf(database).findOne({ _id: "old-round" })).toMatchObject({
      open: false,
      whole: "old-run",
    });
    expect(await editionsOf(database).findOne({ _id: "round" })).toMatchObject({
      open: true,
      whole: "run",
    });
  });

  test("the full migration list applies it and records it once", async () => {
    const database = await testDb();
    await seedClass(database);
    const messages: string[] = [];

    await runMigrations(database, commonsMigrations, (message) => messages.push(message));

    expect(messages).toContain(
      "commons: 20260923T000100-rounds-within-runs — gave 3 round(s) their run as whole, " +
        "closed 1 round edition(s) no run held, closed 1 round(s) left open in closed runs, " +
        "built 3 Publishing index(es); 1 lock(s) on runs left in place, read by nothing",
    );
    expect(
      await database
        .collection("commons.migrations")
        .countDocuments({ _id: "20260923T000100-rounds-within-runs" as never }),
    ).toBe(1);
  });
});

describe("a database the indexes could not hold", () => {
  test("two open editions of one material outside any run block, and nothing is written", async () => {
    const database = await testDb();
    await seedClass(database);
    await editionsOf(database).insertOne(edition("quiz-run-2", "q-solo", true));
    const before = await everything(database);

    const outcome = await roundsWithinRuns.up(database);

    expect(outcome.summary).toBe("blocked");
    expect(outcome.blocked).toContain("material q-solo has 2 open editions: quiz-run, quiz-run-2");
    expect(outcome.blocked).toContain(
      'db.getCollection("publishing.editions").find({ material: "q-solo", open: true })',
    );
    expect(await everything(database)).toEqual(before);
    expect(await indexNames(database)).toEqual(["_id_"]);
  });

  test("two open rounds tied to one run block, and nothing is written", async () => {
    const database = await testDb();
    await seedRelay(database);
    await editionsOf(database).insertMany([
      edition("run", "relay", true),
      edition("round-a", "q-leg-1", true),
      edition("round-b", "q-leg-2", true),
    ]);
    await linksOf(database).insertMany([tie("round-a", "run"), tie("round-b", "run")]);
    const before = await everything(database);

    const outcome = await roundsWithinRuns.up(database);

    expect(outcome.blocked).toContain("run run has 2 open rounds: round-a, round-b");
    expect(outcome.blocked).toContain(
      'db.getCollection("publishing.editions").find({ _id: { $in: ["round-a", "round-b"] } })',
    );
    expect(await everything(database)).toEqual(before);
    expect(await indexNames(database)).toEqual(["_id_"]);
  });

  test("one material tied to one run twice blocks", async () => {
    const database = await testDb();
    await seedRelay(database);
    await editionsOf(database).insertMany([
      edition("run", "relay", true),
      edition("first", "q-leg-1", false),
      edition("second", "q-leg-1", true),
    ]);
    await linksOf(database).insertMany([tie("first", "run"), tie("second", "run")]);

    const outcome = await roundsWithinRuns.up(database);

    expect(outcome.blocked).toContain("run run holds material q-leg-1 2 times: first, second");
    expect(await editionsOf(database).countDocuments({ whole: { $exists: true } })).toBe(0);
  });

  test("a round already within a different run blocks", async () => {
    const database = await testDb();
    await seedRelay(database);
    await editionsOf(database).insertMany([
      edition("run", "relay", true),
      edition("other", "relay", false),
      edition("round", "q-leg-1", true, { whole: "other" }),
    ]);
    await linksOf(database).insertOne(tie("round", "run"));

    const outcome = await roundsWithinRuns.up(database);

    expect(outcome.blocked).toContain(
      "round round is tied to run run but already belongs to other",
    );
  });

  test("startup stops with the diagnostic and records nothing", async () => {
    const database = await testDb();
    await seedRelay(database);
    await editionsOf(database).insertMany([
      edition("run", "relay", true),
      edition("round-a", "q-leg-1", true),
      edition("round-b", "q-leg-2", true),
    ]);
    await linksOf(database).insertMany([tie("round-a", "run"), tie("round-b", "run")]);
    const mongodbUrl = `${await testDbUri()}${database.databaseName}`;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const error = await caughtError(() => runCommonsProcess({ port: 3999, mongodbUrl }));

      expect(error.name).toBe("MigrationBlocked");
      expect(error.message).toContain(
        "commons: migration 20260923T000100-rounds-within-runs cannot run automatically.",
      );
      expect(error.message).toContain("run run has 2 open rounds: round-a, round-b");
    } finally {
      log.mockRestore();
    }
    expect(
      await database
        .collection("commons.migrations")
        .countDocuments({ _id: "20260923T000100-rounds-within-runs" as never }),
    ).toBe(0);
    expect(await editionsOf(database).countDocuments({ whole: { $exists: true } })).toBe(0);
  });
});
