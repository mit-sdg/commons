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

interface RunRead {
  run: {
    run: string;
    open: boolean;
    token: string;
    openRound: string | null;
    modelSorts: boolean;
    rounds: { leg: string; round: string | null }[];
  } | null;
}

let edge: Edge;
let cookie: string;
let relay: string;
let legs: string[];

const readRun = async (run: string) =>
  (await json(await post(edge, "/live/relays/run", { run }, cookie))) as unknown as RunRead;

const launch = async (): Promise<string> => {
  const launched = await json(await post(edge, "/live/relays/launch", { relay }, cookie));
  return launched.run as string;
};

const openRound = async (run: string, leg: string) =>
  json(await post(edge, "/live/relays/open-round", { run, leg }, cookie));

const sort = async (round: string) => json(await post(edge, "/live/walls/sort", { round }, cookie));

const isLocked = (target: string) => edge.application.concepts.Locking._isLocked({ target });

/** Polls a read until it settles, so a reaction's chain is not raced. */
async function until<Value>(read: () => PromiseLike<Value>, done: (value: Value) => boolean) {
  let value = await read();
  for (let attempt = 0; attempt < 40 && !done(value); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    value = await read();
  }
  return value;
}

/** One phone hands the open round in, so a card waits in the tray. */
async function handIn(token: string, device: string, value: string) {
  const face = await json(await post(edge, "/live/p/arrive", { token }));
  const question = (face.relay as unknown as { questions: { question: string }[] }).questions[0]
    ?.question as string;
  const begun = await json(await post(edge, "/live/p/begin", { token, device }));
  await post(edge, "/live/p/answer", { response: begun.response, question, value });
  await post(edge, "/live/p/submit", { response: begun.response });
}

beforeAll(async () => {
  edge = createEdge(mongoImplementations(await testDb()));
  cookie = await registerHost(edge);
  relay = (await json(await post(edge, "/live/relays/plan", { title: "Race" }, cookie)))
    .relay as string;
  legs = [];
  for (const title of ["One word", "Another", "A third"]) {
    const added = await json(
      await post(
        edge,
        "/live/relays/add-round",
        { relay, title, prompt: `${title}?`, parts: [], cap: 0, choices: [] },
        cookie,
      ),
    );
    legs.push(added.leg as string);
  }
});

afterAll(stopTestDb);

describe("two dashboards opening rounds in one instant", () => {
  test("closing during a round's publication cannot leave that round open afterward", async () => {
    const instances = mongoImplementations(await testDb());
    const original = instances.Linking.setLinks.bind(instances.Linking);
    let reached!: () => void;
    let release!: () => void;
    const paused = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      release = resolve;
    });
    instances.Linking.setLinks = async function setLinks({ source, targets }) {
      reached();
      await resume;
      return original({ source, targets });
    };
    const isolated = createEdge(instances);
    const host = await registerHost(isolated);
    const call = (path: string, body: unknown) => post(isolated, path, body, host).then(json);
    const { relay } = await call("/live/relays/plan", { title: "Interrupted opening" });
    const { leg } = await call("/live/relays/add-round", {
      relay,
      title: "One",
      prompt: "Why?",
      parts: [],
      cap: 0,
      choices: [],
    });
    const { run } = await call("/live/relays/launch", { relay });
    const opening = call("/live/relays/open-round", { run, leg });
    await paused;
    try {
      expect((await call("/live/relays/close", { run })).run).toBe(run);
    } finally {
      release();
    }
    const { round } = await opening;
    expect(typeof round).toBe("string");
    const edition = await until(
      () => isolated.application.concepts.Publishing._edition({ edition: round }),
      (rows) => rows[0]?.open === false,
    );
    expect(edition[0].open).toBe(false);
    expect(await isolated.application.concepts.Locking._isLocked({ target: run })).toEqual({
      locked: false,
    });
  });

  test("concurrent launches leave one readable run and one participation token", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () =>
        post(edge, "/live/relays/launch", { relay }, cookie).then(json),
      ),
    );
    const successes = attempts.filter((reply) => typeof reply.run === "string");
    expect(successes).toHaveLength(1);
    expect(attempts.filter((reply) => reply.error === "CONFLICT")).toHaveLength(5);
    const run = successes[0].run;
    expect((await readRun(run)).run?.token).toBe(successes[0].token);
    expect(
      await edge.application.concepts.Publishing._editionsFor({ material: relay }),
    ).toHaveLength(1);
    await post(edge, "/live/relays/close", { run }, cookie);
  });

  test("every trial leaves one round open, refuses the other, and the run still reads", async () => {
    for (let trial = 0; trial < 25; trial += 1) {
      const run = await launch();
      const answers = await Promise.all([
        openRound(run, legs[0]),
        openRound(run, legs[1]),
        openRound(run, legs[2]),
      ]);
      const opened = answers.filter((answer) => typeof answer.round === "string");
      const refused = answers.filter((answer) => answer.error === "CONFLICT");
      expect(opened, `trial ${trial}: ${JSON.stringify(answers)}`).toHaveLength(1);
      expect(refused, `trial ${trial}: ${JSON.stringify(answers)}`).toHaveLength(2);

      const read = await readRun(run);
      expect(read.run?.openRound).toBe(opened[0].round);
      expect(read.run?.rounds.filter((round) => round.round !== null)).toHaveLength(1);

      const closed = await json(
        await post(edge, "/live/relays/close-round", { round: opened[0].round }, cookie),
      );
      expect(closed.round).toBe(opened[0].round);
      const after = await readRun(run);
      expect(after.run?.openRound).toBeNull();
      expect(await edge.application.concepts.Locking._isLocked({ target: run })).toEqual({
        locked: false,
      });

      const ran = read.run?.rounds.find((round) => round.round === opened[0].round)?.leg;
      const loser = legs.find((leg) => leg !== ran) as string;
      const next = await openRound(run, loser);
      expect(typeof next.round, `trial ${trial}: ${JSON.stringify(next)}`).toBe("string");
      await post(edge, "/live/relays/close", { run }, cookie);
      expect(await edge.application.concepts.Locking._isLocked({ target: run })).toEqual({
        locked: false,
      });
    }
  });

  test("closing the run with a round open gives the lock back too", async () => {
    const run = await launch();
    const opened = await openRound(run, legs[0]);
    expect(typeof opened.round, JSON.stringify(opened)).toBe("string");
    expect(await edge.application.concepts.Locking._isLocked({ target: run })).toEqual({
      locked: true,
    });
    await post(edge, "/live/relays/close", { run }, cookie);
    expect(await edge.application.concepts.Locking._isLocked({ target: run })).toEqual({
      locked: false,
    });
  });

  test("a parent close also closes a round already linked to it", async () => {
    const run = await launch();
    const { round } = await openRound(run, legs[0]);
    // Exercise the parent-close event itself, including a round linked after
    // the Close endpoint selected which child it would close first.
    await edge.application.concepts.Publishing.close({ edition: run, at: new Date() });
    const edition = await until(
      () => edge.application.concepts.Publishing._edition({ edition: round }),
      (rows) => rows[0]?.open === false,
    );
    expect(edition[0].open).toBe(false);
    expect(
      await until(
        () => isLocked(run),
        (lock) => !lock.locked,
      ),
    ).toEqual({ locked: false });
  });
});

describe("the run's Model sorts switch", () => {
  test("is one fact of the run, read back on the run and refused once the run closes", async () => {
    const run = await launch();
    expect((await readRun(run)).run?.modelSorts).toBe(false);
    const on = await json(await post(edge, "/live/relays/sort-by-model", { run }, cookie));
    expect(on.modelSorts).toBe(true);
    expect((await readRun(run)).run?.modelSorts).toBe(true);
    const again = await json(await post(edge, "/live/relays/sort-by-model", { run }, cookie));
    expect(again.modelSorts).toBe(true);
    const off = await json(await post(edge, "/live/relays/sort-by-hand", { run }, cookie));
    expect(off.modelSorts).toBe(false);
    expect((await readRun(run)).run?.modelSorts).toBe(false);
    await post(edge, "/live/relays/close", { run }, cookie);
    const closed = await json(await post(edge, "/live/relays/sort-by-model", { run }, cookie));
    expect(closed.error).toBe("CONFLICT");
  });
});

describe("a run left locked with no round open", () => {
  test("is freed by one unlock, and opens again afterward", async () => {
    const run = await launch();
    await edge.application.concepts.Locking.lock({ target: run, at: new Date() });
    const refused = await openRound(run, legs[0] as string);
    expect(refused.error, JSON.stringify(refused)).toBe("CONFLICT");

    const freed = await json(await post(edge, "/live/relays/unlock", { run }, cookie));
    expect(freed.run).toBe(run);
    expect(await isLocked(run)).toEqual({ locked: false });

    // Unlocking a run that holds no lock changes nothing and answers the run.
    const again = await json(await post(edge, "/live/relays/unlock", { run }, cookie));
    expect(again.run).toBe(run);

    const opened = await openRound(run, legs[0] as string);
    expect(typeof opened.round, JSON.stringify(opened)).toBe("string");
    const blocked = await json(await post(edge, "/live/relays/unlock", { run }, cookie));
    expect(blocked.error).toBe("CONFLICT");
    await post(edge, "/live/relays/close", { run }, cookie);
  });
});

describe("dashboards ticking the sort together", () => {
  test("send one ask, answer the rest quietly, and give the lock back with the reply", async () => {
    const run = await launch();
    const token = (await readRun(run)).run?.token as string;
    const opened = await openRound(run, legs[0] as string);
    const round = opened.round as string;
    await handIn(token, "phone-1", "save");

    const ticks = await Promise.all([sort(round), sort(round), sort(round)]);
    const asked = ticks.filter((tick) => tick.asked === true);
    expect(asked, JSON.stringify(ticks)).toHaveLength(1);
    expect(await edge.application.concepts.Reasoning._pending()).toHaveLength(1);
    expect(await isLocked(round)).toEqual({ locked: true });

    // A tick that finds the lock held is a quiet no, not a conflict.
    const later = await sort(round);
    expect(later.asked).toBe(false);
    expect(later.error).toBeUndefined();

    const [pending] = await edge.application.concepts.Reasoning._pending();
    await edge.application.concepts.Reasoning.answer({
      asking: pending?.asking as string,
      reply: JSON.stringify({ kind: "placed", placements: [{ card: "c1", pile: "Words" }] }),
      at: new Date(),
    });
    expect(
      await until(
        () => isLocked(round),
        (lock) => !lock.locked,
      ),
    ).toEqual({ locked: false });
    await post(edge, "/live/relays/close", { run }, cookie);
  });
});

describe("a classroom reconnects and hands in", () => {
  test("fifty devices retain one response each and repeated hand-ins make fifty cards", async () => {
    const run = await launch();
    const token = (await readRun(run)).run?.token as string;
    const { round } = await openRound(run, legs[0]);
    const face = await json(await post(edge, "/live/p/arrive", { token }));
    const question = (face.relay as unknown as { questions: { question: string }[] }).questions[0]
      .question;
    const replies = await Promise.all(
      Array.from({ length: 50 }, async (_, index) => {
        const device = `classroom-${index}`;
        const attempts = await Promise.all([
          post(edge, "/live/p/begin", { token, device }).then(json),
          post(edge, "/live/p/begin", { token, device }).then(json),
        ]);
        expect(attempts[0].response).toBe(attempts[1].response);
        const response = attempts[0].response;
        expect(typeof response).toBe("string");
        const answered = await json(
          await post(edge, "/live/p/answer", {
            response,
            question,
            value: `Frustration ${index}`,
          }),
        );
        expect(answered.response).toBe(response);
        const submitted = await Promise.all([
          post(edge, "/live/p/submit", { response }).then(json),
          post(edge, "/live/p/submit", { response }).then(json),
        ]);
        expect(submitted.filter((reply) => reply.response === response)).toHaveLength(1);
        expect(submitted.filter((reply) => reply.error === "CONFLICT")).toHaveLength(1);
        return response;
      }),
    );
    expect(new Set(replies).size).toBe(50);
    const read = async () =>
      (await json(await post(edge, "/live/walls/read", { round }, cookie))).wall as unknown as {
        cards: { value: string }[];
      };
    const wall = await until(read, (wall) => wall.cards.length === 50);
    expect(wall.cards).toHaveLength(50);
    expect(new Set(wall.cards.map((card) => card.value)).size).toBe(50);
    await post(edge, "/live/relays/close-round", { round }, cookie);
    const late = await json(await post(edge, "/live/p/submit", { response: replies[0] }));
    expect(late.error).toBe("CONFLICT");
    const between = await json(await post(edge, "/live/p/begin", { token, device: "late-phone" }));
    expect(between.error).toBe("CONFLICT");
    const next = await openRound(run, legs[1]);
    const rejoined = await json(
      await post(edge, "/live/p/begin", { token, device: "classroom-0" }),
    );
    expect(typeof rejoined.response).toBe("string");
    expect(replies).not.toContain(rejoined.response);
    expect(
      (await edge.application.concepts.Responding._response({ response: rejoined.response }))[0]
        .subject,
    ).toBe(next.round);
    await post(edge, "/live/relays/close", { run }, cookie);
  });
});
