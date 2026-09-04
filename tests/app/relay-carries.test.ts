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
    username: "lee",
    password: "pw-lee-123",
    displayName: "Professor Lee",
    email: "lee@example.com",
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

/** Poll a read until it settles; reactions land after the response. */
async function until<Value>(read: () => Promise<Value>, done: (value: Value) => boolean) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const value = await read();
    if (done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return read();
}

interface Wall {
  cards: { card: string; value: string; pile: string | null }[];
  piles: { pile: string; name: string; count: number; picked: string | null }[];
  questions: {
    question: string;
    prompt: string;
    choices: string[];
    parts: string[];
    context: { name: string; cards: string[] }[];
  }[];
}

/** A phone answers the open round with the values given, one per item, and hands in. */
async function handIn(edge: Edge, token: string, values: string[]) {
  const face = await until(
    async () =>
      (await json(await post(edge, "/live/p/arrive", { token }))).relay as {
        openRound: string | null;
        questions: { question: string; parts: string[]; cap: number }[];
      },
    (value) => value.openRound !== null && value.questions.length > 0,
  );
  const begun = await json(
    await post(edge, "/live/p/begin", { token, device: `phone-${Math.random()}` }),
  );
  const response = begun.response as string;
  const question = face.questions[0];
  const items =
    question.parts.length === 0
      ? [question.question]
      : Array.from(
          { length: question.cap >= 2 ? values.length : question.parts.length },
          (_, index) => `${question.question}#${index + 1}`,
        );
  for (const [index, item] of items.entries()) {
    await post(edge, "/live/p/answer", { response, question: item, value: values[index] ?? "" });
  }
  await post(edge, "/live/p/submit", { response });
  return response;
}

describe("what a round carries from an earlier one", () => {
  let edge: Edge;
  let cookie: string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    cookie = await registerHost(edge);
  });

  afterAll(stopTestDb);

  test("the uses table is served, and a take naming another word is refused", async () => {
    const served = await json(await post(edge, "/live/relays/uses", {}, cookie));
    expect((served.uses as { use: string }[]).map((entry) => entry.use)).toEqual([
      "context",
      "choices",
      "parts",
    ]);

    const planned = await json(await post(edge, "/live/relays/plan", { title: "Uses" }, cookie));
    const relay = planned.relay as string;
    const first = await json(
      await post(
        edge,
        "/live/relays/add-round",
        { relay, title: "A", prompt: "A?", parts: [], cap: 0, choices: [] },
        cookie,
      ),
    );
    const second = await json(
      await post(
        edge,
        "/live/relays/add-round",
        { relay, title: "B", prompt: "B?", parts: [], cap: 0, choices: [] },
        cookie,
      ),
    );
    const refused = await json(
      await post(
        edge,
        "/live/relays/set-takes",
        { leg: second.leg, source: first.leg, use: "picked" },
        cookie,
      ),
    );
    expect(refused.error).toBe("INVALID_REQUEST");
    const set = await json(
      await post(
        edge,
        "/live/relays/set-takes",
        { leg: second.leg, source: first.leg, use: "context" },
        cookie,
      ),
    );
    expect(set.draw).toBeDefined();
  });

  test("picked piles open a later round as context, as parts, or as choices, and a vote's ballots make piles", async () => {
    const planned = await json(await post(edge, "/live/relays/plan", { title: "Carries" }, cookie));
    const relay = planned.relay as string;
    const add = async (title: string, parts: string[], choices: string[]) =>
      (
        await json(
          await post(
            edge,
            "/live/relays/add-round",
            { relay, title, prompt: `${title}?`, parts, cap: 0, choices },
            cookie,
          ),
        )
      ).leg as string;
    const verbs = await add("Verbs", ["one", "two"], []);
    const stranger = await add("Stranger", [], []);
    const each = await add("Each", [], []);
    const vote = await add("Vote", [], []);
    const runoff = await add("Runoff", [], []);
    for (const [leg, use] of [
      [stranger, "context"],
      [each, "parts"],
      [vote, "choices"],
    ] as const) {
      await post(edge, "/live/relays/set-takes", { leg, source: verbs, use }, cookie);
    }
    await post(
      edge,
      "/live/relays/set-takes",
      { leg: runoff, source: vote, use: "context" },
      cookie,
    );

    const launched = await json(await post(edge, "/live/relays/launch", { relay }, cookie));
    const run = launched.run as string;
    const token = launched.token as string;

    // Round one: two phones, four cards, sorted by hand into two piles.
    const opened = await json(
      await post(edge, "/live/relays/open-round", { run, leg: verbs }, cookie),
    );
    const round = opened.round as string;
    await handIn(edge, token, ["save", "share"]);
    await handIn(edge, token, ["keep", "send"]);
    const wall = (await json(await post(edge, "/live/walls/read", { round }, cookie))).wall as Wall;
    expect(wall.cards).toHaveLength(4);
    const byValue = new Map(wall.cards.map((card) => [card.value, card.card]));
    const keeping = await json(
      await post(
        edge,
        "/live/walls/open-pile",
        { round, name: "keeping", card: byValue.get("save") },
        cookie,
      ),
    );
    await post(
      edge,
      "/live/walls/move-card",
      { card: byValue.get("keep"), pile: keeping.pile },
      cookie,
    );
    const sending = await json(
      await post(
        edge,
        "/live/walls/open-pile",
        { round, name: "sending", card: byValue.get("share") },
        cookie,
      ),
    );
    await post(
      edge,
      "/live/walls/move-card",
      { card: byValue.get("send"), pile: sending.pile },
      cookie,
    );
    await post(edge, "/live/relays/close-round", { round }, cookie);

    // Nothing picked: the dependent round is refused.
    const early = await json(
      await post(edge, "/live/relays/open-round", { run, leg: stranger }, cookie),
    );
    expect(early.error).toBe("CONFLICT");
    await post(edge, "/live/walls/pick", { round, pile: keeping.pile }, cookie);
    await post(edge, "/live/walls/pick", { round, pile: sending.pile }, cookie);

    // Context: the question as authored, with the piles and their cards above it.
    const shown = await json(
      await post(edge, "/live/relays/open-round", { run, leg: stranger }, cookie),
    );
    const strangerWall = await until(
      async () =>
        (await json(await post(edge, "/live/walls/read", { round: shown.round }, cookie)))
          .wall as Wall | null,
      (value) => value !== null && value.questions.length > 0,
    );
    expect(strangerWall?.questions[0]).toMatchObject({
      prompt: "Stranger?",
      choices: [],
      parts: [],
      context: [
        { name: "keeping", cards: ["save", "keep"] },
        { name: "sending", cards: ["share", "send"] },
      ],
    });
    await post(edge, "/live/relays/close-round", { round: shown.round }, cookie);

    // Parts: one box per picked pile.
    const boxed = await json(
      await post(edge, "/live/relays/open-round", { run, leg: each }, cookie),
    );
    const eachWall = await until(
      async () =>
        (await json(await post(edge, "/live/walls/read", { round: boxed.round }, cookie)))
          .wall as Wall | null,
      (value) => value !== null && value.questions.length > 0,
    );
    expect(eachWall?.questions[0]).toMatchObject({
      parts: ["keeping", "sending"],
      choices: [],
      context: [],
    });
    await post(edge, "/live/relays/close-round", { round: boxed.round }, cookie);

    // Choices: the vote, whose ballots file themselves under a pile per choice.
    const voting = await json(
      await post(edge, "/live/relays/open-round", { run, leg: vote }, cookie),
    );
    await until(
      async () =>
        (await json(await post(edge, "/live/walls/read", { round: voting.round }, cookie)))
          .wall as Wall | null,
      (value) => value !== null && value.questions.length > 0,
    );
    await handIn(edge, token, ["keeping"]);
    await handIn(edge, token, ["keeping"]);
    await handIn(edge, token, ["sending"]);
    const voteWall = await until(
      async () =>
        (await json(await post(edge, "/live/walls/read", { round: voting.round }, cookie)))
          .wall as Wall,
      (value) => value.cards.length === 3 && value.cards.every((card) => card.pile !== null),
    );
    expect(voteWall.questions[0].choices).toEqual(["keeping", "sending"]);
    expect(
      voteWall.piles
        .map((pile) => [pile.name, pile.count] as const)
        .sort((left, right) => left[0].localeCompare(right[0])),
    ).toEqual([
      ["keeping", 2],
      ["sending", 1],
    ]);
    await post(edge, "/live/relays/close-round", { round: voting.round }, cookie);

    // A vote's groups carry like piles: the winner shown as context, without its ballots.
    const won = voteWall.piles.find((pile) => pile.name === "keeping")?.pile;
    await post(edge, "/live/walls/pick", { round: voting.round, pile: won }, cookie);
    const after = await json(
      await post(edge, "/live/relays/open-round", { run, leg: runoff }, cookie),
    );
    const runoffWall = await until(
      async () =>
        (await json(await post(edge, "/live/walls/read", { round: after.round }, cookie)))
          .wall as Wall | null,
      (value) => value !== null && value.questions.length > 0,
    );
    expect(runoffWall?.questions[0].context).toEqual([{ name: "keeping", cards: [] }]);
  });

  test("a choice nobody chose is opened as an empty pile and carries as an empty group", async () => {
    const planned = await json(await post(edge, "/live/relays/plan", { title: "Empty" }, cookie));
    const relay = planned.relay as string;
    const poll = (
      await json(
        await post(
          edge,
          "/live/relays/add-round",
          {
            relay,
            title: "Poll",
            prompt: "Which?",
            parts: [],
            cap: 0,
            choices: ["yes", "no", "maybe"],
          },
          cookie,
        ),
      )
    ).leg as string;
    const after = (
      await json(
        await post(
          edge,
          "/live/relays/add-round",
          { relay, title: "After", prompt: "Why?", parts: [], cap: 0, choices: [] },
          cookie,
        ),
      )
    ).leg as string;
    await post(
      edge,
      "/live/relays/set-takes",
      { leg: after, source: poll, use: "context" },
      cookie,
    );

    const launched = await json(await post(edge, "/live/relays/launch", { relay }, cookie));
    const run = launched.run as string;
    const token = launched.token as string;
    const opened = await json(
      await post(edge, "/live/relays/open-round", { run, leg: poll }, cookie),
    );
    const round = opened.round as string;
    await until(
      async () =>
        (await json(await post(edge, "/live/walls/read", { round }, cookie))).wall as Wall | null,
      (value) => value !== null && value.questions.length > 0,
    );
    await handIn(edge, token, ["yes"]);
    const wall = await until(
      async () =>
        (await json(await post(edge, "/live/walls/read", { round }, cookie))).wall as Wall,
      (value) => value.piles.length === 1,
    );
    // Only the choice that was chosen has a pile; the other two have none.
    expect(wall.piles.map((pile) => pile.name)).toEqual(["yes"]);
    await post(edge, "/live/relays/close-round", { round }, cookie);

    // A name the round never offered is no pile of this wall.
    const stranger = await json(
      await post(edge, "/live/walls/open-choice", { round, name: "perhaps" }, cookie),
    );
    expect(stranger.error).toBe("NOT_FOUND");

    // Naming an unchosen choice opens its empty pile; naming it again reaches
    // the same pile rather than making another.
    const empty = await json(
      await post(edge, "/live/walls/open-choice", { round, name: "maybe" }, cookie),
    );
    const again = await json(
      await post(edge, "/live/walls/open-choice", { round, name: "maybe" }, cookie),
    );
    expect(again.pile).toBe(empty.pile);
    // Naming a choice that already has ballots reaches that pile too.
    const chosen = wall.piles.find((pile) => pile.name === "yes")?.pile;
    const reached = await json(
      await post(edge, "/live/walls/open-choice", { round, name: "yes" }, cookie),
    );
    expect(reached.pile).toBe(chosen);

    await post(edge, "/live/walls/pick", { round, pile: chosen }, cookie);
    await post(edge, "/live/walls/pick", { round, pile: empty.pile }, cookie);
    const picked = (await json(await post(edge, "/live/walls/read", { round }, cookie)))
      .wall as Wall;
    expect(
      picked.piles
        .map((pile) => [pile.name, pile.count, pile.picked !== null] as const)
        .sort((left, right) => left[0].localeCompare(right[0])),
    ).toEqual([
      ["maybe", 0, true],
      ["yes", 1, true],
    ]);

    // The empty group carries into the round that takes this one as context.
    const asked = await json(
      await post(edge, "/live/relays/open-round", { run, leg: after }, cookie),
    );
    const afterWall = await until(
      async () =>
        (await json(await post(edge, "/live/walls/read", { round: asked.round }, cookie)))
          .wall as Wall | null,
      (value) => value !== null && value.questions.length > 0,
    );
    expect(afterWall?.questions[0].context).toEqual([
      { name: "yes", cards: [] },
      { name: "maybe", cards: [] },
    ]);
  });
});
