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
      refines: string | null;
      composed: string | null;
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

    // Adopt the revision; the line answers the questionnaire it composed.
    await post(edge, "/live/drafts/adopt", { candidate: line[1].candidate }, cookie);
    line = await until(
      () => lineOf(brief),
      (steps) => steps[1]?.composed !== null,
    );
    const composed = line[1].composed as string;
    const listed = await json(await post(edge, "/live/quizzes/list", {}, cookie));
    expect(
      (listed.questionnaires as { questionnaire: string }[]).map((entry) => entry.questionnaire),
    ).toContain(composed);
    const whole = await json(
      await post(edge, "/live/quizzes/get", { questionnaire: composed }, cookie),
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

describe("questions stand contiguously", () => {
  let edge: Edge;
  let cookie: string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    ({ cookie } = await registerHost(edge));
  });

  afterAll(stopTestDb);

  const questionsOf = async (questionnaire: string) => {
    const whole = await json(await post(edge, "/live/quizzes/get", { questionnaire }, cookie));
    return (
      whole.questionnaire as {
        questions: { question: string; prompt: string; position: number }[];
      }
    ).questions;
  };

  test("adding appends, removing closes ranks, and a move swaps neighbors", async () => {
    const questionnaire = await buildQuiz(edge, cookie, "score");
    await post(
      edge,
      "/live/quizzes/add-question",
      { questionnaire, prompt: "Name one plant.", expected: "Any" },
      cookie,
    );
    let questions = await questionsOf(questionnaire);
    expect(questions.map((entry) => entry.position)).toEqual([1, 2, 3]);

    await post(edge, "/live/quizzes/remove-question", { question: questions[1].question }, cookie);
    questions = await until(
      () => questionsOf(questionnaire),
      (rows) => rows.length === 2 && rows[1].position === 2,
    );
    expect(questions.map((entry) => entry.position)).toEqual([1, 2]);
    expect(questions.map((entry) => entry.prompt)).toEqual([
      "Which gas do plants take in?",
      "Name one plant.",
    ]);

    const raised = await json(
      await post(edge, "/live/quizzes/raise-question", { question: questions[1].question }, cookie),
    );
    expect(raised.question).toBe(questions[1].question);
    questions = await questionsOf(questionnaire);
    expect(questions.map((entry) => entry.prompt)).toEqual([
      "Name one plant.",
      "Which gas do plants take in?",
    ]);

    const atTop = await post(
      edge,
      "/live/quizzes/raise-question",
      { question: questions[0].question },
      cookie,
    );
    expect(atTop.status).toBeGreaterThanOrEqual(400);
    const atBottom = await post(
      edge,
      "/live/quizzes/lower-question",
      { question: questions[1].question },
      cookie,
    );
    expect(atBottom.status).toBeGreaterThanOrEqual(400);

    const lowered = await post(
      edge,
      "/live/quizzes/lower-question",
      { question: questions[0].question },
      cookie,
    );
    expect(lowered.status).toBe(200);
    questions = await questionsOf(questionnaire);
    expect(questions.map((entry) => entry.prompt)).toEqual([
      "Which gas do plants take in?",
      "Name one plant.",
    ]);

    const missing = await post(
      edge,
      "/live/quizzes/raise-question",
      { question: "no-such" },
      cookie,
    );
    expect(missing.status).toBeGreaterThanOrEqual(400);
  });

  test("retitling and moving are refused while a run is open", async () => {
    const questionnaire = await buildQuiz(edge, cookie, "score");
    const questions = await questionsOf(questionnaire);
    const launch = await json(await post(edge, "/live/runs/launch", { questionnaire }, cookie));
    const retitleDenied = await post(
      edge,
      "/live/quizzes/retitle",
      { questionnaire, title: "Mid-run title" },
      cookie,
    );
    expect(retitleDenied.status).toBeGreaterThanOrEqual(400);
    const moveDenied = await post(
      edge,
      "/live/quizzes/lower-question",
      { question: questions[0].question },
      cookie,
    );
    expect(moveDenied.status).toBeGreaterThanOrEqual(400);
    await post(edge, "/live/runs/close", { run: launch.run }, cookie);
    const allowed = await post(
      edge,
      "/live/quizzes/retitle",
      { questionnaire, title: "After-run title" },
      cookie,
    );
    expect(allowed.status).toBe(200);
  });
});

describe("the refining line with a scripted reasoner", () => {
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
      refines: string | null;
      composed: string | null;
      items: { prompt: string; expected: string }[];
    }[];

  const questionsOf = async (questionnaire: string) => {
    const whole = await json(await post(edge, "/live/quizzes/get", { questionnaire }, cookie));
    return (
      whole.questionnaire as {
        questions: { question: string; prompt: string; position: number }[];
      }
    ).questions;
  };

  test("a refined quiz is corrected in place, keeping question identities", async () => {
    const questionnaire = await buildQuiz(edge, cookie, "score");
    await post(
      edge,
      "/live/quizzes/add-question",
      { questionnaire, prompt: "One more.", expected: "x" },
      cookie,
    );
    const before = await questionsOf(questionnaire);
    expect(before).toHaveLength(3);

    const refined = await json(await post(edge, "/live/drafts/refine", { questionnaire }, cookie));
    const brief = refined.brief as string;
    let line = await lineOf(brief);
    expect(line).toHaveLength(1);
    expect(line[0].refines).toBe(questionnaire);
    expect(line[0].items).toHaveLength(3);
    expect(line[0].items[0].prompt).toBe("Which gas do plants take in?");

    await post(
      edge,
      "/live/drafts/correct",
      { candidate: line[0].candidate, request: "Tighten the wording" },
      cookie,
    );
    await serveReasoner(edge);
    line = await lineOf(brief);
    expect(line).toHaveLength(2);
    expect(line[1].refines).toBe(questionnaire);
    expect(line[1].items).toHaveLength(2);
    expect(line[1].items[0].prompt).toContain("Corrected quiz");

    const adopted = await post(
      edge,
      "/live/drafts/adopt",
      { candidate: line[1].candidate },
      cookie,
    );
    expect(adopted.status).toBe(200);
    const after = await until(
      () => questionsOf(questionnaire),
      (rows) => rows.length === 2 && rows[0].prompt.includes("Corrected quiz"),
    );
    expect(after).toHaveLength(2);
    expect(after[0].question).toBe(before[0].question);
    expect(after[1].question).toBe(before[1].question);
    expect(after.map((entry) => entry.position)).toEqual([1, 2]);
  });

  test("a refinement grows the questionnaire when the draft carries more", async () => {
    const created = await json(
      await post(
        edge,
        "/live/quizzes/create",
        { title: "Short quiz", form: "quiz", disclosure: "score" },
        cookie,
      ),
    );
    const questionnaire = created.questionnaire as string;
    await post(
      edge,
      "/live/quizzes/add-question",
      { questionnaire, prompt: "Only question?", expected: "Yes" },
      cookie,
    );
    const before = await questionsOf(questionnaire);

    const refined = await json(await post(edge, "/live/drafts/refine", { questionnaire }, cookie));
    let line = await lineOf(refined.brief as string);
    await post(
      edge,
      "/live/drafts/correct",
      { candidate: line[0].candidate, request: "Add another question" },
      cookie,
    );
    await serveReasoner(edge);
    line = await lineOf(refined.brief as string);
    await post(edge, "/live/drafts/adopt", { candidate: line[1].candidate }, cookie);
    const after = await until(
      () => questionsOf(questionnaire),
      (rows) => rows.length === 2,
    );
    expect(after[0].question).toBe(before[0].question);
    expect(after.map((entry) => entry.position)).toEqual([1, 2]);
  });

  test("a refinement keeps the questionnaire's form", async () => {
    const questionnaire = await buildQuiz(edge, cookie, "score");
    const refined = await json(await post(edge, "/live/drafts/refine", { questionnaire }, cookie));
    let line = await lineOf(refined.brief as string);
    await post(
      edge,
      "/live/drafts/correct",
      { candidate: line[0].candidate, request: "Make this a survey instead" },
      cookie,
    );
    await serveReasoner(edge);
    line = await lineOf(refined.brief as string);
    expect(line[1].items[0].prompt).toContain("Corrected survey");
    const denied = await post(edge, "/live/drafts/adopt", { candidate: line[1].candidate }, cookie);
    expect(denied.status).toBeGreaterThanOrEqual(400);

    // The questionnaire is untouched, and the line stays open to correct again.
    expect(await questionsOf(questionnaire)).toHaveLength(2);
    await post(
      edge,
      "/live/drafts/correct",
      { candidate: line[1].candidate, request: "Make it a quiz again" },
      cookie,
    );
    await serveReasoner(edge);
    line = await lineOf(refined.brief as string);
    const adopted = await post(
      edge,
      "/live/drafts/adopt",
      { candidate: line[2].candidate },
      cookie,
    );
    expect(adopted.status).toBe(200);
  });

  test("refining is refused while a run is open and once retired", async () => {
    const questionnaire = await buildQuiz(edge, cookie, "score");
    const launch = await json(await post(edge, "/live/runs/launch", { questionnaire }, cookie));
    const midRun = await post(edge, "/live/drafts/refine", { questionnaire }, cookie);
    expect(midRun.status).toBeGreaterThanOrEqual(400);
    await post(edge, "/live/runs/close", { run: launch.run }, cookie);
    await post(edge, "/live/quizzes/retire", { questionnaire }, cookie);
    const retired = await post(edge, "/live/drafts/refine", { questionnaire }, cookie);
    expect(retired.status).toBeGreaterThanOrEqual(400);
    const missing = await post(edge, "/live/drafts/refine", { questionnaire: "no-such" }, cookie);
    expect(missing.status).toBeGreaterThanOrEqual(400);
  });
});

describe("many participants at once", () => {
  let edge: Edge;
  let cookie: string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    ({ cookie } = await registerHost(edge));
  });

  afterAll(stopTestDb);

  test("forty devices join, answer, and hand in concurrently; the board counts every one", async () => {
    const questionnaire = await buildQuiz(edge, cookie, "score");
    const launch = await json(await post(edge, "/live/runs/launch", { questionnaire }, cookie));
    const run = launch.run as string;
    const token = launch.token as string;

    const face = await json(await post(edge, "/live/p/arrive", { token }));
    const questions = (face.face as { questions: { question: string }[] }).questions;

    const participants = Array.from({ length: 40 }, (_value, index) => `device-${index}`);
    const outcomes = await Promise.all(
      participants.map(async (device, index) => {
        const begun = await json(await post(edge, "/live/p/begin", { token, device }));
        const response = begun.response as string;
        // Half the room answers correctly; the other half misses the first question.
        const first = index % 2 === 0 ? "Carbon dioxide" : "Oxygen";
        await post(edge, "/live/p/answer", {
          response,
          question: questions[0].question,
          value: first,
        });
        await post(edge, "/live/p/answer", {
          response,
          question: questions[1].question,
          value: "Chlorophyll",
        });
        const submitted = await post(edge, "/live/p/submit", { response });
        return { response, submitted: submitted.status };
      }),
    );
    expect(outcomes.every((entry) => entry.submitted === 200)).toBe(true);
    expect(new Set(outcomes.map((entry) => entry.response)).size).toBe(40);

    const results = await until(
      async () => {
        const read = await json(await post(edge, "/live/runs/results", { run }, cookie));
        return read as {
          board: { started: number; handedIn: number };
          scores: { results: { score: number }[] } | undefined;
        };
      },
      (read) => (read.scores?.results.length ?? 0) === 40,
    );
    expect(results.board.started).toBe(40);
    expect(results.board.handedIn).toBe(40);
    const scores = (results.scores as { results: { score: number }[] }).results.map(
      (entry) => entry.score,
    );
    expect(scores.filter((score) => score === 2)).toHaveLength(20);
    expect(scores.filter((score) => score === 1)).toHaveLength(20);
  });
});
