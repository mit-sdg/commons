import { reusableFixture, refreshEdge } from "../support/fixtures.ts";
import { MongoPublishingConcept } from "../../src/concepts/publishing/publishing.mongo.ts";
import { MongoSuggestingConcept } from "../../src/concepts/suggesting/suggesting.mongo.ts";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { MongoRespondingConcept } from "../../src/concepts/responding/responding.mongo.ts";
import { serveOnePass, disabledMind } from "../../src/reasoning/worker.ts";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

class PausedResponding extends MongoRespondingConcept {
  submitArmed = false;
  submitEntered = Promise.withResolvers<void>();
  submitRelease = Promise.withResolvers<void>();
  async submit(input: Parameters<MongoRespondingConcept["submit"]>[0]) {
    if (this.submitArmed) {
      this.submitArmed = false;
      this.submitEntered.resolve();
      await this.submitRelease.promise;
    }
    return super.submit(input);
  }
}

class PausedPublishing extends MongoPublishingConcept {
  armed = false;
  entered = Promise.withResolvers<void>();
  release = Promise.withResolvers<void>();
  async publishWithin(input: Parameters<MongoPublishingConcept["publishWithin"]>[0]) {
    if (this.armed) {
      this.armed = false;
      this.entered.resolve();
      await this.release.promise;
    }
    return super.publishWithin(input);
  }
}

class PausedSuggesting extends MongoSuggestingConcept {
  armed = false;
  entered = Promise.withResolvers<void>();
  release = Promise.withResolvers<void>();
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

async function buildFixture(carry = false) {
  const database = await testDb();
  const instances = mongoImplementations(database);
  const responding = new PausedResponding(database);
  const publishing = new PausedPublishing(database);
  const suggesting = new PausedSuggesting(database);
  const selected = {
    ...instances,
    Responding: responding,
    Publishing: publishing,
    Suggesting: suggesting,
  };
  const edge = createEdge(selected);
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
    db: database,
    resetEdge: () => refreshEdge(edge, selected),
    edge,
    c,
    responding,
    call,
    session,
    round,
    run,
    card,
    user,
    publishing,
    suggesting,
    token,
    question,
    category,
    leg,
    nextLeg,
    relay,
  };
}
const variants = new Map<
  boolean,
  ReturnType<typeof reusableFixture<Awaited<ReturnType<typeof buildFixture>>>>
>();
function fixture(carry = false) {
  let prepared = variants.get(carry);
  if (prepared === undefined) {
    prepared = reusableFixture(
      () => buildFixture(carry),
      ({ responding, publishing, suggesting }) => {
        responding.submitArmed = false;
        responding.submitEntered = Promise.withResolvers<void>();
        responding.submitRelease = Promise.withResolvers<void>();
        for (const gate of [publishing, suggesting]) {
          gate.armed = false;
          gate.entered = Promise.withResolvers<void>();
          gate.release = Promise.withResolvers<void>();
        }
      },
    );
    variants.set(carry, prepared);
  }
  return prepared();
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

test("answer and submit promptly refuse a missing response", async () => {
  const edge = createEdge(mongoImplementations(await testDb()));
  for (const path of ["/live/p/answer", "/live/p/submit"]) {
    expect(
      await edge.gateway.invoke(
        path,
        { response: "missing", question: "missing-question", value: "irrelevant" },
        { timeoutMs: 1500 },
      ),
    ).toMatchObject({ ok: false, error: { kind: "domain", value: "NOT_FOUND" } });
  }
});

test("an admitted round keeps the request's picks when the source's pins change before it is published", async () => {
  const f = await fixture(true);
  await f.call("/live/relays/close-round", { round: f.round });
  expect(await f.call("/live/relays/open-round", { run: f.run, leg: f.nextLeg })).toEqual({
    declined: "NOTHING_PICKED",
  });
  await f.call("/live/walls/pick", { round: f.round, pile: f.category });
  f.publishing.armed = true;
  const result = await resumeAfter(
    f.edge.gateway.invoke(
      "/live/relays/open-round",
      { session: f.session, run: f.run, leg: f.nextLeg, picked: [f.category] },
      { timeoutMs: 1500 },
    ),
    f.publishing.entered.promise,
    () => f.publishing.release.resolve(),
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
    await f.c.Categorizing.describeCategory({
      category: f.category,
      description: "Preserved legacy text",
    });
    await f.c.Guiding.set({
      subject: f.category,
      use: "pile-definition",
      title: "",
      body: "Sorting definition",
    });
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
    if (!removePile) {
      expect(await f.c.Categorizing._getCategoryDetail({ category: f.category })).toMatchObject([
        { description: "Preserved legacy text" },
      ]);
      expect(
        await f.c.Guiding._guidanceText({ subject: f.category, use: "pile-definition" }),
      ).toEqual({ text: "Sorting definition" });
      expect(
        await f.c.Guiding._guidanceText({ subject: f.category, use: "pile-summary" }),
      ).toMatchObject({ text: "A synthetic summary." });
    }
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

beforeAll(async () => {
  await fixture(false);
  await fixture(true);
});
