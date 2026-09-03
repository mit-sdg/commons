import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { scriptedEditsReply } from "../../src/reasoning/scripted-edits.ts";
import { serveOnePass, type Mind } from "../../src/reasoning/worker.ts";
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

const HOST = {
  username: "lee",
  password: "pw-lee-123",
  displayName: "Professor Lee",
  email: "lee@example.com",
};

async function registerHost(edge: Edge, host = HOST) {
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
  const cookie = login.headers.get("Set-Cookie")?.split(";")[0] as string;
  return { user: registered.user, cookie };
}

/** The scripted relay-drafting mind; anything else it is handed answers nothing. */
const mind: Mind = ({ passage }) => Promise.resolve(scriptedEditsReply(passage) ?? "");

/** Serve every pending ask, including the one a stood-upon reply queues next. */
async function serveReasoner(edge: Edge, rounds = 4) {
  for (let round = 0; round < rounds; round += 1) {
    const served = await serveOnePass(edge.application.concepts.RoundReasoning, mind);
    if (served === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Poll a read until it settles into the expected shape; reactions land after the response. */
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

interface Line {
  suggestion: string;
  kind: string;
  target: string;
  value: string;
  position: number;
  standing: string;
}

interface Offering {
  offering: string;
  lines: Line[];
}

interface Round {
  leg: string;
  number: number;
  title: string;
  prompt: string;
  parts: string[];
  cap: number;
  choices: string[];
  takes: { source: string; sourceNumber: number; shape: string }[];
}

const offerings = async (edge: Edge, cookie: string, relay: string): Promise<Offering[]> => {
  const read = await json(await post(edge, "/live/edits/offerings", { relay }, cookie));
  return read.offerings as unknown as Offering[];
};

const rounds = async (edge: Edge, cookie: string, relay: string): Promise<Round[]> => {
  const read = await json(await post(edge, "/live/relays/get", { relay }, cookie));
  const whole = read.relay as unknown as { rounds: Round[] } | null;
  return whole === null ? [] : whole.rounds;
};

const plan = async (edge: Edge, cookie: string, title: string): Promise<string> => {
  const planned = await json(await post(edge, "/live/relays/plan", { title }, cookie));
  return planned.relay as unknown as string;
};

/** Draft against the relay, serve the ask, and wait for the offering to stand. */
async function draft(
  edge: Edge,
  cookie: string,
  relay: string,
  request: string,
  standing: number,
): Promise<Offering> {
  const asked = await json(await post(edge, "/live/edits/draft", { relay, request }, cookie));
  expect(typeof asked.asking).toBe("string");
  await serveReasoner(edge);
  const offered = await until(
    () => offerings(edge, cookie, relay),
    (all) => all.length > standing,
  );
  expect(offered.length).toBe(standing + 1);
  return offered[0];
}

describe("the relay editing loop", () => {
  let edge: Edge;
  let cookie: string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    ({ cookie } = await registerHost(edge));
  });

  afterAll(stopTestDb);

  test("a drafted relay is offered as lines, and taking each one builds the rounds", async () => {
    const relay = await plan(edge, cookie, "Verbs and strangers");

    const offering = await draft(
      edge,
      cookie,
      relay,
      "Two rounds: three verbs from the passage, then the stranger.",
      0,
    );
    expect(offering.lines.map((line) => line.kind)).toEqual(["add", "add"]);
    expect(offering.lines.every((line) => line.standing === "pending")).toBe(true);
    expect(JSON.parse(offering.lines[0].value)).toEqual({
      title: "Three verbs",
      prompt: "Name three verbs from the passage.",
      parts: ["one", "two", "three"],
      cap: 0,
      choices: [],
    });

    // Each add line is taken on its own; see content/issues/open for what a
    // take-all carrying several of them does.
    for (const line of offering.lines) {
      await post(edge, "/live/edits/take", { suggestion: line.suggestion }, cookie);
    }
    const built = await until(
      () => rounds(edge, cookie, relay),
      (all) => all.length === 2,
    );
    expect(built.map((round) => round.title)).toEqual(["Three verbs", "The stranger"]);
    expect(built.map((round) => round.number)).toEqual([1, 2]);
    expect(built[0].parts).toEqual(["one", "two", "three"]);
    expect(built[0].prompt).toBe("Name three verbs from the passage.");
    expect(built[1].parts).toEqual(["answer"]);
    // An added round carries no takes line; what it takes is set afterward.
    expect(built[1].takes).toEqual([]);

    const settled = await until(
      () => offerings(edge, cookie, relay),
      (all) => all[0].lines.every((line) => line.standing === "taken"),
    );
    expect(settled[0].lines.every((line) => line.standing === "taken")).toBe(true);

    // Drafted again, the same two rounds keep their identities and only the
    // takes the second round is missing are offered.
    const second = await draft(
      edge,
      cookie,
      relay,
      "Two rounds: three verbs from the passage, then the stranger.",
      1,
    );
    expect(second.lines.map((line) => line.kind)).toEqual(["takes"]);
    expect(second.lines[0].target).toBe(built[1].leg);
    expect(JSON.parse(second.lines[0].value)).toEqual({ from: 1, shape: "picked" });

    await post(edge, "/live/edits/take-all", { offering: second.offering }, cookie);
    const drawn = await until(
      () => rounds(edge, cookie, relay),
      (all) => all[1].takes.length === 1,
    );
    expect(drawn[1].takes).toEqual([{ source: built[0].leg, sourceNumber: 1, shape: "picked" }]);
    expect(drawn.map((round) => round.title)).toEqual(["Three verbs", "The stranger"]);
  });

  test("a round drafted again is revised in place, and a declined line changes nothing", async () => {
    const relay = await plan(edge, cookie, "One round");
    await post(
      edge,
      "/live/relays/add-round",
      {
        relay,
        title: "Pace",
        prompt: "How is the pace?",
        parts: [],
        cap: 0,
        choices: [],
      },
      cookie,
    );
    const [standing] = await rounds(edge, cookie, relay);

    const offering = await draft(edge, cookie, relay, "Reword the round.", 0);
    expect(offering.lines.map((line) => line.kind)).toEqual(["title", "prompt"]);
    expect(offering.lines.map((line) => line.target)).toEqual([standing.leg, standing.leg]);
    expect(offering.lines[0].value).toBe("Warm-up");
    expect(offering.lines[1].value).toBe("In one word, how is the pace so far?");

    await post(edge, "/live/edits/decline", { suggestion: offering.lines[0].suggestion }, cookie);
    await post(edge, "/live/edits/take", { suggestion: offering.lines[1].suggestion }, cookie);
    const revised = await until(
      () => rounds(edge, cookie, relay),
      (all) => all[0].prompt !== standing.prompt,
    );
    expect(revised.length).toBe(1);
    expect(revised[0].leg).toBe(standing.leg);
    expect(revised[0].title).toBe("Pace");
    expect(revised[0].prompt).toBe("In one word, how is the pace so far?");

    const settled = await until(
      () => offerings(edge, cookie, relay),
      (all) => all[0].lines.every((line) => line.standing !== "pending"),
    );
    expect(settled[0].lines.map((line) => line.standing)).toEqual(["declined", "taken"]);
  });

  test("a reply that cannot be read is stood upon once, and the second reply is offered", async () => {
    const relay = await plan(edge, cookie, "Unreadable first");
    const offering = await draft(
      edge,
      cookie,
      relay,
      "Draft one round; the first reply is unreadable.",
      0,
    );
    expect(offering.lines.map((line) => line.kind)).toEqual(["add"]);
    expect(JSON.parse(offering.lines[0].value).title).toBe("Warm-up");

    const [insistence] = await edge.application.concepts.RoundInsisting._for({ aim: relay });
    expect(insistence.satisfied).toBe(true);
  });
});
