import { reusableFixture } from "../support/fixtures.ts";
import { afterAll, describe, expect, test } from "vite-plus/test";
import type { Db } from "mongodb";
import { createLiveEdge as createEdge } from "../support/domain-world.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoCategorizingConcept } from "../../src/concepts/categorizing/categorizing.mongo.ts";
import { MongoPublishingConcept } from "../../src/concepts/publishing/publishing.mongo.ts";
import { MongoSnapshottingConcept } from "../../src/concepts/snapshotting/snapshotting.mongo.ts";

type Edge = ReturnType<typeof createEdge>;
type Body = Record<string, unknown>;

afterAll(stopTestDb);

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

const answer = async (response: Response) => ({
  status: response.status,
  body: (await response.json()) as Body,
});

async function signIn(edge: Edge, name: string) {
  const host = {
    username: name,
    password: `pw-${name}-123`,
    displayName: name,
    email: `${name}@example.com`,
  };
  const { user } = await edge.application.concepts.Authenticating.register(host);
  await edge.application.concepts.Profiling.createProfile({ user, displayName: name });
  const { role } = await edge.application.concepts.Roling.ensureRole({
    name: "live-host",
    capabilities: ["live:host"],
  });
  await edge.application.concepts.Roling.assign({ user, context: "commons", role });
  const login = await post(edge, "/auth/login", {
    username: host.username,
    password: host.password,
  });
  return { user, cookie: login.headers.get("Set-Cookie")?.split(";")[0] as string };
}

interface Stage {
  edge: Edge;
  user: string;
  cookie: string;
  call: (path: string, body: Body) => Promise<Body>;
  relay: string;
  legs: { leg: string; questionnaire: string }[];
  run: string;
  token: string;
}

/** A relay of three rounds, launched; the first round keeps two standing piles. */
async function stage(edge: Edge, name: string): Promise<Stage> {
  const { user, cookie } = await signIn(edge, name);
  const call = async (path: string, body: Body) =>
    (await post(edge, path, body, cookie).then((response) => response.json())) as Body;
  const { relay } = (await call("/live/relays/plan", { title: `Opening ${name}` })) as {
    relay: string;
  };
  const legs: Stage["legs"] = [];
  for (const title of ["One word", "Another", "A third"]) {
    const added = (await call("/live/relays/add-round", {
      relay,
      title,
      prompt: `${title}?`,
      parts: [],
      cap: 0,
      choices: [],
    })) as { leg: string; questionnaire: string };
    legs.push(added);
  }
  for (const pile of ["Timing", "Access"]) {
    await call("/live/rounds/add-pile", { leg: legs[0]!.leg, name: pile, description: "" });
  }
  const { run, token } = (await call("/live/relays/launch", { relay })) as {
    run: string;
    token: string;
  };
  return { edge, user, cookie, call, relay, legs, run, token };
}

const face = async (edge: Edge, token: string) =>
  ((await post(edge, "/live/p/arrive", { token }).then((response) => response.json())) as Body)
    .relay as {
    openRound: string | null;
    questions: { prompt: string }[] | null;
    rounds: { number: number; round: string | null; open: boolean | null }[];
  };

const ordinaryStage = reusableFixture(async () => {
  const db = await testDb();
  const edge = createEdge(mongoImplementations(db));
  return { db, ...(await stage(edge, "lee")) };
});

/** The answer, or `late` once ten seconds have passed without one: a held press never answers, a slow one still does. */
const withinTenSeconds = <T>(request: Promise<T>) =>
  Promise.race([
    request,
    new Promise<"late">((resolve) => setTimeout(() => resolve("late"), 10_000)),
  ]);

const runRead = async (stage: Stage) =>
  (await stage.call("/live/relays/run", { run: stage.run })).run as {
    openRound: string | null;
    open: boolean;
    opening: string | null;
    rounds: { leg: string; round: string | null }[];
  };

/** The round's standing piles as the wall holds them, with whether each is reserved. */
async function standingPiles(edge: Edge, round: string) {
  const { Categorizing, Pinning } = edge.application.concepts;
  const piles = await Categorizing._categoriesIn({ scope: round });
  return Promise.all(
    piles.map(async ({ category, name }) => ({
      name,
      reserved: (await Pinning._isPinned({ item: category, scope: "live-reserved-piles" })).pinned,
    })),
  );
}

class FaultingCategorizing extends MongoCategorizingConcept {
  failing: string | undefined;
  override async ensureCategory(input: { scope: string; name: string; description: string }) {
    if (input.name === this.failing) {
      this.failing = undefined;
      throw new Error("storage fault");
    }
    return super.ensureCategory(input);
  }
}

class PausedSnapshotting extends MongoSnapshottingConcept {
  armed = false;
  readonly entered = Promise.withResolvers<void>();
  readonly release = Promise.withResolvers<void>();
  override async capture(input: { subject: string; value: unknown }) {
    if (this.armed) {
      this.armed = false;
      this.entered.resolve();
      await this.release.promise;
    }
    return super.capture(input);
  }
}

/**
 * Holds the first press's capture until another press first reads a
 * presentation, and lets it land before that read answers: the read answers
 * as the round stood before, and every read after it finds the presentation.
 */
class StraddledSnapshotting extends MongoSnapshottingConcept {
  armed = false;
  straddling = false;
  readonly entered = Promise.withResolvers<void>();
  readonly release = Promise.withResolvers<void>();
  readonly landed = Promise.withResolvers<void>();
  override async capture(input: { subject: string; value: unknown }) {
    if (!this.armed) return super.capture(input);
    this.armed = false;
    this.entered.resolve();
    await this.release.promise;
    const captured = await super.capture(input);
    this.landed.resolve();
    return captured;
  }
  override async _snapshot(input: { subject: string }) {
    if (!this.straddling) return super._snapshot(input);
    this.straddling = false;
    const before = await super._snapshot(input);
    this.release.resolve();
    await this.landed.promise;
    return before;
  }
}

/** Holds a publish after its write and before its answer, so another engine can act between. */
class HeldPublishing extends MongoPublishingConcept {
  armed = false;
  readonly written = Promise.withResolvers<void>();
  readonly release = Promise.withResolvers<void>();
  override async publishWithin(input: Parameters<MongoPublishingConcept["publishWithin"]>[0]) {
    const published = await super.publishWithin(input);
    if (this.armed) {
      this.armed = false;
      this.written.resolve();
      await this.release.promise;
    }
    return published;
  }
}

/**
 * Puts two presses in the order a race needs: the first is held at its write,
 * having found the run between rounds; the second is sent only then, so it
 * finds the run between rounds too. On two engines both writes are held until
 * both have come, so they meet at Publishing's guard together. One engine runs
 * one Publishing action at a time, so there the first write is let go once the
 * second press has read, and the second write waits in line behind it.
 */
class Gate {
  readonly firstWrite = Promise.withResolvers<void>();
  private readonly released = Promise.withResolvers<void>();
  private writes = 0;
  private sent = false;
  constructor(private readonly engines: 1 | 2) {}
  /** The second press is on its way; its read, or its write, is what the first awaits. */
  second(): void {
    this.sent = true;
  }
  read(): void {
    if (this.sent && this.engines === 1) this.release();
  }
  async write(): Promise<void> {
    this.writes += 1;
    this.firstWrite.resolve();
    if (this.writes >= 2) this.release();
    await this.released.promise;
  }
  /** Also called once either press is answered, so a press that never came to write holds nothing. */
  release(): void {
    this.released.resolve();
  }
}

class GatedPublishing extends MongoPublishingConcept {
  gate: Gate | undefined;
  override async _openPart(input: { whole: string }) {
    const answered = await super._openPart(input);
    this.gate?.read();
    return answered;
  }
  override async publishWithin(input: Parameters<MongoPublishingConcept["publishWithin"]>[0]) {
    await this.gate?.write();
    return super.publishWithin(input);
  }
}

describe("pressing Open again", () => {
  test("answers the round already open and puts back a standing pile a fault left off its wall", async () => {
    const database = await testDb();
    const categorizing = new FaultingCategorizing(database, "Categorizing");
    const edge = createEdge({ ...mongoImplementations(database), Categorizing: categorizing });
    const s = await stage(edge, "lee");
    categorizing.failing = "Access";
    const first = await answer(
      await post(edge, "/live/relays/open-round", { run: s.run, leg: s.legs[0]!.leg }, s.cookie),
    );
    expect(first).toEqual({ status: 200, body: { round: expect.any(String) } });
    const round = first.body.round as string;
    await edge.application.whenIdle();
    expect(await standingPiles(edge, round)).toEqual([{ name: "Timing", reserved: true }]);

    const again = await answer(
      await post(edge, "/live/relays/open-round", { run: s.run, leg: s.legs[0]!.leg }, s.cookie),
    );
    expect(again).toEqual({ status: 200, body: { round } });
    await edge.application.whenIdle();
    const piles = await standingPiles(edge, round);
    expect(piles.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "Access", reserved: true },
      { name: "Timing", reserved: true },
    ]);
    expect(await edge.application.concepts.Publishing._parts({ whole: s.run })).toHaveLength(1);

    const third = await answer(
      await post(edge, "/live/relays/open-round", { run: s.run, leg: s.legs[0]!.leg }, s.cookie),
    );
    expect(third).toEqual({ status: 200, body: { round } });
    await edge.application.whenIdle();
    expect(await standingPiles(edge, round)).toHaveLength(2);
  });

  test("finishes a round left opening, which phones do not see until it is finished", async () => {
    const s = await ordinaryStage();
    const edge = s.edge;
    const { Publishing } = edge.application.concepts;
    const { edition: round } = (await Publishing.publishWithin({
      whole: s.run,
      author: s.user,
      material: s.legs[0]!.questionnaire,
      at: new Date(),
    })) as { edition: string };

    const waiting = await face(edge, s.token);
    expect(waiting.openRound).toBeNull();
    expect(waiting.rounds.every((entry) => entry.round === null)).toBe(true);
    expect(
      await answer(await post(edge, "/live/p/begin", { token: s.token, device: "phone-1" })),
    ).toEqual({ status: 409, body: { error: "CONFLICT" } });
    expect(await runRead(s)).toMatchObject({ openRound: null, opening: round });
    expect(
      await answer(
        await post(edge, "/live/relays/open-round", { run: s.run, leg: s.legs[1]!.leg }, s.cookie),
      ),
    ).toEqual({ status: 200, body: { declined: "ROUND_OPEN", round: 1 } });

    const finished = await answer(
      await post(edge, "/live/relays/open-round", { run: s.run, leg: s.legs[0]!.leg }, s.cookie),
    );
    expect(finished).toEqual({ status: 200, body: { round } });
    expect(await runRead(s)).toMatchObject({ openRound: round, opening: null });
    const met = await face(edge, s.token);
    expect(met.openRound).toBe(round);
    expect(met.questions?.[0]?.prompt).toBe("One word?");
    const begun = await answer(
      await post(edge, "/live/p/begin", { token: s.token, device: "phone-1" }),
    );
    expect(begun.status).toBe(200);
    await edge.application.whenIdle();
    expect(await standingPiles(edge, round)).toHaveLength(2);
  });

  test("answers a press whose reads straddle the capture of the same round at once", async () => {
    const database = await testDb();
    const snapshotting = new StraddledSnapshotting(database, "RunSnapshotting");
    const edge = createEdge({ ...mongoImplementations(database), RunSnapshotting: snapshotting });
    const s = await stage(edge, "lee");
    const press = () =>
      post(edge, "/live/relays/open-round", { run: s.run, leg: s.legs[1]!.leg }, s.cookie).then(
        answer,
      );
    snapshotting.armed = true;
    const first = press();
    await snapshotting.entered.promise;
    snapshotting.straddling = true;
    const second = await withinTenSeconds(press());
    snapshotting.release.resolve();
    if (second === "late") expect.fail("the second press went unanswered");
    expect([{ round: expect.any(String) }, { error: "CONFLICT" }]).toContainEqual(second.body);

    const opened = await first;
    const read = await runRead(s);
    expect(read).toMatchObject({ openRound: expect.any(String), opening: null });
    for (const reply of [opened, second]) {
      if (typeof reply.body.round === "string") expect(reply.body.round).toBe(read.openRound);
    }
    expect(await edge.application.concepts.Publishing._parts({ whole: s.run })).toHaveLength(1);
  });

  test("closes a round left opening through Close round, and the round then counts as run", async () => {
    const s = await ordinaryStage();
    const edge = s.edge;
    const { edition: round } = (await edge.application.concepts.Publishing.publishWithin({
      whole: s.run,
      author: s.user,
      material: s.legs[2]!.questionnaire,
      at: new Date(),
    })) as { edition: string };
    expect(await s.call("/live/relays/close-round", { round })).toEqual({ round });
    expect(await runRead(s)).toMatchObject({ openRound: null, opening: null });
    expect(await s.call("/live/relays/open-round", { run: s.run, leg: s.legs[2]!.leg })).toEqual({
      declined: "ROUND_DONE",
      round: 3,
    });
    expect(
      typeof (await s.call("/live/relays/open-round", { run: s.run, leg: s.legs[0]!.leg })).round,
    ).toBe("string");
  });
});

describe("a round closed while it was opening", () => {
  test("is on the phone's face as a round that ran, and the round after it is next", async () => {
    const s = await ordinaryStage();
    const edge = s.edge;
    const { edition: round } = (await edge.application.concepts.Publishing.publishWithin({
      whole: s.run,
      author: s.user,
      material: s.legs[0]!.questionnaire,
      at: new Date(),
    })) as { edition: string };
    const standing = async () =>
      (await face(edge, s.token)).rounds.map(({ number, round, open }) => ({
        number,
        round,
        open,
      }));

    expect(await standing()).toEqual([
      { number: 1, round: null, open: null },
      { number: 2, round: null, open: null },
      { number: 3, round: null, open: null },
    ]);

    expect(await s.call("/live/relays/close-round", { round })).toEqual({ round });
    const closed = await face(edge, s.token);
    expect(closed.openRound).toBeNull();
    expect(await standing()).toEqual([
      { number: 1, round, open: false },
      { number: 2, round: null, open: null },
      { number: 3, round: null, open: null },
    ]);
    expect(closed.rounds.find((entry) => entry.round === null)?.number).toBe(2);
  });
});

describe("closing the run", () => {
  test("answers a run already closed at once, as closed", async () => {
    const s = await ordinaryStage();
    const edge = s.edge;
    await s.call("/live/relays/open-round", { run: s.run, leg: s.legs[0]!.leg });
    expect(await s.call("/live/relays/close", { run: s.run })).toEqual({ run: s.run });

    const again = await withinTenSeconds(
      post(edge, "/live/relays/close", { run: s.run }, s.cookie).then(answer),
    );
    expect(again).toEqual({ status: 200, body: { run: s.run } });
    expect(await runRead(s)).toMatchObject({ open: false, openRound: null, opening: null });
  });
});

describe("the rounds of a run, read through its parts", () => {
  test("the Live list and the relay page show each round published within the run", async () => {
    const s = await ordinaryStage();
    const first = (await s.call("/live/relays/open-round", { run: s.run, leg: s.legs[0]!.leg }))
      .round as string;
    await s.call("/live/relays/close-round", { round: first });
    const second = (await s.call("/live/relays/open-round", { run: s.run, leg: s.legs[2]!.leg }))
      .round as string;

    const listed = ((await s.call("/live/relays/list", {})).relays as Body[]).find(
      (entry) => entry.relay === s.relay,
    ) as { run: string; openRound: string; rounds: { round: string | null; open: boolean }[] };
    expect(listed.run).toBe(s.run);
    expect(listed.openRound).toBe(second);
    expect(listed.rounds.map(({ round, open }) => ({ round, open }))).toEqual([
      { round: first, open: false },
      { round: null, open: null },
      { round: second, open: true },
    ]);

    const page = (await s.call("/live/relays/get", { relay: s.relay })).relay as {
      runs: { run: string; rounds: { round: string }[] }[];
    };
    expect(
      page.runs.find((entry) => entry.run === s.run)?.rounds.map(({ round }) => round),
    ).toEqual([first, second]);
  });
});

describe("a round between its publication and its presentation", () => {
  test("is not open to phones until its presentation is captured", async () => {
    const database = await testDb();
    const snapshotting = new PausedSnapshotting(database, "RunSnapshotting");
    const edge = createEdge({ ...mongoImplementations(database), RunSnapshotting: snapshotting });
    const s = await stage(edge, "lee");
    snapshotting.armed = true;
    const opening = post(
      edge,
      "/live/relays/open-round",
      { run: s.run, leg: s.legs[0]!.leg },
      s.cookie,
    ).then(answer);
    await snapshotting.entered.promise;
    try {
      const waiting = await face(edge, s.token);
      expect(waiting.openRound).toBeNull();
      expect(waiting.questions ?? []).toEqual([]);
      expect(
        await answer(await post(edge, "/live/p/begin", { token: s.token, device: "early" })),
      ).toEqual({ status: 409, body: { error: "CONFLICT" } });
      expect((await runRead(s)).opening).toEqual(expect.any(String));
    } finally {
      snapshotting.release.resolve();
    }
    const opened = await opening;
    expect(opened).toEqual({ status: 200, body: { round: expect.any(String) } });
    expect((await face(edge, s.token)).openRound).toBe(opened.body.round);
    expect(
      (await answer(await post(edge, "/live/p/begin", { token: s.token, device: "early" }))).status,
    ).toBe(200);
  });

  test("is declined CLOSED, with nothing captured, when the run closed in between", async () => {
    const database = await testDb();
    const held = new HeldPublishing(database);
    const opener = createEdge({ ...mongoImplementations(database), Publishing: held });
    const s = await stage(opener, "lee");
    const closer = createEdge(mongoImplementations(database));
    held.armed = true;
    const opening = post(
      opener,
      "/live/relays/open-round",
      { run: s.run, leg: s.legs[0]!.leg },
      s.cookie,
    ).then(answer);
    await held.written.promise;
    try {
      expect(
        (await post(closer, "/live/relays/close", { run: s.run }, s.cookie).then(answer)).body,
      ).toEqual({ run: s.run });
    } finally {
      held.release.resolve();
    }
    expect(await opening).toEqual({ status: 200, body: { declined: "CLOSED" } });
    const [part] = await opener.application.concepts.Publishing._parts({ whole: s.run });
    expect(part?.open).toBe(false);
    expect(
      await opener.application.concepts.RunSnapshotting._snapshot({ subject: part!.edition }),
    ).toEqual([]);
    expect((await face(opener, s.token)).rounds[0]).toMatchObject({
      round: part!.edition,
      open: false,
    });
  });
});

/**
 * Two presses that both read the run between rounds meet Publishing's guard.
 * An endpoint answers only along the posture its chain asks for, so the
 * loser's refusal reaches the board as its category; the run read then says
 * which round is open.
 */
describe("two presses that race to Publishing's guard", () => {
  const race = async (database: Db, engines: 1 | 2, legs: [number, number]) => {
    const gate = new Gate(engines);
    const gated = () => {
      const publishing = new GatedPublishing(database);
      return {
        edge: createEdge({ ...mongoImplementations(database), Publishing: publishing }),
        publishing,
      };
    };
    const first = gated();
    const second = engines === 1 ? first : gated();
    const s = await stage(first.edge, `host-${engines}-${legs.join("")}`);
    first.publishing.gate = gate;
    second.publishing.gate = gate;
    const press = (edge: Edge, index: number) => {
      const answered = post(
        edge,
        "/live/relays/open-round",
        { run: s.run, leg: s.legs[legs[index]!]!.leg },
        s.cookie,
      ).then(answer);
      void answered.then(
        () => gate.release(),
        () => gate.release(),
      );
      return answered;
    };
    const opening = press(first.edge, 0);
    await Promise.race([gate.firstWrite.promise, opening]);
    gate.second();
    const answers = await Promise.all([opening, press(second.edge, 1)]);
    first.publishing.gate = undefined;
    second.publishing.gate = undefined;
    return { s, answers };
  };

  for (const engines of [2] as const) {
    test(`of two rounds on ${engines} engine(s): one opens, the other is answered CONFLICT`, async () => {
      const { s, answers } = await race(await testDb(), engines, [0, 1]);
      const opened = answers.filter((reply) => typeof reply.body.round === "string");
      const refused = answers.filter((reply) => reply.body.error === "CONFLICT");
      expect(opened, JSON.stringify(answers)).toHaveLength(1);
      expect(refused, JSON.stringify(answers)).toHaveLength(1);
      expect(refused[0]!.status).toBe(409);
      const read = await runRead(s);
      expect(read.openRound).toBe(opened[0]!.body.round);
      expect(read.rounds.filter((entry) => entry.round !== null)).toHaveLength(1);
    });

    test(`of one round on ${engines} engine(s): it opens once, the other is answered CONFLICT`, async () => {
      const { s, answers } = await race(await testDb(), engines, [0, 0]);
      const opened = answers.filter((reply) => typeof reply.body.round === "string");
      const refused = answers.filter((reply) => reply.body.error === "CONFLICT");
      expect(opened, JSON.stringify(answers)).toHaveLength(1);
      expect(refused, JSON.stringify(answers)).toHaveLength(1);
      const read = await runRead(s);
      expect(read.openRound).toBe(opened[0]!.body.round);
      expect(await s.edge.application.concepts.Publishing._parts({ whole: s.run })).toHaveLength(1);
    });
  }
});
