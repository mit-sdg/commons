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
    const served = await serveOnePass(edge.application.concepts.Reasoning, mind);
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
    expect(invited.participant).toBe("seat-1");
    const [seated] = await until(
      async () => await edge.application.concepts.Responding._responsesFor({ subject: round }),
      (responses) => responses.length === 1,
    );
    const response = seated!.response;

    // Inviting the model raised an ask; the reasoner answers it.
    const asked = await until(
      async () => await edge.application.concepts.Reasoning._pending(),
      (pending) => pending.length > 0,
    );
    expect(asked.length).toBe(1);
    await serveReasoner(edge);
    const replies = await edge.application.concepts.Reasoning._repliesAbout({
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
      async () => await edge.application.concepts.Insisting._for({ aim: round }),
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

    // A closed round of an open run is where staff pick, so its wall still takes writes.
    expect((await post(edge, "/live/relays/close-round", { round }, cookie)).status).toBe(200);
    expect(
      (await post(edge, "/live/walls/pick", { round, piles: [pile, byHand] }, cookie)).status,
    ).toBe(200);
    expect(
      (await post(edge, "/live/walls/rename-pile", { pile: byHand, name: "Sorted" }, cookie))
        .status,
    ).toBe(200);

    // Once the run has closed, every wall write is refused and the wall still reads.
    expect((await post(edge, "/live/relays/close", { run }, cookie)).status).toBe(200);
    const writes: [string, Record<string, unknown>][] = [
      ["/live/walls/open-pile", { round, name: "Too late", card }],
      ["/live/walls/move-card", { card, pile }],
      ["/live/walls/to-tray", { card }],
      ["/live/walls/rename-pile", { pile: byHand, name: "Too late" }],
      ["/live/walls/merge-pile", { pile: byHand, into: pile }],
      ["/live/walls/describe-pile", { pile: byHand, description: "Too late" }],
      ["/live/walls/pick", { round, piles: [] }],
      ["/live/walls/summarize", { pile: byHand }],
    ];
    for (const [path, body] of writes) {
      expect([path, (await post(edge, path, body, cookie)).status]).toEqual([path, 409]);
    }
    const late = await json(await post(edge, "/live/walls/sort", { round }, cookie));
    expect(late.asked).toBe(false);

    const kept = await readWall();
    expect(kept.piles.find((entry) => entry.pile === byHand)?.name).toBe("Sorted");
    expect(kept.piles.filter((entry) => entry.picked !== null).length).toBe(2);
  }, 90_000);

  test("seats belong to the run: invited once, the model answers every later round until dismissed", async () => {
    const planned = await json(
      await post(edge, "/live/relays/plan", { title: "Three rounds" }, cookie),
    );
    const relay = planned.relay as string;
    const legs: string[] = [];
    for (const title of ["First", "Second", "Third"]) {
      const added = await json(
        await post(
          edge,
          "/live/relays/add-round",
          { relay, title, prompt: `${title} question`, parts: [], cap: 0, choices: [] },
          cookie,
        ),
      );
      legs.push(added.leg as string);
    }
    const launched = await json(await post(edge, "/live/relays/launch", { relay }, cookie));
    const run = launched.run as string;

    interface Run {
      seats: { participant: string }[];
      openRound: string | null;
      rounds: { round: string | null; figure: { handedIn: number; handedInByModel: number } }[];
    }
    const readRun = async () => {
      const body = await json(await post(edge, "/live/relays/run", { run }, cookie));
      return body.run as unknown as Run;
    };
    const handedInOn = async (round: string) =>
      (await edge.application.concepts.Responding._responsesFor({ subject: round })).filter(
        (response) => response.submitted,
      ).length;
    const later = () => new Date(Date.now() + 60_000);
    const playRound = async (round: string, seats: number) => {
      await until(
        async () => await edge.application.concepts.Responding._responsesFor({ subject: round }),
        (responses) => responses.length === seats,
      );
      await until(
        async () => await edge.application.concepts.Reasoning._pending(),
        (pending) => pending.length === seats,
      );
      await serveReasoner(edge);
      await serveParticipantsOnce(edge.application.concepts, later);
      return await until(
        async () => await handedInOn(round),
        (count) => count === seats,
      );
    };

    // A seat taken before any round opens waits for the first.
    const first = await json(
      await post(edge, "/live/relays/invite", { run, device: "seat-a" }, cookie),
    );
    expect(first.participant).toBe("seat-a");
    expect((await readRun()).seats.length).toBe(1);

    const opened = await json(
      await post(edge, "/live/relays/open-round", { run, leg: legs[0] }, cookie),
    );
    const roundOne = opened.round as string;
    await post(edge, "/live/relays/invite", { run, device: "seat-b" }, cookie);
    await post(edge, "/live/relays/invite", { run, device: "seat-c" }, cookie);
    expect((await readRun()).seats.length).toBe(3);
    expect(await playRound(roundOne, 3)).toBe(3);
    const afterOne = await readRun();
    expect(afterOne.rounds[0]?.figure.handedInByModel).toBe(3);

    // Round two reaches the same three seats with no second invitation.
    await post(edge, "/live/relays/close-round", { round: roundOne }, cookie);
    const second = await json(
      await post(edge, "/live/relays/open-round", { run, leg: legs[1] }, cookie),
    );
    const roundTwo = second.round as string;
    expect(await playRound(roundTwo, 3)).toBe(3);
    expect((await readRun()).seats.length).toBe(3);

    // A dismissed seat is reached by no later round; dismissing every seat empties the run.
    await post(edge, "/live/relays/dismiss", { run, participant: "seat-b" }, cookie);
    expect((await readRun()).seats.length).toBe(2);
    await post(edge, "/live/relays/close-round", { round: roundTwo }, cookie);
    const third = await json(
      await post(edge, "/live/relays/open-round", { run, leg: legs[2] }, cookie),
    );
    const roundThree = third.round as string;
    expect(await playRound(roundThree, 2)).toBe(2);
    const begun = await edge.application.concepts.Responding._responsesFor({ subject: roundThree });
    expect(begun.map((response) => response.participant).sort()).toEqual(["seat-a", "seat-c"]);
    // Dismissing every seat is one request per seat, as inviting is; the dismissed keep their cards.
    for (const seat of (await readRun()).seats) {
      expect(
        (await post(edge, "/live/relays/dismiss", { run, participant: seat.participant }, cookie))
          .status,
      ).toBe(200);
    }
    expect((await readRun()).seats.length).toBe(0);
    expect(
      (await post(edge, "/live/relays/dismiss", { run, participant: "seat-b" }, cookie)).status,
    ).toBe(200);
    expect(
      (await json(await post(edge, "/live/relays/dismiss", { run, participant: "nobody" }, cookie)))
        .error,
    ).toBe("NOT_FOUND");

    // A closed run seats nobody.
    await post(edge, "/live/relays/close", { run }, cookie);
    expect(
      (await post(edge, "/live/relays/invite", { run, device: "seat-d" }, cookie)).status,
    ).toBe(409);
  }, 90_000);
});
