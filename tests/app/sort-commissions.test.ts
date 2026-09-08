import { afterAll, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { MongoLockingConcept } from "../../src/concepts/locking/locking.mongo.ts";
import { MongoSuggestingConcept } from "../../src/concepts/suggesting/suggesting.mongo.ts";
import { placingPassage } from "../../src/computations/live-walls.ts";
import { scriptedMind, serveOnePass, disabledMind } from "../../src/reasoning/worker.ts";
import { MongoCategorizingConcept } from "../../src/concepts/categorizing/categorizing.mongo.ts";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

class PausedCategorizing extends MongoCategorizingConcept {
  armed = false;
  readonly entered = Promise.withResolvers<void>();
  readonly release = Promise.withResolvers<void>();
  async _getCategory(input: { item: string }) {
    const result = await super._getCategory(input);
    if (this.armed) {
      this.armed = false;
      this.entered.resolve();
      await this.release.promise;
    }
    return result;
  }
}

class PausedSuggesting extends MongoSuggestingConcept {
  armed = false;
  readonly entered = Promise.withResolvers<void>();
  readonly release = Promise.withResolvers<void>();
  async take(input: { suggestion: string }) {
    const result = await super.take(input);
    if (this.armed) {
      this.armed = false;
      this.entered.resolve();
      await this.release.promise;
    }
    return result;
  }
}

class PausedLocking extends MongoLockingConcept {
  armed = false;
  readonly entered = Promise.withResolvers<void>();
  readonly release = Promise.withResolvers<void>();
  async _isLocked(input: { target: string }) {
    const result = await super._isLocked(input);
    if (this.armed) {
      this.armed = false;
      this.entered.resolve();
      await this.release.promise;
    }
    return result;
  }
}

async function fixture() {
  const database = await testDb();
  const instances = mongoImplementations(database);
  const categorizing = new PausedCategorizing(database);
  const suggesting = new PausedSuggesting(database);
  const locking = new PausedLocking(database);
  const edge = createEdge({
    ...instances,
    Categorizing: categorizing,
    Suggesting: suggesting,
    Locking: locking,
  });
  const c = edge.application.concepts;
  const { user } = await c.Authenticating.register({
    username: "diag",
    password: "password123",
    email: "diag@example.edu",
  });
  await c.Profiling.createProfile({ user, displayName: "Diagnostic" });
  const { role } = await c.Roling.ensureRole({ name: "live-host", capabilities: ["live:host"] });
  await c.Roling.assign({ user, context: "commons", role });
  const login = await edge.fetch(
    new Request("http://edge/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "diag", password: "password123" }),
    }),
  );
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const session = cookie.slice(cookie.indexOf("=") + 1);
  const call = async (path: string, data: Record<string, unknown>) => {
    const r = await edge.gateway.invoke(path, { session, ...data }, { timeoutMs: 1500 });
    if (!r.ok) throw Error(JSON.stringify(r));
    return r.value as any;
  };
  const { relay } = await call("/live/relays/plan", { title: "Controlled transition" });
  const { leg } = await call("/live/relays/add-round", {
    relay,
    title: "One answer",
    prompt: "A synthetic word",
    parts: [],
    cap: 0,
    choices: [],
  });
  const { run, token } = await call("/live/relays/launch", { relay });
  const { round } = await call("/live/relays/open-round", { run, leg });
  const face = await call("/live/p/arrive", { token });
  const question = face.relay.questions[0].question;
  const { response } = await call("/live/p/begin", { token, device: "single" });
  await call("/live/p/answer", { response, question, value: "synthetic answer" });
  await call("/live/p/submit", { response });
  let { wall } = await call("/live/walls/read", { round });
  const card = wall.cards[0].card;
  const { category } = await c.Categorizing.createCategory({
    scope: round,
    name: "Synthetic",
    description: "",
  });
  await c.Categorizing.assign({ category, item: card });

  return { edge, c, categorizing, call, session, round, run, card, user, suggesting, locking };
}

for (const path of ["/live/walls/sort", "/live/walls/sort-now"]) {
  test(`${path} answers when a piled-card observation crosses emptying`, async () => {
    const f = await fixture();
    f.categorizing.armed = true;
    const sorting = f.edge.gateway.invoke(
      path,
      { session: f.session, round: f.round },
      { timeoutMs: 1500 },
    );
    try {
      // Pause after a real read captured the piled card. The other public
      // request empties it before that original, unchanged result resumes.
      await Promise.race([
        f.categorizing.entered.promise,
        sorting.then(() => {
          throw new Error("Sorting completed before the controlled read");
        }),
      ]);
      expect(await f.call("/live/walls/empty-piles", { round: f.round })).toEqual({
        emptied: true,
      });
      f.categorizing.release.resolve();
      expect(await sorting).toEqual({ ok: true, value: { asked: false } });
      expect(await f.c.Reasoning._pending()).toEqual([]);
      expect(await f.c.Locking._isLocked({ target: f.round })).toEqual({ locked: false });
      expect(await f.c.Categorizing._getCategory({ item: f.card })).toEqual([]);
    } finally {
      f.categorizing.release.resolve();
      await f.edge.application.whenIdle();
    }
  });

  test(`${path} gives a total answer for absent round reads`, async () => {
    const f = await fixture();
    expect(
      await f.edge.gateway.invoke(
        path,
        { session: f.session, round: "absent-round" },
        { timeoutMs: 1500 },
      ),
    ).toEqual(
      path.endsWith("sort-now")
        ? { ok: false, error: { kind: "domain", value: "CLOSED" } }
        : { ok: true, value: { asked: false } },
    );
    expect(await f.c.Locking._isLocked({ target: "absent-round" })).toEqual({ locked: false });
  });
}

test("authorization precedes absent-round outcomes on both routes", async () => {
  const f = await fixture();
  await f.c.Roling.revoke({ user: f.user, context: "commons" });
  for (const path of ["/live/walls/sort", "/live/walls/sort-now"]) {
    expect(
      await f.edge.gateway.invoke(
        path,
        { session: f.session, round: "absent-round" },
        { timeoutMs: 1500 },
      ),
    ).toEqual({ ok: false, error: { kind: "domain", value: "FORBIDDEN" } });
  }
  expect(await f.c.Reasoning._pending()).toEqual([]);
});

test("a closed round idles automatically but permits a deliberate ask in an open run", async () => {
  const f = await fixture();
  await f.call("/live/walls/empty-piles", { round: f.round });
  await f.c.Publishing.close({ edition: f.round, at: new Date() });
  expect(await f.call("/live/walls/sort", { round: f.round })).toEqual({ asked: false });
  expect(await f.call("/live/walls/sort-now", { round: f.round })).toMatchObject({ asked: true });
  expect(await f.c.Reasoning._pending()).toHaveLength(1);
});

test("concurrent sorting requests preserve the winning ask and its lock", async () => {
  const f = await fixture();
  await f.call("/live/walls/empty-piles", { round: f.round });
  const requests = ["/live/walls/sort", "/live/walls/sort-now"].map((path) =>
    f.edge.fetch(
      new Request(`http://edge/api${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `__Host-commons-session=${f.session}`,
        },
        body: JSON.stringify({ round: f.round }),
      }),
    ),
  );
  const results = await Promise.all(requests);
  const outcomes = await Promise.all(
    results.map(async (result) => ({
      status: result.status,
      body: (await result.json()) as { asked?: boolean },
    })),
  );
  expect(outcomes.filter(({ body }) => body.asked === true)).toHaveLength(1);
  expect(
    outcomes.filter(({ status, body }) => status === 409 || body.asked === false),
  ).toHaveLength(1);
  expect(await f.c.Reasoning._pending()).toHaveLength(1);
  expect(await f.c.Locking._isLocked({ target: f.round })).toEqual({ locked: true });
  // A later idle request must not release the earlier winner's lock either.
  expect(await f.call("/live/walls/sort", { round: f.round })).toEqual({ asked: false });
  expect(await f.c.Locking._isLocked({ target: f.round })).toEqual({ locked: true });
});

test("a closed run idles automatically and refuses deliberate sorting", async () => {
  const f = await fixture();
  await f.c.Publishing.close({ edition: f.run, at: new Date() });
  expect(await f.call("/live/walls/sort", { round: f.round })).toEqual({ asked: false });
  expect(
    await f.edge.gateway.invoke(
      "/live/walls/sort-now",
      { session: f.session, round: f.round },
      { timeoutMs: 1500 },
    ),
  ).toEqual({ ok: false, error: { kind: "domain", value: "CLOSED" } });
  expect(await f.c.Reasoning._pending()).toEqual([]);
});

test("a commission fixes the brief and completes after applying the reply", async () => {
  const f = await fixture();
  await f.call("/live/walls/empty-piles", { round: f.round });
  await f.call("/live/walls/set-notes", {
    round: f.round,
    body: "Keep related contributions together",
  });
  await f.call("/live/walls/sort-now", { round: f.round });
  const [before] = await f.c.Commissioning._forSubject({ subject: f.round });
  expect(before.status).toBe("accepted");
  const [ask] = await f.c.Reasoning._pending();
  expect(before.brief).toBe(ask.passage);
  expect(before.brief).toContain("Keep related contributions together");
  await f.call("/live/walls/set-notes", { round: f.round, body: "Different next time" });
  await f.c.Publishing.close({ edition: f.round, at: new Date() });
  await serveOnePass(f.c.Reasoning, scriptedMind());
  await f.edge.application.whenIdle();
  const [done] = await f.c.Commissioning._commission({ commission: before.commission });
  expect(done.status).toBe("completed");
  expect(done.brief).toBe(before.brief);
  expect((await f.c.Categorizing._getCategory({ item: f.card })).length).toBe(1);
  expect(await f.c.Locking._isLocked({ target: f.round })).toEqual({ locked: false });
});

test("provider failure concludes the undertaking without changing submissions", async () => {
  const f = await fixture();
  await f.call("/live/walls/empty-piles", { round: f.round });
  await f.call("/live/walls/sort-now", { round: f.round });
  await serveOnePass(f.c.Reasoning, disabledMind());
  await f.edge.application.whenIdle();
  const [work] = await f.c.Commissioning._forSubject({ subject: f.round });
  expect(work.status).toBe("failed");
  expect(work.account).toBe("The reasoner is disabled.");
  expect(await f.c.Categorizing._getCategory({ item: f.card })).toEqual([]);
});

test("completion receipts and corrections can precede association with the undertaking", async () => {
  const f = await fixture();
  await f.call("/live/walls/empty-piles", { round: f.round });
  const at = new Date();
  const [snapshot] = await f.c.RunSnapshotting._snapshot({ subject: f.round });
  const brief = placingPassage({
    value: snapshot.value,
    ...(await f.c.Categorizing._categoriesWithItems({ scope: f.round })),
    ...(await f.c.Responding._valuesForSubject({ subject: f.round })),
    removed: [],
    notes: "",
  });
  const { commission } = await f.c.Commissioning.prepare({
    subject: f.round,
    brief,
    account: "",
    at,
  });
  await f.c.Commissioning.accept({ commission, at });
  await f.c.Locking.lock({ target: f.round, at });
  const first = await f.c.Reasoning.ask({
    reasoner: "gemini-flash",
    about: f.round,
    passage: brief,
    at,
  });
  await f.c.Reasoning.answer({ asking: first.asking, reply: "not a usable reply", at });
  const [repair] = await f.c.Reasoning._pending();
  expect(repair.asking).not.toBe(first.asking);
  await serveOnePass(f.c.Reasoning, scriptedMind());
  await f.edge.application.whenIdle();
  expect(await f.c.Commissioning._receipt({ execution: repair.asking })).toMatchObject([
    { successful: true },
  ]);
  await f.c.Commissioning.assign({ commission, execution: first.asking, at });
  await f.edge.application.whenIdle();
  const [work] = await f.c.Commissioning._commission({ commission });
  expect(work.status).toBe("completed");
  expect(work.executions).toEqual(expect.arrayContaining([first.asking, repair.asking]));
  expect(work.executions).toHaveLength(2);
});

test("exhausted corrections conclude one failed undertaking with all attempts", async () => {
  const f = await fixture();
  await f.call("/live/walls/empty-piles", { round: f.round });
  await f.call("/live/walls/sort-now", { round: f.round });
  for (let n = 0; n < 4; n++) {
    const pending = await f.c.Reasoning._pending();
    if (pending.length === 0) break;
    await f.c.Reasoning.answer({ asking: pending[0].asking, reply: "unusable", at: new Date() });
  }
  await f.edge.application.whenIdle();
  const [work] = await f.c.Commissioning._forSubject({ subject: f.round });
  expect(work.status).toBe("failed");
  expect(work.executions.length).toBeGreaterThan(1);
  expect(await f.c.Reasoning._pending()).toEqual([]);
});

for (const removePile of [false, true]) {
  test(`commission waits for application and records ${removePile ? "refusal" : "completion"}`, async () => {
    const f = await fixture();
    const [{ category }] = await f.c.Categorizing._getCategory({ item: f.card });
    await f.call("/live/walls/empty-piles", { round: f.round });
    await f.call("/live/walls/sort-now", { round: f.round });
    const [ask] = await f.c.Reasoning._pending();
    f.suggesting.armed = true;
    const reply = f.c.Reasoning.answer({
      asking: ask.asking,
      reply: JSON.stringify({ kind: "placed", placements: [{ card: "c1", pile: "Synthetic" }] }),
      at: new Date(),
    });
    try {
      await Promise.race([
        f.suggesting.entered.promise,
        reply.then(() => {
          throw new Error("No placement was paused");
        }),
      ]);
      expect((await f.c.Commissioning._forSubject({ subject: f.round }))[0].status).toBe(
        "accepted",
      );
      expect(await f.c.Locking._isLocked({ target: f.round })).toEqual({ locked: true });
      if (removePile) await f.c.Categorizing.deleteCategory({ category });
      f.suggesting.release.resolve();
      await reply;
      await f.edge.application.whenIdle();
      const [work] = await f.c.Commissioning._forSubject({ subject: f.round });
      expect(work.status).toBe(removePile ? "failed" : "completed");
      if (removePile) expect(work.account).toBe("A placement could not be applied.");
    } finally {
      f.suggesting.release.resolve();
      await reply;
    }
  });
}

test("a lock acquired after observation records failed admission and preserves the holder", async () => {
  const f = await fixture();
  await f.call("/live/walls/empty-piles", { round: f.round });
  f.locking.armed = true;
  const request = f.edge.gateway.invoke(
    "/live/walls/sort-now",
    { session: f.session, round: f.round },
    { timeoutMs: 5000 },
  );
  try {
    await Promise.race([
      f.locking.entered.promise,
      request.then(() => {
        throw new Error("No admission observation was paused");
      }),
    ]);
    await f.c.Locking.lock({ target: f.round, at: new Date() });
    f.locking.release.resolve();
    expect(await request).toMatchObject({
      ok: false,
      error: { kind: "domain", value: "TARGET_ALREADY_LOCKED" },
    });
    await f.edge.application.whenIdle();
    expect((await f.c.Commissioning._forSubject({ subject: f.round }))[0].status).toBe("failed");
    expect(await f.c.Locking._isLocked({ target: f.round })).toEqual({ locked: true });
    expect(await f.c.Reasoning._pending()).toEqual([]);
  } finally {
    f.locking.release.resolve();
    await request;
  }
});
