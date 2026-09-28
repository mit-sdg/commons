import { afterAll, describe, expect, test } from "vite-plus/test";
import type { Db } from "mongodb";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoAttendingConcept } from "../../src/concepts/attending/attending.mongo.ts";

type Edge = ReturnType<typeof createEdge>;
type Body = Record<string, unknown>;

afterAll(stopTestDb);

/** The application's instant, moved by hand. */
class Clock {
  at = Date.now();
  readonly now = () => new Date(this.at);
  advance(ms: number) {
    this.at += ms;
  }
}

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
  return login.headers.get("Set-Cookie")?.split(";")[0] as string;
}

interface Stage {
  edge: Edge;
  call: (path: string, body: Body) => Promise<Body>;
  legs: string[];
  run: string;
  token: string;
}

/** A relay of two rounds, launched, with nothing open yet. */
async function stage(edge: Edge, name: string): Promise<Stage> {
  const cookie = await signIn(edge, name);
  const call = async (path: string, body: Body) =>
    (await post(edge, path, body, cookie).then((response) => response.json())) as Body;
  const { relay } = (await call("/live/relays/plan", { title: `Room ${name}` })) as {
    relay: string;
  };
  const legs: string[] = [];
  for (const title of ["First", "Second"]) {
    const { leg } = (await call("/live/relays/add-round", {
      relay,
      title,
      prompt: `${title}?`,
      parts: [],
      cap: 0,
      choices: [],
    })) as { leg: string };
    legs.push(leg);
  }
  const { run, token } = (await call("/live/relays/launch", { relay })) as {
    run: string;
    token: string;
  };
  return { edge, call, legs, run, token };
}

const arrive = async (s: Stage, body: Body = {}) =>
  answer(await post(s.edge, "/live/p/arrive", { token: s.token, ...body }));

const attend = async (s: Stage, device: string, holding = "") =>
  answer(await post(s.edge, "/live/p/attend", { token: s.token, device, holding }));

const room = async (s: Stage) =>
  ((await s.call("/live/relays/run", { run: s.run })).run as { room: Body }).room;

const openRound = async (s: Stage, leg: string) =>
  (await s.call("/live/relays/open-round", { run: s.run, leg })).round as string;

/** The answer, or `late` once ten seconds pass without one, so a slow runner never reads as a hang. */
const withinTenSeconds = <T>(request: Promise<T>) =>
  Promise.race([
    request,
    new Promise<"late">((resolve) => setTimeout(() => resolve("late"), 10_000)),
  ]);

const attendances = (s: Stage) =>
  s.edge.application.concepts.Attending._present({ gathering: s.run, since: new Date(0) });

class FaultingAttending extends MongoAttendingConcept {
  asked = 0;
  override async attend(): Promise<{ attendee: string }> {
    this.asked += 1;
    throw new Error("storage fault");
  }
}

/** Holds every check-in on Attending's line until the test lets it go. */
class HeldAttending extends MongoAttendingConcept {
  asked = 0;
  readonly entered = Promise.withResolvers<void>();
  readonly release = Promise.withResolvers<void>();
  override async attend(input: Parameters<MongoAttendingConcept["attend"]>[0]) {
    this.asked += 1;
    this.entered.resolve();
    await this.release.promise;
    return super.attend(input);
  }
}

function edgeWith(database: Db, clock: Clock, attending?: MongoAttendingConcept) {
  const instances = mongoImplementations(database, clock.now);
  return createEdge(
    attending === undefined ? instances : { ...instances, Attending: attending },
    undefined,
    clock.now,
  );
}

describe("a device on the participant link", () => {
  test("checks in with the round it shows, or with nothing while it waits", async () => {
    const clock = new Clock();
    const s = await stage(edgeWith(await testDb(), clock), "ada");
    expect(await attend(s, "phone-1")).toEqual({ status: 200, body: {} });
    expect(await attendances(s)).toEqual([
      { attendee: "phone-1", holding: "", heardAt: clock.now() },
    ]);

    const round = await openRound(s, s.legs[0]!);
    clock.advance(3_000);
    expect(await attend(s, "phone-1", round)).toEqual({ status: 200, body: {} });
    expect(await attendances(s)).toEqual([
      { attendee: "phone-1", holding: round, heardAt: clock.now() },
    ]);
  });

  test("arrives at its usual speed while a check-in hangs, whatever the arrive names", async () => {
    const database = await testDb();
    const clock = new Clock();
    const held = new HeldAttending(database);
    const s = await stage(edgeWith(database, clock, held), "hal");
    const round = await openRound(s, s.legs[0]!);
    const checkingIn = attend(s, "phone-1", round);
    await held.entered.promise;
    try {
      for (let poll = 0; poll < 3; poll += 1) {
        const arrived = await withinTenSeconds(arrive(s, { device: "phone-2", holding: round }));
        expect(arrived).toMatchObject({ status: 200, body: { relay: { openRound: round } } });
      }
      expect(held.asked).toBe(1);
    } finally {
      held.release.resolve();
    }
    expect(await checkingIn).toEqual({ status: 200, body: {} });
    expect(held.asked).toBe(1);
    expect(await attendances(s)).toEqual([
      { attendee: "phone-1", holding: round, heardAt: clock.now() },
    ]);
  });

  test("keeps its face when Attending faults, and only the check-in fails", async () => {
    const database = await testDb();
    const clock = new Clock();
    const faulting = new FaultingAttending(database);
    const s = await stage(edgeWith(database, clock, faulting), "bea");
    const round = await openRound(s, s.legs[0]!);

    const arrived = await arrive(s);
    expect(arrived.status).toBe(200);
    expect(arrived.body.relay).toMatchObject({ openRound: round });
    expect(faulting.asked).toBe(0);

    const checkedIn = await attend(s, "phone-1", round);
    expect(checkedIn.status).not.toBe(200);
    expect(checkedIn.body.error).toEqual(expect.any(String));
    expect(faulting.asked).toBe(1);
    expect(await attendances(s)).toEqual([]);
  });

  test("writes once for two check-ins inside twenty seconds on the same round", async () => {
    const clock = new Clock();
    const s = await stage(edgeWith(await testDb(), clock), "cyd");
    const first = clock.now();
    await attend(s, "phone-1");
    clock.advance(10_000);
    await attend(s, "phone-1");
    expect(await attendances(s)).toEqual([{ attendee: "phone-1", holding: "", heardAt: first }]);

    clock.advance(10_000);
    await attend(s, "phone-1");
    expect((await attendances(s))[0]?.heardAt).toEqual(clock.now());
  });

  test("is not counted for arriving alone", async () => {
    const clock = new Clock();
    const s = await stage(edgeWith(await testDb(), clock), "dee");
    const arrived = await arrive(s);
    expect(arrived.status).toBe(200);
    expect(arrived.body.relay).toMatchObject({ run: s.run });
    await s.edge.application.whenIdle();
    expect(await attendances(s)).toEqual([]);
    expect(await room(s)).toEqual({ here: 0, onOpenRound: 0 });
  });

  test("is answered NOT_FOUND on a token that shares nothing or opens a questionnaire run", async () => {
    const clock = new Clock();
    const s = await stage(edgeWith(await testDb(), clock), "ivy");
    const unshared = { token: "no-such-token", device: "phone-1", holding: "" };
    expect(await answer(await post(s.edge, "/live/p/attend", unshared))).toMatchObject({
      body: { error: "NOT_FOUND" },
    });

    const { questionnaire } = (await s.call("/live/quizzes/create", {
      title: "A show of hands",
      form: "survey",
      disclosure: "score",
    })) as { questionnaire: string };
    await s.call("/live/quizzes/add-question", {
      questionnaire,
      prompt: "Here?",
      choices: ["Yes"],
      expected: "",
      explanation: "",
    });
    const { run, token } = (await s.call("/live/runs/launch", { questionnaire })) as {
      run: string;
      token: string;
    };
    const survey = { token, device: "phone-1", holding: "" };
    expect(await answer(await post(s.edge, "/live/p/attend", survey))).toMatchObject({
      body: { error: "NOT_FOUND" },
    });
    expect(
      await s.edge.application.concepts.Attending._present({ gathering: run, since: new Date(0) }),
    ).toEqual([]);
  });
});

describe("the room on the run read", () => {
  test("counts the devices heard in the last minute and those holding the open round", async () => {
    const clock = new Clock();
    const s = await stage(edgeWith(await testDb(), clock), "eve");
    for (const device of ["phone-1", "phone-2", "laptop-1"]) await attend(s, device);
    expect(await room(s)).toEqual({ here: 3, onOpenRound: 0 });

    const round = await openRound(s, s.legs[0]!);
    clock.advance(3_000);
    await attend(s, "phone-1", round);
    await attend(s, "phone-2", round);
    expect(await room(s)).toEqual({ here: 3, onOpenRound: 2 });

    clock.advance(40_000);
    await attend(s, "phone-1", round);
    clock.advance(20_000);
    expect(await room(s)).toEqual({ here: 2, onOpenRound: 2 });

    clock.advance(3_000);
    expect(await room(s)).toEqual({ here: 1, onOpenRound: 1 });
  });

  test("no longer counts a device that leaves, and a second leave is refused", async () => {
    const clock = new Clock();
    const s = await stage(edgeWith(await testDb(), clock), "fay");
    await attend(s, "phone-1");
    await attend(s, "phone-2");
    expect(await room(s)).toEqual({ here: 2, onOpenRound: 0 });

    const left = await answer(
      await post(s.edge, "/live/p/leave", { token: s.token, device: "phone-1" }),
    );
    expect(left).toEqual({ status: 200, body: {} });
    expect(await room(s)).toEqual({ here: 1, onOpenRound: 0 });

    const again = await answer(
      await post(s.edge, "/live/p/leave", { token: s.token, device: "phone-1" }),
    );
    expect(again.status).not.toBe(200);
    expect(again.body.error).toEqual(expect.any(String));
    expect(await room(s)).toEqual({ here: 1, onOpenRound: 0 });
  });

  test("never counts a model seat", async () => {
    const clock = new Clock();
    const s = await stage(edgeWith(await testDb(), clock), "gus");
    const round = await openRound(s, s.legs[0]!);
    await attend(s, "phone-1", round);
    expect((await s.call("/live/runs/invite", { run: s.run, device: "seat-1" })).participant).toBe(
      "seat-1",
    );
    await s.edge.application.whenIdle();
    const begun = await s.edge.application.concepts.Responding._responsesFor({ subject: round });
    expect(begun.map((response) => response.participant)).toContain("seat-1");
    expect(await room(s)).toEqual({ here: 1, onOpenRound: 1 });
  });
});
