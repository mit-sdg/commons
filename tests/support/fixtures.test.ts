import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { assembleCommons } from "../../src/assembly/application.ts";
import { afterAll, expect, test, vi } from "vite-plus/test";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { reusableFixture, refreshFixture, refreshEdge } from "./fixtures.ts";

afterAll(stopTestDb);

test("a restored world retains indexes and resets changed, deleted and newly created state", async () => {
  const fixture = reusableFixture(async () => {
    const db = await testDb();
    await db
      .collection<{ _id: string; email: string; at?: Date }>("people")
      .createIndex({ email: 1 }, { unique: true });
    await db
      .collection<{ _id: string; email: string; at?: Date }>("people")
      .insertOne({ _id: "seed", email: "seed@example.test", at: new Date(0) });
    const app = assembleCommons(mongoImplementations(db));
    return { db, edge: { application: app } };
  });
  const first = await fixture();
  await first.db.collection<{ _id: string; email: string; at?: Date }>("people").deleteMany({});
  await first.db
    .collection<{ _id: string; email: string; at?: Date }>("people")
    .insertOne({ _id: "changed", email: "other@example.test" });
  await first.db.collection("new-state").insertOne({ value: "must disappear" });
  const second = await fixture();
  expect(second).toBe(first);
  expect(
    await second.db
      .collection<{ _id: string; email: string; at?: Date }>("people")
      .findOne({ _id: "seed" }),
  ).toMatchObject({
    email: "seed@example.test",
    at: new Date(0),
  });
  expect(
    await second.db
      .collection<{ _id: string; email: string; at?: Date }>("people")
      .countDocuments(),
  ).toBe(1);
  expect(await second.db.collection("new-state").countDocuments()).toBe(0);
  await expect(
    second.db
      .collection<{ _id: string; email: string; at?: Date }>("people")
      .insertOne({ _id: "duplicate", email: "seed@example.test" }),
  ).rejects.toThrow("E11000");
});

test("restoring an HTTP fixture refreshes its transport ledger even for captured request closures", async () => {
  const fixture = reusableFixture(async () => {
    const db = await testDb();
    const instances = mongoImplementations(db);
    const edge = createEdge(instances, "https://commons.test");
    const { user } = await edge.application.concepts.Authenticating.register({
      username: "fixture-owner",
      password: "password123",
      email: "fixture@example.test",
    });
    await edge.application.concepts.Profiling.createProfile({ user, displayName: "Fixture owner" });
    const { session } = await edge.application.concepts.Sessioning.start({ user });
    const refreshed = vi.spyOn(instances.Sessioning, "refresh");
    const request = () =>
      edge.fetch(
        new Request("https://commons.test/api/auth/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `__Host-commons-session=${session}`,
          },
          body: "{}",
        }),
      );
    return {
      db,
      edge,
      resetEdge: () => refreshEdge(edge, instances, "https://commons.test"),
      refreshed,
      request,
    };
  });
  const first = await fixture();
  expect((await first.request()).status).toBe(200);
  expect((await first.request()).status).toBe(200);
  expect(first.refreshed).toHaveBeenCalledTimes(1);
  const second = await fixture();
  expect(second.edge).toBe(first.edge);
  expect((await second.request()).status).toBe(200);
  expect(second.refreshed).toHaveBeenCalledTimes(2);
});

test("fixture refresh invalidates a constant-key template read before a direct invitation action", async () => {
  const db = await testDb();
  const app = assembleCommons(mongoImplementations(db));
  await app.concepts.Wording.word({
    place: "invitation",
    heading: "Saved fixture copy",
    passage: "Saved body",
  });
  const invite = async (address: string) => {
    const issued = await app.concepts.Inviting.invite({
      channel: "email",
      address,
      at: new Date(),
    });
    await app.whenIdle();
    return db.collection("mailing.messages").findOne({ key: issued.invitation });
  };
  expect((await invite("first@example.test"))?.subject).toBe("Saved fixture copy");
  await db.collection("wording.wordings").deleteMany({});
  // This control proves the test can expose stale state when a driver rewrite bypasses the engine.
  expect((await invite("stale@example.test"))?.subject).toBe("Saved fixture copy");
  await refreshFixture(app);
  expect((await invite("fresh@example.test"))?.subject).toBe("Your Commons invitation");
});
