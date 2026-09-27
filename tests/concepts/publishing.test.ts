import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import type { Db, Document } from "mongodb";
import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/publishing/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoPublishingConcept } from "../../src/concepts/publishing/publishing.mongo.ts";
import { publishing as publishingRegistration } from "../../src/concepts/publishing/registry.ts";

const floors: [string, () => Promise<MongoPublishingConcept>][] = [
  ["on MongoDB", async () => new MongoPublishingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

const opened = new Date("2026-03-03T09:00:00Z");
const closed = new Date("2026-03-03T10:00:00Z");

for (const [floor, make] of floors) {
  describe(`Publishing ${floor}`, () => {
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
          whole: null,
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

    test("concurrent publishers create only one live edition", async () => {
      const publishing = await make();
      const results = await Promise.allSettled(
        Array.from({ length: 12 }, () =>
          publishing.publish({ author: "lee", material: "quiz-1", at: opened }),
        ),
      );
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      for (const result of results) {
        if (result.status === "rejected")
          expect(result.reason).toBeInstanceOf(refusalErrors.MaterialAlreadyShared);
      }
      expect(await publishing._editionsFor({ material: "quiz-1" })).toHaveLength(1);
    });

    test("concurrent closes succeed once and retain that closing time", async () => {
      const publishing = await make();
      const { edition } = await publishing.publish({
        author: "lee",
        material: "quiz-1",
        at: opened,
      });
      const times = Array.from({ length: 12 }, (_, index) => new Date(closed.getTime() + index));
      const results = await Promise.allSettled(
        times.map((at) => publishing.close({ edition, at })),
      );
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      for (const result of results) {
        if (result.status === "rejected")
          expect(result.reason).toBeInstanceOf(refusalErrors.AlreadyClosed);
      }
      const winner = results.findIndex((result) => result.status === "fulfilled");
      expect((await publishing._edition({ edition }))[0].closedAt).toEqual(times[winner]);
      // Refusals must not poison later publication.
      await publishing.publish({ author: "lee", material: "quiz-1", at: closed });
      expect(await publishing._openEditions()).toHaveLength(1);
    });

    test("close records the closing time and frees the material for a later edition", async () => {
      const publishing = await make();
      const first = await publishing.publish({ author: "lee", material: "quiz-1", at: opened });
      await publishing.close({ edition: first.edition, at: closed });
      expect(await publishing._edition({ edition: first.edition })).toEqual([
        {
          author: "lee",
          material: "quiz-1",
          whole: null,
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

    test("publishWithin opens a part tied to its whole from the moment it exists", async () => {
      const publishing = await make();
      const { edition: session } = await publishing.publish({
        author: "lee",
        material: "session",
        at: opened,
      });
      const { edition: part } = await publishing.publishWithin({
        whole: session,
        author: "lee",
        material: "question-1",
        at: opened,
      });
      expect(await publishing._edition({ edition: part })).toEqual([
        {
          author: "lee",
          material: "question-1",
          whole: session,
          open: true,
          openedAt: opened,
          closedAt: null,
        },
      ]);
      expect(await publishing._openPart({ whole: session })).toEqual([
        { edition: part, material: "question-1" },
      ]);
      expect(await publishing._parts({ whole: session })).toEqual([
        { edition: part, material: "question-1", open: true, openedAt: opened, closedAt: null },
      ]);
      expect(await publishing._edition({ edition: session })).toMatchObject([{ whole: null }]);
    });

    test("publishWithin refuses a whole that does not exist", async () => {
      const publishing = await make();
      const err = await refusal(() =>
        publishing.publishWithin({ whole: "no-such", author: "lee", material: "q", at: opened }),
      );
      expect(err).toBeInstanceOf(refusalErrors.EditionNotFound);
      expect(err.message).toBe("There is no such edition.");
      expect(await publishing._editionsFor({ material: "q" })).toEqual([]);
    });

    test("publishWithin refuses a whole that has closed", async () => {
      const publishing = await make();
      const { edition: session } = await publishing.publish({
        author: "lee",
        material: "session",
        at: opened,
      });
      await publishing.close({ edition: session, at: closed });
      const err = await refusal(() =>
        publishing.publishWithin({ whole: session, author: "lee", material: "q", at: closed }),
      );
      expect(err).toBeInstanceOf(refusalErrors.WholeClosed);
      expect(err.message).toBe("What this belongs to is closed.");
      expect(await publishing._parts({ whole: session })).toEqual([]);
    });

    test("a whole holds one open part; closing it frees the whole for the next", async () => {
      const publishing = await make();
      const { edition: session } = await publishing.publish({
        author: "lee",
        material: "session",
        at: opened,
      });
      const first = await publishing.publishWithin({
        whole: session,
        author: "lee",
        material: "question-1",
        at: opened,
      });
      const err = await refusal(() =>
        publishing.publishWithin({
          whole: session,
          author: "lee",
          material: "question-2",
          at: opened,
        }),
      );
      expect(err).toBeInstanceOf(refusalErrors.PartOpen);
      expect(err.message).toBe("Another part is open; close it first.");

      await publishing.close({ edition: first.edition, at: closed });
      expect(await publishing._openPart({ whole: session })).toEqual([]);
      const second = await publishing.publishWithin({
        whole: session,
        author: "lee",
        material: "question-2",
        at: closed,
      });
      expect(await publishing._openPart({ whole: session })).toEqual([
        { edition: second.edition, material: "question-2" },
      ]);
    });

    test("a material is published once within a whole, even after its part closes", async () => {
      const publishing = await make();
      const { edition: session } = await publishing.publish({
        author: "lee",
        material: "session",
        at: opened,
      });
      const first = await publishing.publishWithin({
        whole: session,
        author: "lee",
        material: "question-1",
        at: opened,
      });
      await publishing.close({ edition: first.edition, at: closed });
      const err = await refusal(() =>
        publishing.publishWithin({
          whole: session,
          author: "lee",
          material: "question-1",
          at: closed,
        }),
      );
      expect(err).toBeInstanceOf(refusalErrors.PartDone);
      expect(err.message).toBe("This was already released here.");

      const { edition: nextSession } = await publishing.publish({
        author: "lee",
        material: "next-session",
        at: closed,
      });
      await publishing.publishWithin({
        whole: nextSession,
        author: "lee",
        material: "question-1",
        at: closed,
      });
    });

    test("a material open outside the whole is refused within it, the whole's own included", async () => {
      const publishing = await make();
      const { edition: session } = await publishing.publish({
        author: "lee",
        material: "session",
        at: opened,
      });
      await publishing.publish({ author: "lee", material: "quiz", at: opened });
      const elsewhere = await refusal(() =>
        publishing.publishWithin({ whole: session, author: "lee", material: "quiz", at: opened }),
      );
      expect(elsewhere).toBeInstanceOf(refusalErrors.MaterialAlreadyShared);
      const itself = await refusal(() =>
        publishing.publishWithin({
          whole: session,
          author: "lee",
          material: "session",
          at: opened,
        }),
      );
      expect(itself).toBeInstanceOf(refusalErrors.MaterialAlreadyShared);
      expect(await publishing._parts({ whole: session })).toEqual([]);
    });

    test("an open part holds its material against publish", async () => {
      const publishing = await make();
      const { edition: session } = await publishing.publish({
        author: "lee",
        material: "session",
        at: opened,
      });
      await publishing.publishWithin({
        whole: session,
        author: "lee",
        material: "question-1",
        at: opened,
      });
      const err = await refusal(() =>
        publishing.publish({ author: "lee", material: "question-1", at: opened }),
      );
      expect(err).toBeInstanceOf(refusalErrors.MaterialAlreadyShared);
    });

    test("a missing whole outranks every other obstacle", async () => {
      const publishing = await make();
      await publishing.publish({ author: "lee", material: "quiz", at: opened });
      const err = await refusal(() =>
        publishing.publishWithin({ whole: "no-such", author: "lee", material: "quiz", at: opened }),
      );
      expect(err).toBeInstanceOf(refusalErrors.EditionNotFound);
    });

    test("a closed whole outranks a done material and an open part", async () => {
      const publishing = await make();
      const { edition: session } = await publishing.publish({
        author: "lee",
        material: "session",
        at: opened,
      });
      await publishing.publishWithin({
        whole: session,
        author: "lee",
        material: "question-1",
        at: opened,
      });
      await publishing.close({ edition: session, at: closed });
      const err = await refusal(() =>
        publishing.publishWithin({
          whole: session,
          author: "lee",
          material: "question-1",
          at: closed,
        }),
      );
      expect(err).toBeInstanceOf(refusalErrors.WholeClosed);
    });

    test("a done material outranks an open part, including when it is that part", async () => {
      const publishing = await make();
      const { edition: session } = await publishing.publish({
        author: "lee",
        material: "session",
        at: opened,
      });
      const first = await publishing.publishWithin({
        whole: session,
        author: "lee",
        material: "question-1",
        at: opened,
      });
      const same = await refusal(() =>
        publishing.publishWithin({
          whole: session,
          author: "lee",
          material: "question-1",
          at: opened,
        }),
      );
      expect(same).toBeInstanceOf(refusalErrors.PartDone);

      await publishing.close({ edition: first.edition, at: closed });
      await publishing.publishWithin({
        whole: session,
        author: "lee",
        material: "question-2",
        at: closed,
      });
      const earlier = await refusal(() =>
        publishing.publishWithin({
          whole: session,
          author: "lee",
          material: "question-1",
          at: closed,
        }),
      );
      expect(earlier).toBeInstanceOf(refusalErrors.PartDone);
    });

    test("an open part outranks a material open elsewhere", async () => {
      const publishing = await make();
      const { edition: session } = await publishing.publish({
        author: "lee",
        material: "session",
        at: opened,
      });
      await publishing.publishWithin({
        whole: session,
        author: "lee",
        material: "question-1",
        at: opened,
      });
      await publishing.publish({ author: "lee", material: "quiz", at: opened });
      const err = await refusal(() =>
        publishing.publishWithin({ whole: session, author: "lee", material: "quiz", at: opened }),
      );
      expect(err).toBeInstanceOf(refusalErrors.PartOpen);
    });

    test("closing a whole leaves its open part open", async () => {
      const publishing = await make();
      const { edition: session } = await publishing.publish({
        author: "lee",
        material: "session",
        at: opened,
      });
      const part = await publishing.publishWithin({
        whole: session,
        author: "lee",
        material: "question-1",
        at: opened,
      });
      await publishing.close({ edition: session, at: closed });
      expect(await publishing._openPart({ whole: session })).toEqual([
        { edition: part.edition, material: "question-1" },
      ]);
    });

    test("_parts answers a whole's parts in publication order", async () => {
      const publishing = await make();
      const { edition: session } = await publishing.publish({
        author: "lee",
        material: "session",
        at: opened,
      });
      const earlier = new Date(opened.getTime() - 60_000);
      const parts: string[] = [];
      for (const [material, at] of [
        ["question-1", opened],
        ["question-2", opened],
        ["question-3", earlier],
      ] as const) {
        const { edition } = await publishing.publishWithin({
          whole: session,
          author: "lee",
          material,
          at,
        });
        await publishing.close({ edition, at: closed });
        parts.push(edition);
      }
      expect((await publishing._parts({ whole: session })).map((row) => row.edition)).toEqual([
        parts[2],
        parts[0],
        parts[1],
      ]);
      expect(await publishing._parts({ whole: parts[0] })).toEqual([]);
      expect(await publishing._parts({ whole: "no-such" })).toEqual([]);
      expect(await publishing._openPart({ whole: "no-such" })).toEqual([]);
    });

    test("concurrent parts within one whole open exactly one", async () => {
      const publishing = await make();
      const { edition: session } = await publishing.publish({
        author: "lee",
        material: "session",
        at: opened,
      });
      const different = await Promise.allSettled(
        Array.from({ length: 12 }, (_, index) =>
          publishing.publishWithin({
            whole: session,
            author: "lee",
            material: `question-${index}`,
            at: opened,
          }),
        ),
      );
      expect(different.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      for (const result of different) {
        if (result.status === "rejected")
          expect(result.reason).toBeInstanceOf(refusalErrors.PartOpen);
      }
      const [open] = await publishing._openPart({ whole: session });
      await publishing.close({ edition: open.edition, at: closed });

      const same = await Promise.allSettled(
        Array.from({ length: 12 }, () =>
          publishing.publishWithin({
            whole: session,
            author: "lee",
            material: "question-next",
            at: closed,
          }),
        ),
      );
      expect(same.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      for (const result of same) {
        if (result.status === "rejected")
          expect(result.reason).toBeInstanceOf(refusalErrors.PartDone);
      }
      expect(await publishing._parts({ whole: session })).toHaveLength(2);
    });
  });
}

type Insert = () => Promise<unknown>;

/** The database, with every insert passed through `around` so a test can hold one mid-race. */
function interleaved(db: Db, around: (insert: Insert) => Promise<unknown>): Db {
  return new Proxy(db, {
    get(target, key) {
      if (key !== "collection") return Reflect.get(target, key);
      return (name: string) =>
        new Proxy(target.collection(name), {
          get(collection, member) {
            if (member === "insertOne") {
              return (...args: Parameters<typeof collection.insertOne>) =>
                around(() => collection.insertOne(...args));
            }
            const value: unknown = Reflect.get(collection, member);
            return typeof value === "function" ? value.bind(collection) : value;
          },
        });
    },
  });
}

function gate() {
  let open = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
}

/** A second process whose first insert waits until the test lets it through. */
function heldAtInsert(db: Db) {
  const reached = gate();
  const release = gate();
  const concept = new MongoPublishingConcept(
    interleaved(db, async (insert) => {
      reached.open();
      await release.opened;
      return insert();
    }),
  );
  return { concept, reached: reached.opened, release: release.open };
}

/** The database, with the filter of every find on any collection kept in `filters`. */
function readsKept(db: Db, filters: Document[]): Db {
  return new Proxy(db, {
    get(target, key) {
      if (key !== "collection") return Reflect.get(target, key);
      return (name: string) =>
        new Proxy(target.collection(name), {
          get(collection, member) {
            const value: unknown = Reflect.get(collection, member);
            if (typeof value !== "function") return value;
            if (member !== "find" && member !== "findOne") return value.bind(collection);
            return (filter: Document, ...rest: unknown[]) => {
              filters.push(filter);
              return value.call(collection, filter, ...rest);
            };
          },
        });
    },
  });
}

/** Each index the winning plan scans, or COLLSCAN where it reads the whole collection. */
function scans(stage: Document | undefined): string[] {
  if (stage === undefined) return [];
  const own =
    stage.stage === "IXSCAN" ? [stage.indexName] : stage.stage === "COLLSCAN" ? ["COLLSCAN"] : [];
  const inputs: Document[] = stage.inputStages ?? [stage.inputStage];
  return [...own, ...inputs.flatMap(scans)];
}

async function session(publishing: MongoPublishingConcept) {
  const { edition } = await publishing.publish({ author: "lee", material: "session", at: opened });
  return edition;
}

describe("Publishing shared by processes on one MongoDB database", () => {
  test("instances racing parts of one whole open exactly one and refuse the rest by guard", async () => {
    const db = await testDb();
    const instances = Array.from({ length: 6 }, () => new MongoPublishingConcept(db));
    const whole = await session(instances[0]);

    const different = await Promise.allSettled(
      instances.map((publishing, index) =>
        publishing.publishWithin({
          whole,
          author: "lee",
          material: `question-${index}`,
          at: opened,
        }),
      ),
    );
    expect(different.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of different) {
      if (result.status === "rejected")
        expect(result.reason).toBeInstanceOf(refusalErrors.PartOpen);
    }
    const [open] = await instances[0]._openPart({ whole });
    await instances[0].close({ edition: open.edition, at: closed });

    const same = await Promise.allSettled(
      instances.map((publishing) =>
        publishing.publishWithin({ whole, author: "lee", material: "question-next", at: closed }),
      ),
    );
    expect(same.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of same) {
      if (result.status === "rejected")
        expect(result.reason).toBeInstanceOf(refusalErrors.PartDone);
    }
  });

  test("instances racing to publish one material open one edition", async () => {
    const db = await testDb();
    const instances = Array.from({ length: 6 }, () => new MongoPublishingConcept(db));

    const results = await Promise.allSettled(
      instances.map((publishing) =>
        publishing.publish({ author: "lee", material: "quiz", at: opened }),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of results) {
      if (result.status === "rejected")
        expect(result.reason).toBeInstanceOf(refusalErrors.MaterialAlreadyShared);
    }
    expect(await instances[0]._editionsFor({ material: "quiz" })).toHaveLength(1);
  });

  test("instances racing one material as an edition and as a part open one of them", async () => {
    const db = await testDb();
    const instances = Array.from({ length: 6 }, () => new MongoPublishingConcept(db));
    const whole = await session(instances[0]);
    const within = (index: number) => index % 2 === 1;

    const results = await Promise.allSettled(
      instances.map((publishing, index) =>
        within(index)
          ? publishing.publishWithin({ whole, author: "lee", material: "quiz", at: opened })
          : publishing.publish({ author: "lee", material: "quiz", at: opened }),
      ),
    );
    const winners = results.filter((result) => result.status === "fulfilled");
    expect(winners).toHaveLength(1);
    const [winner] = await instances[0]._editionsFor({ material: "quiz" });
    const [{ whole: winnerWhole }] = await instances[0]._edition({ edition: winner.edition });
    results.forEach((result, index) => {
      if (result.status === "fulfilled") return;
      expect(result.reason).toBeInstanceOf(
        within(index) && winnerWhole === whole
          ? refusalErrors.PartDone
          : refusalErrors.MaterialAlreadyShared,
      );
    });
  });

  test("instances racing one close close it once", async () => {
    const db = await testDb();
    const instances = Array.from({ length: 6 }, () => new MongoPublishingConcept(db));
    const edition = await session(instances[0]);
    const times = instances.map((_, index) => new Date(closed.getTime() + index));

    const results = await Promise.allSettled(
      instances.map((publishing, index) => publishing.close({ edition, at: times[index] })),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of results) {
      if (result.status === "rejected")
        expect(result.reason).toBeInstanceOf(refusalErrors.AlreadyClosed);
    }
    const winner = results.findIndex((result) => result.status === "fulfilled");
    expect((await instances[0]._edition({ edition }))[0].closedAt).toEqual(times[winner]);
  });

  test("a part another process opened after the check refuses the late insert as PART_OPEN", async () => {
    const db = await testDb();
    const other = new MongoPublishingConcept(db);
    const whole = await session(other);
    const held = heldAtInsert(db);

    const late = held.concept.publishWithin({ whole, author: "lee", material: "q-1", at: opened });
    await held.reached;
    await other.publishWithin({ whole, author: "lee", material: "q-2", at: opened });
    held.release();

    expect(await refusal(() => late)).toBeInstanceOf(refusalErrors.PartOpen);
    expect((await other._parts({ whole })).map((row) => row.material)).toEqual(["q-2"]);
  });

  test("the same part another process opened after the check refuses the late insert as PART_DONE", async () => {
    const db = await testDb();
    const other = new MongoPublishingConcept(db);
    const whole = await session(other);
    const held = heldAtInsert(db);

    const late = held.concept.publishWithin({ whole, author: "lee", material: "q-1", at: opened });
    await held.reached;
    await other.publishWithin({ whole, author: "lee", material: "q-1", at: opened });
    held.release();

    expect(await refusal(() => late)).toBeInstanceOf(refusalErrors.PartDone);
    expect(await other._parts({ whole })).toHaveLength(1);
  });

  test("an edition another process published after the check refuses the late publish", async () => {
    const db = await testDb();
    const other = new MongoPublishingConcept(db);
    const held = heldAtInsert(db);

    const late = held.concept.publish({ author: "lee", material: "quiz", at: opened });
    await held.reached;
    await other.publish({ author: "lee", material: "quiz", at: opened });
    held.release();

    expect(await refusal(() => late)).toBeInstanceOf(refusalErrors.MaterialAlreadyShared);
    expect(await other._editionsFor({ material: "quiz" })).toHaveLength(1);
  });

  test("a conflicting part closed before the late insert is checked again opens the late part", async () => {
    const db = await testDb();
    const other = new MongoPublishingConcept(db);
    const whole = await session(other);
    const reached = gate();
    const release = gate();
    const failed = gate();
    const resume = gate();
    const held = new MongoPublishingConcept(
      interleaved(db, async (insert) => {
        reached.open();
        await release.opened;
        try {
          return await insert();
        } catch (error) {
          failed.open();
          await resume.opened;
          throw error;
        }
      }),
    );

    const late = held.publishWithin({ whole, author: "lee", material: "q-1", at: opened });
    await reached.opened;
    const winner = await other.publishWithin({ whole, author: "lee", material: "q-2", at: opened });
    release.open();
    await failed.opened;
    await other.close({ edition: winner.edition, at: closed });
    resume.open();

    const { edition } = await late;
    expect(await other._openPart({ whole })).toEqual([{ edition, material: "q-1" }]);
  });

  test("two assembled engines racing a part answer the loser with a refusal, not a fault", async () => {
    const db = await testDb();
    const engine = (publishing: MongoPublishingConcept) =>
      assemble({
        conceptSet: conceptSet({ Publishing: publishingRegistration }),
        composition: {},
        instances: { Publishing: publishing },
      });
    const held = heldAtInsert(db);
    const plain = new MongoPublishingConcept(db);
    const first = engine(held.concept);
    const second = engine(plain);
    const whole = await session(plain);

    const late = first.concepts.Publishing.publishWithin({
      whole,
      author: "lee",
      material: "q-1",
      at: opened,
    });
    await held.reached;
    expect(
      await second.concepts.Publishing.publishWithin({
        whole,
        author: "lee",
        material: "q-2",
        at: opened,
      }),
    ).toHaveProperty("edition");
    held.release();
    expect(await late).toMatchObject({
      error: "PART_OPEN",
      detail: "Another part is open; close it first.",
    });

    const [open] = await second.concepts.Publishing._openPart({ whole });
    await second.concepts.Publishing.close({ edition: open.edition, at: closed });
    const racing = await Promise.all(
      [first, second, first, second].map((app, index) =>
        app.concepts.Publishing.publishWithin({
          whole,
          author: "lee",
          material: `q-${index + 3}`,
          at: closed,
        }),
      ),
    );
    expect(racing.filter((result) => "edition" in result)).toHaveLength(1);
    for (const result of racing) {
      if (!("edition" in result)) expect(result).toMatchObject({ error: "PART_OPEN" });
    }
  });
});

describe("Publishing's reads by whole", () => {
  test("parts, the open part and the guard read through the partial indexes", async () => {
    const db = await testDb();
    const filters: Document[] = [];
    const publishing = new MongoPublishingConcept(readsKept(db, filters));
    const whole = await session(publishing);
    for (const material of ["q-1", "q-2", "q-3"]) {
      const { edition } = await publishing.publishWithin({
        whole,
        author: "lee",
        material,
        at: opened,
      });
      await publishing.close({ edition, at: closed });
    }
    await publishing.publishWithin({ whole, author: "lee", material: "q-4", at: closed });
    const scanned = async (read: () => Promise<unknown>) => {
      filters.length = 0;
      await read();
      expect(filters).toHaveLength(1);
      const explained = await db.collection("publishing.editions").find(filters[0]).explain();
      const plan: Document = explained.queryPlanner.winningPlan;
      return scans(plan.queryPlan ?? plan);
    };

    expect(await scanned(() => publishing._parts({ whole }))).toEqual([
      "one_part_per_material_per_whole",
    ]);
    expect(await scanned(() => publishing._openPart({ whole }))).toEqual([
      "one_open_part_per_whole",
    ]);
    const guard = await scanned(() =>
      refusal(() =>
        publishing.publishWithin({ whole, author: "lee", material: "q-5", at: closed }),
      ),
    );
    expect(guard).toContain("one_part_per_material_per_whole");
    expect(guard).not.toContain("COLLSCAN");
  });
});
