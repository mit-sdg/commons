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
    username: "priya",
    password: "pw-priya-123",
    displayName: "Professor Priya",
    email: "priya@example.com",
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
  open: boolean;
  cards: { card: string; value: string; pile: string | null }[];
  piles: {
    pile: string;
    name: string;
    description: string;
    definition: string;
    legacyText: string;
    count: number;
    picked: string | null;
  }[];
}

interface Round {
  leg: string;
  piles: { pile: string; name: string; description: string }[];
  notes: string;
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

describe("what a round carries besides its question", () => {
  let edge: Edge;
  let cookie: string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    cookie = await registerHost(edge);
  });

  afterAll(stopTestDb);

  test("standing piles and the sorter's note reach the wall and the passage, and the sorting controls act on purpose", async () => {
    const planned = await json(
      await post(edge, "/live/relays/plan", { title: "What went wrong" }, cookie),
    );
    const relay = planned.relay as string;
    const added = await json(
      await post(
        edge,
        "/live/relays/add-round",
        {
          relay,
          title: "The bug",
          prompt: "What went wrong the last time an app failed you?",
          parts: [],
          cap: 0,
          choices: [],
        },
        cookie,
      ),
    );
    const leg = added.leg as string;
    const readRelay = async () =>
      (
        (await json(await post(edge, "/live/relays/get", { relay }, cookie))).relay as {
          rounds: Round[];
        }
      ).rounds[0]!;

    // Two standing piles, each with its sentence, and a note for the sorter.
    const pace = await json(
      await post(
        edge,
        "/live/rounds/add-pile",
        { leg, name: "Pace", description: "It was too slow to use." },
        cookie,
      ),
    );
    const crash = await json(
      await post(
        edge,
        "/live/rounds/add-pile",
        { leg, name: "Crash", description: "It stopped working outright." },
        cookie,
      ),
    );
    const twice = await post(
      edge,
      "/live/rounds/add-pile",
      { leg, name: "Pace", description: "" },
      cookie,
    );
    expect(twice.status).toBe(409);
    await post(edge, "/live/rounds/rename-pile", { pile: crash.pile, name: "Crashes" }, cookie);
    await post(
      edge,
      "/live/rounds/describe-pile",
      { pile: crash.pile, description: "It stopped working." },
      cookie,
    );
    const noted = await json(
      await post(
        edge,
        "/live/rounds/set-notes",
        { leg, body: "Group by what went wrong, not by which app." },
        cookie,
      ),
    );
    expect(typeof noted.guidance).toBe("string");
    const authored = await readRelay();
    expect(authored.piles).toEqual([
      { pile: pace.pile, name: "Pace", description: "It was too slow to use." },
      { pile: crash.pile, name: "Crashes", description: "It stopped working." },
    ]);
    expect(authored.notes).toBe("Group by what went wrong, not by which app.");
    // A wall's pile is no standing pile of any round.
    const blank = await post(edge, "/live/rounds/set-notes", { leg, body: "  " }, cookie);
    expect(blank.status).toBe(400);
    // Two dashboards saving at once leave one note, one of the two.
    const raced = await Promise.all([
      json(await post(edge, "/live/rounds/set-notes", { leg, body: "Group by verb." }, cookie)),
      json(await post(edge, "/live/rounds/set-notes", { leg, body: "Group by object." }, cookie)),
    ]);
    expect(raced.map((one) => one.guidance)).toEqual([noted.guidance, noted.guidance]);
    expect(["Group by verb.", "Group by object."]).toContain((await readRelay()).notes);
    await post(
      edge,
      "/live/rounds/set-notes",
      { leg, body: "Group by what went wrong, not by which app." },
      cookie,
    );

    const launched = await json(await post(edge, "/live/relays/launch", { relay }, cookie));
    const run = launched.run as string;
    const token = launched.token as string;
    const opened = await json(await post(edge, "/live/relays/open-round", { run, leg }, cookie));
    const round = opened.round as string;
    const readWall = async () =>
      (await json(await post(edge, "/live/walls/read", { round }, cookie))).wall as Wall;

    // Standing definitions guide sorting; empty piles have no result summary.
    const seeded = await until(readWall, (wall) => wall.piles.length === 2);
    expect(seeded.piles.map((pile) => [pile.name, pile.definition, pile.count])).toEqual([
      ["Pace", "It was too slow to use.", 0],
      ["Crashes", "It stopped working.", 0],
    ]);
    expect(seeded.piles.every((pile) => pile.description === "" && pile.legacyText === "")).toBe(
      true,
    );
    expect(seeded.cards).toEqual([]);

    // Once the round has opened, its piles are frozen and its note is not.
    const late = await post(
      edge,
      "/live/rounds/add-pile",
      { leg, name: "Late", description: "" },
      cookie,
    );
    expect(late.status).toBe(409);
    const renamedLate = await post(
      edge,
      "/live/rounds/rename-pile",
      { pile: pace.pile, name: "Speed" },
      cookie,
    );
    expect(renamedLate.status).toBe(409);
    const wallPile = await post(
      edge,
      "/live/rounds/describe-pile",
      { pile: seeded.piles[0]!.pile, description: "Not through here." },
      cookie,
    );
    expect(wallPile.status).toBe(404);
    await post(
      edge,
      "/live/rounds/set-notes",
      { leg, body: "Group by what went wrong. Slowness is its own pile." },
      cookie,
    );

    // A click on the new-pile cell opens an empty pile by name, and reaches one that stands.
    const empty = await json(
      await post(edge, "/live/walls/open-pile", { round, name: "Confusing" }, cookie),
    );
    expect(typeof empty.pile).toBe("string");
    expect(empty.card).toBeUndefined();
    const again = await json(
      await post(edge, "/live/walls/open-pile", { round, name: "Confusing" }, cookie),
    );
    expect(again.pile).toBe(empty.pile);
    const three = await until(readWall, (wall) => wall.piles.length === 3);
    expect(three.piles[2]).toMatchObject({ name: "Confusing", count: 0 });
    const noCard = await post(
      edge,
      "/live/walls/open-pile",
      { round, name: "Nowhere", card: "no-such-card" },
      cookie,
    );
    expect(noCard.status).toBe(404);

    await handIn(edge, token, "it froze");
    await handIn(edge, token, "took forever to load");
    const full = await until(readWall, (wall) => wall.cards.length === 2);

    // The passage carries the piles with their sentences and the note as it now stands.
    const asked = await json(await post(edge, "/live/walls/sort-now", { round }, cookie));
    expect(asked.asked).toBe(true);
    const pending = await edge.application.concepts.Reasoning._pending();
    const passage = pending.find((ask) => ask.about === round)?.passage ?? "";
    expect(passage).toContain("- Pace (0 cards): It was too slow to use.");
    expect(passage).toContain("- Crashes (0 cards): It stopped working.");
    expect(passage).toContain(
      "The author's notes:\nGroup by what went wrong. Slowness is its own pile.",
    );
    expect(passage).not.toContain("not by which app");
    // An ask is out, so a second Sort now, and the tick, ask nothing.
    expect((await json(await post(edge, "/live/walls/sort-now", { round }, cookie))).asked).toBe(
      false,
    );
    expect((await json(await post(edge, "/live/walls/sort", { round }, cookie))).asked).toBe(false);
    const asking = pending.find((ask) => ask.about === round)!.asking;
    await edge.application.concepts.Reasoning.answer({
      asking,
      reply: JSON.stringify({
        kind: "placed",
        placements: [
          { card: "c1", pile: "Crashes" },
          { card: "c2", pile: "Pace" },
        ],
      }),
      at: new Date(),
    });
    const sorted = await until(readWall, (wall) => wall.cards.every((card) => card.pile !== null));
    expect(sorted.piles.map((pile) => [pile.name, pile.count])).toEqual([
      ["Pace", 1],
      ["Crashes", 1],
      ["Confusing", 0],
    ]);
    const froze = full.cards.find((card) => card.value === "it froze")!;
    expect(sorted.cards.find((card) => card.card === froze.card)?.pile).toBe(
      crash.pile === "" ? "" : sorted.piles[1]!.pile,
    );

    // Empty the piles: every card back in the tray, the piles standing with their lids.
    await post(edge, "/live/walls/pick", { round, pile: sorted.piles[0]!.pile }, cookie);
    const emptied = await json(await post(edge, "/live/walls/empty-piles", { round }, cookie));
    expect(emptied.emptied).toBe(true);
    const tray = await until(readWall, (wall) => wall.cards.every((card) => card.pile === null));
    expect(tray.piles.map((pile) => [pile.name, pile.definition, pile.count])).toEqual([
      ["Pace", "It was too slow to use.", 0],
      ["Crashes", "It stopped working.", 0],
      ["Confusing", "", 0],
    ]);
    expect(tray.piles[0]!.picked).not.toBeNull();
    const emptyAgain = await json(await post(edge, "/live/walls/empty-piles", { round }, cookie));
    expect(emptyAgain.emptied).toBe(false);

    // On a closed round of an open run, the tick stays silent and Sort now asks once.
    await post(edge, "/live/relays/close-round", { round }, cookie);
    // The round's piles stay frozen with the run, closed or not.
    expect(
      (
        await post(
          edge,
          "/live/rounds/add-pile",
          { leg, name: "Still late", description: "" },
          cookie,
        )
      ).status,
    ).toBe(409);
    expect((await json(await post(edge, "/live/walls/sort", { round }, cookie))).asked).toBe(false);
    const closedAsk = await json(await post(edge, "/live/walls/sort-now", { round }, cookie));
    expect(closedAsk.asked).toBe(true);
    // Describe by hand writes the pile's sentence on a closed round too.
    await post(
      edge,
      "/live/walls/describe-pile",
      { pile: sorted.piles[2]!.pile, description: "The room lost its place." },
      cookie,
    );
    expect((await readWall()).piles.find((pile) => pile.name === "Confusing")?.description).toBe(
      "The room lost its place.",
    );

    // Writing and clearing a result summary never overwrites its standing definition.
    const standingPile = seeded.piles[0]!;
    await post(
      edge,
      "/live/walls/describe-pile",
      { pile: standingPile.pile, description: "Two responses describe delays." },
      cookie,
    );
    let separated = (await readWall()).piles.find((pile) => pile.pile === standingPile.pile)!;
    expect(separated.definition).toBe("It was too slow to use.");
    expect(separated.description).toBe("Two responses describe delays.");
    await post(
      edge,
      "/live/walls/describe-pile",
      { pile: standingPile.pile, description: "" },
      cookie,
    );
    separated = (await readWall()).piles.find((pile) => pile.pile === standingPile.pile)!;
    expect(separated.definition).toBe("It was too slow to use.");
    expect(separated.description).toBe("");

    // Once the run closes, both controls are refused.
    await post(edge, "/live/relays/close", { run }, cookie);
    expect((await post(edge, "/live/walls/sort-now", { round }, cookie)).status).toBe(409);
    expect((await post(edge, "/live/walls/empty-piles", { round }, cookie)).status).toBe(409);
    // Once the run has closed the round is the relay's again, and its piles can change.
    expect(
      (
        await post(
          edge,
          "/live/rounds/add-pile",
          { leg, name: "Next time", description: "" },
          cookie,
        )
      ).status,
    ).toBe(200);
    // The note can still be cleared, since it stands on the leg, not the run.
    const cleared = await Promise.all(
      [1, 2].map(async () => json(await post(edge, "/live/rounds/clear-notes", { leg }, cookie))),
    );
    expect(cleared).toEqual(expect.arrayContaining([{ cleared: true }, { cleared: false }]));
    expect((await readRelay()).notes).toBe("");
    const clearedAgain = await json(await post(edge, "/live/rounds/clear-notes", { leg }, cookie));
    expect(clearedAgain.cleared).toBe(false);
  }, 60_000);
});
