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

interface Account {
  user: string;
  cookie: string;
}

async function register(edge: Edge, username: string): Promise<Account> {
  const password = `pw-${username}-123`;
  const registered = await edge.application.concepts.Authenticating.register({
    username,
    password,
    email: `${username}@example.com`,
  });
  await edge.application.concepts.Profiling.createProfile({
    user: registered.user,
    displayName: username,
  });
  const login = await post(edge, "/auth/login", { username, password });
  return {
    user: registered.user,
    cookie: login.headers.get("Set-Cookie")?.split(";")[0] as string,
  };
}

let edge: Edge;
let host: Account;
let runId: string;
let token: string;
let round: string;
let question: string;

const countResponses = async () =>
  (await edge.application.concepts.Responding._responsesFor({ subject: round })).length;

beforeAll(async () => {
  edge = createEdge(mongoImplementations(await testDb()));
  host = await register(edge, "lee");
  const { role } = await edge.application.concepts.Roling.ensureRole({
    name: "live-host",
    capabilities: ["live:host"],
  });
  await edge.application.concepts.Roling.assign({ user: host.user, context: "commons", role });

  const relay = (await json(await post(edge, "/live/relays/plan", { title: "Seats" }, host.cookie)))
    .relay as string;
  const added = await json(
    await post(
      edge,
      "/live/relays/add-round",
      { relay, title: "One word", prompt: "One word?", parts: [], cap: 0, choices: [] },
      host.cookie,
    ),
  );
  const launched = await json(await post(edge, "/live/relays/launch", { relay }, host.cookie));
  runId = launched.run as string;
  token = launched.token as string;
  round = (
    await json(
      await post(
        edge,
        "/live/relays/open-round",
        { run: launched.run, leg: added.leg },
        host.cookie,
      ),
    )
  ).round as string;
  question = (
    (await json(await post(edge, "/live/p/arrive", { token }))).relay as unknown as {
      questions: { question: string }[];
    }
  ).questions[0].question;
});

afterAll(stopTestDb);

describe("a signed student in a relay round", () => {
  test("answers, hands in, and reads the wall on the endpoints that carry a session", async () => {
    const alice = await register(edge, "alice");
    const begun = await json(await post(edge, "/live/p/begin-signed", { token }, alice.cookie));
    const response = begun.response as string;
    expect(begun.participant).toBe(alice.user);

    expect(
      (
        await post(
          edge,
          "/live/p/answer-signed",
          { response, question, value: "kestrel" },
          alice.cookie,
        )
      ).status,
    ).toBe(200);
    expect((await post(edge, "/live/p/submit-signed", { response }, alice.cookie)).status).toBe(
      200,
    );

    const read = await json(await post(edge, "/live/p/wall-signed", { response }, alice.cookie));
    const wall = read.wall as unknown as { cards: { value: string; mine: boolean }[] };
    expect(wall.cards.filter((card) => card.mine).map((card) => card.value)).toEqual(["kestrel"]);
  });

  test("a borrowed response identifier reaches nothing, signed or anonymous", async () => {
    const carol = await register(edge, "carol");
    const mallory = await register(edge, "mallory");
    const begun = await json(await post(edge, "/live/p/begin-signed", { token }, carol.cookie));
    const response = begun.response as string;
    await post(edge, "/live/p/answer-signed", { response, question, value: "heron" }, carol.cookie);
    // Handed in, so the wall read's own branch is reached on its merits and
    // only ownership stands between a borrowed identifier and the cards.
    await post(edge, "/live/p/submit-signed", { response }, carol.cookie);

    for (const [path, body] of [
      ["/live/p/answer-signed", { response, question, value: "stolen" }],
      ["/live/p/submit-signed", { response }],
      ["/live/p/wall-signed", { response }],
      ["/live/p/outcome-signed", { response }],
    ] as const) {
      expect((await post(edge, path, body, mallory.cookie)).status, path).toBe(404);
    }

    for (const [path, body] of [
      ["/live/p/answer", { response, question, value: "stolen" }],
      ["/live/p/submit", { response }],
      ["/live/p/wall", { response }],
      ["/live/p/outcome", { response }],
    ] as const) {
      expect((await post(edge, path, body)).status, path).toBe(404);
    }

    expect(await edge.application.concepts.Responding._answers({ response })).toMatchObject([
      { value: "heron" },
    ]);
    const mine = await json(await post(edge, "/live/p/wall-signed", { response }, carol.cookie));
    expect(
      (mine.wall as unknown as { cards: { value: string; mine: boolean }[] }).cards.filter(
        (card) => card.mine,
      ),
    ).toHaveLength(1);
  });
});

describe("the anonymous join refuses a device that names an account", () => {
  test("it says the same thing whether that account has begun, handed in, or never came", async () => {
    const absent = await register(edge, "absent");
    const waiting = await register(edge, "waiting");
    const finished = await register(edge, "finished");

    await post(edge, "/live/p/begin-signed", { token }, waiting.cookie);
    const done = await json(await post(edge, "/live/p/begin-signed", { token }, finished.cookie));
    await post(
      edge,
      "/live/p/answer-signed",
      { response: done.response, question, value: "swift" },
      finished.cookie,
    );
    await post(edge, "/live/p/submit-signed", { response: done.response }, finished.cookie);

    const before = await countResponses();
    const probes = [];
    for (const account of [absent, waiting, finished]) {
      const probe = await post(edge, "/live/p/begin", { token, device: account.user });
      probes.push({ status: probe.status, body: await probe.text() });
    }
    expect(probes[0]).toEqual(probes[1]);
    expect(probes[1]).toEqual(probes[2]);
    expect(probes[0].status).toBe(404);
    expect(await countResponses()).toBe(before);
  });

  test("an ordinary device still joins", async () => {
    const begun = await json(await post(edge, "/live/p/begin", { token, device: "phone-9" }));
    expect(typeof begun.response).toBe("string");
    expect(begun.participant).toBe("phone-9");
  });
});

describe("a signed student in a quiz run", () => {
  test("a borrowed identifier cannot hand their quiz in for them", async () => {
    const created = await json(
      await post(
        edge,
        "/live/quizzes/create",
        { title: "Photosynthesis", form: "quiz", disclosure: "score" },
        host.cookie,
      ),
    );
    const questionnaire = created.questionnaire as string;
    await post(
      edge,
      "/live/quizzes/add-question",
      {
        questionnaire,
        prompt: "Which gas do plants take in?",
        choices: ["Oxygen", "Carbon dioxide"],
        expected: "Carbon dioxide",
        explanation: "",
      },
      host.cookie,
    );
    const launched = await json(
      await post(edge, "/live/runs/launch", { questionnaire }, host.cookie),
    );
    const quizToken = launched.token as string;
    const quizQuestion = (
      (await json(await post(edge, "/live/p/arrive", { token: quizToken }))).face as unknown as {
        questions: { question: string }[];
      }
    ).questions[0].question;

    const dana = await register(edge, "dana");
    const begun = await json(
      await post(edge, "/live/p/begin-signed", { token: quizToken }, dana.cookie),
    );
    const response = begun.response as string;
    // Every question answered, so only ownership stands between a caller and
    // the hand-in: the whole-quiz branch is reached on its merits.
    await post(
      edge,
      "/live/p/answer-signed",
      { response, question: quizQuestion, value: "Carbon dioxide" },
      dana.cookie,
    );

    expect((await post(edge, "/live/p/submit", { response })).status).toBe(404);
    expect(await edge.application.concepts.Responding._response({ response })).toMatchObject([
      { submitted: false },
    ]);

    expect((await post(edge, "/live/p/submit-signed", { response }, dana.cookie)).status).toBe(200);
  });
});

describe("a model seat is an identifier the host made up", () => {
  test("it refuses to seat an account, so no card is marked as the model's", async () => {
    const student = await register(edge, "student");
    const seated = await post(
      edge,
      "/live/relays/invite",
      { run: runId, device: student.user },
      host.cookie,
    );
    expect(seated.status).toBe(400);
    expect(
      await edge.application.concepts.Subscribing._isSubscribed({
        user: student.user,
        target: runId,
      }),
    ).toMatchObject({ subscribed: false });

    const model = await json(
      await post(edge, "/live/relays/invite", { run: runId, device: "model-1" }, host.cookie),
    );
    expect(model.participant).toBe("model-1");
  });
});

describe("the edge reads a bounded amount before it decides anything", () => {
  test("an oversized body is refused without a session and without parsing", async () => {
    const huge = "x".repeat(1_000_001);
    const response = await post(edge, "/live/p/arrive", { token: huge });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "REQUEST_TOO_LARGE" });
  });

  test("a body nested past the stated depth is refused", async () => {
    let nested: unknown = "leaf";
    for (let level = 0; level < 200; level += 1) nested = { nested };
    const response = await post(edge, "/live/p/arrive", { token: nested });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_REQUEST" });
  });

  test("an ordinary body still passes", async () => {
    expect((await post(edge, "/live/p/arrive", { token })).status).toBe(200);
  });
});
