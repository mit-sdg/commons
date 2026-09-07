import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { scriptedEditsReply } from "../../src/reasoning/scripted-edits.ts";
import { serveOnePass, type Mind } from "../../src/reasoning/worker.ts";
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

/** The scripted relay-drafting mind; anything else it is handed answers nothing. */
const mind: Mind = ({ passage }) => Promise.resolve(scriptedEditsReply(passage) ?? "");

/** Serve every pending ask, including the one a stood-upon reply queues next. */
async function serveReasoner(edge: Edge, rounds = 4) {
  for (let round = 0; round < rounds; round += 1) {
    const served = await serveOnePass(edge.application.concepts.Reasoning, mind);
    if (served === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
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

interface Line {
  suggestion: string;
  kind: string;
  target: string;
  value: string;
  position: number;
  standing: string;
}

interface Offering {
  offering: string;
  lines: Line[];
}

interface Round {
  leg: string;
  number: number;
  title: string;
  prompt: string;
  parts: string[];
  cap: number;
  choices: string[];
  takes: { source: string; sourceNumber: number; use: string }[];
  piles: { pile: string; name: string; description: string }[];
  notes: string;
}

const offerings = async (edge: Edge, cookie: string, relay: string): Promise<Offering[]> => {
  const read = await json(await post(edge, "/live/edits/offerings", { relay }, cookie));
  return read.offerings as unknown as Offering[];
};

const rounds = async (edge: Edge, cookie: string, relay: string): Promise<Round[]> => {
  const read = await json(await post(edge, "/live/relays/get", { relay }, cookie));
  const whole = read.relay as unknown as { rounds: Round[] } | null;
  return whole === null ? [] : whole.rounds;
};

const plan = async (edge: Edge, cookie: string, title: string): Promise<string> => {
  const planned = await json(await post(edge, "/live/relays/plan", { title }, cookie));
  return planned.relay as unknown as string;
};

/** Draft against the relay, serve the ask, and wait for the offering to stand. */
async function draft(
  edge: Edge,
  cookie: string,
  relay: string,
  request: string,
  standing: number,
): Promise<Offering> {
  const asked = await json(await post(edge, "/live/edits/draft", { relay, request }, cookie));
  expect(typeof asked.asking).toBe("string");
  await serveReasoner(edge);
  const offered = await until(
    () => offerings(edge, cookie, relay),
    (all) => all.length > standing,
  );
  expect(offered.length).toBe(standing + 1);
  return offered[0];
}

interface GuidedRelay {
  description: string;
  hostGuide: { opening: string; closing: string };
  rounds: {
    storedSelection: string;
    hostGuide: { purpose: string; facilitation: string; selection: string | null };
  }[];
}

describe("the relay editing loop", () => {
  let edge: Edge;
  let cookie: string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    ({ cookie } = await registerHost(edge));
  });

  afterAll(stopTestDb);

  test("host guides persist separately, clear, and remain outside the participant face", async () => {
    const relay = await plan(edge, cookie, "Host guide checks");
    const add = async (title: string) => {
      const response = await post(
        edge,
        "/live/relays/add-round",
        { relay, title, prompt: "What would help?", parts: [], cap: 0, choices: [] },
        cookie,
      );
      expect(response.status).toBe(200);
      return (await json(response)).leg as string;
    };
    const first = await add("Incidents");
    const second = await add("Improvements");
    const set = (path: string, body: unknown) => post(edge, path, body, cookie);
    expect(
      (
        await set("/live/relays/set-guide", {
          relay,
          field: "description",
          body: "Build useful changes.",
        })
      ).status,
    ).toBe(200);
    expect(
      (await set("/live/relays/set-guide", { relay, field: "opening", body: "Invite incidents." }))
        .status,
    ).toBe(200);
    expect(
      (
        await set("/live/rounds/set-guide", {
          leg: first,
          field: "purpose",
          body: "Gather concrete situations.",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await set("/live/rounds/set-guide", {
          leg: first,
          field: "selection",
          body: "Choose distinct incidents.",
        })
      ).status,
    ).toBe(200);
    const read = async () =>
      (await json(await set("/live/relays/get", { relay }))).relay as GuidedRelay;
    let found = await read();
    expect(found.description).toBe("Build useful changes.");
    expect(found.hostGuide.opening).toBe("Invite incidents.");
    expect(found.rounds[0].hostGuide).toEqual({
      purpose: "Gather concrete situations.",
      facilitation: "",
      selection: null,
    });
    expect(found.rounds[0].storedSelection).toBe("Choose distinct incidents.");
    expect(
      (await set("/live/relays/set-takes", { leg: second, source: first, use: "context" })).status,
    ).toBe(200);
    found = await read();
    expect(found.rounds[0].hostGuide.selection).toBe("Choose distinct incidents.");
    await set("/live/relays/clear-takes", { leg: second, source: first });
    found = await read();
    expect(found.rounds[0].hostGuide.selection).toBeNull();
    expect(found.rounds[0].storedSelection).toBe("Choose distinct incidents.");
    await set("/live/relays/set-guide", { relay, field: "opening", body: "  " });
    expect((await read()).hostGuide.opening).toBe("");
    expect(
      (await set("/live/rounds/set-guide", { leg: first, field: "opening", body: "wrong scope" }))
        .status,
    ).not.toBe(200);
    expect(
      (
        await post(edge, "/live/relays/set-guide", {
          relay,
          field: "opening",
          body: "unauthorized",
        })
      ).status,
    ).not.toBe(200);
    const launched = await json(await set("/live/relays/launch", { relay }));
    expect(typeof launched.run).toBe("string");
    const hostRun = (await json(await set("/live/relays/run", { run: launched.run })))
      .run as GuidedRelay;
    expect(hostRun.description).toBe("Build useful changes.");
    expect(hostRun.rounds[0].hostGuide.purpose).toBe("Gather concrete situations.");
    const face = await (await post(edge, "/live/p/arrive", { token: launched.token })).json();
    expect(JSON.stringify(face)).not.toContain("hostGuide");
    expect(JSON.stringify(face)).not.toContain("Build useful changes.");
    expect(
      (
        await set("/live/rounds/set-guide", {
          leg: first,
          field: "facilitation",
          body: "Pause during the run.",
        })
      ).status,
    ).toBe(200);
    await set("/live/relays/close", { run: launched.run });
    await set("/live/relays/retire", { relay });
    expect(
      (await set("/live/relays/set-guide", { relay, field: "opening", body: "retired" })).status,
    ).not.toBe(200);
    expect(
      (await set("/live/rounds/set-guide", { leg: first, field: "purpose", body: "retired" }))
        .status,
    ).not.toBe(200);
  });

  test("accepted generated rounds keep distinct host guides and relay guidance", async () => {
    const relay = await plan(edge, cookie, "Guided draft");
    const question = (title: string, purpose: string, selection: string | null, from = 0) => ({
      number: 0,
      kind: "write",
      title,
      hostGuide: { purpose, facilitation: "", selection },
      prompt: "What would help?",
      parts: [],
      cap: 0,
      choices: [],
      piles: [],
      notes: "",
      takes: { from, use: from ? "context" : "" },
    });
    const asked = await json(
      await post(
        edge,
        "/live/edits/draft",
        { relay, request: "Gather incidents, then improvements." },
        cookie,
      ),
    );
    await edge.application.concepts.Reasoning.answer({
      at: new Date(),
      asking: asked.asking,
      reply: JSON.stringify({
        kind: "relay",
        title: "Guided draft",
        description: "Improve shared work.",
        hostGuide: { opening: "Invite incidents.", closing: "Agree on a trial." },
        rounds: [
          question("Incidents", "Gather situations.", "Pick distinct incidents."),
          question("Improvements", "Develop practical changes.", null, 1),
        ],
      }),
    });
    const all = await until(
      () => offerings(edge, cookie, relay),
      (value) => value.length > 0,
    );
    for (const line of all[0].lines) {
      const applied = await json(
        await post(edge, "/live/edits/take", { suggestion: line.suggestion }, cookie),
      );
      expect(applied.applied).toBe(true);
    }
    const found = (await json(await post(edge, "/live/relays/get", { relay }, cookie)))
      .relay as GuidedRelay;
    expect(found.description).toBe("Improve shared work.");
    expect(found.hostGuide).toEqual({ opening: "Invite incidents.", closing: "Agree on a trial." });
    expect(
      found.rounds.map((entry: { hostGuide: { purpose: string } }) => entry.hostGuide.purpose),
    ).toEqual(["Gather situations.", "Develop practical changes."]);
    expect(found.rounds[0].hostGuide.selection).toBe("Pick distinct incidents.");
    expect(found.rounds[1].hostGuide.selection).toBeNull();
  });

  test("repairs an invalid source before offering and applying a nonadjacent dependency", async () => {
    const relay = await plan(edge, cookie, "Shared audiences");
    const brief =
      "Gather audiences, pause for an independent energy check, then develop an idea for each audience.";
    const makeRound = (title: string, prompt: string) => ({
      number: 0,
      kind: "write",
      title,
      prompt,
      parts: [],
      cap: 0,
      choices: [],
      takes: { from: 0, use: "" },
      piles: [],
      notes: "",
    });
    const proposed = [
      makeRound("Audiences", "Who should the event serve?"),
      makeRound("Energy", "How much energy do you have today?"),
      {
        ...makeRound("Event ideas", "What event idea would help each selected audience?"),
        kind: "list",
        takes: { from: 1, use: "parts" },
      },
    ];
    const passages: string[] = [];
    const repairMind: Mind = ({ passage }) => {
      passages.push(passage);
      const rounds =
        passages.length === 1
          ? proposed.map((round, index) =>
              index === 2 ? { ...round, takes: { from: 3, use: "parts" } } : round,
            )
          : proposed;
      return Promise.resolve(JSON.stringify({ kind: "relay", title: "Shared audiences", rounds }));
    };
    await post(edge, "/live/edits/draft", { relay, request: brief }, cookie);
    for (let attempt = 0; attempt < 4; attempt++) {
      await serveOnePass(edge.application.concepts.Reasoning, repairMind);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const offered = await until(
      () => offerings(edge, cookie, relay),
      (all) => all.length === 1,
    );
    expect(passages).toHaveLength(2);
    expect(passages[1]).toContain(passages[0]);
    expect(passages[1]).toContain("earlier position in the delivered relay");
    for (const line of offered[0].lines) {
      const applied = await json(
        await post(edge, "/live/edits/take", { suggestion: line.suggestion }, cookie),
      );
      expect(applied.applied).toBe(true);
    }
    const built = await rounds(edge, cookie, relay);
    expect(built).toHaveLength(3);
    expect(built[1].takes).toEqual([]);
    expect(built[2].takes).toEqual([{ source: built[0].leg, sourceNumber: 1, use: "parts" }]);
  });

  test("taking a missing suggestion promptly answers not found", async () => {
    const response = await post(edge, "/live/edits/take", { suggestion: "missing" }, cookie);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "NOT_FOUND" });
  }, 2_000);

  test("a removal offered before a new draw reports refusal rather than application", async () => {
    const relay = await plan(edge, cookie, "Stale removal");
    const add = async (title: string) =>
      json(
        await post(
          edge,
          "/live/relays/add-round",
          {
            relay,
            title,
            prompt: "Why?",
            parts: [],
            cap: 0,
            choices: [],
          },
          cookie,
        ),
      );
    const first = await add("Source");
    const second = await add("Later");
    const { Suggesting, Relaying } = edge.application.concepts;
    const { offering } = await Suggesting.offer({
      subject: relay,
      lines: [{ kind: "remove", target: first.leg, value: "" }],
      at: new Date(),
    });
    const [line] = await Suggesting._pendingIn({ offering });
    expect(
      (
        await post(
          edge,
          "/live/relays/set-takes",
          {
            leg: second.leg,
            source: first.leg,
            use: "context",
          },
          cookie,
        )
      ).status,
    ).toBe(200);
    const response = await post(edge, "/live/edits/take", { suggestion: line.suggestion }, cookie);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "CONFLICT" });
    expect(await Relaying._leg({ leg: first.leg })).toHaveLength(1);
    expect((await Suggesting._suggestion({ suggestion: line.suggestion }))[0].standing).toBe(
      "taken",
    );
  });

  test("suggestions for a removed round neither claim application nor rename the relay", async () => {
    const relay = await plan(edge, cookie, "Stale notes");
    const added = await json(
      await post(
        edge,
        "/live/relays/add-round",
        {
          relay,
          title: "Gone",
          prompt: "Why?",
          parts: [],
          cap: 0,
          choices: [],
        },
        cookie,
      ),
    );
    const { Suggesting } = edge.application.concepts;
    const { offering } = await Suggesting.offer({
      subject: relay,
      lines: [
        { kind: "notes", target: added.leg, value: "Group by meaning." },
        { kind: "title", target: added.leg, value: "Wrong relay title" },
      ],
      at: new Date(),
    });
    const lines = await Suggesting._pendingIn({ offering });
    expect((await post(edge, "/live/relays/remove-round", { leg: added.leg }, cookie)).status).toBe(
      200,
    );
    for (const line of lines) {
      const response = await post(
        edge,
        "/live/edits/take",
        { suggestion: line.suggestion },
        cookie,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ suggestion: line.suggestion, applied: false });
    }
    expect((await edge.application.concepts.Relaying._relay({ relay }))[0].title).toBe(
      "Stale notes",
    );
  });

  test("taking a notes edit replaces duplicate standing notes and a blank clears them", async () => {
    const relay = await plan(edge, cookie, "Notes regression");
    const added = await json(
      await post(
        edge,
        "/live/relays/add-round",
        {
          relay,
          title: "One",
          prompt: "Why?",
          parts: [],
          cap: 0,
          choices: [],
        },
        cookie,
      ),
    );
    const leg = added.leg as string;
    const { Guiding, Suggesting } = edge.application.concepts;
    // Legacy racing writers could leave several entries for this single note.
    for (const body of ["First", "Second"]) {
      await Guiding.give({ subject: leg, use: "sorting", title: "", body });
    }
    const read = async () => Guiding._guidanceFor({ subject: leg, use: "sorting" });
    for (const value of ["One replacement", ""]) {
      const { offering } = await Suggesting.offer({
        subject: relay,
        lines: [{ kind: "notes", target: leg, value }],
        at: new Date(),
      });
      const [line] = await Suggesting._pendingIn({ offering });
      const taken = await json(
        await post(edge, "/live/edits/take", { suggestion: line.suggestion }, cookie),
      );
      expect(taken.error).toBeUndefined();
      expect(taken.applied).toBe(true);
      const notes = await until(read, (rows) =>
        value === "" ? rows.length === 0 : rows.length === 1 && rows[0].body === value,
      );
      expect(notes.map((note) => note.body)).toEqual(value === "" ? [] : [value]);
    }
  });

  test("a drafted relay is offered as lines, and taking each one builds the rounds", async () => {
    const relay = await plan(edge, cookie, "Verbs and strangers");

    const offering = await draft(
      edge,
      cookie,
      relay,
      "Two rounds: three verbs from the passage, then the stranger.",
      0,
    );
    expect(offering.lines.map((line) => line.kind)).toEqual(["add", "add"]);
    expect(offering.lines.every((line) => line.standing === "pending")).toBe(true);
    expect(JSON.parse(offering.lines[0].value)).toEqual({
      kind: "list",
      title: "Three verbs",
      prompt: "Name three verbs from the passage.",
      parts: ["one", "two", "three"],
      cap: 0,
      choices: [],
      piles: [],
      notes: "",
      takes: { from: 0, use: "" },
      position: 1,
    });
    expect(JSON.parse(offering.lines[1].value)).toMatchObject({
      takes: { from: 1, use: "context" },
      position: 2,
    });

    for (const line of offering.lines) {
      const taken = await json(
        await post(edge, "/live/edits/take", { suggestion: line.suggestion }, cookie),
      );
      expect(taken.applied).toBe(true);
    }
    const built = await until(
      () => rounds(edge, cookie, relay),
      (all) => all.length === 2 && all[1].takes.length === 1,
    );
    expect(built.map((round) => round.title)).toEqual(["Three verbs", "The stranger"]);
    expect(built.map((round) => round.number)).toEqual([1, 2]);
    expect(built[0].parts).toEqual(["one", "two", "three"]);
    expect(built[0].prompt).toBe("Name three verbs from the passage.");
    expect(built[1].parts).toEqual([]);
    expect(built[1].takes).toEqual([{ source: built[0].leg, sourceNumber: 1, use: "context" }]);

    const settled = await until(
      () => offerings(edge, cookie, relay),
      (all) => all[0].lines.every((line) => line.standing === "taken"),
    );
    expect(settled[0].lines.every((line) => line.standing === "taken")).toBe(true);

    // Drafted again unchanged, the relay as it stands is offered as one keep line.
    const second = await draft(
      edge,
      cookie,
      relay,
      "Two rounds: three verbs from the passage, then the stranger.",
      1,
    );
    expect(second.lines.map((line) => line.kind)).toEqual(["keep"]);

    // Delivered the other way about with their numbers kept, the two rounds
    // are offered as one move and the takes the stranger drops; taking the
    // move reorders the standing rounds rather than rewriting them.
    const third = await draft(edge, cookie, relay, "Swap the two rounds.", 2);
    expect(third.lines.map((line) => [line.kind, line.target])).toEqual([
      ["takes", built[1].leg],
      ["move", built[1].leg],
    ]);
    for (const line of third.lines) {
      await post(edge, "/live/edits/take", { suggestion: line.suggestion }, cookie);
    }
    const swapped = await until(
      () => rounds(edge, cookie, relay),
      (all) => all[0].title === "The stranger",
    );
    expect(swapped.map((round) => [round.leg, round.number])).toEqual([
      [built[1].leg, 1],
      [built[0].leg, 2],
    ]);
    expect(swapped[0].takes).toEqual([]);
  });

  test("a round drafted again is revised in place, and a declined line changes nothing", async () => {
    const relay = await plan(edge, cookie, "One round");
    await post(
      edge,
      "/live/relays/add-round",
      {
        relay,
        title: "Pace",
        prompt: "How is the pace?",
        parts: [],
        cap: 0,
        choices: [],
      },
      cookie,
    );
    const [standing] = await rounds(edge, cookie, relay);

    const offering = await draft(edge, cookie, relay, "Reword the round.", 0);
    expect(offering.lines.map((line) => line.kind)).toEqual(["title", "prompt"]);
    expect(offering.lines.map((line) => line.target)).toEqual([standing.leg, standing.leg]);
    expect(offering.lines[0].value).toBe("Warm-up");
    expect(offering.lines[1].value).toBe("In one word, how is the pace so far?");

    await post(edge, "/live/edits/decline", { suggestion: offering.lines[0].suggestion }, cookie);
    await post(edge, "/live/edits/take", { suggestion: offering.lines[1].suggestion }, cookie);
    const revised = await until(
      () => rounds(edge, cookie, relay),
      (all) => all[0].prompt !== standing.prompt,
    );
    expect(revised.length).toBe(1);
    expect(revised[0].leg).toBe(standing.leg);
    expect(revised[0].title).toBe("Pace");
    expect(revised[0].prompt).toBe("In one word, how is the pace so far?");

    const settled = await until(
      () => offerings(edge, cookie, relay),
      (all) => all[0].lines.every((line) => line.standing !== "pending"),
    );
    expect(settled[0].lines.map((line) => line.standing)).toEqual(["declined", "taken"]);
  });

  test("a reply that cannot be read is stood upon once, and the second reply is offered", async () => {
    const relay = await plan(edge, cookie, "Unreadable first");
    const offering = await draft(
      edge,
      cookie,
      relay,
      "Draft one round; the first reply is unreadable.",
      0,
    );
    expect(offering.lines.map((line) => line.kind)).toEqual(["add"]);
    expect(JSON.parse(offering.lines[0].value).title).toBe("Warm-up");

    const [insistence] = await edge.application.concepts.Insisting._for({ aim: relay });
    expect(insistence.satisfied).toBe(true);
  });

  test("a drafted round arrives with its standing piles and its note, and a redraft revises them", async () => {
    const relay = await plan(edge, cookie, "What went wrong");
    const offering = await draft(edge, cookie, relay, "One round: what went wrong.", 0);
    expect(offering.lines.map((line) => line.kind)).toEqual(["add"]);
    expect(JSON.parse(offering.lines[0].value)).toMatchObject({
      piles: [
        { name: "Pace", sentence: "It was too slow to use." },
        { name: "Crashes", sentence: "It stopped working outright." },
      ],
      notes: "Group by what went wrong, not by which app it happened in.",
    });
    await post(edge, "/live/edits/take", { suggestion: offering.lines[0].suggestion }, cookie);
    const built = await until(
      () => rounds(edge, cookie, relay),
      (all) => all.length === 1 && all[0].piles.length === 2 && all[0].notes !== "",
    );
    expect(built[0].piles.map((pile) => [pile.name, pile.description])).toEqual([
      ["Pace", "It was too slow to use."],
      ["Crashes", "It stopped working outright."],
    ]);
    expect(built[0].notes).toBe("Group by what went wrong, not by which app it happened in.");
    // The follow-on lines are about the round, not the relay: the panel sees one offering.
    expect((await offerings(edge, cookie, relay)).length).toBe(1);

    // Piles and the note changed by hand are read back into the next draft, and
    // a draft that changes them is offered as pile, unpile, and notes lines.
    await post(
      edge,
      "/live/rounds/rename-pile",
      { pile: built[0].piles[1].pile, name: "Freezes" },
      cookie,
    );
    await post(
      edge,
      "/live/rounds/set-notes",
      { leg: built[0].leg, body: "Keep it short." },
      cookie,
    );
    const again = await draft(edge, cookie, relay, "Draft again: what went wrong.", 1);
    expect(again.lines.map((line) => [line.kind, line.value])).toEqual([
      ["pile", JSON.stringify({ name: "Crashes", sentence: "It stopped working outright." })],
      ["unpile", "Freezes"],
      ["notes", "Group by what went wrong, not by which app it happened in."],
    ]);
    for (const line of again.lines) {
      await post(edge, "/live/edits/take", { suggestion: line.suggestion }, cookie);
    }
    const revised = await until(
      () => rounds(edge, cookie, relay),
      (all) => all[0].piles.map((pile) => pile.name).join() === "Pace,Crashes",
    );
    expect(revised[0].piles.map((pile) => pile.name)).toEqual(["Pace", "Crashes"]);
    expect(revised[0].notes).toBe("Group by what went wrong, not by which app it happened in.");
  }, 60_000);
});
