import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { scriptedMind, serveOnePass } from "../../src/reasoning/worker.ts";
import { serveParticipantsOnce } from "../../src/reasoning/participant.ts";

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

const HOST = {
  username: "nadia",
  password: "pw-nadia-123",
  displayName: "Professor Nadia",
  email: "nadia@example.com",
};

async function registerHost(edge: Edge) {
  const registered = await edge.application.concepts.Authenticating.register(HOST);
  await edge.application.concepts.Profiling.createProfile({
    user: registered.user,
    displayName: HOST.displayName,
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
    username: HOST.username,
    password: HOST.password,
  });
  return login.headers.get("Set-Cookie")?.split(";")[0] as string;
}

/** Serve every pending round ask; a served reply may queue the repair ask. */
async function serveReasoner(edge: Edge, rounds = 4) {
  const mind = scriptedMind();
  for (let round = 0; round < rounds; round += 1) {
    const served = await serveOnePass(edge.application.concepts.RoundReasoning, mind);
    if (served === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
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
  number: number;
  title: string;
  open: boolean;
  begun: number;
  handedIn: number;
  cards: {
    card: string;
    value: string;
    part: string;
    pile: string | null;
    model: boolean;
    mine: boolean;
  }[];
  piles: {
    pile: string;
    name: string;
    description: string;
    count: number;
    picked: string | null;
  }[];
}

describe("the model participant and the wall", () => {
  let edge: Edge;
  let cookie: string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    cookie = await registerHost(edge);
  });

  afterAll(stopTestDb);

  test("an invited model participant answers, hands in, and its cards are sorted onto the wall", async () => {
    const planned = await json(
      await post(edge, "/live/relays/plan", { title: "Mid-lecture check" }, cookie),
    );
    const relay = planned.relay as string;

    const added = await json(
      await post(
        edge,
        "/live/relays/add-round",
        {
          relay,
          title: "What would help",
          prompt: "What would help you most right now?",
          parts: ["First", "Second"],
          cap: 0,
          choices: [],
        },
        cookie,
      ),
    );
    const leg = added.leg as string;

    const launched = await json(await post(edge, "/live/relays/launch", { relay }, cookie));
    const run = launched.run as string;

    const opened = await json(await post(edge, "/live/relays/open-round", { run, leg }, cookie));
    expect(opened.error).toBe(undefined);
    const round = opened.round as string;
    expect(typeof round).toBe("string");

    const invited = await json(
      await post(edge, "/live/relays/invite", { run, device: "seat-1" }, cookie),
    );
    const response = invited.response as string;
    expect(invited.participant).toBe("model:seat-1");

    // Inviting the model raised an ask; the reasoner answers it.
    const asked = await until(
      async () => await edge.application.concepts.RoundReasoning._pending(),
      (pending) => pending.length > 0,
    );
    expect(asked.length).toBe(1);
    await serveReasoner(edge);
    const replies = await edge.application.concepts.RoundReasoning._repliesAbout({
      about: response,
    });
    expect(replies.length).toBe(1);

    // The phone waits out its own delay before it hands in.
    expect(await serveParticipantsOnce(edge.application.concepts, () => new Date())).toBe(0);

    const later = () => new Date(Date.now() + 60_000);
    expect(await serveParticipantsOnce(edge.application.concepts, later)).toBe(1);

    const readWall = async () => {
      const body = await json(await post(edge, "/live/walls/read", { round }, cookie));
      return body.wall as unknown as Wall;
    };

    const handedIn = await until(readWall, (wall) => wall?.handedIn === 1);
    expect(handedIn.number).toBe(1);
    expect(handedIn.title).toBe("What would help");
    expect(handedIn.open).toBe(true);
    expect(handedIn.begun).toBe(1);
    expect(handedIn.cards.length).toBe(2);
    expect(handedIn.cards.map((card) => card.part)).toEqual(["First", "Second"]);
    expect(handedIn.cards.every((card) => card.model)).toBe(true);
    expect(handedIn.cards.every((card) => card.mine === false)).toBe(true);
    expect(handedIn.cards.every((card) => card.pile === null)).toBe(true);
    expect(Object.keys(handedIn.cards[0] ?? {}).includes("response")).toBe(false);
    expect(Object.keys(handedIn.cards[0] ?? {}).includes("participant")).toBe(false);

    // The phone reads the same wall with its own cards marked.
    const phone = await json(await post(edge, "/live/p/wall", { response }));
    const seen = phone.wall as unknown as Wall;
    expect(seen.cards.every((card) => card.mine)).toBe(true);

    // The model sorts what is in the tray.
    const sorted = await json(await post(edge, "/live/walls/sort", { round }, cookie));
    expect(sorted.asked).toBe(true);
    await serveReasoner(edge);

    const piled = await until(readWall, (wall) => wall.cards.every((card) => card.pile !== null));
    expect(piled.piles.length).toBeGreaterThan(0);
    expect(piled.piles.reduce((total, pile) => total + pile.count, 0)).toBe(2);
    expect(piled.cards.every((card) => card.pile !== null)).toBe(true);

    // An unusable reply is stood upon once, and the retry settles the insistence.
    const insisted = await until(
      async () => await edge.application.concepts.RoundInsisting._for({ aim: round }),
      (rows) => rows.every((row) => row.settled),
    );
    expect(insisted.every((row) => row.satisfied)).toBe(true);

    // Nothing is left in the tray, so the next tick asks for nothing.
    const quiet = await json(await post(edge, "/live/walls/sort", { round }, cookie));
    expect(quiet.asked).toBe(false);

    // A pile takes a lid, and picking it records what carries forward.
    const pile = piled.piles[0]!.pile;
    const summarized = await json(await post(edge, "/live/walls/summarize", { pile }, cookie));
    expect(summarized.asked).toBe(true);
    await serveReasoner(edge);
    const lidded = await until(
      readWall,
      (wall) => (wall.piles.find((entry) => entry.pile === pile)?.description ?? "") !== "",
    );
    expect(lidded.piles.find((entry) => entry.pile === pile)?.description).toContain(
      "These answers all say something about",
    );

    await post(edge, "/live/walls/pick", { round, piles: [pile] }, cookie);
    const picked = await until(readWall, (wall) =>
      wall.piles.some((entry) => entry.picked !== null),
    );
    expect(picked.piles.find((entry) => entry.pile === pile)?.picked).toBe(pile);

    // Sorting by hand: a card goes back to the tray and into a pile of its own.
    const card = picked.cards[0]!.card;
    await post(edge, "/live/walls/to-tray", { card }, cookie);
    const trayed = await until(readWall, (wall) =>
      wall.cards.some((entry) => entry.card === card && entry.pile === null),
    );
    expect(trayed.cards.find((entry) => entry.card === card)?.pile).toBe(null);

    const openedPile = await json(
      await post(edge, "/live/walls/open-pile", { round, name: "By hand", card }, cookie),
    );
    const byHand = openedPile.pile as string;
    const rehomed = await until(readWall, (wall) =>
      wall.cards.some((entry) => entry.card === card && entry.pile === byHand),
    );
    expect(rehomed.piles.some((entry) => entry.name === "By hand")).toBe(true);
  }, 90_000);
});
