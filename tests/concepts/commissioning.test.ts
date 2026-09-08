import { afterAll, expect, test } from "vite-plus/test";
import { MongoCommissioningConcept } from "../../src/concepts/commissioning/commissioning.mongo.ts";
import { CommissionNotPrepared } from "../../src/concepts/commissioning/errors.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

test("an undertaking retains its brief, executions and first conclusion", async () => {
  const c = new MongoCommissioningConcept(await testDb());
  const at = new Date();
  const prepared = await c.prepare({
    subject: "desk",
    brief: "Arrange these three letters",
    account: "",
    at,
  });
  expect(prepared.status).toBe("prepared");
  expect(await c.accept({ commission: prepared.commission, at })).toEqual({
    commission: prepared.commission,
    brief: prepared.brief,
  });
  await c.assign({ commission: prepared.commission, execution: "first", at });
  await c.assign({ commission: prepared.commission, execution: "first", at });
  await c.assign({ commission: prepared.commission, execution: "correction", at });
  const done = await c.conclude({
    commission: prepared.commission,
    successful: true,
    account: "",
    at,
  });
  expect(done.status).toBe("completed");
  expect(
    await c.conclude({
      commission: prepared.commission,
      successful: false,
      account: "late failure",
      at,
    }),
  ).toEqual(done);
  expect(await c._commission({ commission: prepared.commission })).toMatchObject([
    { brief: prepared.brief, status: "completed", executions: ["first", "correction"] },
  ]);
  await expect(c.accept({ commission: prepared.commission, at })).rejects.toBeInstanceOf(
    CommissionNotPrepared,
  );
});

test("a declined occasion cannot turn into an undertaking when circumstances change", async () => {
  const c = new MongoCommissioningConcept(await testDb());
  const at = new Date();
  const declined = await c.prepare({ subject: "desk", brief: "", account: "No work waiting", at });
  await expect(c.accept({ commission: declined.commission, at })).rejects.toBeInstanceOf(
    CommissionNotPrepared,
  );
  await c.conclude({ commission: declined.commission, successful: true, account: "", at });
  expect(await c._commission({ commission: declined.commission })).toMatchObject([
    { status: "declined", account: "No work waiting" },
  ]);
  const next = await c.prepare({ subject: "desk", brief: "A new letter", account: "", at });
  expect(next.commission).not.toBe(declined.commission);
  expect(next.status).toBe("prepared");
});

test("concurrent acceptance and conclusion preserve the owned state transitions", async () => {
  const c = new MongoCommissioningConcept(await testDb());
  const at = new Date();
  const { commission } = await c.prepare({ subject: "desk", brief: "Letters", account: "", at });
  const accepts = await Promise.allSettled(
    Array.from({ length: 8 }, () => c.accept({ commission, at })),
  );
  expect(accepts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const results = await Promise.all(
    [true, false].map((successful) =>
      c.conclude({ commission, successful, account: successful ? "" : "Unavailable", at }),
    ),
  );
  expect(results[0]).toEqual(results[1]);
});

test("retention expires terminal history but leaves outstanding work available", async () => {
  const db = await testDb();
  const c = new MongoCommissioningConcept(db);
  const at = new Date();
  const declined = await c.prepare({ subject: "desk", brief: "", account: "idle", at });
  const prepared = await c.prepare({ subject: "desk", brief: "Letters", account: "", at });
  const records = db.collection<{ _id: string; expiresAt?: Date }>("commissioning.commissions");
  expect((await records.findOne({ _id: declined.commission }))?.expiresAt).toEqual(
    new Date(at.getTime() + 3_600_000),
  );
  expect((await records.findOne({ _id: prepared.commission }))?.expiresAt).toBeUndefined();
  await c.accept({ commission: prepared.commission, at });
  expect((await records.findOne({ _id: prepared.commission }))?.expiresAt).toBeUndefined();
  await c.conclude({ commission: prepared.commission, successful: true, account: "", at });
  expect((await records.findOne({ _id: prepared.commission }))?.expiresAt).toEqual(
    new Date(at.getTime() + 7 * 86_400_000),
  );
  expect((await records.indexes()).some((index) => index.expireAfterSeconds === 0)).toBe(true);
});

for (const reportFirst of [false, true]) {
  test(`execution receipt and association agree with receipt ${reportFirst ? "first" : "last"}`, async () => {
    const c = new MongoCommissioningConcept(await testDb());
    const at = new Date();
    const { commission } = await c.prepare({ subject: "desk", brief: "Letters", account: "", at });
    await c.accept({ commission, at });
    const report = () =>
      c.report({ execution: "attempt", successful: false, account: "Could not finish", at });
    const assign = () => c.assign({ commission, execution: "attempt", at });
    if (reportFirst) {
      await report();
      await assign();
    } else {
      await assign();
      await report();
    }
    expect(await c._commission({ commission })).toMatchObject([
      { status: "failed", account: "Could not finish" },
    ]);
    await c.report({ execution: "attempt", successful: true, account: "", at });
    expect(await c._receipt({ execution: "attempt" })).toMatchObject([
      { successful: false, account: "Could not finish" },
    ]);
  });
}
