import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { SAMPLING_OPENING } from "../../src/computations/live-sampling.ts";
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

interface Person {
  username: string;
  password: string;
  displayName: string;
  email: string;
}

async function register(edge: Edge, person: Person, hosts: boolean) {
  const registered = await edge.application.concepts.Authenticating.register(person);
  await edge.application.concepts.Profiling.createProfile({
    user: registered.user,
    displayName: person.displayName,
  });
  if (hosts) {
    const { role } = await edge.application.concepts.Roling.ensureRole({
      name: "live-host",
      capabilities: ["live:host"],
    });
    await edge.application.concepts.Roling.assign({
      user: registered.user,
      context: "commons",
      role,
    });
  }
  const login = await post(edge, "/auth/login", {
    username: person.username,
    password: person.password,
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

interface Sample {
  asking: string;
  answeredAt: string;
  standing: string;
  answers: { value: string; pile: string }[];
}

interface Reading {
  sample: Sample | null;
  pending: boolean;
  failure: string | null;
  failedAt: string | null;
}

describe("sampling a round in the editor", () => {
  let edge: Edge;
  let cookie: string;
  let stranger: string;
  let relay: string;
  let write: string;
  let taking: string;
  let crashes: string;

  const readSample = async (leg: string) =>
    (await json(await post(edge, "/live/rounds/sample", { leg }, cookie))) as unknown as Reading;

  const askFor = async (leg: string) => {
    const response = await post(edge, "/live/rounds/sample-answers", { leg }, cookie);
    const body = (await response.json()) as { asked?: boolean; asking?: string; error?: string };
    return { status: response.status, ...body };
  };

  const passageAbout = async (leg: string) =>
    (await edge.application.concepts.Reasoning._pending()).find((ask) => ask.about === leg)
      ?.passage ?? "";

  /** Answers every ask the reasoner holds with the deterministic scripted mind. */
  const serveReasoner = async () => {
    const mind = scriptedMind();
    for (let pass = 0; pass < 4; pass += 1) {
      if ((await serveOnePass(edge.application.concepts.Reasoning, mind)) === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  /** Asks for a sample, serves it, and waits for the fresh sample to read back. */
  const sampleAndServe = async (leg: string) => {
    expect((await askFor(leg)).asked).toBe(true);
    await serveReasoner();
    return await until(
      async () => await readSample(leg),
      (reading) => reading.pending === false && reading.sample !== null,
    );
  };

  /** The piles a sample names, each once, in the order they are first placed in. */
  const namesOf = (sample: Sample) => [...new Set(sample.answers.map((answer) => answer.pile))];

  const addRound = async (title: string, prompt: string) =>
    (
      await json(
        await post(
          edge,
          "/live/relays/add-round",
          { relay, title, prompt, parts: [], cap: 0, choices: [] },
          cookie,
        ),
      )
    ).leg as string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    cookie = await register(
      edge,
      {
        username: "nadia",
        password: "pw-nadia-123",
        displayName: "Professor Nadia",
        email: "nadia@example.com",
      },
      true,
    );
    stranger = await register(
      edge,
      {
        username: "wes",
        password: "pw-wes-123",
        displayName: "Wes",
        email: "wes@example.com",
      },
      false,
    );
    relay = (
      await json(await post(edge, "/live/relays/plan", { title: "What went wrong" }, cookie))
    ).relay as string;
    write = await addRound("The bug", "What went wrong the last time an app failed you?");
    await post(
      edge,
      "/live/rounds/add-pile",
      { leg: write, name: "Pace", description: "It was too slow to use." },
      cookie,
    );
    crashes = (
      await json(
        await post(
          edge,
          "/live/rounds/add-pile",
          { leg: write, name: "Crashes", description: "It stopped working outright." },
          cookie,
        ),
      )
    ).pile as string;
    await post(
      edge,
      "/live/rounds/set-notes",
      { leg: write, body: "Group by what went wrong, not by which app." },
      cookie,
    );
    taking = await addRound("The worst of them", "Which of these bothers you most?");
    const takes = await json(
      await post(
        edge,
        "/live/relays/set-takes",
        { leg: taking, source: write, use: "choices" },
        cookie,
      ),
    );
    expect(takes.draw).toBeDefined();
  }, 60_000);

  afterAll(stopTestDb);

  test("before any ask a round has no sample, and nothing is out", async () => {
    expect(await readSample(write)).toEqual({
      sample: null,
      pending: false,
      failure: null,
      failedAt: null,
    });
  });

  test("a round taking choices from a source with no sample is refused rather than asked", async () => {
    const refused = await askFor(taking);
    expect(refused.status).toBe(409);
    expect(refused.error).toBe("CONFLICT");
    expect(await passageAbout(taking)).toBe("");
  });

  test("the ask carries the round's piles and its note, and a second press asks nothing", async () => {
    const asked = await askFor(write);
    expect(asked.asked).toBe(true);
    expect(typeof asked.asking).toBe("string");

    const passage = await passageAbout(write);
    expect(passage.startsWith(SAMPLING_OPENING)).toBe(true);
    expect(passage).toContain("What went wrong the last time an app failed you?");
    expect(passage).toContain("The piles as they stand:\n- Pace: It was too slow to use.");
    expect(passage).toContain("- Crashes: It stopped working outright.");
    expect(passage).toContain("The author's notes:\nGroup by what went wrong, not by which app.");

    // While the ask is out, a second press asks nothing and the editor waits.
    expect((await askFor(write)).asked).toBe(false);
    const waiting = await readSample(write);
    expect(waiting.pending).toBe(true);
    expect(waiting.sample).toBe(null);
  });

  test("the served sample is twelve answers on piles the round already stands on", async () => {
    await serveReasoner();
    const reading = await until(
      async () => await readSample(write),
      (found) => found.pending === false && found.sample !== null,
    );
    expect(reading.pending).toBe(false);
    expect(reading.failure).toBe(null);
    const sample = reading.sample!;
    expect(sample.standing).toBe("fresh");
    expect(sample.answers.length).toBe(12);
    expect(sample.answers.every((answer) => answer.value !== "" && answer.pile !== "")).toBe(true);
    expect(namesOf(sample)).toContain("Pace");
    expect(namesOf(sample)).toContain("Crashes");
    expect(typeof sample.asking).toBe("string");
  });

  test("rewriting the note or the question dims the sample, and asking again replaces it", async () => {
    const before = (await readSample(write)).sample!.asking;
    await post(
      edge,
      "/live/rounds/set-notes",
      { leg: write, body: "Group by what went wrong. Slowness is its own pile." },
      cookie,
    );
    expect((await readSample(write)).sample!.standing).toBe("stale");

    const asked = await sampleAndServe(write);
    expect(asked.sample!.standing).toBe("fresh");
    expect(asked.sample!.asking).not.toBe(before);

    await post(
      edge,
      "/live/relays/revise-round",
      {
        leg: write,
        title: "The bug",
        prompt: "What went wrong the last time a phone app failed you?",
        parts: [],
        cap: 0,
        choices: [],
      },
      cookie,
    );
    expect((await readSample(write)).sample!.standing).toBe("stale");

    const again = await sampleAndServe(write);
    expect(again.sample!.standing).toBe("fresh");
  });

  test("the taking round is sampled after its source, on the source's own pile names", async () => {
    const source = (await readSample(write)).sample!;
    const carried = namesOf(source);
    expect(carried.length).toBeGreaterThan(1);

    expect((await askFor(taking)).asked).toBe(true);
    const passage = await passageAbout(taking);
    const offered = passage.split("Choose from: ")[1]?.split("\n")[0] ?? "";
    expect(offered.split(" | ")).toEqual(carried);
    expect(passage).toContain(source.answers[0]!.value);

    await serveReasoner();
    const reading = await until(
      async () => await readSample(taking),
      (found) => found.pending === false && found.sample !== null,
    );
    const sample = reading.sample!;
    expect(sample.standing).toBe("fresh");
    expect(sample.answers.length).toBe(12);
    expect(sample.answers.every((answer) => carried.includes(answer.value))).toBe(true);
  });

  test("re-sampling identical answers stays fresh until a carried name changes", async () => {
    // The note shapes the source's own passage, but the names its sample lands
    // on do not move, so what the taking round carries is the same as before.
    await post(
      edge,
      "/live/rounds/set-notes",
      { leg: write, body: "Group by what went wrong. Crashing is its own pile." },
      cookie,
    );
    const before = namesOf((await sampleAndServe(write)).sample!);
    expect((await readSample(taking)).sample!.standing).toBe("fresh");

    // Renaming a standing pile does move them, so the taking round goes stale.
    await post(edge, "/live/rounds/rename-pile", { pile: crashes, name: "Quits" }, cookie);
    const after = namesOf((await sampleAndServe(write)).sample!);
    expect(after).toContain("Quits");
    expect(after).not.toEqual(before);
    expect((await readSample(taking)).sample!.standing).toBe("stale");
  });

  test("changing source answer text with identical pile names makes the dependent sample stale", async () => {
    await sampleAndServe(taking);
    const before = (await readSample(write)).sample!;
    expect((await askFor(write)).asked).toBe(true);
    const asking = (await edge.application.concepts.Reasoning._pending()).find(
      (ask) => ask.about === write,
    )!.asking;
    await edge.application.concepts.Reasoning.answer({
      asking,
      reply: JSON.stringify({
        kind: "sampled",
        answers: before.answers.map((answer, index) => ({
          ...answer,
          value: index === 0 ? "A new scenario with the same pile name." : answer.value,
        })),
      }),
      at: new Date(),
    });
    expect(namesOf((await readSample(write)).sample!)).toEqual(namesOf(before));
    expect((await readSample(taking)).sample!.standing).toBe("stale");
  });

  test("a sample taking context from an inferred vote does not receive ballots as narrative", async () => {
    const vote = (await sampleAndServe(taking)).sample!;
    const follow = await addRound("Plan together", "Propose a shared activity from these groups.");
    await post(
      edge,
      "/live/relays/set-takes",
      { leg: follow, source: taking, use: "context" },
      cookie,
    );
    expect((await askFor(follow)).asked).toBe(true);
    const passage = await passageAbout(follow);
    for (const name of namesOf(vote)) {
      expect(passage).toContain(`\n- ${name}`);
      expect(passage).not.toContain(`\n  - ${name}`);
    }
    await serveReasoner();
  });

  test("a reply the reading cannot make out is a sample of no answers", async () => {
    const muddle = await addRound("The muddle", "What would you change first?");
    expect((await askFor(muddle)).asked).toBe(true);
    const pending = await edge.application.concepts.Reasoning._pending();
    const asking = pending.find((ask) => ask.about === muddle)!.asking;
    await edge.application.concepts.Reasoning.answer({
      asking,
      reply: "not json",
      at: new Date(),
    });
    const reading = await readSample(muddle);
    expect(reading.pending).toBe(false);
    expect(reading.sample!.answers).toEqual([]);
    expect(reading.sample!.standing).toBe("fresh");
  });

  test("a round nobody can name, and a reader who cannot host, are turned away", async () => {
    const missingAsk = await post(
      edge,
      "/live/rounds/sample-answers",
      { leg: "no-such-leg" },
      cookie,
    );
    expect(missingAsk.status).toBe(404);
    expect((await json(missingAsk)).error).toBe("NOT_FOUND");
    const missingRead = await post(edge, "/live/rounds/sample", { leg: "no-such-leg" }, cookie);
    expect(missingRead.status).toBe(404);
    expect((await json(missingRead)).error).toBe("NOT_FOUND");

    const forbiddenAsk = await post(edge, "/live/rounds/sample-answers", { leg: write }, stranger);
    expect(forbiddenAsk.status).toBe(403);
    expect((await json(forbiddenAsk)).error).toBe("FORBIDDEN");
    const forbiddenRead = await post(edge, "/live/rounds/sample", { leg: write }, stranger);
    expect(forbiddenRead.status).toBe(403);
    expect((await json(forbiddenRead)).error).toBe("FORBIDDEN");
  });

  test("three dependent write previews generate in sequence", async () => {
    const legs: string[] = [];
    for (let index = 0; index < 3; index++) {
      const leg = await addRound(
        `Preview step ${index + 1}`,
        index === 0
          ? "Describe a technical frustration."
          : "Suggest an improvement to the earlier situations.",
      );
      if (index > 0) {
        const linked = await post(
          edge,
          "/live/relays/set-takes",
          { leg, source: legs[index - 1], use: "context" },
          cookie,
        );
        expect(linked.status).toBe(200);
      }
      legs.push(leg);
    }
    for (const leg of legs) {
      const asked = await askFor(leg);
      expect(asked).toMatchObject({ status: 200, asked: true });
      await serveReasoner();
      const read = await readSample(leg);
      expect(read.sample?.standing).toBe("fresh");
      expect(read.sample?.answers).toHaveLength(12);
    }
  });

  test("a retired relay is asked for nothing more, though its samples still read", async () => {
    await post(edge, "/live/relays/retire", { relay }, cookie);
    const refused = await post(edge, "/live/rounds/sample-answers", { leg: write }, cookie);
    expect(refused.status).toBe(409);
    expect((await json(refused)).error).toBe("CONFLICT");
    const reading = await readSample(write);
    expect(reading.pending).toBe(false);
    expect(reading.sample!.answers.length).toBe(12);
  });
});
