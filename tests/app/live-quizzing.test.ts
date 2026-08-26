import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { scriptedMind, serveOnePass } from "../../src/reasoning/worker.ts";

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
  const cookie = login.headers.get("Set-Cookie")?.split(";")[0] as string;
  return { user: registered.user, cookie };
}

/** Serve every pending reasoner ask with the deterministic scripted mind. */
async function serveReasoner(edge: Edge, rounds = 4) {
  const mind = scriptedMind();
  for (let round = 0; round < rounds; round += 1) {
    const served = await serveOnePass(edge.application.concepts.Reasoning, mind);
    if (served === 0) break;
    // A served reply may itself queue another ask (the repair loop); poll again.
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function buildQuiz(edge: Edge, cookie: string, disclosure: string) {
  const created = await json(
    await post(
      edge,
      "/live/quizzes/create",
      { title: "Photosynthesis check", form: "quiz", disclosure },
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
      position: 1,
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
      position: 2,
    },
    cookie,
  );
  return questionnaire;
}

describe("the live quiz loop", () => {
  let edge: Edge;
  let cookie: string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    ({ cookie } = await registerHost(edge));
  });

  afterAll(stopTestDb);

  test("a manual quiz runs end to end: author, launch, participate, grade, disclose, close", async () => {
    const questionnaire = await buildQuiz(edge, cookie, "answers");

    const launch = await json(await post(edge, "/live/runs/launch", { questionnaire }, cookie));
    const run = launch.run as string;
    const token = launch.token as string;
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    // Editing while the run is open is refused with RUN_OPEN.
    const editWhileOpen = await json(
      await post(
        edge,
        "/live/quizzes/add-question",
        { questionnaire, prompt: "Late?", choices: [], expected: "", explanation: "", position: 3 },
        cookie,
      ),
    );
    // Authored branch answers reach HTTP callers as their public category.
    expect(editWhileOpen.error).toBe("CONFLICT");

    // A second launch of the same questionnaire is refused while one stands open.
    const relaunch = await post(edge, "/live/runs/launch", { questionnaire }, cookie);
    expect(relaunch.status).toBeGreaterThanOrEqual(400);

    // The participant face conceals expected answers and explanations.
    const face = await json(await post(edge, "/live/p/arrive", { token }));
    const faceText = JSON.stringify(face);
    expect(faceText).toContain("Which gas do plants take in?");
    expect(faceText).not.toContain("Carbon dioxide".repeat(1).length > 0 && "expected");
    expect(faceText).not.toContain("explanation");
    expect((face.face as { open: boolean }).open).toBe(true);

    // An anonymous phone begins, answers, and rejoins after a reload.
    const begun = await json(await post(edge, "/live/p/begin", { token, device: "phone-1" }));
    const response = begun.response as string;
    const rejoined = await json(await post(edge, "/live/p/begin", { token, device: "phone-1" }));
    expect(rejoined.response).toBe(response);

    const questions = (face.face as { questions: { question: string; position: number }[] })
      .questions;
    expect(questions).toHaveLength(2);

    // A quiz cannot be handed in incomplete.
    await post(edge, "/live/p/answer", {
      response,
      question: questions[0].question,
      value: "Carbon dioxide",
    });
    const early = await post(edge, "/live/p/submit", { response });
    expect(early.status).toBe(409);

    // Answer the rest — changing an answer replaces it in place — and hand in.
    await post(edge, "/live/p/answer", {
      response,
      question: questions[1].question,
      value: "chlorophyll",
    });
    await post(edge, "/live/p/answer", {
      response,
      question: questions[1].question,
      value: "Chlorophyll",
    });
    const submitted = await post(edge, "/live/p/submit", { response });
    expect(submitted.status).toBe(200);

    // Handing in twice is refused.
    const again = await post(edge, "/live/p/submit", { response });
    expect(again.status).toBeGreaterThanOrEqual(400);

    // Beginning again after hand-in is refused rather than counted twice.
    const reBegin = await post(edge, "/live/p/begin", { token, device: "phone-1" });
    expect(reBegin.status).toBeGreaterThanOrEqual(400);

    // Grading lands through the reaction; the outcome polls until it does.
    let outcome: Record<string, never> = {};
    for (let attempt = 0; attempt < 40; attempt += 1) {
      outcome = await json(await post(edge, "/live/p/outcome", { response }));
      const formed = outcome.outcome as { score: number | null } | undefined;
      if (formed?.score !== null && formed?.score !== undefined) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const formed = outcome.outcome as {
      disclosure: string;
      score: number;
      outOf: number;
      items: { expected: string; value: string | null }[];
    };
    expect(formed.disclosure).toBe("answers");
    expect(formed.score).toBe(2);
    expect(formed.outOf).toBe(2);
    expect(formed.items).toHaveLength(2);
    expect(JSON.stringify(formed)).not.toContain("Photosynthesis fixes carbon.");

    // The staff board carries the handed-in values and the score.
    const results = await json(await post(edge, "/live/runs/results", { run }, cookie));
    const board = results.board as { started: number; handedIn: number; questions: unknown[] };
    expect(board.started).toBe(1);
    expect(board.handedIn).toBe(1);
    const scores = results.scores as { results: { score: number; outOf: number }[] };
    expect(scores.results).toEqual([expect.objectContaining({ score: 2, outOf: 2 })]);

    // The open-runs shelf lists it; closing removes it and ends participation.
    const open = await json(await post(edge, "/live/runs/open", {}, cookie));
    expect(JSON.stringify(open)).toContain(run);
    await post(edge, "/live/runs/close", { run }, cookie);
    const closedFace = await json(await post(edge, "/live/p/arrive", { token }));
    expect((closedFace.face as { open: boolean }).open).toBe(false);
    const lateBegin = await post(edge, "/live/p/begin", { token, device: "phone-2" });
    expect(lateBegin.status).toBe(409);
  });

  test("a survey collects hand-ins without a key and accepts partial answers", async () => {
    const created = await json(
      await post(edge, "/live/quizzes/create", { title: "Pace check", form: "survey" }, cookie),
    );
    const questionnaire = created.questionnaire as string;
    await post(
      edge,
      "/live/quizzes/add-question",
      {
        questionnaire,
        prompt: "How is the pace?",
        choices: ["Slow", "Right", "Fast"],
        position: 1,
      },
      cookie,
    );
    await post(
      edge,
      "/live/quizzes/add-question",
      { questionnaire, prompt: "What is unclear?", choices: [], position: 2 },
      cookie,
    );
    const launch = await json(await post(edge, "/live/runs/launch", { questionnaire }, cookie));
    const token = launch.token as string;
    const run = launch.run as string;

    const face = await json(await post(edge, "/live/p/arrive", { token }));
    const questions = (face.face as { questions: { question: string }[] }).questions;
    const begun = await json(await post(edge, "/live/p/begin", { token, device: "phone-9" }));
    const response = begun.response as string;
    await post(edge, "/live/p/answer", {
      response,
      question: questions[0].question,
      value: "Right",
    });
    const submitted = await post(edge, "/live/p/submit", { response });
    expect(submitted.status).toBe(200);

    const outcome = await json(await post(edge, "/live/p/outcome", { response }));
    expect(outcome.received).toBe(true);
    expect(outcome.outcome).toBeUndefined();

    const results = await json(await post(edge, "/live/runs/results", { run }, cookie));
    expect(results.scores).toBeUndefined();
    const board = results.board as {
      handedIn: number;
      questions: { prompt: string; values: { value: string }[] }[];
    };
    expect(board.handedIn).toBe(1);
    expect(board.questions[0].values).toEqual([expect.objectContaining({ value: "Right" })]);
    expect(board.questions[1].values).toEqual([]);
  });

  test("a quiz with no expected answers cannot launch; a signed-in participant binds to the account", async () => {
    const created = await json(
      await post(edge, "/live/quizzes/create", { title: "Unready quiz", form: "quiz" }, cookie),
    );
    const questionnaire = created.questionnaire as string;
    await post(
      edge,
      "/live/quizzes/add-question",
      { questionnaire, prompt: "Open question?", choices: [], position: 1 },
      cookie,
    );
    const refused = await post(edge, "/live/runs/launch", { questionnaire }, cookie);
    expect(refused.status).toBe(409);

    // Give it an answer, launch, and join with the host's own session.
    const face0 = await json(await post(edge, "/live/quizzes/get", { questionnaire }, cookie));
    const question = (face0.questionnaire as { questions: { question: string }[] }).questions[0]
      .question;
    await post(
      edge,
      "/live/quizzes/revise-question",
      {
        question,
        prompt: "Open question?",
        choices: [],
        expected: "42",
        explanation: "",
        position: 1,
      },
      cookie,
    );
    const launch = await json(await post(edge, "/live/runs/launch", { questionnaire }, cookie));
    const begun = await json(
      await post(edge, "/live/p/begin-signed", { token: launch.token }, cookie),
    );
    expect(typeof begun.response).toBe("string");
    expect(begun.participant).not.toBe("");
    const board = await json(await post(edge, "/live/runs/results", { run: launch.run }, cookie));
    expect((board.board as { started: number }).started).toBe(1);
    await post(edge, "/live/runs/close", { run: launch.run }, cookie);
  });

  test("permissions gate the staff surface", async () => {
    const listed = await post(edge, "/live/quizzes/list", {}, cookie);
    expect(listed.status).toBe(200);
    const anonymous = await post(edge, "/live/quizzes/list", {});
    expect(anonymous.status).toBeGreaterThanOrEqual(400);
    const mistyped = await post(edge, "/live/p/arrive", { token: "not-a-token" });
    expect(mistyped.status).toBeGreaterThanOrEqual(400);
  });
});

describe("the drafting loop with a scripted reasoner", () => {
  let edge: Edge;
  let cookie: string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    ({ cookie } = await registerHost(edge));
  });

  afterAll(stopTestDb);

  const lineOf = async (brief: string) =>
    (await json(await post(edge, "/live/drafts/line", { brief }, cookie))).line as {
      step: string;
      candidate: string | null;
      adopted: boolean;
      clarifying: boolean;
      stalled: boolean;
      items: { prompt: string; expected: string }[];
      clarifications: { clarification: string; question: string; answer: string | null }[];
    }[];

  test("a described quiz is drafted, corrected, and adopted into an editable questionnaire", async () => {
    const described = await json(
      await post(
        edge,
        "/live/drafts/describe",
        { request: "A two-question quiz about photosynthesis for beginners" },
        cookie,
      ),
    );
    const brief = described.brief as string;
    await serveReasoner(edge);

    let line = await lineOf(brief);
    expect(line).toHaveLength(1);
    expect(line[0].candidate).not.toBeNull();
    expect(line[0].items.length).toBeGreaterThan(0);
    expect(line[0].items[0].expected).not.toBe("");

    // Correct it; the revision arrives as a new step whose basis is the first candidate.
    await post(
      edge,
      "/live/drafts/correct",
      { candidate: line[0].candidate, request: "Make the second question multiple choice" },
      cookie,
    );
    await serveReasoner(edge);
    line = await lineOf(brief);
    expect(line).toHaveLength(2);
    expect(line[1].candidate).not.toBeNull();

    // Adopt the revision; the questionnaire appears on the staff shelf with the items.
    await post(edge, "/live/drafts/adopt", { candidate: line[1].candidate }, cookie);
    let questionnaires: { title: string; questionnaire: string }[] = [];
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const listed = await json(await post(edge, "/live/quizzes/list", {}, cookie));
      questionnaires = listed.questionnaires as typeof questionnaires;
      if (questionnaires.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(questionnaires.length).toBe(1);
    const whole = await json(
      await post(
        edge,
        "/live/quizzes/get",
        { questionnaire: questionnaires[0].questionnaire },
        cookie,
      ),
    );
    const questions = (whole.questionnaire as { questions: { prompt: string }[] }).questions;
    expect(questions.length).toBeGreaterThan(0);

    // Correcting an adopted candidate is refused; the line marks it adopted.
    line = await lineOf(brief);
    expect(line[1].adopted).toBe(true);
    const late = await post(
      edge,
      "/live/drafts/correct",
      { candidate: line[1].candidate, request: "One more question" },
      cookie,
    );
    expect(late.status).toBeGreaterThanOrEqual(400);
  });

  test("an ambiguous request comes back as a question and resumes from the answer", async () => {
    const described = await json(
      await post(
        edge,
        "/live/drafts/describe",
        { request: "Something ambiguous about gardening" },
        cookie,
      ),
    );
    const brief = described.brief as string;
    await serveReasoner(edge);

    let line = await lineOf(brief);
    expect(line[0].clarifying).toBe(true);
    expect(line[0].candidate).toBeNull();
    const open = line[0].clarifications.find((entry) => entry.answer === null);
    expect(open).toBeDefined();

    await post(
      edge,
      "/live/drafts/clarify",
      { clarification: open?.clarification, answer: "A quiz, please" },
      cookie,
    );
    await serveReasoner(edge);
    line = await lineOf(brief);
    expect(line[0].clarifying).toBe(false);
    expect(line[0].candidate).not.toBeNull();
    expect(line[0].items[0].prompt).toContain("Clarified quiz");
  });

  test("an unreadable reply is repaired without any creator action", async () => {
    const described = await json(
      await post(edge, "/live/drafts/describe", { request: "unreadable nonsense probe" }, cookie),
    );
    const brief = described.brief as string;
    await serveReasoner(edge);

    const line = await lineOf(brief);
    expect(line[0].stalled).toBe(false);
    expect(line[0].candidate).not.toBeNull();
    expect(line[0].items[0].prompt).toContain("Repaired quiz");
  });

  test("a reply that never becomes readable stalls the brief honestly after three complaints", async () => {
    const described = await json(
      await post(edge, "/live/drafts/describe", { request: "hopeless case" }, cookie),
    );
    const brief = described.brief as string;
    const hopelessMind = () => Promise.resolve("never valid json");
    for (let round = 0; round < 6; round += 1) {
      const served = await serveOnePass(edge.application.concepts.Reasoning, hopelessMind);
      if (served === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const line = await lineOf(brief);
    expect(line[0].stalled).toBe(true);
    expect(line[0].candidate).toBeNull();
  });

  test("a reasoner that cannot be reached stalls the brief with the failure's account", async () => {
    const described = await json(
      await post(edge, "/live/drafts/describe", { request: "network trouble" }, cookie),
    );
    const brief = described.brief as string;
    const unreachableMind = () => Promise.reject(new Error("The reasoner answered HTTP 503."));
    await serveOnePass(edge.application.concepts.Reasoning, unreachableMind);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const line = await lineOf(brief);
    expect(line[0].stalled).toBe(true);
  });
});
