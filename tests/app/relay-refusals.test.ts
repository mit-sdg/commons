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

interface Round {
  leg: string;
  number: number;
  questionnaire: string;
  title: string;
  question: string;
  prompt: string;
  takes: { source: string; sourceNumber: number; shape: string }[];
}

interface Added {
  leg: string;
  questionnaire: string;
  question: string;
}

let edge: Edge;
let cookie: string;

const rounds = async (relay: string): Promise<Round[]> => {
  const read = await json(await post(edge, "/live/relays/get", { relay }, cookie));
  const whole = read.relay as unknown as { title: string; rounds: Round[] } | null;
  return whole === null ? [] : whole.rounds;
};

const plan = async (title: string): Promise<string> => {
  const planned = await json(await post(edge, "/live/relays/plan", { title }, cookie));
  return planned.relay as string;
};

const addRound = async (relay: string, title: string): Promise<Added> => {
  const added = await json(
    await post(
      edge,
      "/live/relays/add-round",
      { relay, title, prompt: `${title}?`, parts: [], cap: 0, choices: [] },
      cookie,
    ),
  );
  return added as unknown as Added;
};

beforeAll(async () => {
  edge = createEdge(mongoImplementations(await testDb()));
  cookie = await registerHost(edge);
});

afterAll(stopTestDb);

/** The boundary answers a refusal's category, so RELAY_RETIRED arrives as CONFLICT. */
describe("writing to a retired relay", () => {
  let relay: string;
  let first: Added;
  let second: Added;

  beforeAll(async () => {
    relay = await plan("Warm-up");
    first = await addRound(relay, "One word");
    second = await addRound(relay, "The stranger");
    await post(
      edge,
      "/live/relays/set-takes",
      { leg: second.leg, source: first.leg, shape: "context" },
      cookie,
    );
    const retired = await json(await post(edge, "/live/relays/retire", { relay }, cookie));
    expect(retired.relay).toBe(relay);
  });

  test("retitling the relay is refused", async () => {
    const refused = await json(
      await post(edge, "/live/relays/retitle", { relay, title: "Cool-down" }, cookie),
    );
    expect(refused.error).toBe("CONFLICT");
  });

  test("adding a round is refused", async () => {
    const refused = await json(
      await post(
        edge,
        "/live/relays/add-round",
        { relay, title: "Late", prompt: "Late?", parts: [], cap: 0, choices: [] },
        cookie,
      ),
    );
    expect(refused.error).toBe("CONFLICT");
  });

  test("revising a round is refused", async () => {
    const refused = await json(
      await post(
        edge,
        "/live/relays/revise-round",
        {
          leg: first.leg,
          title: "Two words",
          prompt: "Two words?",
          parts: [],
          cap: 0,
          choices: [],
        },
        cookie,
      ),
    );
    expect(refused.error).toBe("CONFLICT");
  });

  test("removing a round is refused", async () => {
    const refused = await json(
      await post(edge, "/live/relays/remove-round", { leg: second.leg }, cookie),
    );
    expect(refused.error).toBe("CONFLICT");
  });

  test("moving a round is refused", async () => {
    const refused = await json(
      await post(edge, "/live/relays/move-round", { leg: second.leg, position: 1 }, cookie),
    );
    expect(refused.error).toBe("CONFLICT");
  });

  test("setting what a round takes is refused", async () => {
    const refused = await json(
      await post(
        edge,
        "/live/relays/set-takes",
        { leg: second.leg, source: first.leg, shape: "context" },
        cookie,
      ),
    );
    expect(refused.error).toBe("CONFLICT");
  });

  test("clearing what a round takes is refused", async () => {
    const refused = await json(
      await post(edge, "/live/relays/clear-takes", { leg: second.leg, source: first.leg }, cookie),
    );
    expect(refused.error).toBe("CONFLICT");
  });

  test("the relay stands as it was left", async () => {
    const standing = await rounds(relay);
    expect(standing.map((round) => round.title)).toEqual(["One word", "The stranger"]);
    expect(standing[0].prompt).toBe("One word?");
    expect(standing[1].takes).toEqual([{ source: first.leg, sourceNumber: 1, shape: "context" }]);
  });
});

/** A round's questionnaire is reached through its relay, and is NOT_FOUND anywhere else. */
describe("a relay round's questionnaire on the quiz and run endpoints", () => {
  let relay: string;
  let round: Added;

  beforeAll(async () => {
    relay = await plan("Verbs and strangers");
    round = await addRound(relay, "Three verbs");
  });

  test("it is not on the shelf", async () => {
    const list = await json(await post(edge, "/live/quizzes/list", {}, cookie));
    const shelf = list.questionnaires as unknown as { questionnaire: string }[];
    expect(shelf.some((entry) => entry.questionnaire === round.questionnaire)).toBe(false);
  });

  test("reading it as a questionnaire is refused", async () => {
    const refused = await json(
      await post(edge, "/live/quizzes/get", { questionnaire: round.questionnaire }, cookie),
    );
    expect(refused.error).toBe("NOT_FOUND");
  });

  test("retitling it is refused", async () => {
    const refused = await json(
      await post(
        edge,
        "/live/quizzes/retitle",
        { questionnaire: round.questionnaire, title: "Hijacked" },
        cookie,
      ),
    );
    expect(refused.error).toBe("NOT_FOUND");
  });

  test("adding a question to it is refused", async () => {
    const refused = await json(
      await post(
        edge,
        "/live/quizzes/add-question",
        { questionnaire: round.questionnaire, prompt: "A second question?" },
        cookie,
      ),
    );
    expect(refused.error).toBe("NOT_FOUND");
  });

  test("launching it as a run of its own is refused", async () => {
    const refused = await json(
      await post(edge, "/live/runs/launch", { questionnaire: round.questionnaire }, cookie),
    );
    expect(refused.error).toBe("NOT_FOUND");
  });

  test("the round stands as it was authored", async () => {
    const standing = await rounds(relay);
    expect(standing.map((entry) => entry.title)).toEqual(["Three verbs"]);
    expect(standing[0].prompt).toBe("Three verbs?");
    expect(standing[0].question).toBe(round.question);
  });
});
