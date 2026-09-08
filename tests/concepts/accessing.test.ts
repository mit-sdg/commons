import { afterAll, expect, test, vi } from "vite-plus/test";
import { MongoAccessingConcept } from "../../src/concepts/accessing/accessing.mongo.ts";
import { AccessAlreadyEstablished } from "../../src/concepts/accessing/errors.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

test("readers see no choice before its write and the entire choice before acknowledgement", async () => {
  const db = await testDb();
  const collection = db.collection("accessing.resources");
  const insert = collection.insertOne.bind(collection);
  const beforeWrite = Promise.withResolvers<void>();
  const allowWrite = Promise.withResolvers<void>();
  const afterWrite = Promise.withResolvers<void>();
  const allowReturn = Promise.withResolvers<void>();
  const insertSpy = vi.spyOn(collection, "insertOne").mockImplementation(async (...args) => {
    beforeWrite.resolve();
    await allowWrite.promise;
    const result = await insert(...args);
    afterWrite.resolve();
    await allowReturn.promise;
    return result;
  });
  const collectionSpy = vi.spyOn(db, "collection").mockReturnValue(collection);
  const writer = new MongoAccessingConcept(db);
  collectionSpy.mockRestore();
  const reader = new MongoAccessingConcept(db);
  const writing = writer.establish({ resource: "room", holders: ["omar", "lee"] });
  try {
    await beforeWrite.promise;
    expect(await reader._holders({ resource: "room" })).toEqual([]);
    allowWrite.resolve();
    await afterWrite.promise;
    expect(await reader._holders({ resource: "room" })).toEqual([{ holders: ["lee", "omar"] }]);
  } finally {
    allowWrite.resolve();
    allowReturn.resolve();
    await writing;
    insertSpy.mockRestore();
  }
});

test("a complete choice survives duplicate establishment and retirement prevents reopening", async () => {
  const db = await testDb();
  const c = new MongoAccessingConcept(db);
  expect(await c._holders({ resource: "room" })).toEqual([]);
  await c.establish({ resource: "room", holders: ["omar", "lee", "omar"] });
  await expect(c.establish({ resource: "room", holders: ["ravi"] })).rejects.toBeInstanceOf(
    AccessAlreadyEstablished,
  );
  const restarted = new MongoAccessingConcept(db);
  expect(await restarted._holders({ resource: "room" })).toEqual([{ holders: ["lee", "omar"] }]);
  await restarted.retire({ resource: "room" });
  await restarted.retire({ resource: "room" });
  expect(await restarted._holders({ resource: "room" })).toEqual([]);
  await expect(c.establish({ resource: "room", holders: ["ravi"] })).rejects.toBeInstanceOf(
    AccessAlreadyEstablished,
  );
  await c.retire({ resource: "closed" });
  await expect(c.establish({ resource: "closed", holders: [] })).rejects.toBeInstanceOf(
    AccessAlreadyEstablished,
  );
});

test("competing instances publish exactly one complete set", async () => {
  const db = await testDb();
  const instances = Array.from({ length: 8 }, () => new MongoAccessingConcept(db));
  const sets = instances.map((_, i) => Array.from({ length: 100 }, (_, j) => `${i}:${j}`).sort());
  const outcomes = await Promise.allSettled(
    instances.map((c, i) => c.establish({ resource: "room", holders: sets[i] })),
  );
  expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const winner = outcomes.findIndex((result) => result.status === "fulfilled");
  expect(await instances[0]._holders({ resource: "room" })).toEqual([{ holders: sets[winner] }]);
});

test("establishment racing retirement always leaves access retired", async () => {
  const db = await testDb();
  const first = new MongoAccessingConcept(db);
  const second = new MongoAccessingConcept(db);
  const outcomes = await Promise.allSettled([
    first.establish({ resource: "room", holders: ["omar"] }),
    second.retire({ resource: "room" }),
  ]);
  expect(outcomes[1].status).toBe("fulfilled");
  expect(await first._holders({ resource: "room" })).toEqual([]);
  await expect(first.establish({ resource: "room", holders: ["lee"] })).rejects.toBeInstanceOf(
    AccessAlreadyEstablished,
  );
});

test("an empty established set remains distinct from missing access", async () => {
  const c = new MongoAccessingConcept(await testDb());
  await c.establish({ resource: "empty", holders: [] });
  expect(await c._holders({ resource: "empty" })).toEqual([{ holders: [] }]);
  await expect(c.establish({ resource: "empty", holders: ["omar"] })).rejects.toBeInstanceOf(
    AccessAlreadyEstablished,
  );
});
