import { afterAll, expect, test } from "vite-plus/test";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { responseIdentity } from "../../src/migrations/20260906T000200-response-identity.ts";

afterAll(stopTestDb);

test("response identity migration preserves unique responses and prevents duplicates", async () => {
  const db = await testDb();
  const responses = db.collection<{ _id: string; subject: string; participant: string }>(
    "responding.responses",
  );
  await responses.insertOne({ _id: "one", subject: "round", participant: "phone" });
  expect((await responseIdentity.up(db)).blocked).toBeUndefined();
  await expect(
    responses.insertOne({ _id: "two", subject: "round", participant: "phone" }),
  ).rejects.toMatchObject({ code: 11000 });
  expect((await responseIdentity.up(db)).blocked).toBeUndefined();
  expect(await responses.countDocuments()).toBe(1);
});

test("response identity migration blocks historical collisions without deleting any hand-ins", async () => {
  const db = await testDb();
  const responses = db.collection<{
    _id: string;
    subject: string;
    participant: string;
    submitted: boolean;
  }>("responding.responses");
  await responses.insertMany([
    { _id: "one", subject: "round", participant: "phone", submitted: true },
    { _id: "two", subject: "round", participant: "phone", submitted: true },
  ]);
  const before = await responses.find().toArray();
  const result = await responseIdentity.up(db);
  expect(result.blocked).toContain("one, two");
  expect(await responses.find().toArray()).toEqual(before);
});

test("migration copies legacy answers in order and preserves later edits on reapplication", async () => {
  const db = await testDb();
  const responses = db.collection<{
    _id: string;
    subject: string;
    participant: string;
    answers?: unknown;
  }>("responding.responses");
  const legacy = db.collection("responding.answers");
  await responses.insertMany([
    { _id: "one", subject: "round", participant: "phone" },
    { _id: "empty", subject: "round", participant: "other-phone" },
  ]);
  await legacy.insertMany([
    { response: "one", item: "second", value: "B", seq: 2 },
    { response: "one", item: "first", value: "A", seq: 1 },
  ]);
  expect((await responseIdentity.up(db)).blocked).toBeUndefined();
  expect((await responses.findOne({ _id: "one" }))?.answers).toEqual([
    { item: "first", value: "A" },
    { item: "second", value: "B" },
  ]);
  expect((await responses.findOne({ _id: "empty" }))?.answers).toEqual([]);
  expect(await legacy.countDocuments()).toBe(2);
  await responses.updateOne(
    { _id: "one" },
    { $set: { answers: [{ item: "first", value: "Revised" }] } },
  );
  expect((await responseIdentity.up(db)).blocked).toBeUndefined();
  expect((await responses.findOne({ _id: "one" }))?.answers).toEqual([
    { item: "first", value: "Revised" },
  ]);
});

test.each([
  [
    { item: "q", value: "A", seq: 1 },
    { item: "q", value: "B", seq: 2 },
  ],
  [{ item: "q", value: 42, seq: 1 }],
  [{ item: "q", value: "A" }],
  [
    { item: "q", value: "A", seq: 1 },
    { item: "r", value: "B", seq: 1 },
  ],
])("migration blocks ambiguous legacy answers before copying any response: %j", async (...rows) => {
  const db = await testDb();
  const responses = db.collection<{
    _id: string;
    subject: string;
    participant: string;
    answers?: unknown;
  }>("responding.responses");
  await responses.insertMany([
    { _id: "valid", subject: "round", participant: "phone" },
    { _id: "invalid", subject: "round", participant: "other-phone" },
  ]);
  await db
    .collection("responding.answers")
    .insertMany(rows.map((row) => ({ ...row, response: "invalid" })));
  expect((await responseIdentity.up(db)).blocked).toContain("invalid");
  expect(await responses.countDocuments({ answers: { $exists: true } })).toBe(0);
});
