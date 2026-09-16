import { MongoClient } from "mongodb";
import { afterAll, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb, testDbUri } from "../../src/concepts/testing.ts";

/**
 * The most commands one cold wall read may cost the database, counted on a
 * client of its own: a room of 45 cards in 8 piles, read by an edge that has
 * not read it before, so every concept query goes to the database.
 */
const COMMANDS_PER_COLD_READ = 20;

/**
 * The most commands one cold sort tick may cost the same room when there is
 * nothing to do: its gates and the passage's inputs, none of them growing with
 * the room or the deployment, and the one declined proposal it records.
 */
const COMMANDS_PER_IDLE_TICK = 17;

/**
 * The most commands one cold arrive may cost on a three-round run: the relay
 * face's reads, one set per leg, none of them growing with the deployment.
 */
const COMMANDS_PER_COLD_ARRIVE = 15;

const READS = ["find", "aggregate", "count", "countDocuments", "distinct"];
const WRITES = ["insert", "update", "delete", "findAndModify"];

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
  const registered = await edge.application.concepts.Authenticating.register({
    username: "omar",
    password: "password123",
    email: "omar@example.com",
  });
  await edge.application.concepts.Profiling.createProfile({
    user: registered.user,
    displayName: "Omar",
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
  const login = await post(edge, "/auth/login", { username: "omar", password: "password123" });
  return login.headers.get("Set-Cookie")?.split(";")[0] as string;
}

async function until<Value>(read: () => Promise<Value>, done: (value: Value) => boolean) {
  let value = await read();
  for (let attempt = 0; attempt < 60 && !done(value); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    value = await read();
  }
  return value;
}

afterAll(stopTestDb);

/** A room of 45 cards, 40 of them in 8 piles, one removed, and four in the tray. */
async function stageRoom() {
  const db = await testDb();
  const edge = createEdge(mongoImplementations(db));
  const cookie = await registerHost(edge);
  const call = async (path: string, body: unknown, as = cookie) =>
    json(await post(edge, path, body, as));

  const { relay } = await call("/live/relays/plan", { title: "Cost" });
  const { leg } = await call("/live/relays/add-round", {
    relay,
    title: "Cost",
    prompt: "What would help?",
    parts: [],
    cap: 0,
    choices: [],
  });
  const launched = await call("/live/relays/launch", { relay });
  const run = launched.run as string;
  const token = launched.token as string;
  const { round } = await call("/live/relays/open-round", { run, leg });
  for (const seat of ["seat-1", "seat-2"]) await call("/live/runs/invite", { run, device: seat });
  const arrived = await until(
    async () =>
      (await json(await post(edge, "/live/p/arrive", { token }))).relay as unknown as {
        openRound: string | null;
        questions: { question: string }[];
      },
    (found) => found.openRound !== null && found.questions.length > 0,
  );
  const question = arrived.questions[0]!.question;
  const devices = [...Array.from({ length: 43 }, (_, seat) => `phone-${seat}`), "seat-1", "seat-2"];
  for (const [index, device] of devices.entries()) {
    const { response } = await call("/live/p/begin", { token, device });
    await call("/live/p/answer", { response, question, value: `answer ${index}` });
    await call("/live/p/submit", { response });
  }
  const readWall = async () =>
    (await call("/live/walls/read", { round })).wall as unknown as {
      cards: { card: string }[];
    };
  const cards = (await until(readWall, (wall) => wall.cards.length === 45)).cards;
  const piles: string[] = [];
  for (let index = 0; index < 8; index += 1) {
    const opened = await call("/live/walls/open-pile", {
      round,
      name: `pile ${index}`,
      card: cards[index]!.card,
    });
    piles.push(opened.pile as string);
  }
  for (let index = 8; index < 40; index += 1) {
    await call("/live/walls/move-card", { card: cards[index]!.card, pile: piles[index % 8]! });
  }
  for (const pile of piles.slice(0, 4)) {
    await edge.application.concepts.Guiding.set({
      subject: pile,
      use: "pile-definition",
      title: "",
      body: "A definition.",
    });
  }
  await call("/live/walls/remove-card", { round, card: cards[41]!.card });
  return { db, edge, call, run, round, cards, piles };
}

interface Command {
  name: string;
  collection: string;
  filter: Record<string, unknown>;
}

/**
 * A second edge on a client of its own reads the same room cold, and the
 * client reports every command the invocation sends.
 */
async function coldEdge(db: Awaited<ReturnType<typeof testDb>>) {
  const monitored = new MongoClient(await testDbUri(), { monitorCommands: true });
  await monitored.connect();
  const cold = createEdge(mongoImplementations(monitored.db(db.databaseName)));
  const login = await post(cold, "/auth/login", { username: "omar", password: "password123" });
  const coldCookie = login.headers.get("Set-Cookie")?.split(";")[0] as string;
  const session = coldCookie.slice(coldCookie.indexOf("=") + 1);
  const commands: Command[] = [];
  monitored.on("commandStarted", (event) => {
    if (!READS.includes(event.commandName) && !WRITES.includes(event.commandName)) return;
    const filter = (event.command.filter ?? event.command.query ?? {}) as Record<string, unknown>;
    commands.push({
      name: event.commandName,
      collection: String(event.command[event.commandName]),
      filter,
    });
  });
  // The access gate's own reads are not the invocation's.
  const gate = /^(sessioning|roling|archiving)\./;
  const own = () => commands.filter((command) => !gate.test(command.collection));
  const summary = () =>
    [
      ...own().reduce((tally, command) => {
        const key = `${command.name} ${command.collection} ${Object.keys(command.filter).join(",")}`;
        tally.set(key, (tally.get(key) ?? 0) + 1);
        return tally;
      }, new Map<string, number>()),
    ]
      .sort((a, b) => b[1] - a[1])
      .map(([command, count]) => `${count} × ${command}`)
      .join("\n");
  return {
    cold,
    session,
    own,
    summary,
    close: () => monitored.close(),
  };
}

test("a cold wall read at 45 cards and 8 piles costs a bounded number of commands", async () => {
  const { db, round } = await stageRoom();
  const { cold, session, own, summary, close } = await coldEdge(db);
  try {
    // The invocation alone, without the HTTP gate's own session reads.
    const answered = await cold.gateway.invoke("/live/walls/read", { session, round });
    expect(answered.ok).toBe(true);
    const read = (answered as { value: { wall: { cards: unknown[]; piles: unknown[] } } }).value
      .wall;
    expect(read.cards).toHaveLength(44);
    expect(read.piles).toHaveLength(8);
    const wall = own().filter((command) => READS.includes(command.name));
    expect(wall.length, `commands for one cold read:\n${summary()}`).toBeLessThanOrEqual(
      COMMANDS_PER_COLD_READ,
    );
  } finally {
    await close();
  }
}, 120_000);

/** A read whose filter names no scope reads everything the deployment has stored. */
const unbounded = (command: Command) =>
  READS.includes(command.name) && Object.keys(command.filter).length === 0;

test("a cold sort tick with an empty tray reads nothing that grows and records one declined proposal", async () => {
  const { db, call, round, cards, piles } = await stageRoom();
  for (const index of [40, 42, 43, 44]) {
    await call("/live/walls/move-card", { card: cards[index]!.card, pile: piles[index % 8]! });
  }
  const { cold, session, own, summary, close } = await coldEdge(db);
  try {
    const answered = await cold.gateway.invoke("/live/walls/sort", { session, round });
    expect(answered).toEqual({ ok: true, value: { asked: false } });
    const tick = own();
    expect(tick.filter(unbounded), `unbounded reads:\n${summary()}`).toEqual([]);
    expect(
      tick.filter((command) => WRITES.includes(command.name)).map((command) => command.collection),
    ).toEqual(["commissioning.commissions"]);
    expect(tick.length, `commands for one idle tick:\n${summary()}`).toBeLessThanOrEqual(
      COMMANDS_PER_IDLE_TICK,
    );
    const proposals = await cold.application.concepts.Commissioning._forSubject({
      subject: round,
    });
    expect(proposals.map((proposal) => proposal.status)).toEqual(["declined"]);
  } finally {
    await close();
  }
}, 120_000);

test("a cold sort tick with cards in the tray records one commission and asks once", async () => {
  const { db, round } = await stageRoom();
  const { cold, session, own, summary, close } = await coldEdge(db);
  try {
    const answered = await cold.gateway.invoke("/live/walls/sort", { session, round });
    expect(answered.ok, JSON.stringify(answered)).toBe(true);
    expect((answered as { value: { asked: boolean } }).value.asked).toBe(true);
    expect(own().filter(unbounded), `unbounded reads:\n${summary()}`).toEqual([]);
    const commissions = await cold.application.concepts.Commissioning._forSubject({
      subject: round,
    });
    expect(commissions).toHaveLength(1);
    expect(await cold.application.concepts.Reasoning._pendingAbout({ about: round })).toHaveLength(
      1,
    );
  } finally {
    await close();
  }
}, 120_000);

test("a cold arrive on a three-round run costs a bounded number of commands", async () => {
  const db = await testDb();
  const edge = createEdge(mongoImplementations(db));
  const cookie = await registerHost(edge);
  const call = async (path: string, body: unknown, as = cookie) =>
    json(await post(edge, path, body, as));
  const { relay } = await call("/live/relays/plan", { title: "Arrive" });
  const legs: string[] = [];
  for (const title of ["One", "Two", "Three"]) {
    const { leg } = await call("/live/relays/add-round", {
      relay,
      title,
      prompt: `${title}?`,
      parts: [],
      cap: 0,
      choices: [],
    });
    legs.push(leg as string);
  }
  const launched = await call("/live/relays/launch", { relay });
  const run = launched.run as string;
  const token = launched.token as string;
  await call("/live/relays/open-round", { run, leg: legs[0]! });
  const { cold, own, summary, close } = await coldEdge(db);
  try {
    const answered = await cold.gateway.invoke("/live/p/arrive", { token });
    expect(answered.ok, JSON.stringify(answered)).toBe(true);
    const face = (answered as { value: { relay: { rounds: unknown[] } } }).value.relay;
    expect(face.rounds).toHaveLength(3);

    const arrive = own().filter((command) => READS.includes(command.name));
    expect(arrive.filter(unbounded), `unbounded reads:\n${summary()}`).toEqual([]);
    expect(arrive.length, `commands for one cold arrive:\n${summary()}`).toBeLessThanOrEqual(
      COMMANDS_PER_COLD_ARRIVE,
    );
    // The reads the arrive path keys on are served by indexes the concepts own.
    for (const [collection, key] of [
      ["linking.links", { targets: 1 }],
      ["relaying.legs", { material: 1 }],
      ["relaying.legs", { relay: 1, position: 1 }],
      ["sharing.shares", { token: 1 }],
    ] as const) {
      const keys = (await db.collection(collection).indexes()).map((index) => index.key);
      expect(keys, collection).toContainEqual(key);
    }
  } finally {
    await close();
  }
}, 120_000);
