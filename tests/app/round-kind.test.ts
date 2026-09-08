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

interface Round {
  leg: string;
  number: number;
  kind: string;
  prompt: string;
  choices: string[];
  parts: string[];
  cap: number;
  piles: { pile: string; name: string; description: string }[];
  takes: { source: string; sourceNumber: number; use: string }[];
}

interface Presented {
  question: string;
  prompt: string;
  choices: string[];
  parts: string[];
  cap: number;
}

interface Face {
  openRound: string | null;
  questions: Presented[];
}

interface Wall {
  piles: { pile: string; name: string; count: number }[];
  questions: Presented[];
}

let edge: Edge;
let cookie: string;

/** Poll a read until it settles; the capture and the seeding land after the response. */
async function until<Value>(read: () => Promise<Value>, done: (value: Value) => boolean) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const value = await read();
    if (done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return read();
}

const rounds = async (relay: string): Promise<Round[]> => {
  const read = await json(await post(edge, "/live/relays/get", { relay }, cookie));
  const whole = read.relay as unknown as { rounds: Round[] } | null;
  return whole === null ? [] : whole.rounds;
};

const plan = async (title: string): Promise<string> => {
  const planned = await json(await post(edge, "/live/relays/plan", { title }, cookie));
  return planned.relay as string;
};

const addRound = async (
  relay: string,
  title: string,
  {
    parts = [],
    cap = 0,
    choices = [],
  }: { parts?: string[]; cap?: number; choices?: string[] } = {},
): Promise<string> => {
  const added = await json(
    await post(
      edge,
      "/live/relays/add-round",
      { relay, title, prompt: `${title}?`, parts, cap, choices },
      cookie,
    ),
  );
  return added.leg as string;
};

/**
 * A round with a standing pile and a note beside its question, so a kind has
 * something of each to leave out. A question takes parts or choices, never
 * both, so each round is authored with one of them.
 */
const addWholeRound = async (
  relay: string,
  title: string,
  pile: string,
  held: { parts?: string[]; choices?: string[] },
): Promise<string> => {
  const leg = await addRound(relay, title, held);
  await post(
    edge,
    "/live/rounds/add-pile",
    { leg, name: pile, description: `What ${title} left.` },
    cookie,
  );
  await post(edge, "/live/rounds/set-notes", { leg, body: `Sort ${title} by shape.` }, cookie);
  return leg;
};

const BOXES = ["one", "two"];
const CHOICES = ["a", "b"];

const openRound = async (run: string, leg: string): Promise<string> =>
  (await json(await post(edge, "/live/relays/open-round", { run, leg }, cookie))).round as string;

const closeRound = (round: string) => post(edge, "/live/relays/close-round", { round }, cookie);

/** What the phone meets: the captured presentation of the round now open. */
const presented = async (token: string, round: string): Promise<Presented> => {
  const face = await until(
    async () => (await json(await post(edge, "/live/p/arrive", { token }))).relay as Face,
    (value) => value.openRound === round && value.questions.length > 0,
  );
  return face.questions[0];
};

/** How long the seeding has to land before a wall is read as carrying no pile of its own. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 500));

const wallOf = async (round: string): Promise<Wall> =>
  (await until(
    async () =>
      (await json(await post(edge, "/live/walls/read", { round }, cookie))).wall as Wall | null,
    (value) => value !== null && value.questions.length > 0,
  )) as Wall;

const setKind = async (leg: string, kind: string) => {
  const response = await post(edge, "/live/relays/set-kind", { leg, kind }, cookie);
  const body = (await response.json()) as { leg?: string; kind?: string; error?: string };
  return { status: response.status, ...body };
};

const launch = async (relay: string) => {
  const response = await post(edge, "/live/relays/launch", { relay }, cookie);
  const body = (await response.json()) as { run?: string; token?: string; error?: string };
  return { status: response.status, ...body };
};

const kindOf = async (relay: string, leg: string) =>
  (await rounds(relay)).find((round) => round.leg === leg)?.kind;

/** The boundary answers a refusal's category, so KIND_BLANK arrives as INVALID_REQUEST. */
describe("the kind a round is to its planner", () => {
  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    cookie = await registerHost(edge);
  });

  afterAll(stopTestDb);

  test("the word the editor pressed stands on the round, and a round never given one has none", async () => {
    const relay = await plan("Naming");
    const first = await addRound(relay, "Name it");
    const second = await addRound(relay, "Vote on the names");
    expect(await kindOf(relay, first)).toBe("");
    expect(await kindOf(relay, second)).toBe("");

    expect(await setKind(second, "vote")).toMatchObject({ leg: second, kind: "vote" });
    expect(await kindOf(relay, second)).toBe("vote");
    // The word is one round's; the round beside it is untouched.
    expect(await kindOf(relay, first)).toBe("");

    expect(await setKind(second, "list")).toMatchObject({ leg: second, kind: "list" });
    expect(await kindOf(relay, second)).toBe("list");
  }, 60_000);

  test("a blank word, a round that does not exist, and a retired relay are all refused", async () => {
    const relay = await plan("Refusals");
    const leg = await addRound(relay, "Name it");
    expect(await setKind(leg, "   ")).toMatchObject({ status: 400, error: "INVALID_REQUEST" });
    expect(await setKind("ghost", "vote")).toMatchObject({ status: 404, error: "NOT_FOUND" });
    expect(await kindOf(relay, leg)).toBe("");

    expect(await json(await post(edge, "/live/relays/retire", { relay }, cookie))).toMatchObject({
      relay,
    });
    expect(await setKind(leg, "vote")).toMatchObject({ status: 409, error: "CONFLICT" });
    expect(await kindOf(relay, leg)).toBe("");
  }, 60_000);

  test("a relay holding a vote with nothing to vote on is refused a launch until the choices are written", async () => {
    const relay = await plan("A bare vote");
    const leg = await addRound(relay, "Vote on the names");
    await setKind(leg, "vote");
    // NO_CHOICES: the guard reads the word the editor pressed, not what the
    // question holds, so a vote whose choices are not written yet is refused.
    expect(await launch(relay)).toMatchObject({ status: 409, error: "CONFLICT" });

    await post(
      edge,
      "/live/relays/revise-round",
      {
        leg,
        title: "Vote on the names",
        prompt: "Which name?",
        parts: [],
        cap: 0,
        choices: ["Piles", "Groups"],
      },
      cookie,
    );
    expect(typeof (await launch(relay)).run).toBe("string");
  }, 60_000);

  test("a vote that takes an earlier round's piles launches on the take alone", async () => {
    const relay = await plan("A vote that takes");
    const source = await addRound(relay, "Name it");
    const leg = await addRound(relay, "Vote on the names");
    await setKind(leg, "vote");
    expect(await launch(relay)).toMatchObject({ status: 409, error: "CONFLICT" });

    await post(edge, "/live/relays/set-takes", { leg, source, use: "choices" }, cookie);
    const taking = (await rounds(relay)).find((round) => round.leg === leg);
    expect(taking?.takes).toEqual([{ source, sourceNumber: 1, use: "choices" }]);
    expect(taking?.choices).toEqual([]);
    expect(typeof (await launch(relay)).run).toBe("string");
  }, 60_000);

  test("a vote round nobody pressed a word on launches on its choices", async () => {
    const relay = await plan("A vote with no word");
    const leg = await addRound(relay, "Vote on the names", { choices: ["Piles", "Groups"] });
    expect(await kindOf(relay, leg)).toBe("");
    expect(typeof (await launch(relay)).run).toBe("string");
  }, 60_000);

  test("the word `list` with no choices launches, and the same round as a vote does not", async () => {
    const relay = await plan("Only a vote is guarded");
    const leg = await addRound(relay, "Name three");
    await setKind(leg, "vote");
    expect(await launch(relay)).toMatchObject({ status: 409, error: "CONFLICT" });

    await setKind(leg, "list");
    expect(typeof (await launch(relay)).run).toBe("string");
  }, 60_000);

  test("a write round is one box, and what it was written with stays on the question", async () => {
    const relay = await plan("Written");
    const boxed = await addWholeRound(relay, "Boxed", "Boxes", { parts: BOXES });
    const chosen = await addWholeRound(relay, "Chosen", "Choices", { choices: CHOICES });
    await setKind(boxed, "write");
    await setKind(chosen, "write");

    const launched = await launch(relay);
    const run = launched.run as string;
    const token = launched.token as string;

    const boxedRound = await openRound(run, boxed);
    expect(await presented(token, boxedRound)).toMatchObject({
      prompt: "Boxed?",
      parts: [],
      choices: [],
      cap: 0,
    });
    expect((await wallOf(boxedRound)).piles.map((pile) => pile.name)).toContain("Boxes");
    await closeRound(boxedRound);

    const chosenRound = await openRound(run, chosen);
    expect(await presented(token, chosenRound)).toMatchObject({
      prompt: "Chosen?",
      parts: [],
      choices: [],
    });
    expect((await wallOf(chosenRound)).piles.map((pile) => pile.name)).toContain("Choices");
    await closeRound(chosenRound);

    // The word left the parts and the choices where they were written.
    const read = await rounds(relay);
    expect(read.find((round) => round.leg === boxed)).toMatchObject({
      kind: "write",
      parts: BOXES,
    });
    expect(read.find((round) => round.leg === chosen)).toMatchObject({
      kind: "write",
      choices: CHOICES,
    });

    await post(edge, "/live/relays/close", { run }, cookie);
  }, 120_000);

  test("a list opens with its parts, a vote with its choices, and a leg with no word with what it holds", async () => {
    const relay = await plan("Every other word");
    const listing = await addWholeRound(relay, "Listing", "Listed", { parts: BOXES });
    const voting = await addWholeRound(relay, "Voting", "Voted", { choices: CHOICES });
    const unworded = await addWholeRound(relay, "Unworded", "Unsorted", { choices: CHOICES });
    const unboxed = await addWholeRound(relay, "Unboxed", "Unbagged", { parts: BOXES });
    await setKind(listing, "list");
    await setKind(voting, "vote");

    const launched = await launch(relay);
    const run = launched.run as string;
    const token = launched.token as string;

    const listRound = await openRound(run, listing);
    expect(await presented(token, listRound)).toMatchObject({ parts: BOXES, choices: [] });
    expect((await wallOf(listRound)).piles.map((pile) => pile.name)).toContain("Listed");
    await closeRound(listRound);

    // A vote's wall is its choices, so its standing pile stays on the leg.
    const voteRound = await openRound(run, voting);
    expect(await presented(token, voteRound)).toMatchObject({
      choices: CHOICES,
      parts: [],
      cap: 0,
    });
    await wallOf(voteRound);
    await settle();
    expect((await wallOf(voteRound)).piles).toEqual([]);
    expect(
      (await rounds(relay)).find((round) => round.leg === voting)?.piles.map((pile) => pile.name),
    ).toEqual(["Voted"]);
    await closeRound(voteRound);

    // A leg nobody pressed a word on opens as its content makes it.
    const bareRound = await openRound(run, unworded);
    expect(await presented(token, bareRound)).toMatchObject({ choices: CHOICES, parts: [] });
    expect((await wallOf(bareRound)).piles.map((pile) => pile.name)).toContain("Unsorted");
    await closeRound(bareRound);

    const bareBoxes = await openRound(run, unboxed);
    expect(await presented(token, bareBoxes)).toMatchObject({ parts: BOXES, choices: [] });
    await closeRound(bareBoxes);

    await post(edge, "/live/relays/close", { run }, cookie);
  }, 120_000);

  test("the sampled passage offers the choices under a vote and the boxes under a list", async () => {
    const relay = await plan("Sampled by word");
    const written = await addWholeRound(relay, "Written", "Sorted", { choices: CHOICES });
    const boxed = await addWholeRound(relay, "Boxed", "Sorted", { parts: BOXES });
    const listing = await addWholeRound(relay, "Listing", "Sorted", { parts: BOXES });
    const voting = await addWholeRound(relay, "Voting", "Sorted", { choices: CHOICES });
    await setKind(written, "write");
    await setKind(boxed, "write");
    await setKind(listing, "list");
    await setKind(voting, "vote");

    const passageOf = async (leg: string) => {
      const asked = await json(await post(edge, "/live/rounds/sample-answers", { leg }, cookie));
      expect(asked.asked).toBe(true);
      const pending = await edge.application.concepts.Reasoning._pending();
      return pending.find((ask) => ask.about === leg)?.passage ?? "";
    };

    const writtenPassage = await passageOf(written);
    expect(writtenPassage).toContain("Written?");
    expect(writtenPassage).not.toContain("Choose from: ");
    expect(await passageOf(boxed)).not.toContain("The boxes to answer:");

    const listPassage = await passageOf(listing);
    expect(listPassage).toContain("The boxes to answer:\n- one\n- two");
    expect(listPassage).not.toContain("Choose from: ");

    const votePassage = await passageOf(voting);
    expect(votePassage).toContain("Choose from: a | b");
    expect(votePassage).not.toContain("The boxes to answer:");
  }, 60_000);
});
