import { pooledLiveEdge } from "../support/world-pool.ts";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import type { RunSnapshot } from "../../src/computations/live-snapshots.ts";
import { stopTestDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";
import { scriptedMind, serveOnePass } from "../../src/reasoning/worker.ts";
import type { ParticipantFloor } from "../../src/reasoning/participant.ts";
import { serveParticipantsOnce } from "../../src/reasoning/participant.ts";

const presentation: RunSnapshot = {
  title: "What would help",
  form: "survey",
  disclosure: "score",
  questions: [
    {
      item: "q1",
      prompt: "What would help you most right now?",
      choices: [],
      expected: "",
      explanation: "",
      parts: ["First", "Second"],
      cap: 0,
      position: 1,
    },
    {
      item: "q2",
      prompt: "How is the pace?",
      choices: ["Too fast", "About right"],
      expected: "",
      explanation: "",
      position: 2,
    },
  ],
};

const said = JSON.stringify({
  kind: "answers",
  answers: [
    { item: "q1#1", value: "more worked examples" },
    { item: "q1#2", value: "slower on proofs" },
    { item: "q2", value: "About right" },
  ],
});

interface SeatResponse {
  response: string;
  participant: string;
  submitted: boolean;
  startedAt: Date;
}

interface FloorState {
  editions: string[];
  wholes: Record<string, string>;
  closed: string[];
  snapshots: Record<string, unknown>;
  responses: Record<string, SeatResponse[]>;
  replies: Record<string, string>;
  pending: string[];
  failed: string[];
  seats: Record<string, string[]>;
  dismissed: string[];
  faults: string[];
}

/**
 * The floor as the worker reads it, with what it wrote back kept beside it. A
 * begin raises its ask as the assembly's reaction does; a participant named in
 * faults has its first begin fail.
 */
function floorOf(state: Partial<FloorState>) {
  const {
    editions = [],
    wholes = {},
    closed = [],
    snapshots = {},
    responses = {},
    replies = {},
    pending = [],
    failed = [],
    seats = {},
    dismissed = [],
    faults = [],
  } = state;
  const answered: { response: string; item: string; value: string }[] = [];
  const submitted: string[] = [];
  const begun: { participant: string; subject: string }[] = [];
  const faulting = new Set(faults);
  const concepts: ParticipantFloor = {
    Publishing: {
      _openEditions: () => editions.map((edition) => ({ edition })),
      _edition: ({ edition }) => [
        { whole: wholes[edition] ?? null, open: !closed.includes(edition) },
      ],
    },
    Responding: {
      _responsesFor: ({ subject }) => responses[subject] ?? [],
      begin: ({ participant, subject, at }) => {
        if (faulting.delete(participant)) throw new Error("The begin was lost.");
        begun.push({ participant, subject });
        const round = (responses[subject] ??= []);
        const existing = round.find((response) => response.participant === participant);
        if (existing?.submitted === true) throw new Error("This was already handed in.");
        const response = existing ?? {
          response: `${subject}/${participant}`,
          participant,
          submitted: false,
          startedAt: at,
        };
        if (existing === undefined) round.push(response);
        pending.push(response.response);
        return { response: response.response };
      },
      answer: (input) => {
        answered.push(input);
        return undefined;
      },
      submit: ({ response }) => {
        submitted.push(response);
        return undefined;
      },
    },
    Reasoning: {
      _repliesAbout: ({ about }) =>
        replies[about] === undefined ? [] : [{ reply: replies[about] }],
      _pendingAbout: ({ about }) => pending.filter((asked) => asked === about),
      _lastFailureAbout: ({ about }) => failed.filter((asked) => asked === about),
    },
    Subscribing: {
      _getSubscribers: ({ target }) =>
        Object.entries(seats)
          .filter(([, runs]) => runs.includes(target))
          .map(([user]) => ({ user })),
    },
    Trashing: {
      _isTrashed: ({ item }) => ({ trashed: dismissed.includes(item) }),
    },
    RunSnapshotting: {
      _snapshot: ({ subject }) => (subject in snapshots ? [{ value: snapshots[subject] }] : []),
    },
  };
  return { concepts, answered, submitted, begun, pending, replies, snapshots };
}

const seated: SeatResponse = {
  response: "r1",
  participant: "model:d1",
  submitted: false,
  startedAt: new Date(),
};

/** Far enough ahead that every participant's own delay has passed. */
const later = () => new Date(Date.now() + 60_000);

describe("the participant worker", () => {
  test("plays an edition that is no part, finding the seat on the edition itself", async () => {
    const floor = floorOf({
      editions: ["run-1"],
      snapshots: { "run-1": presentation },
      responses: { "run-1": [seated] },
      replies: { r1: said },
      seats: { "model:d1": ["run-1"] },
    });

    expect(await serveParticipantsOnce(floor.concepts, later)).toBe(1);
    expect(floor.answered).toEqual([
      { response: "r1", item: "q1#1", value: "more worked examples" },
      { response: "r1", item: "q1#2", value: "slower on proofs" },
      { response: "r1", item: "q2", value: "About right" },
    ]);
    expect(floor.submitted).toEqual(["r1"]);
  });

  test("leaves a response whose participant holds no seat", async () => {
    const floor = floorOf({
      editions: ["run-1"],
      snapshots: { "run-1": presentation },
      responses: { "run-1": [seated] },
      replies: { r1: said },
      seats: {},
    });

    expect(await serveParticipantsOnce(floor.concepts, later)).toBe(0);
    expect(floor.answered).toEqual([]);
    expect(floor.submitted).toEqual([]);
  });

  test("plays a round, finding the seat on the run it is a part of", async () => {
    const floor = floorOf({
      editions: ["run-1", "round-1"],
      wholes: { "round-1": "run-1" },
      snapshots: { "round-1": presentation },
      responses: { "round-1": [seated] },
      replies: { r1: said },
      seats: { "model:d1": ["run-1"] },
    });

    expect(await serveParticipantsOnce(floor.concepts, later)).toBe(1);
    expect(floor.answered).toHaveLength(3);
    expect(floor.submitted).toEqual(["r1"]);
    expect(floor.begun).toEqual([]);
  });

  test("passes over an edition whose run was captured in no snapshot", async () => {
    const floor = floorOf({
      editions: ["run-1"],
      responses: { "run-1": [seated] },
      replies: { r1: said },
      seats: { "model:d1": ["run-1"] },
    });

    expect(await serveParticipantsOnce(floor.concepts, later)).toBe(0);
    expect(floor.answered).toEqual([]);
    expect(floor.submitted).toEqual([]);
  });

  test("begins every seat of a round open to the room, and hands in once each has its reply", async () => {
    const floor = floorOf({
      editions: ["run-1", "round-1"],
      wholes: { "round-1": "run-1" },
      snapshots: { "round-1": presentation },
      seats: { "model:a": ["run-1"], "model:b": ["run-1"], "model:elsewhere": ["run-2"] },
    });

    expect(await serveParticipantsOnce(floor.concepts)).toBe(0);
    expect(floor.begun).toEqual([
      { participant: "model:a", subject: "round-1" },
      { participant: "model:b", subject: "round-1" },
    ]);
    expect(floor.pending).toEqual(["round-1/model:a", "round-1/model:b"]);

    floor.pending.length = 0;
    floor.replies["round-1/model:a"] = said;
    floor.replies["round-1/model:b"] = said;

    expect(await serveParticipantsOnce(floor.concepts, later)).toBe(2);
    expect(floor.submitted).toEqual(["round-1/model:a", "round-1/model:b"]);
    expect(floor.begun).toHaveLength(2);
  });

  test("begins no seat of a round still opening, and begins them on the pass after the capture", async () => {
    const floor = floorOf({
      editions: ["run-1", "round-1"],
      wholes: { "round-1": "run-1" },
      seats: { "model:a": ["run-1"] },
    });

    expect(await serveParticipantsOnce(floor.concepts)).toBe(0);
    expect(floor.begun).toEqual([]);

    floor.snapshots["round-1"] = presentation;
    expect(await serveParticipantsOnce(floor.concepts)).toBe(0);
    expect(floor.begun).toEqual([{ participant: "model:a", subject: "round-1" }]);
  });

  test("begins no seat of a round whose run has closed", async () => {
    const floor = floorOf({
      editions: ["round-1"],
      wholes: { "round-1": "run-1" },
      closed: ["run-1"],
      snapshots: { "round-1": presentation },
      responses: { "round-1": [seated] },
      replies: { r1: said },
      seats: { "model:d1": ["run-1"], "model:a": ["run-1"] },
    });

    expect(await serveParticipantsOnce(floor.concepts, later)).toBe(0);
    expect(floor.begun).toEqual([]);
    expect(floor.submitted).toEqual([]);
  });

  test("never begins a dismissed seat, nor a seat that already handed in", async () => {
    const floor = floorOf({
      editions: ["run-1", "round-1"],
      wholes: { "round-1": "run-1" },
      snapshots: { "round-1": presentation },
      responses: { "round-1": [{ ...seated, submitted: true }] },
      seats: { "model:d1": ["run-1"], "model:gone": ["run-1"] },
      dismissed: ["model:gone"],
    });

    expect(await serveParticipantsOnce(floor.concepts)).toBe(0);
    expect(await serveParticipantsOnce(floor.concepts)).toBe(0);
    expect(floor.begun).toEqual([]);
  });

  test("a begin that failed is made on the next pass, and the others are begun in the first", async () => {
    const floor = floorOf({
      editions: ["run-1", "round-1"],
      wholes: { "round-1": "run-1" },
      snapshots: { "round-1": presentation },
      seats: { "model:a": ["run-1"], "model:b": ["run-1"], "model:c": ["run-1"] },
      faults: ["model:b"],
    });
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...line: unknown[]) => errors.push(line.join(" "));
    try {
      await serveParticipantsOnce(floor.concepts);
    } finally {
      console.error = original;
    }
    expect(errors).toEqual(["participants: one seat could not be begun."]);
    expect(floor.begun.map(({ participant }) => participant)).toEqual(["model:a", "model:c"]);

    await serveParticipantsOnce(floor.concepts);
    expect(floor.begun.map(({ participant }) => participant)).toEqual([
      "model:a",
      "model:c",
      "model:b",
    ]);
  });

  test("two passes in a row begin each seat once", async () => {
    const floor = floorOf({
      editions: ["run-1", "round-1"],
      wholes: { "round-1": "run-1" },
      snapshots: { "round-1": presentation },
      seats: { "model:a": ["run-1"], "model:b": ["run-1"] },
    });

    await serveParticipantsOnce(floor.concepts);
    await serveParticipantsOnce(floor.concepts);
    expect(floor.begun.map(({ participant }) => participant)).toEqual(["model:a", "model:b"]);
  });

  test("begins again a seat whose response was never put to the reasoner, and only that one", async () => {
    const unasked: SeatResponse = { ...seated, response: "r-unasked", participant: "model:a" };
    const waiting: SeatResponse = { ...seated, response: "r-waiting", participant: "model:b" };
    const failed: SeatResponse = { ...seated, response: "r-failed", participant: "model:c" };
    const floor = floorOf({
      editions: ["run-1", "round-1"],
      wholes: { "round-1": "run-1" },
      snapshots: { "round-1": presentation },
      responses: { "round-1": [unasked, waiting, failed] },
      pending: ["r-waiting"],
      failed: ["r-failed"],
      seats: { "model:a": ["run-1"], "model:b": ["run-1"], "model:c": ["run-1"] },
    });

    await serveParticipantsOnce(floor.concepts);
    await serveParticipantsOnce(floor.concepts);
    expect(floor.begun).toEqual([{ participant: "model:a", subject: "round-1" }]);
    expect(floor.pending).toEqual(["r-waiting", "r-unasked"]);
  });

  test("begins no seat on an edition that is no part: its seats are begun as they are taken", async () => {
    const floor = floorOf({
      editions: ["run-1"],
      snapshots: { "run-1": presentation },
      seats: { "model:a": ["run-1"] },
    });

    await serveParticipantsOnce(floor.concepts);
    expect(floor.begun).toEqual([]);
  });
});

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

/** Reads once every flow the edge accepted has settled, so a reaction's chain is not raced. */
async function settled<Value>(edge: Edge, read: () => PromiseLike<Value>) {
  await edge.application.whenIdle();
  return read();
}

describe("the participant worker on the floor", () => {
  let edge: Edge;
  let cookie: string;

  beforeAll(async () => {
    edge = (await pooledLiveEdge()).edge;
    cookie = await registerHost(edge);
  });

  afterAll(stopTestDb);

  /** A launched relay of one round, not yet opened. */
  async function launchRelay(title: string) {
    const planned = await json(await post(edge, "/live/relays/plan", { title }, cookie));
    const relay = planned.relay as string;
    const added = await json(
      await post(
        edge,
        "/live/relays/add-round",
        { relay, title, prompt: `${title}?`, parts: [], cap: 0, choices: [] },
        cookie,
      ),
    );
    const launched = await json(await post(edge, "/live/relays/launch", { relay }, cookie));
    return { run: launched.run as string, leg: added.leg as string };
  }

  const invite = async (run: string, device: string) =>
    expect((await post(edge, "/live/runs/invite", { run, device }, cookie)).status).toBe(200);

  const openRound = async (run: string, leg: string) => {
    const opened = await json(await post(edge, "/live/relays/open-round", { run, leg }, cookie));
    expect(opened.error).toBe(undefined);
    return opened.round as string;
  };

  const close = async (run: string) =>
    expect((await post(edge, "/live/relays/close", { run }, cookie)).status).toBe(200);

  const responsesTo = async (round: string) =>
    await edge.application.concepts.Responding._responsesFor({ subject: round });

  /** The seats that began the round, each with how many asks its response raised. */
  const begunOn = async (round: string) => {
    const seats: Record<string, number> = {};
    for (const { response, participant } of await responsesTo(round)) {
      const pending = await edge.application.concepts.Reasoning._pendingAbout({ about: response });
      const replies = await edge.application.concepts.Reasoning._repliesAbout({ about: response });
      seats[participant] = pending.length + replies.length;
    }
    return seats;
  };

  const everyAsked = (seats: Record<string, number>, count: number) =>
    Object.keys(seats).length === count && Object.values(seats).every((asks) => asks > 0);

  test("a seat taken before the round opens is begun by the pass after the capture, and asks", async () => {
    const { run, leg } = await launchRelay("Before the round");
    await invite(run, "seat-early");
    const round = await openRound(run, leg);

    await serveParticipantsOnce(edge.application.concepts);
    const begun = await settled(edge, () => begunOn(round));
    expect(everyAsked(begun, 1)).toBe(true);
    expect(Object.keys(begun)).toEqual(["seat-early"]);
    expect(begun["seat-early"]).toBeGreaterThan(0);

    // A second pass finds the seat begun and asked, so it begins and asks nothing more.
    await serveParticipantsOnce(edge.application.concepts);
    expect(await begunOn(round)).toEqual(begun);
    await close(run);
  });

  test("a seat taken while the round is open is begun and asks", async () => {
    const { run, leg } = await launchRelay("During the round");
    const round = await openRound(run, leg);
    await invite(run, "seat-late");

    await serveParticipantsOnce(edge.application.concepts);
    const begun = await settled(edge, () => begunOn(round));
    expect(everyAsked(begun, 1)).toBe(true);
    expect(Object.keys(begun)).toEqual(["seat-late"]);
    await close(run);
  });

  test("a round left opening begins no seat, and the pass after its capture begins them", async () => {
    const { run } = await launchRelay("Left opening");
    await invite(run, "seat-waiting");
    const { edition: round } = await edge.application.concepts.Publishing.publishWithin({
      whole: run,
      author: "nadia",
      material: "left-opening-material",
      at: new Date(),
    });

    await serveParticipantsOnce(edge.application.concepts);
    await serveParticipantsOnce(edge.application.concepts);
    expect(await responsesTo(round)).toEqual([]);

    await edge.application.concepts.RunSnapshotting.capture({
      subject: round,
      value: presentation,
    });
    await serveParticipantsOnce(edge.application.concepts);
    const begun = await settled(edge, () => begunOn(round));
    expect(everyAsked(begun, 1)).toBe(true);
    expect(Object.keys(begun)).toEqual(["seat-waiting"]);
    await close(run);
  });

  test("a dismissed seat is never begun, and a seat that handed in is not begun again", async () => {
    const { run, leg } = await launchRelay("Dismissed and done");
    await invite(run, "seat-kept");
    await invite(run, "seat-dismissed");
    expect(
      (await post(edge, "/live/runs/dismiss", { run, participant: "seat-dismissed" }, cookie))
        .status,
    ).toBe(200);
    const round = await openRound(run, leg);

    await serveParticipantsOnce(edge.application.concepts);
    expect(everyAsked(await settled(edge, () => begunOn(round)), 1)).toBe(true);
    const mind = scriptedMind();
    for (let pass = 0; pass < 40; pass += 1) {
      if ((await serveOnePass(edge.application.concepts.Reasoning, mind)) === 0) break;
      await edge.application.whenIdle();
    }
    const later = () => new Date(Date.now() + 60_000);
    await serveParticipantsOnce(edge.application.concepts, later);

    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...line: unknown[]) => errors.push(line.join(" "));
    try {
      expect(await serveParticipantsOnce(edge.application.concepts, later)).toBe(0);
      expect(await serveParticipantsOnce(edge.application.concepts, later)).toBe(0);
    } finally {
      console.error = original;
    }
    expect(errors).toEqual([]);
    const responses = await responsesTo(round);
    expect(responses.map(({ participant, submitted }) => ({ participant, submitted }))).toEqual([
      { participant: "seat-kept", submitted: true },
    ]);
    expect(await begunOn(round)).toEqual({ "seat-kept": 1 });
    await close(run);
  });

  test("a seat whose begin was lost is begun on the next pass", async () => {
    const { run, leg } = await launchRelay("Lost begin");
    await invite(run, "seat-lost");
    await invite(run, "seat-steady");
    const concepts = edge.application.concepts;
    let lost = 0;
    const floor: ParticipantFloor = {
      Publishing: concepts.Publishing,
      Reasoning: concepts.Reasoning,
      Subscribing: concepts.Subscribing,
      Trashing: concepts.Trashing,
      RunSnapshotting: concepts.RunSnapshotting,
      Responding: {
        _responsesFor: (input) => concepts.Responding._responsesFor(input),
        answer: (input) => concepts.Responding.answer(input),
        submit: (input) => concepts.Responding.submit(input),
        begin: (input) => {
          if (input.participant === "seat-lost" && lost === 0) {
            lost += 1;
            throw new Error("The begin was lost.");
          }
          return concepts.Responding.begin(input);
        },
      },
    };
    const round = await openRound(run, leg);

    const original = console.error;
    console.error = () => undefined;
    try {
      await serveParticipantsOnce(floor);
    } finally {
      console.error = original;
    }
    await serveParticipantsOnce(floor);
    const begun = await settled(edge, () => begunOn(round));
    expect(everyAsked(begun, 2)).toBe(true);
    expect(Object.keys(begun).sort()).toEqual(["seat-lost", "seat-steady"]);
    expect(lost).toBeLessThanOrEqual(1);
    await close(run);
  });
});
