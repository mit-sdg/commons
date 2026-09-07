import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { inspectAssembly } from "@mit-sdg/sync-engine/tooling";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { disabledMind, scriptedMind, serveOnePass } from "../../src/reasoning/worker.ts";

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
    username: "omar",
    password: "pw-omar-123",
    displayName: "Professor Omar",
    email: "omar@example.com",
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
  notes: string;
  asksOut: number;
  sortPending: boolean;
  cards: { card: string; value: string; pile: string | null }[];
  piles: {
    pile: string;
    name: string;
    description: string;
    count: number;
    picked: string | null;
  }[];
}

/** A relay of one written round, launched, with that round open on the wall. */
interface Live {
  relay: string;
  leg: string;
  run: string;
  token: string;
  round: string;
}

let edge: Edge;
let cookie: string;

const readWall = async (round: string) =>
  (await json(await post(edge, "/live/walls/read", { round }, cookie))).wall as unknown as Wall;

const sort = async (round: string) =>
  (await json(await post(edge, "/live/walls/sort", { round }, cookie))) as { asked?: boolean };

const sortNow = async (round: string) => {
  const response = await post(edge, "/live/walls/sort-now", { round }, cookie);
  const body = (await response.json()) as { asked?: boolean; error?: string };
  return { status: response.status, ...body };
};

const sortByModel = async (run: string) =>
  (await json(await post(edge, "/live/relays/sort-by-model", { run }, cookie))) as {
    modelSorts?: boolean;
  };

const closeRound = (round: string) => post(edge, "/live/relays/close-round", { round }, cookie);

const isLocked = async (round: string) =>
  (await edge.application.concepts.Locking._isLocked({ target: round })).locked;

const pendingAbout = async (round: string) =>
  (await edge.application.concepts.Reasoning._pending()).filter((ask) => ask.about === round);

/** Answers every ask the reasoner holds with the scripted mind, as the floor's worker does. */
const serveReasoner = async () => {
  for (let pass = 0; pass < 4; pass += 1) {
    if ((await serveOnePass(edge.application.concepts.Reasoning, scriptedMind())) === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

/** Plans a relay of one written round and opens that round on a fresh run. */
async function openRound(title: string, prompt: string): Promise<Live> {
  const planned = await json(await post(edge, "/live/relays/plan", { title }, cookie));
  const relay = planned.relay as string;
  const added = await json(
    await post(
      edge,
      "/live/relays/add-round",
      { relay, title, prompt, parts: [], cap: 0, choices: [] },
      cookie,
    ),
  );
  const leg = added.leg as string;
  const launched = await json(await post(edge, "/live/relays/launch", { relay }, cookie));
  const run = launched.run as string;
  const opened = await json(await post(edge, "/live/relays/open-round", { run, leg }, cookie));
  return { relay, leg, run, token: launched.token as string, round: opened.round as string };
}

/** A phone answers the open round with one value and hands in. */
async function handIn(token: string, value: string) {
  const face = await until(
    async () =>
      (await json(await post(edge, "/live/p/arrive", { token }))).relay as unknown as {
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
  return response;
}

describe("the sorting controls the dashboard presses", () => {
  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    cookie = await registerHost(edge);
  });

  afterAll(stopTestDb);

  test("two dashboards making Resort's ask in one instant make one ask", async () => {
    const live = await openRound("Two dashboards", "What would help?");
    await handIn(live.token, "the pace was fast");
    await until(
      () => readWall(live.round),
      (wall) => wall.cards.length === 1,
    );

    const both = await Promise.all([sortNow(live.round), sortNow(live.round)]);
    const asked = both.filter((answer) => answer.asked === true);
    expect(asked, JSON.stringify(both)).toHaveLength(1);
    // The dashboard that lost is told nothing was asked, or stopped at the
    // refused lock, which the wire answers as a conflict.
    const lost = both.filter((answer) => answer.status === 409 || answer.asked === false);
    expect(lost, JSON.stringify(both)).toHaveLength(1);
    expect(await pendingAbout(live.round)).toHaveLength(1);
  }, 60_000);

  test("Resort's ask lands on a round the switch left alone, and the tick waits it out", async () => {
    const live = await openRound("Sort on purpose", "What would help?");
    const before = await json(await post(edge, "/live/relays/run", { run: live.run }, cookie));
    expect((before.run as unknown as { modelSorts: boolean }).modelSorts).toBe(false);
    await handIn(live.token, "the pace was fast");
    await handIn(live.token, "clearer slides");
    await until(
      () => readWall(live.round),
      (wall) => wall.cards.length === 2,
    );

    expect((await sortNow(live.round)).asked).toBe(true);
    // An ask is out, so the tick answers that it asked for nothing of its own.
    expect((await sort(live.round)).asked).toBe(false);
    expect(await pendingAbout(live.round)).toHaveLength(1);

    await serveReasoner();
    const sorted = await until(
      () => readWall(live.round),
      (wall) => wall.cards.every((card) => card.pile !== null),
    );
    expect(sorted.cards.map((card) => card.pile).every((pile) => pile !== null)).toBe(true);
    // Nothing is left in the tray, so the next tick asks for nothing.
    expect((await sort(live.round)).asked).toBe(false);
  }, 60_000);

  test("the model files the room's answers into the piles the round already stands on", async () => {
    const planned = await json(
      await post(edge, "/live/relays/plan", { title: "Standing piles" }, cookie),
    );
    const relay = planned.relay as string;
    const added = await json(
      await post(
        edge,
        "/live/relays/add-round",
        {
          relay,
          title: "The lecture",
          prompt: "What would help you most right now?",
          parts: [],
          cap: 0,
          choices: [],
        },
        cookie,
      ),
    );
    const leg = added.leg as string;
    await post(
      edge,
      "/live/rounds/add-pile",
      { leg, name: "Pace", description: "It went too fast." },
      cookie,
    );
    await post(
      edge,
      "/live/rounds/add-pile",
      { leg, name: "Examples", description: "The room wants more worked examples." },
      cookie,
    );
    const launched = await json(await post(edge, "/live/relays/launch", { relay }, cookie));
    const run = launched.run as string;
    const token = launched.token as string;
    expect((await sortByModel(run)).modelSorts).toBe(true);
    const opened = await json(await post(edge, "/live/relays/open-round", { run, leg }, cookie));
    const round = opened.round as string;

    const standing = await until(
      () => readWall(round),
      (wall) => wall.piles.length === 2,
    );
    expect(standing.piles.map((pile) => [pile.name, pile.description, pile.count])).toEqual([
      ["Pace", "It went too fast.", 0],
      ["Examples", "The room wants more worked examples.", 0],
    ]);

    await handIn(token, "the pace was fast");
    await handIn(token, "clearer slides");
    await until(
      () => readWall(round),
      (wall) => wall.cards.length === 2,
    );

    expect((await sort(round)).asked).toBe(true);
    await serveReasoner();
    const filed = await until(
      () => readWall(round),
      (wall) => wall.cards.every((card) => card.pile !== null),
    );
    // The cards land in the standing piles; no second pile of either name is opened.
    expect(filed.piles.map((pile) => [pile.name, pile.count])).toEqual([
      ["Pace", 1],
      ["Examples", 1],
    ]);
    expect(filed.piles.map((pile) => pile.description)).toEqual([
      "It went too fast.",
      "The room wants more worked examples.",
    ]);
    expect(filed.cards.find((card) => card.value === "the pace was fast")?.pile).toBe(
      filed.piles[0]!.pile,
    );
    expect(filed.cards.find((card) => card.value === "clearer slides")?.pile).toBe(
      filed.piles[1]!.pile,
    );

    // Emptying the piles is one request: every card back in the tray, the piles
    // standing with their names, their lids, and their picks.
    await post(edge, "/live/walls/pick", { round, pile: filed.piles[0]!.pile }, cookie);
    const picked = await until(
      () => readWall(round),
      (wall) => wall.piles.some((pile) => pile.picked !== null),
    );
    expect(picked.piles[0]!.picked).not.toBeNull();
    const emptied = await json(await post(edge, "/live/walls/empty-piles", { round }, cookie));
    expect(emptied.emptied).toBe(true);
    const tray = await until(
      () => readWall(round),
      (wall) => wall.cards.every((card) => card.pile === null),
    );
    expect(tray.piles.map((pile) => [pile.name, pile.description, pile.count])).toEqual([
      ["Pace", "It went too fast.", 0],
      ["Examples", "The room wants more worked examples.", 0],
    ]);
    expect(tray.piles[0]!.picked).not.toBeNull();

    // A wall just emptied is a wall of standing piles, and the next tick fills them again.
    expect((await sort(round)).asked).toBe(true);
    await serveReasoner();
    const refilled = await until(
      () => readWall(round),
      (wall) => wall.cards.every((card) => card.pile !== null),
    );
    expect(refilled.piles.map((pile) => [pile.name, pile.count])).toEqual([
      ["Pace", 1],
      ["Examples", 1],
    ]);
  }, 90_000);

  test("a phone never meets the note the sorter reads", async () => {
    const planned = await json(
      await post(edge, "/live/relays/plan", { title: "The note" }, cookie),
    );
    const relay = planned.relay as string;
    const added = await json(
      await post(
        edge,
        "/live/relays/add-round",
        {
          relay,
          title: "The lecture",
          prompt: "What would help you most right now?",
          parts: [],
          cap: 0,
          choices: [],
        },
        cookie,
      ),
    );
    const leg = added.leg as string;
    const note = "Most of them will say the pace; keep those together.";
    const sentence = "Anything about how fast it went.";
    await post(edge, "/live/rounds/add-pile", { leg, name: "Pace", description: sentence }, cookie);
    await post(edge, "/live/rounds/set-notes", { leg, body: note }, cookie);
    const launched = await json(await post(edge, "/live/relays/launch", { relay }, cookie));
    const token = launched.token as string;
    const opened = await json(
      await post(edge, "/live/relays/open-round", { run: launched.run, leg }, cookie),
    );
    const round = opened.round as string;

    // The face a phone arrives at carries the rounds and the open question, and
    // neither the note nor a standing pile's sentence.
    const face = (await json(await post(edge, "/live/p/arrive", { token }))).relay as unknown as
      | Record<string, unknown>
      | undefined;
    expect(Object.keys(face ?? {})).not.toContain("notes");
    expect(Object.keys(face ?? {})).not.toContain("note");
    const arrived = await (await post(edge, "/live/p/arrive", { token })).text();
    expect(arrived).not.toContain(note);
    expect(arrived).not.toContain(sentence);

    // Nor does the wall the phone reads after it hands in.
    const response = await handIn(token, "the pace was fast");
    await until(
      () => readWall(round),
      (wall) => wall.cards.length === 1,
    );
    const seen = await (await post(edge, "/live/p/wall", { response })).text();
    expect(seen).not.toContain(note);
    // The sorter's own passage carries it, which is where the note belongs.
    expect((await sortNow(round)).asked).toBe(true);
    const [ask] = await pendingAbout(round);
    expect(ask?.passage ?? "").toContain(note);
  }, 60_000);

  test("the run's note is read after the relay's, stands on that run alone, and is one entry", async () => {
    const relayNote = "Group by the verb, never by tense.";
    const runNote = "This room writes in French; the verb is the same pile in either language.";
    const live = await openRound("Two notes", "Name one verb the app needs.");
    await post(edge, "/live/rounds/set-notes", { leg: live.leg, body: relayNote }, cookie);
    // The wall opens with no note of the run's, whatever the relay's says.
    expect((await readWall(live.round)).notes).toBe("");

    // Two dashboards setting the run's note in one instant leave one entry: the wall
    // reads one text, and clearing once leaves nothing to clear.
    const [first, second] = await Promise.all([
      post(edge, "/live/walls/set-notes", { round: live.round, body: "A's words." }, cookie),
      post(edge, "/live/walls/set-notes", { round: live.round, body: runNote }, cookie),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    const standing = await until(
      () => readWall(live.round),
      (wall) => wall.notes !== "",
    );
    expect(["A's words.", runNote]).toContain(standing.notes);
    const set = await json(
      await post(edge, "/live/walls/set-notes", { round: live.round, body: runNote }, cookie),
    );
    expect(typeof set.guidance).toBe("string");
    expect((await readWall(live.round)).notes).toBe(runNote);

    // The sorter reads both, the relay's first; the relay's read is untouched.
    await handIn(live.token, "save");
    await until(
      () => readWall(live.round),
      (wall) => wall.cards.length === 1,
    );
    expect((await sortNow(live.round)).asked).toBe(true);
    const [ask] = await pendingAbout(live.round);
    expect(ask?.passage ?? "").toContain(`The author's notes:\n${relayNote}\n\n${runNote}\n\n`);
    const got = await json(await post(edge, "/live/relays/get", { relay: live.relay }, cookie));
    const rounds = (got.relay as { rounds: { leg: string; notes: string }[] }).rounds;
    expect(rounds.find((round) => round.leg === live.leg)?.notes).toBe(relayNote);

    // Two dashboards clearing together both succeed, with one deletion.
    const cleared = await Promise.all(
      [1, 2].map(async () =>
        json(await post(edge, "/live/walls/clear-notes", { round: live.round }, cookie)),
      ),
    );
    expect(cleared).toEqual(expect.arrayContaining([{ cleared: true }, { cleared: false }]));
    expect((await readWall(live.round)).notes).toBe("");
    await post(edge, "/live/walls/set-notes", { round: live.round, body: runNote }, cookie);

    // The next run of the same relay starts with the relay's note and nothing after it.
    await closeRound(live.round);
    await post(edge, "/live/relays/close", { run: live.run }, cookie);
    const refusedClosed = await post(
      edge,
      "/live/walls/set-notes",
      { round: live.round, body: "Too late." },
      cookie,
    );
    expect(refusedClosed.status).toBe(409);
    const launched = await json(
      await post(edge, "/live/relays/launch", { relay: live.relay }, cookie),
    );
    const opened = await json(
      await post(edge, "/live/relays/open-round", { run: launched.run, leg: live.leg }, cookie),
    );
    const again = opened.round as string;
    expect((await readWall(again)).notes).toBe("");
    await handIn(launched.token as string, "delete");
    await until(
      () => readWall(again),
      (wall) => wall.cards.length === 1,
    );
    expect((await sortNow(again)).asked).toBe(true);
    const [secondAsk] = await pendingAbout(again);
    expect(secondAsk?.passage ?? "").toContain(`The author's notes:\n${relayNote}\n\nThe piles`);
    expect(secondAsk?.passage ?? "").not.toContain(runNote);
  }, 60_000);

  test("a pile opens empty on a closed round, and every sorting control is refused once the run closes", async () => {
    const live = await openRound("Closing time", "What would help?");
    await handIn(live.token, "the pace was fast");
    const full = await until(
      () => readWall(live.round),
      (wall) => wall.cards.length === 1,
    );
    const card = full.cards[0]!.card;
    await closeRound(live.round);

    // A closed round of an open run is where staff sort, so a pile opens on it
    // by name alone, and a second click reaches the pile that stands.
    const empty = await json(
      await post(edge, "/live/walls/open-pile", { round: live.round, name: "Nobody said" }, cookie),
    );
    expect(typeof empty.pile).toBe("string");
    expect(empty.card).toBeUndefined();
    const again = await json(
      await post(edge, "/live/walls/open-pile", { round: live.round, name: "Nobody said" }, cookie),
    );
    expect(again.pile).toBe(empty.pile);
    const closedRound = await until(
      () => readWall(live.round),
      (wall) => wall.piles.length === 1,
    );
    expect(closedRound.piles[0]).toMatchObject({ name: "Nobody said", count: 0 });
    expect(closedRound.open).toBe(false);

    await post(edge, "/live/relays/close", { run: live.run }, cookie);
    const refused: [string, Record<string, unknown>][] = [
      ["/live/walls/open-pile", { round: live.round, name: "Too late" }],
      ["/live/walls/open-pile", { round: live.round, name: "Too late", card }],
      ["/live/walls/sort-now", { round: live.round }],
      ["/live/walls/empty-piles", { round: live.round }],
    ];
    for (const [path, body] of refused) {
      const answer = await post(edge, path, body, cookie);
      expect([path, answer.status]).toEqual([path, 409]);
    }
    expect((await readWall(live.round)).piles.map((pile) => pile.name)).toEqual(["Nobody said"]);
  }, 60_000);

  test("the close settles the wall: one ask, the round locked while it is out, and nothing after", async () => {
    const live = await openRound("Settling", "What would help?");
    expect((await sortByModel(live.run)).modelSorts).toBe(true);
    await handIn(live.token, "the pace was fast");
    await handIn(live.token, "clearer slides");
    await until(
      () => readWall(live.round),
      (wall) => wall.cards.length === 2,
    );
    // Nothing has ticked, so the close is what asks.
    expect(await pendingAbout(live.round)).toHaveLength(0);
    expect((await readWall(live.round)).asksOut).toBe(0);

    await closeRound(live.round);
    expect(
      await until(
        () => pendingAbout(live.round),
        (pending) => pending.length === 1,
      ),
    ).toHaveLength(1);
    expect(await isLocked(live.round)).toBe(true);
    expect((await readWall(live.round)).asksOut).toBe(1);

    await serveReasoner();
    await until(
      () => pendingAbout(live.round),
      (pending) => pending.length === 0,
    );
    const settled = await until(
      () => readWall(live.round),
      (wall) => wall.cards.every((card) => card.pile !== null),
    );
    expect(settled.cards.map((card) => card.pile).every((pile) => pile !== null)).toBe(true);
    expect(settled.asksOut).toBe(0);
    expect(await isLocked(live.round)).toBe(false);
    // The tick asks about an open round only, so the settled round is left alone.
    expect((await sort(live.round)).asked).toBe(false);
  }, 90_000);

  test("sorting off keeps the current sort pending through its placement consequences", async () => {
    const live = await openRound("Finishing with sorting off", "What would help?");
    await sortByModel(live.run);
    await handIn(live.token, "more worked examples");
    await handIn(live.token, "the pace was fast");
    await until(
      () => readWall(live.round),
      (wall) => wall.cards.length === 2,
    );
    expect((await sort(live.round)).asked).toBe(true);
    await post(edge, "/live/relays/sort-by-hand", { run: live.run }, cookie);
    const waiting = await readWall(live.round);
    expect(waiting.asksOut).toBe(1);
    expect(waiting.sortPending).toBe(true);
    expect((await sort(live.round)).asked).toBe(false);
    // Emptying does not cancel accepted work, and neither does closing.
    await post(edge, "/live/walls/empty-piles", { round: live.round }, cookie);
    await closeRound(live.round);
    await serveReasoner();
    const done = await readWall(live.round);
    expect(done.asksOut).toBe(0);
    expect(done.sortPending).toBe(false);
    expect(done.cards.every((card) => card.pile !== null)).toBe(true);
    const consequences = inspectAssembly(edge.application).occurrences;
    const categories = new Set(done.piles.map((pile) => pile.pile));
    const placements = consequences.flatMap((record, index) =>
      record.concept === "Categorizing" &&
      ["file", "assign"].includes(record.action) &&
      categories.has(record.output?.category as string)
        ? [index]
        : [],
    );
    const unlocked = consequences.findIndex(
      (record) =>
        record.concept === "Locking" &&
        record.action === "unlock" &&
        record.output?.target === live.round,
    );
    expect(placements.length).toBeGreaterThan(0);
    expect(unlocked).toBeGreaterThan(Math.max(...placements));
  }, 60_000);

  test("overlapping sorting and pile summaries keep independent reply holds", async () => {
    const live = await openRound("Overlapping replies", "What would help?");
    await handIn(live.token, "more examples");
    await handIn(live.token, "clearer slides");
    const wall = await until(
      () => readWall(live.round),
      (value) => value.cards.length === 2,
    );
    const { Categorizing, Reasoning, Locking } = edge.application.concepts;
    const { category } = await Categorizing.file({
      scope: live.round,
      name: "Examples",
      item: wall.cards[0].card,
    });
    expect((await sortNow(live.round)).asked).toBe(true);
    expect((await post(edge, "/live/walls/summarize", { pile: category }, cookie)).status).toBe(
      200,
    );
    const pending = (await Reasoning._pending()).filter((ask) => ask.about === live.round);
    expect(pending).toHaveLength(2);
    await serveReasoner();
    // Match unique domain identities: the engine retains a bounded flow window,
    // so offsets into an earlier inspection can shift as old flows expire.
    const records = inspectAssembly(edge.application).occurrences;
    const settled = await readWall(live.round);
    const categories = new Set(settled.piles.map((pile) => pile.pile));
    for (const ask of pending) {
      expect(
        records.some(
          (record) =>
            record.concept === "Locking" &&
            record.action === "lock" &&
            record.output?.target === ask.asking,
        ),
      ).toBe(true);
      expect(await Locking._isLocked({ target: ask.asking })).toEqual({ locked: false });
    }
    const lastChange = records.findLastIndex(
      (record) =>
        record.concept === "Categorizing" && categories.has(record.output?.category as string),
    );
    const released = records.findLastIndex(
      (record) =>
        record.concept === "Locking" &&
        record.action === "unlock" &&
        record.output?.target === live.round,
    );
    expect(lastChange).toBeGreaterThanOrEqual(0);
    expect(released).toBeGreaterThan(lastChange);
    expect(settled.sortPending).toBe(false);
    expect(settled.asksOut).toBe(0);
    expect(settled.cards.every((card) => card.pile !== null)).toBe(true);
    expect(settled.piles.find((pile) => pile.pile === category)?.description).not.toBe("");
  }, 60_000);

  test("with no reasoner the tick's ask fails at once, frees the round, and the wall says why", async () => {
    const live = await openRound("No reasoner", "What would help?");
    expect((await sortByModel(live.run)).modelSorts).toBe(true);
    await handIn(live.token, "the pace was fast");
    await until(
      () => readWall(live.round),
      (wall) => wall.cards.length === 1,
    );
    expect((await sort(live.round)).asked).toBe(true);
    expect((await readWall(live.round)).asksOut).toBe(1);

    expect(await serveOnePass(edge.application.concepts.Reasoning, disabledMind())).toBe(0);
    const failed = await until(
      () => readWall(live.round) as Promise<Wall & { failure: string | null }>,
      (wall) => wall.asksOut === 0,
    );
    expect(failed.failure).toBe("The reasoner is disabled.");
    expect(failed.cards[0]?.pile).toBeNull();
    expect(await isLocked(live.round)).toBe(false);
  }, 60_000);

  test("an ask out at the close is the settling ask, and with the switch off the close asks nothing", async () => {
    const asking = await openRound("Already asking", "What would help?");
    await sortByModel(asking.run);
    await handIn(asking.token, "the pace was fast");
    await until(
      () => readWall(asking.round),
      (wall) => wall.cards.length === 1,
    );
    expect((await sortNow(asking.round)).asked).toBe(true);
    await closeRound(asking.round);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await pendingAbout(asking.round)).toHaveLength(1);
    expect((await readWall(asking.round)).asksOut).toBe(1);

    const byHand = await openRound("Sorted by hand", "What would help?");
    await handIn(byHand.token, "the pace was fast");
    await until(
      () => readWall(byHand.round),
      (wall) => wall.cards.length === 1,
    );
    await closeRound(byHand.round);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await pendingAbout(byHand.round)).toHaveLength(0);
    expect((await readWall(byHand.round)).asksOut).toBe(0);
    expect((await readWall(byHand.round)).cards.every((card) => card.pile === null)).toBe(true);
  }, 90_000);

  test("two dashboards unpicking one pile in one instant both answer the pile", async () => {
    const live = await openRound("Carrying forward", "What would help?");
    await handIn(live.token, "the pace was fast");
    const full = await until(
      () => readWall(live.round),
      (wall) => wall.cards.length === 1,
    );
    await closeRound(live.round);
    const opened = await json(
      await post(
        edge,
        "/live/walls/open-pile",
        { round: live.round, name: "Pace", card: full.cards[0]!.card },
        cookie,
      ),
    );
    const pile = opened.pile as string;
    await post(edge, "/live/walls/pick", { round: live.round, pile }, cookie);
    await until(
      () => readWall(live.round),
      (wall) => wall.piles.some((one) => one.picked !== null),
    );

    const both = await Promise.all([
      post(edge, "/live/walls/unpick", { round: live.round, pile }, cookie),
      post(edge, "/live/walls/unpick", { round: live.round, pile }, cookie),
    ]);
    expect(both.map((answer) => answer.status)).toEqual([200, 200]);
    expect(await Promise.all(both.map((answer) => answer.json()))).toEqual([{ pile }, { pile }]);
    expect((await readWall(live.round)).piles[0]!.picked).toBeNull();
  }, 60_000);
});
