import { MongoLockingConcept } from "../../src/concepts/locking/locking.mongo.ts";
import { MongoLinkingConcept } from "../../src/concepts/linking/linking.mongo.ts";
import { MongoSuggestingConcept } from "../../src/concepts/suggesting/suggesting.mongo.ts";
import { afterAll, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { MongoPinningConcept } from "../../src/concepts/pinning/pinning.mongo.ts";
import { MongoRespondingConcept } from "../../src/concepts/responding/responding.mongo.ts";
import { serveOnePass, disabledMind } from "../../src/reasoning/worker.ts";
import { MongoCategorizingConcept } from "../../src/concepts/categorizing/categorizing.mongo.ts";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

class PausedCategorizing extends MongoCategorizingConcept {
  armed = false;
  readonly entered = Promise.withResolvers<void>();
  readonly release = Promise.withResolvers<void>();
  itemsArmed = false;
  readonly itemsEntered = Promise.withResolvers<void>();
  readonly itemsRelease = Promise.withResolvers<void>();
  async _categoriesWithItems(input: { scope: string }) {
    const result = await super._categoriesWithItems(input);
    if (this.itemsArmed) {
      this.itemsArmed = false;
      this.itemsEntered.resolve();
      await this.itemsRelease.promise;
    }
    return result;
  }
  async _getItems(input: { category: string }) {
    const result = await super._getItems(input);
    if (this.itemsArmed) {
      this.itemsArmed = false;
      this.itemsEntered.resolve();
      await this.itemsRelease.promise;
    }
    return result;
  }
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

class PausedResponding extends MongoRespondingConcept {
  submitArmed = false;
  readonly submitEntered = Promise.withResolvers<void>();
  readonly submitRelease = Promise.withResolvers<void>();
  async submit(input: Parameters<MongoRespondingConcept["submit"]>[0]) {
    if (this.submitArmed) {
      this.submitArmed = false;
      this.submitEntered.resolve();
      await this.submitRelease.promise;
    }
    return super.submit(input);
  }
  armed = false;
  readonly entered = Promise.withResolvers<void>();
  readonly release = Promise.withResolvers<void>();
  async _collectedAnswers(input: { response: string }) {
    const result = await super._collectedAnswers(input);
    if (this.armed) {
      this.armed = false;
      this.entered.resolve();
      await this.release.promise;
    }
    return result;
  }
}

class PausedPinning extends MongoPinningConcept {
  armed = false;
  readonly entered = Promise.withResolvers<void>();
  readonly release = Promise.withResolvers<void>();
  async _getPinned(input: { scope: string }) {
    const result = await super._getPinned(input);
    if (this.armed) {
      this.armed = false;
      this.entered.resolve();
      await this.release.promise;
    }
    return result;
  }
}

class PausedLinking extends MongoLinkingConcept {
  armed = false;
  readonly entered = Promise.withResolvers<void>();
  readonly release = Promise.withResolvers<void>();
  async setLinks(input: Parameters<MongoLinkingConcept["setLinks"]>[0]) {
    if (this.armed) {
      this.armed = false;
      this.entered.resolve();
      await this.release.promise;
    }
    return super.setLinks(input);
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

async function fixture(carry = false) {
  const database = await testDb();
  const instances = mongoImplementations(database);
  const responding = new PausedResponding(database);
  const categorizing = new PausedCategorizing(database);
  const locking = new PausedLocking(database);
  const linking = new PausedLinking(database);
  const suggesting = new PausedSuggesting(database);
  const pinning = new PausedPinning(database);
  const edge = createEdge({
    ...instances,
    Responding: responding,
    Categorizing: categorizing,
    Pinning: pinning,
    Linking: linking,
    Locking: locking,
    Suggesting: suggesting,
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
  let nextLeg: string | undefined;
  if (carry) {
    const added = await call("/live/relays/add-round", {
      relay,
      title: "Carried",
      prompt: "Choose",
      parts: [],
      cap: 0,
      choices: [],
    });
    nextLeg = added.leg;
    await call("/live/relays/set-takes", { leg: nextLeg, source: leg, use: "choices" });
  }
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

  return {
    edge,
    c,
    categorizing,
    responding,
    call,
    session,
    round,
    run,
    card,
    user,
    pinning,
    linking,
    locking,
    suggesting,
    token,
    question,
    category,
    leg,
    nextLeg,
    relay,
  };
}

async function resumeAfter<Result>(
  request: Promise<Result>,
  entered: Promise<void>,
  release: () => void,
  intervene: () => PromiseLike<unknown>,
) {
  try {
    await Promise.race([entered, request.then(() => undefined)]);
    await intervene();
  } finally {
    release();
  }
  return request;
}

test("submission answers when the last answer arrives after an incomplete observation", async () => {
  const f = await fixture();
  const { response } = await f.call("/live/p/begin", { token: f.token, device: "finishing" });
  f.responding.armed = true;
  const result = await resumeAfter(
    f.edge.gateway.invoke("/live/p/submit", { response }, { timeoutMs: 1500 }),
    f.responding.entered.promise,
    () => f.responding.release.resolve(),
    () => f.call("/live/p/answer", { response, question: f.question, value: "last answer" }),
  );
  expect(result.ok || (!result.ok && result.error.kind === "domain"), JSON.stringify(result)).toBe(
    true,
  );
  expect(await f.c.Responding._answers({ response })).toEqual([
    { item: f.question, value: "last answer" },
  ]);
});

test("emptying answers when a card is placed after the empty observation", async () => {
  const f = await fixture();
  await f.c.Categorizing.unassign({ item: f.card });
  f.categorizing.armed = true;
  const result = await resumeAfter(
    f.edge.gateway.invoke(
      "/live/walls/empty-piles",
      { session: f.session, round: f.round },
      { timeoutMs: 1500 },
    ),
    f.categorizing.entered.promise,
    () => f.categorizing.release.resolve(),
    () => f.c.Categorizing.assign({ item: f.card, category: f.category }),
  );
  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
});

test("summarizing answers when a card arrives after the empty observation", async () => {
  const f = await fixture();
  await f.c.Categorizing.unassign({ item: f.card });
  f.categorizing.itemsArmed = true;
  const result = await resumeAfter(
    f.edge.gateway.invoke(
      "/live/walls/summarize",
      { session: f.session, pile: f.category },
      { timeoutMs: 1500 },
    ),
    f.categorizing.itemsEntered.promise,
    () => f.categorizing.itemsRelease.resolve(),
    () => f.c.Categorizing.assign({ item: f.card, category: f.category }),
  );
  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
});

test("clearing answers when a pile empties after the occupied observation", async () => {
  const f = await fixture();
  f.categorizing.itemsArmed = true;
  const result = await resumeAfter(
    f.edge.gateway.invoke(
      "/live/walls/clear-empty-piles",
      { session: f.session, round: f.round },
      { timeoutMs: 1500 },
    ),
    f.categorizing.itemsEntered.promise,
    () => f.categorizing.itemsRelease.resolve(),
    () => f.c.Categorizing.unassign({ item: f.card }),
  );
  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
});

test("an admitted hand-in finishes across closure and stays immutable on retry", async () => {
  const f = await fixture();
  const { response } = await f.call("/live/p/begin", { token: f.token, device: "closing" });
  await f.call("/live/p/answer", { response, question: f.question, value: "kept" });
  f.responding.submitArmed = true;
  const result = await resumeAfter(
    f.edge.gateway.invoke("/live/p/submit", { response }, { timeoutMs: 1500 }),
    f.responding.submitEntered.promise,
    () => f.responding.submitRelease.resolve(),
    () => f.call("/live/relays/close-round", { round: f.round }),
  );
  expect(result).toEqual({ ok: true, value: { response } });
  expect(
    await f.edge.gateway.invoke(
      "/live/p/answer",
      { response, question: f.question, value: "late" },
      { timeoutMs: 1500 },
    ),
  ).toMatchObject({ ok: false, error: { kind: "domain" } });
  expect(
    await f.edge.gateway.invoke("/live/p/submit", { response }, { timeoutMs: 1500 }),
  ).toMatchObject({ ok: false, error: { kind: "domain" } });
  expect(await f.c.Responding._answers({ response })).toEqual([
    { item: f.question, value: "kept" },
  ]);
});

test("opening answers when a source gains its first pick after the no-picks observation", async () => {
  const f = await fixture(true);
  await f.call("/live/relays/close-round", { round: f.round });
  f.pinning.armed = true;
  const result = await resumeAfter(
    f.edge.gateway.invoke(
      "/live/relays/open-round",
      { session: f.session, run: f.run, leg: f.nextLeg },
      { timeoutMs: 1500 },
    ),
    f.pinning.entered.promise,
    () => f.pinning.release.resolve(),
    () => f.call("/live/walls/pick", { round: f.round, pile: f.category }),
  );
  expect(result.ok || (!result.ok && result.error.kind === "domain"), JSON.stringify(result)).toBe(
    true,
  );
  expect(await f.c.Locking._isLocked({ target: f.run })).toEqual({ locked: result.ok });
});

for (const path of ["/live/p/answer", "/live/p/submit"]) {
  test(`${path} promptly refuses a missing response`, async () => {
    const f = await fixture();
    expect(
      await f.edge.gateway.invoke(
        path,
        { response: "missing", question: f.question, value: "irrelevant" },
        { timeoutMs: 1500 },
      ),
    ).toMatchObject({ ok: false, error: { kind: "domain", value: "NOT_FOUND" } });
  });
}

test("an admitted round keeps its picked material when the source changes before linking", async () => {
  const f = await fixture(true);
  await f.call("/live/relays/close-round", { round: f.round });
  await f.call("/live/walls/pick", { round: f.round, pile: f.category });
  f.linking.armed = true;
  const result = await resumeAfter(
    f.edge.gateway.invoke(
      "/live/relays/open-round",
      { session: f.session, run: f.run, leg: f.nextLeg },
      { timeoutMs: 1500 },
    ),
    f.linking.entered.promise,
    () => f.linking.release.resolve(),
    () => f.call("/live/walls/unpick", { round: f.round, pile: f.category }),
  );
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) throw new Error(JSON.stringify(result));
  const round = (result.value as { round: string }).round;
  const [captured] = await f.c.RunSnapshotting._snapshot({ subject: round });
  expect(captured.value).toMatchObject({
    questions: [
      { choices: ["Synthetic"], context: [{ name: "Synthetic", cards: ["synthetic answer"] }] },
    ],
  });
});

for (const removePile of [false, true]) {
  test(`summary commissioning records ${removePile ? "application refusal" : "the applied sentence"}`, async () => {
    const f = await fixture();
    const { asking } = await f.call("/live/walls/summarize", { pile: f.category });
    f.suggesting.armed = true;
    await resumeAfter(
      Promise.resolve(
        f.c.Reasoning.answer({
          asking,
          reply: JSON.stringify({
            kind: "lid",
            pile: f.category,
            sentence: "A synthetic summary.",
          }),
          at: new Date(),
        }),
      ),
      f.suggesting.entered.promise,
      () => f.suggesting.release.resolve(),
      async () => {
        expect((await f.c.Commissioning._forExecution({ execution: asking }))[0].status).toBe(
          "accepted",
        );
        if (removePile) await f.c.Categorizing.deleteCategory({ category: f.category });
      },
    );
    await f.edge.application.whenIdle();
    expect((await f.c.Commissioning._forExecution({ execution: asking }))[0].status).toBe(
      removePile ? "failed" : "completed",
    );
    if (!removePile)
      expect(await f.c.Categorizing._getCategoryDetail({ category: f.category })).toMatchObject([
        { description: "A synthetic summary." },
      ]);
  });
}

test("a failed summary provider leaves a failed commission and no pending work", async () => {
  const f = await fixture();
  const { asking } = await f.call("/live/walls/summarize", { pile: f.category });
  await serveOnePass(f.c.Reasoning, disabledMind());
  await f.edge.application.whenIdle();
  expect((await f.c.Commissioning._forExecution({ execution: asking }))[0].status).toBe("failed");
  expect(await f.c.Locking._isLocked({ target: f.round })).toEqual({ locked: false });
  expect(await f.c.Reasoning._pending()).toEqual([]);
});

test("clearing answers when sorting finishes after the busy observation", async () => {
  const f = await fixture();
  await f.c.Locking.lock({ target: f.round, at: new Date() });
  f.locking.armed = true;
  const result = await resumeAfter(
    f.edge.gateway.invoke(
      "/live/walls/clear-empty-piles",
      { session: f.session, round: f.round },
      { timeoutMs: 1500 },
    ),
    f.locking.entered.promise,
    () => f.locking.release.resolve(),
    () => f.c.Locking.unlock({ target: f.round }),
  );
  expect(result.ok || (!result.ok && result.error.kind === "domain"), JSON.stringify(result)).toBe(
    true,
  );
});
