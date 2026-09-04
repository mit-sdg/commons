import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

type Edge = ReturnType<typeof createEdge>;

const post = (edge: Edge, path: string, body: unknown, cookie?: string) =>
  edge.fetch(
    new Request(`http://edge/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie !== undefined ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

const json = async (response: Response) => (await response.json()) as Record<string, never>;

async function registerHost(edge: Edge) {
  const host = {
    username: "ines",
    password: "pw-ines-123",
    displayName: "Professor Ines",
    email: "ines@example.com",
  };
  const registered = await edge.application.concepts.Authenticating.register(host);
  await edge.application.concepts.Profiling.createProfile({
    user: registered.user,
    displayName: host.displayName,
  });
  const { role } = await edge.application.concepts.Roling.ensureRole({
    name: "live-host",
    capabilities: ["live:host"],
  });
  await edge.application.concepts.Roling.assign({
    user: registered.user,
    context: "commons",
    role,
  });
  const login = await post(edge, "/auth/login", {
    username: host.username,
    password: host.password,
  });
  return login.headers.get("Set-Cookie")?.split(";")[0] as string;
}

async function until<Value>(
  read: () => Promise<Value>,
  done: (value: Value) => boolean,
): Promise<Value> {
  let value = await read();
  for (let attempt = 0; attempt < 40 && !done(value); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    value = await read();
  }
  return value;
}

interface Wall {
  handedIn: number;
  cards: { card: string; value: string; pile: string | null }[];
  piles: { pile: string; name: string; count: number }[];
}

/** A phone answers the open round with one value and hands in. */
async function handIn(edge: Edge, token: string, value: string) {
  const face = await until(
    async () =>
      (await json(await post(edge, "/live/p/arrive", { token }))).relay as {
        openRound: string | null;
        questions: { question: string }[];
      },
    (found) => found.openRound !== null && found.questions.length > 0,
  );
  const begun = await json(
    await post(edge, "/live/p/begin", { token, device: `phone-${Math.random()}` }),
  );
  const response = begun.response as string;
  await post(edge, "/live/p/answer", {
    response,
    question: face.questions[0]!.question,
    value,
  });
  await post(edge, "/live/p/submit", { response });
}

describe("removing a card from the wall", () => {
  let edge: Edge;
  let cookie: string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    cookie = await registerHost(edge);
  });

  afterAll(stopTestDb);

  test("a removed card leaves every reading of the wall, and the hand-in stays", async () => {
    const planned = await json(
      await post(edge, "/live/relays/plan", { title: "One word" }, cookie),
    );
    const relay = planned.relay as string;
    const added = await json(
      await post(
        edge,
        "/live/relays/add-round",
        { relay, title: "One word", prompt: "One word.", parts: [], cap: 0, choices: [] },
        cookie,
      ),
    );
    const launched = await json(await post(edge, "/live/relays/launch", { relay }, cookie));
    const run = launched.run as string;
    const token = launched.token as string;
    const opened = await json(
      await post(edge, "/live/relays/open-round", { run, leg: added.leg }, cookie),
    );
    const round = opened.round as string;
    const readWall = async () =>
      (await json(await post(edge, "/live/walls/read", { round }, cookie))).wall as Wall;

    await handIn(edge, token, "kindness");
    await handIn(edge, token, "something the room should not read");
    await handIn(edge, token, "patience");
    const full = await until(readWall, (wall) => wall.cards.length === 3);
    const offending = full.cards.find((card) => card.value.startsWith("something"))!;

    // The card in the tray is removed: gone from the wall, the hand-in counted still.
    const removed = await json(
      await post(edge, "/live/walls/remove-card", { round, card: offending.card }, cookie),
    );
    expect(removed.card).toBe(offending.card);
    const without = await until(readWall, (wall) => wall.cards.length === 2);
    expect(without.cards.map((card) => card.value).sort()).toEqual(["kindness", "patience"]);
    expect(without.handedIn).toBe(3);

    // The model is asked over the standing cards only.
    const asked = await json(await post(edge, "/live/walls/sort", { round }, cookie));
    expect(asked.asked).toBe(true);
    const pending = await edge.application.concepts.Reasoning._pending();
    const passage = pending.find((ask) => ask.about === round)?.passage ?? "";
    expect(passage).toContain("kindness");
    expect(passage).not.toContain("should not read");

    // A removed card is no card of this wall.
    const again = await post(
      edge,
      "/live/walls/remove-card",
      { round, card: offending.card },
      cookie,
    );
    expect(again.status).toBe(404);
    const opening = await post(
      edge,
      "/live/walls/open-pile",
      { round, name: "Back", card: offending.card },
      cookie,
    );
    expect(opening.status).toBe(404);

    // A card in a pile leaves the pile when removed, and the pile's count is its cards.
    const kindness = without.cards.find((card) => card.value === "kindness")!;
    const patience = without.cards.find((card) => card.value === "patience")!;
    const piled = await json(
      await post(
        edge,
        "/live/walls/open-pile",
        { round, name: "Virtues", card: kindness.card },
        cookie,
      ),
    );
    const pile = piled.pile as string;
    await post(edge, "/live/walls/move-card", { card: patience.card, pile }, cookie);
    const two = await until(
      readWall,
      (wall) => wall.piles.find((entry) => entry.pile === pile)?.count === 2,
    );
    expect(two.piles.find((entry) => entry.pile === pile)?.count).toBe(2);
    await post(edge, "/live/walls/remove-card", { round, card: patience.card }, cookie);
    const one = await until(
      readWall,
      (wall) => wall.piles.find((entry) => entry.pile === pile)?.count === 1,
    );
    expect(one.cards.map((card) => card.value)).toEqual(["kindness"]);
    expect(
      await edge.application.concepts.Categorizing._getCategory({ item: patience.card }),
    ).toEqual([]);

    // Once the run has closed, removing is refused like every other wall write.
    await post(edge, "/live/relays/close-round", { round }, cookie);
    await post(edge, "/live/relays/close", { run }, cookie);
    const late = await post(
      edge,
      "/live/walls/remove-card",
      { round, card: kindness.card },
      cookie,
    );
    expect(late.status).toBe(409);
    expect((await readWall()).cards.map((card) => card.value)).toEqual(["kindness"]);
  }, 60_000);
});
