import { MongoClient } from "mongodb";
import { afterAll, expect, test } from "vite-plus/test";
import { stopTestDb, testDb, testDbUri } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

test("concurrent callers have independent databases on the run's server", async () => {
  const [first, second] = await Promise.all([testDb(), testDb()]);
  expect(first.databaseName).not.toBe(second.databaseName);
  await first.collection<{ _id: string }>("isolation").insertOne({ _id: "only-first" });
  expect(await second.collection("isolation").countDocuments()).toBe(0);
  const observer = new MongoClient(await testDbUri());
  try {
    expect(await observer.db(first.databaseName).collection("isolation").countDocuments()).toBe(1);
  } finally {
    await observer.close();
  }
});

test("closing a file's client leaves the service alive and reopening selects fresh state", async () => {
  const first = await testDb();
  await first.collection<{ _id: string }>("lifecycle").insertOne({ _id: "before-close" });
  await stopTestDb();
  const next = await testDb();
  expect(next.databaseName).not.toBe(first.databaseName);
  expect(await next.collection("lifecycle").countDocuments()).toBe(0);
  expect(await next.command({ ping: 1 })).toMatchObject({ ok: 1 });
});
