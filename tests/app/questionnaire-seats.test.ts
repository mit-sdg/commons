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

/** Register a student account, so a seat can be asked to name one. */
async function register(edge: Edge, username: string) {
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
  return registered.user;
}

/** Serve every pending ask; a served reply may queue another. */
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

interface Board {
  started: number;
  handedIn: number;
  questions: {
    question: string;
    prompt: string;
    choices: string[];
    values: { response: string; participant: string; part: string; value: string }[];
  }[];
  seats: { participant: string }[];
  modelResponses: { response: string; submitted: boolean }[];
}

interface Scores {
  results: {
    submission: string;
    participant: string;
    score: number;
    outOf: number;
    model: boolean;
  }[];
}

async function buildSurvey(edge: Edge, cookie: string, title: string) {
  const created = await json(
    await post(edge, "/live/quizzes/create", { title, form: "survey" }, cookie),
  );
  const questionnaire = created.questionnaire as string;
  await post(
    edge,
    "/live/quizzes/add-question",
    {
      questionnaire,
      prompt: "How is the pace?",
      choices: ["Slow", "Right", "Fast"],
      expected: "",
      explanation: "",
    },
    cookie,
  );
  await post(
    edge,
    "/live/quizzes/add-question",
    { questionnaire, prompt: "What is unclear?", choices: [], expected: "", explanation: "" },
    cookie,
  );
  return questionnaire;
}

async function buildQuiz(edge: Edge, cookie: string, title: string) {
  const created = await json(
    await post(
      edge,
      "/live/quizzes/create",
      { title, form: "quiz", disclosure: "answers" },
      cookie,
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
      explanation: "Photosynthesis fixes carbon.",
    },
    cookie,
  );
  await post(
    edge,
    "/live/quizzes/add-question",
    {
      questionnaire,
      prompt: "Name the light-capturing pigment.",
      choices: [],
      expected: "Chlorophyll",
      explanation: "",
    },
    cookie,
  );
  return questionnaire;
}

describe("a seat on a questionnaire run", () => {
  let edge: Edge;
  let cookie: string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    cookie = await registerHost(edge);
  });

  afterAll(stopTestDb);

  const later = () => new Date(Date.now() + 60_000);

  const readBoard = async (run: string) => {
    const body = await json(await post(edge, "/live/runs/results", { run }, cookie));
    return body.board as unknown as Board;
  };

  test("a survey run seats the model and each seat answers every question", async () => {
    const questionnaire = await buildSurvey(edge, cookie, "Pace check");
    const launch = await json(await post(edge, "/live/runs/launch", { questionnaire }, cookie));
    const run = launch.run as string;

    for (const device of ["seat-1", "seat-2"]) {
      const invited = await json(await post(edge, "/live/runs/invite", { run, device }, cookie));
      expect(invited.participant).toBe(device);
    }

    // Each seat began a response to the run itself, and each begin asked the mind.
    const begun = await until(
      async () => await edge.application.concepts.Responding._responsesFor({ subject: run }),
      (responses) => responses.length === 2,
    );
    expect(begun.map((response) => response.participant)).toEqual(["seat-1", "seat-2"]);

    const asked = await until(
      async () => await edge.application.concepts.Reasoning._pending(),
      (pending) => pending.length === 2,
    );
    expect(asked.length).toBe(2);
    await serveReasoner(edge);

    expect(await serveParticipantsOnce(edge.application.concepts, later)).toBe(2);

    const board = await until(
      async () => await readBoard(run),
      (read) => read.handedIn === 2,
    );
    expect(board.started).toBe(2);
    expect(board.handedIn).toBe(2);

    // Every question of the run was answered, in every seat's response.
    const items = board.questions.map((question) => question.question);
    expect(items.length).toBe(2);
    for (const { response } of begun) {
      const answers = await edge.application.concepts.Responding._answers({ response });
      expect(answers.map((answer) => answer.item).sort()).toEqual([...items].sort());
    }

    expect(board.seats.map((seat) => seat.participant)).toEqual(["seat-1", "seat-2"]);
    expect(board.modelResponses.length).toBe(2);
    expect(board.modelResponses.every((row) => row.submitted)).toBe(true);
    const model = new Set(board.modelResponses.map((row) => row.response));
    expect([...model].sort()).toEqual(begun.map((response) => response.response).sort());

    for (const question of board.questions) {
      const mine = question.values.filter((value) => model.has(value.response));
      expect(mine.length).toBe(2);
      if (question.choices.length > 0) {
        expect(mine.every((value) => question.choices.includes(value.value))).toBe(true);
      }
    }

    await post(edge, "/live/runs/close", { run }, cookie);
  }, 90_000);

  test("a quiz run marks the model's hand-in and leaves the room's unmarked", async () => {
    const questionnaire = await buildQuiz(edge, cookie, "Photosynthesis check");
    const launch = await json(await post(edge, "/live/runs/launch", { questionnaire }, cookie));
    const run = launch.run as string;
    const token = launch.token as string;

    await post(edge, "/live/runs/invite", { run, device: "seat-q" }, cookie);
    const [seated] = await until(
      async () => await edge.application.concepts.Responding._responsesFor({ subject: run }),
      (responses) => responses.length === 1,
    );
    await until(
      async () => await edge.application.concepts.Reasoning._pending(),
      (pending) => pending.length === 1,
    );
    await serveReasoner(edge);
    expect(await serveParticipantsOnce(edge.application.concepts, later)).toBe(1);

    const readScores = async () => {
      const body = await json(await post(edge, "/live/runs/results", { run }, cookie));
      return body.scores as unknown as Scores;
    };
    const graded = await until(readScores, (scores) => scores.results.length === 1);
    expect(graded.results.length).toBe(1);
    expect(graded.results[0]?.submission).toBe(seated!.response);
    expect(graded.results[0]?.model).toBe(true);
    expect(graded.results[0]?.outOf).toBeGreaterThanOrEqual(1);

    // A phone hands in beside the seat, and its row is the room's, not the model's.
    const face = await json(await post(edge, "/live/p/arrive", { token }));
    const questions = (face.face as { questions: { question: string }[] }).questions;
    const begun = await json(await post(edge, "/live/p/begin", { token, device: "phone-1" }));
    const response = begun.response as string;
    for (const [index, value] of ["Carbon dioxide", "Chlorophyll"].entries()) {
      const answered = await post(edge, "/live/p/answer", {
        response,
        question: questions[index]!.question,
        value,
      });
      expect(answered.status).toBe(200);
    }
    expect((await post(edge, "/live/p/submit", { response })).status).toBe(200);

    const both = await until(readScores, (scores) => scores.results.length === 2);
    const room = both.results.find((row) => row.submission === response);
    expect(room?.model).toBe(false);
    expect(both.results.find((row) => row.submission === seated!.response)?.model).toBe(true);

    await post(edge, "/live/runs/close", { run }, cookie);
  }, 90_000);

  test("a dismissed seat keeps its hand-in; a closed run seats nobody; the old address is gone", async () => {
    const questionnaire = await buildSurvey(edge, cookie, "What is unclear");
    const launch = await json(await post(edge, "/live/runs/launch", { questionnaire }, cookie));
    const run = launch.run as string;

    await post(edge, "/live/runs/invite", { run, device: "seat-d" }, cookie);
    const [seated] = await until(
      async () => await edge.application.concepts.Responding._responsesFor({ subject: run }),
      (responses) => responses.length === 1,
    );
    await until(
      async () => await edge.application.concepts.Reasoning._pending(),
      (pending) => pending.length === 1,
    );
    await serveReasoner(edge);
    expect(await serveParticipantsOnce(edge.application.concepts, later)).toBe(1);
    const handedIn = await until(
      async () => await readBoard(run),
      (board) => board.handedIn === 1,
    );
    expect(handedIn.seats.map((seat) => seat.participant)).toEqual(["seat-d"]);

    expect(
      (await post(edge, "/live/runs/dismiss", { run, participant: "seat-d" }, cookie)).status,
    ).toBe(200);
    const dismissed = await readBoard(run);
    expect(dismissed.seats).toEqual([]);
    expect(dismissed.modelResponses).toEqual([{ response: seated!.response, submitted: true }]);

    // Dismissing a participant that holds no seat says so.
    expect(
      (await json(await post(edge, "/live/runs/dismiss", { run, participant: "nobody" }, cookie)))
        .error,
    ).toBe("NOT_FOUND");

    // A closed run seats nobody.
    expect((await post(edge, "/live/runs/close", { run }, cookie)).status).toBe(200);
    expect(
      (await post(edge, "/live/runs/invite", { run, device: "seat-late" }, cookie)).status,
    ).toBe(409);

    // Seats are taken on the runs page; the relays' address is gone.
    expect(
      (await post(edge, "/live/relays/invite", { run, device: "seat-late" }, cookie)).status,
    ).toBe(404);
  }, 90_000);

  test("a seat that names an account is refused, and the account is not subscribed", async () => {
    const questionnaire = await buildSurvey(edge, cookie, "Naming an account");
    const launch = await json(await post(edge, "/live/runs/launch", { questionnaire }, cookie));
    const run = launch.run as string;

    const student = await register(edge, "student");
    const refused = await post(edge, "/live/runs/invite", { run, device: student }, cookie);
    expect(refused.status).toBe(400);
    expect((await json(refused)).error).toBe("INVALID_REQUEST");
    expect(
      await edge.application.concepts.Subscribing._isSubscribed({ user: student, target: run }),
    ).toMatchObject({ subscribed: false });

    await post(edge, "/live/runs/close", { run }, cookie);
  }, 90_000);
});
