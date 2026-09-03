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
    const code = launch.code as string;
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const located = await json(
      await post(edge, "/live/p/locate", { code: `  ${code.toLowerCase()}  ` }),
    );
    expect(located.token).toBe(token);

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
      receipt: {
        prompt: string;
        kind: "graded" | "reference" | "ungraded";
        standard: string;
        value: string;
      }[];
    };
    expect(formed.disclosure).toBe("answers");
    // The written question keeps a reference, so it widens neither the score
    // nor what it is out of.
    expect(formed.score).toBe(1);
    expect(formed.outOf).toBe(1);
    expect(formed.receipt).toHaveLength(2);
    expect(formed.receipt[0]).toMatchObject({
      kind: "graded",
      standard: "Carbon dioxide",
      value: "Carbon dioxide",
    });
    expect(formed.receipt[1]).toEqual(
      expect.objectContaining({
        prompt: "Name the light-capturing pigment.",
        kind: "reference",
        standard: "Chlorophyll",
        value: "Chlorophyll",
      }),
    );
    expect(JSON.stringify(formed)).not.toContain("Photosynthesis fixes carbon.");

    // The staff board carries the handed-in values and the score.
    const results = await json(await post(edge, "/live/runs/results", { run }, cookie));
    const board = results.board as { started: number; handedIn: number; questions: unknown[] };
    expect(board.started).toBe(1);
    expect(board.handedIn).toBe(1);
    const scores = results.scores as { results: { score: number; outOf: number }[] };
    expect(scores.results).toEqual([expect.objectContaining({ score: 1, outOf: 1 })]);

    // The open-runs shelf lists it; closing removes it and ends participation.
    const open = await json(await post(edge, "/live/runs/open", {}, cookie));
    expect(JSON.stringify(open)).toContain(run);
    await post(edge, "/live/runs/close", { run }, cookie);
    const closedLocation = await json(await post(edge, "/live/p/locate", { code }));
    expect(closedLocation.token).toBe(token);
    const closedFace = await json(await post(edge, "/live/p/arrive", { token }));
    expect((closedFace.face as { open: boolean }).open).toBe(false);

    // Closing makes the source editable for a future class, but this edition's
    // face, board, and receipt remain exactly what participants received.
    await post(
      edge,
      "/live/quizzes/revise-question",
      {
        question: questions[0].question,
        prompt: "A changed prompt?",
        choices: ["Oxygen", "Carbon dioxide"],
        expected: "Oxygen",
        explanation: "A changed explanation.",
        position: 1,
      },
      cookie,
    );
    await post(edge, "/live/quizzes/remove-question", { question: questions[1].question }, cookie);
    await post(edge, "/live/quizzes/retitle", { questionnaire, title: "A changed title" }, cookie);

    const historicalFace = await json(await post(edge, "/live/p/arrive", { token }));
    expect(historicalFace.face).toMatchObject({
      title: "Photosynthesis check",
      questions: [
        { prompt: "Which gas do plants take in?" },
        { prompt: "Name the light-capturing pigment." },
      ],
    });
    const historicalOutcome = await json(await post(edge, "/live/p/outcome", { response }));
    expect((historicalOutcome.outcome as typeof formed).receipt).toEqual(formed.receipt);
    expect((historicalOutcome.outcome as typeof formed).score).toBe(1);
    const historicalResults = await json(await post(edge, "/live/runs/results", { run }, cookie));
    expect(historicalResults.board).toMatchObject({
      title: "Photosynthesis check",
      questions: [
        { prompt: "Which gas do plants take in?", expected: "Carbon dioxide" },
        { prompt: "Name the light-capturing pigment.", expected: "Chlorophyll" },
      ],
    });
    const lateBegin = await post(edge, "/live/p/begin", { token, device: "phone-2" });
    expect(lateBegin.status).toBe(409);
  });

  test("a concurrent launch and edit release one coherent version for every run artifact", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const questionnaire = await buildQuiz(edge, cookie, "explanations");
      const authored = await json(await post(edge, "/live/quizzes/get", { questionnaire }, cookie));
      const question = (authored.questionnaire as { questions: { question: string }[] })
        .questions[0].question;
      await post(
        edge,
        "/live/quizzes/revise-question",
        {
          question,
          prompt: "Unready prompt",
          choices: [],
          expected: "A written reference",
          explanation: "Unready explanation",
        },
        cookie,
      );
      const revised = {
        prompt: `Concurrent prompt ${attempt}`,
        choices: ["New A", "New B"],
        expected: "New B",
        explanation: `Concurrent explanation ${attempt}`,
      };

      const [launchResponse] = await Promise.all([
        post(edge, "/live/runs/launch", { questionnaire }, cookie),
        post(edge, "/live/quizzes/revise-question", { question, ...revised }, cookie),
      ]);
      expect([200, 409]).toContain(launchResponse.status);
      const raced = await json(launchResponse);
      let launch = raced;
      if (launchResponse.status === 409) {
        expect(raced.error).toBe("CONFLICT");
        const open = await json(await post(edge, "/live/runs/open", {}, cookie));
        expect(JSON.stringify(open)).not.toContain(questionnaire);
        launch = await json(await post(edge, "/live/runs/launch", { questionnaire }, cookie));
      }
      const run = launch.run as string;

      const [snapshotRow] = await edge.application.concepts.RunSnapshotting._snapshot({
        subject: run,
      });
      const presentation = snapshotRow.value as {
        disclosure: string;
        questions: {
          item: string;
          prompt: string;
          choices: string[];
          expected: string;
          explanation: string;
          parts: string[];
          cap: number;
          position: number;
        }[];
      };
      const captured = presentation.questions.find(({ item }) => item === question);
      expect(captured).toMatchObject(revised);

      const [key] = await edge.application.concepts.Scoring._keyFor({ subject: run });
      expect(key.disclosure).toBe(presentation.disclosure);
      expect(await edge.application.concepts.Scoring._expectations({ key: key.key })).toEqual(
        presentation.questions
          .filter(({ choices, expected }) => choices.length > 0 && expected !== "")
          .map(({ item, expected, explanation }) => ({ item, expected, explanation })),
      );

      const arrived = await json(await post(edge, "/live/p/arrive", { token: launch.token }));
      expect((arrived.face as { questions: unknown[] }).questions).toEqual(
        presentation.questions.map(({ item, prompt, choices, parts, cap, position }) => ({
          question: item,
          prompt,
          parts,
          cap,
          choices,
          position,
        })),
      );
      await post(edge, "/live/runs/close", { run }, cookie);
    }
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

  test("a quiz with no proposed answers cannot launch; a signed-in participant binds to the account", async () => {
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

    // A written answer's expected is a reference, not a proposal, so the quiz
    // is no readier for carrying one.
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
    const stillRefused = await post(edge, "/live/runs/launch", { questionnaire }, cookie);
    expect(stillRefused.status).toBe(409);

    // Offer the choices, and the question proposes its answer; launch, and join
    // with the host's own session.
    await post(
      edge,
      "/live/quizzes/revise-question",
      {
        question,
        prompt: "Open question?",
        choices: ["41", "42"],
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

  test("a written answer is read against its reference, at the levels that reveal answers", async () => {
    const outcomeAt = async (disclosure: string) => {
      const created = await json(
        await post(
          edge,
          "/live/quizzes/create",
          { title: `Mixed quiz (${disclosure})`, form: "quiz", disclosure },
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
          prompt: "How was the pace?",
          choices: ["Too fast", "Just right"],
          expected: "",
          explanation: "",
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
          explanation: "It absorbs red and blue light.",
        },
        cookie,
      );
      const launch = await json(await post(edge, "/live/runs/launch", { questionnaire }, cookie));
      const token = launch.token as string;
      const face = await json(await post(edge, "/live/p/arrive", { token }));
      const questions = (face.face as { questions: { question: string }[] }).questions;
      const begun = await json(
        await post(edge, "/live/p/begin", { token, device: `phone-${disclosure}` }),
      );
      const response = begun.response as string;
      // The choices are answered as expected; the written answer is not.
      await post(edge, "/live/p/answer", {
        response,
        question: questions[0].question,
        value: "Carbon dioxide",
      });
      await post(edge, "/live/p/answer", {
        response,
        question: questions[1].question,
        value: "Just right",
      });
      await post(edge, "/live/p/answer", {
        response,
        question: questions[2].question,
        value: "chloroplast",
      });
      await post(edge, "/live/p/submit", { response });
      const settled = await until(
        async () => json(await post(edge, "/live/p/outcome", { response })),
        (read) => {
          const formed = read.outcome as { score: number | null } | undefined;
          return formed !== undefined && formed.score !== null;
        },
      );
      await post(edge, "/live/runs/close", { run: launch.run }, cookie);
      return settled.outcome as {
        score: number;
        outOf: number;
        receipt?: {
          prompt: string;
          kind: "graded" | "reference" | "ungraded";
          standard: string;
          value: string;
          explanation?: string;
        }[];
      };
    };

    const scored = await outcomeAt("score");
    expect(scored.score).toBe(1);
    expect(scored.outOf).toBe(1);
    expect(scored.receipt).toBeUndefined();

    const answered = await outcomeAt("answers");
    expect(answered.score).toBe(1);
    expect(answered.outOf).toBe(1);
    expect(answered.receipt).toEqual([
      expect.objectContaining({
        kind: "graded",
        standard: "Carbon dioxide",
        value: "Carbon dioxide",
      }),
      expect.objectContaining({
        prompt: "How was the pace?",
        kind: "ungraded",
        standard: "",
        value: "Just right",
      }),
      expect.objectContaining({
        prompt: "Name the light-capturing pigment.",
        kind: "reference",
        standard: "Chlorophyll",
        value: "chloroplast",
      }),
    ]);
    expect(JSON.stringify(answered)).not.toContain("It absorbs red and blue light.");

    const explained = await outcomeAt("explanations");
    expect(explained.score).toBe(1);
    expect(explained.receipt).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "reference",
          standard: "Chlorophyll",
          value: "chloroplast",
          explanation: "It absorbs red and blue light.",
        }),
      ]),
    );
  });

  test("an empty device identity cannot begin a response", async () => {
    const questionnaire = await buildQuiz(edge, cookie, "score");
    const launch = await json(await post(edge, "/live/runs/launch", { questionnaire }, cookie));
    const token = launch.token as string;
    const blank = await post(edge, "/live/p/begin", { token, device: "" });
    expect(blank.status).toBe(400);
    const spaces = await post(edge, "/live/p/begin", { token, device: "   " });
    expect(spaces.status).toBe(400);
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
      abandoned: boolean;
      root: string;
      rootAuthor: string;
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
    const adoptedQuestionnaire = whole.questionnaire as {
      title: string;
      questions: { prompt: string }[];
    };
    expect(adoptedQuestionnaire.title).toBe("AI-generated quiz");
    expect(adoptedQuestionnaire.title).not.toContain("photosynthesis");
    const questions = adoptedQuestionnaire.questions;
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
    const abandonAdopted = await post(edge, "/live/drafts/abandon", { brief }, cookie);
    expect(abandonAdopted.status).toBe(409);
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

  test("a clarifying question answering a correction is repaired without author action", async () => {
    const described = await json(
      await post(edge, "/live/drafts/describe", { request: "A short quiz about tides" }, cookie),
    );
    const brief = described.brief as string;
    await serveReasoner(edge);
    let line = await lineOf(brief);
    expect(line[0].candidate).not.toBeNull();

    // The correction provokes a clarifying question; the form was settled when
    // the line began, so the composition stands on the reply and the repair
    // loop returns a draft with no author involvement.
    await post(
      edge,
      "/live/drafts/correct",
      { candidate: line[0].candidate, request: "make it ambiguous somehow" },
      cookie,
    );
    await serveReasoner(edge);
    line = await lineOf(brief);
    expect(line).toHaveLength(2);
    expect(line[1].clarifying).toBe(false);
    expect(line[1].candidate).not.toBeNull();
    expect(line[1].items[0].prompt).toContain("Repaired quiz");
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

  test("an abandoned line retains its history but ignores a late reasoner reply", async () => {
    const described = await json(
      await post(edge, "/live/drafts/describe", { request: "A short quiz about light" }, cookie),
    );
    const root = described.brief as string;
    await serveReasoner(edge);
    let line = await lineOf(root);
    const firstCandidate = line[0].candidate as string;

    const corrected = await json(
      await post(
        edge,
        "/live/drafts/correct",
        { candidate: firstCandidate, request: "Make it more concise" },
        cookie,
      ),
    );
    const correction = corrected.brief as string;
    const abandoned = await json(
      await post(edge, "/live/drafts/abandon", { brief: correction }, cookie),
    );
    expect(abandoned.brief).toBe(root);

    line = await lineOf(root);
    expect(line).toHaveLength(2);
    expect(line[1]).toMatchObject({
      root,
      abandoned: true,
      candidate: null,
    });

    // The already-issued ask may still be answered, but its reply cannot
    // advance an abandoned line.
    await serveReasoner(edge);
    line = await lineOf(root);
    expect(line[1].candidate).toBeNull();

    expect(
      await post(
        edge,
        "/live/drafts/correct",
        { candidate: firstCandidate, request: "Try again" },
        cookie,
      ),
    ).toHaveProperty("status", 409);
    expect(
      await post(edge, "/live/drafts/adopt", { candidate: firstCandidate }, cookie),
    ).toHaveProperty("status", 409);
    expect(await post(edge, "/live/drafts/abandon", { brief: root }, cookie)).toHaveProperty(
      "status",
      409,
    );
  });

  test("abandoning a repair closes its unsettled insistence", async () => {
    const described = await json(
      await post(edge, "/live/drafts/describe", { request: "one unreadable reply" }, cookie),
    );
    const root = described.brief as string;
    await serveOnePass(edge.application.concepts.Reasoning, () => Promise.resolve("not json"));
    await until(
      async () => await edge.application.concepts.Insisting._unsettledFor({ aim: root }),
      (rows) => rows.length === 1,
    );

    await post(edge, "/live/drafts/abandon", { brief: root }, cookie);
    const unsettled = await until(
      async () => await edge.application.concepts.Insisting._unsettledFor({ aim: root }),
      (rows) => rows.length === 0,
    );
    expect(unsettled).toEqual([]);
  });

  test("only the root author may abandon, and clarification cannot resume afterward", async () => {
    const described = await json(
      await post(edge, "/live/drafts/describe", { request: "Something ambiguous" }, cookie),
    );
    const root = described.brief as string;
    await serveReasoner(edge);
    const line = await lineOf(root);
    const clarification = line[0].clarifications.find((entry) => entry.answer === null);
    expect(clarification).toBeDefined();

    const other = await registerHost(edge, {
      username: "pat",
      password: "pw-pat-123",
      displayName: "Professor Pat",
      email: "pat@example.com",
    });
    const denied = await post(edge, "/live/drafts/abandon", { brief: root }, other.cookie);
    expect(denied.status).toBe(403);

    await post(edge, "/live/drafts/abandon", { brief: root }, cookie);
    const resumed = await post(
      edge,
      "/live/drafts/clarify",
      { clarification: clarification?.clarification, answer: "A quiz" },
      cookie,
    );
    expect(resumed.status).toBe(409);
    expect((await lineOf(root))[0]).toMatchObject({ abandoned: true, clarifying: true });
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
    expect(atTop.status).toBe(409);
    const atBottom = await post(
      edge,
      "/live/quizzes/lower-question",
      { question: questions[1].question },
      cookie,
    );
    expect(atBottom.status).toBe(409);

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
    expect(missing.status).toBe(404);
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

  test("an empty questionnaire can adopt its first AI-generated questions", async () => {
    const created = await json(
      await post(
        edge,
        "/live/quizzes/create",
        { title: "Empty quiz", form: "quiz", disclosure: "score" },
        cookie,
      ),
    );
    const questionnaire = created.questionnaire as string;

    const refined = await json(await post(edge, "/live/drafts/refine", { questionnaire }, cookie));
    let line = await lineOf(refined.brief as string);
    expect(line[0].items).toHaveLength(0);

    await post(
      edge,
      "/live/drafts/correct",
      { candidate: line[0].candidate, request: "Add two questions about photosynthesis" },
      cookie,
    );
    await serveReasoner(edge);
    line = await lineOf(refined.brief as string);
    expect(line[1].items).toHaveLength(2);

    const adopted = await post(
      edge,
      "/live/drafts/adopt",
      { candidate: line[1].candidate },
      cookie,
    );
    expect(adopted.status).toBe(200);
    const after = await until(
      () => questionsOf(questionnaire),
      (rows) => rows.length === 2,
    );
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
    expect(denied.status).toBe(409);

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
    expect(midRun.status).toBe(409);
    await post(edge, "/live/runs/close", { run: launch.run }, cookie);
    await post(edge, "/live/quizzes/retire", { questionnaire }, cookie);
    const retired = await post(edge, "/live/drafts/refine", { questionnaire }, cookie);
    expect(retired.status).toBe(409);
    const missing = await post(edge, "/live/drafts/refine", { questionnaire: "no-such" }, cookie);
    expect(missing.status).toBe(404);
  });
});

describe("a line left can be found again", () => {
  let edge: Edge;
  let cookie: string;
  let user: string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    ({ user, cookie } = await registerHost(edge));
  });

  afterAll(stopTestDb);

  const candidateOf = async (brief: string) => {
    const line = (await json(await post(edge, "/live/drafts/line", { brief }, cookie))).line as {
      candidate: string | null;
      composed: string | null;
    }[];
    return line[0];
  };

  const linesOf = async () =>
    (await json(await post(edge, "/live/drafts/lines", {}, cookie))).lines as {
      brief: string;
      request: string;
      adopted: boolean;
      stalled: boolean;
      clarifying: boolean;
      abandoned: boolean;
      rootAuthor: string;
      refines: string | null;
      refinesTitle: string | null;
      composed: string | null;
      composedTitle: string | null;
    }[];

  const provenanceOf = async (questionnaire: string) =>
    (await json(await post(edge, "/live/drafts/provenance", { questionnaire }, cookie)))
      .provenance as {
      composed: { brief: string; request: string }[];
      refined: {
        brief: string;
        author: string;
        rootAuthor: string;
        adopted: boolean;
        abandoned: boolean;
        stalled: boolean;
      }[];
    };

  test("the author's lines say where each stands, before and after adoption", async () => {
    const described = await json(
      await post(edge, "/live/drafts/describe", { request: "A quiz about photosynthesis" }, cookie),
    );
    await serveReasoner(edge);
    const questionnaire = await buildQuiz(edge, cookie, "score");
    const refined = await json(await post(edge, "/live/drafts/refine", { questionnaire }, cookie));

    let lines = await linesOf();
    expect(lines.map((row) => row.brief)).toEqual([refined.brief, described.brief]);
    expect(lines[0]).toMatchObject({
      refines: questionnaire,
      refinesTitle: "Photosynthesis check",
      composed: null,
      adopted: false,
      stalled: false,
      clarifying: false,
    });
    expect(lines[1]).toMatchObject({
      request: "A quiz about photosynthesis",
      refines: null,
      composed: null,
      adopted: false,
    });

    const step = await candidateOf(described.brief as string);
    await post(edge, "/live/drafts/adopt", { candidate: step.candidate }, cookie);
    lines = await until(linesOf, (rows) => rows[1]?.composed !== null);
    expect(lines[1]).toMatchObject({
      adopted: true,
      composedTitle: "AI-generated quiz",
    });
    expect(lines[0].adopted).toBe(false);
  });

  test("a stalled line and a waiting line both read as unfinished", async () => {
    const stalling = await json(
      await post(edge, "/live/drafts/describe", { request: "hopeless case" }, cookie),
    );
    const hopelessMind = () => Promise.resolve("never valid json");
    for (let round = 0; round < 6; round += 1) {
      const served = await serveOnePass(edge.application.concepts.Reasoning, hopelessMind);
      if (served === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const asking = await json(
      await post(edge, "/live/drafts/describe", { request: "Something ambiguous here" }, cookie),
    );
    await serveReasoner(edge);

    const lines = await until(
      linesOf,
      (rows) =>
        rows.find((row) => row.brief === stalling.brief)?.stalled === true &&
        rows.find((row) => row.brief === asking.brief)?.clarifying === true,
    );
    expect(lines.find((row) => row.brief === stalling.brief)).toMatchObject({
      stalled: true,
      adopted: false,
    });
    expect(lines.find((row) => row.brief === asking.brief)).toMatchObject({
      clarifying: true,
      stalled: false,
      adopted: false,
    });
  });

  test("abandoned refinements leave unfinished work but remain in provenance", async () => {
    const questionnaire = await buildQuiz(edge, cookie, "score");
    const refined = await json(await post(edge, "/live/drafts/refine", { questionnaire }, cookie));
    const brief = refined.brief as string;

    const abandoned = await json(await post(edge, "/live/drafts/abandon", { brief }, cookie));
    expect(abandoned.brief).toBe(brief);

    const lines = await linesOf();
    expect(lines.find((row) => row.brief === brief)).toMatchObject({
      abandoned: true,
      rootAuthor: user,
      adopted: false,
    });
    const provenance = await provenanceOf(questionnaire);
    expect(provenance.refined.find((row) => row.brief === brief)).toMatchObject({
      abandoned: true,
      rootAuthor: user,
      adopted: false,
    });
  });

  test("provenance answers the line that composed a questionnaire and every line since", async () => {
    const described = await json(
      await post(edge, "/live/drafts/describe", { request: "A quiz about tides" }, cookie),
    );
    await serveReasoner(edge);
    const step = await candidateOf(described.brief as string);
    await post(edge, "/live/drafts/adopt", { candidate: step.candidate }, cookie);
    const adopted = await until(
      () => candidateOf(described.brief as string),
      (row) => row.composed !== null,
    );
    const questionnaire = adopted.composed as string;

    const refined = await json(await post(edge, "/live/drafts/refine", { questionnaire }, cookie));
    const provenance = await provenanceOf(questionnaire);
    expect(provenance.composed).toHaveLength(1);
    expect(provenance.composed[0]).toMatchObject({
      brief: described.brief,
      request: "A quiz about tides",
    });
    expect(provenance.refined).toHaveLength(1);
    expect(provenance.refined[0]).toMatchObject({
      brief: refined.brief,
      author: user,
      adopted: false,
      stalled: false,
    });

    const handMade = await buildQuiz(edge, cookie, "score");
    expect(await provenanceOf(handMade)).toEqual({ composed: [], refined: [] });
  });

  test("permissions gate both reads", async () => {
    const lines = await post(edge, "/live/drafts/lines", {});
    expect(lines.status).toBeGreaterThanOrEqual(400);
    const provenance = await post(edge, "/live/drafts/provenance", { questionnaire: "no-such" });
    expect(provenance.status).toBeGreaterThanOrEqual(400);
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
        return {
          board: read.board as { started: number; handedIn: number },
          scores: read.scores as { results: { score: number }[] } | undefined,
        };
      },
      (read) => (read.scores?.results.length ?? 0) === 40,
    );
    expect(results.board.started).toBe(40);
    expect(results.board.handedIn).toBe(40);
    const scores = (results.scores as { results: { score: number }[] }).results.map(
      (entry) => entry.score,
    );
    // The written question is out of the key, so the choice question alone
    // separates the room.
    expect(scores.filter((score) => score === 1)).toHaveLength(20);
    expect(scores.filter((score) => score === 0)).toHaveLength(20);
  });
});
