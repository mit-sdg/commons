import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

/**
 * The wall on one fixed room, read through all three wall endpoints at four
 * moments and written down as one line per fact: each card by its place, its
 * pile and its marks; each pile by its name, its count, its texts and whether
 * it was picked; and the figures and flags of each moment. Any change
 * to what the wall says has to be made on purpose, and a diff names the fact.
 * Re-pin only on purpose: `WALL_GOLDEN=pin`.
 */
const GOLDEN = new URL("./fixtures/wall-golden.txt", import.meta.url);

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

async function register(edge: Edge, username: string, host = false) {
  const registered = await edge.application.concepts.Authenticating.register({
    username,
    password: "password123",
    email: `${username}@example.com`,
  });
  await edge.application.concepts.Profiling.createProfile({
    user: registered.user,
    displayName: username,
  });
  if (host) {
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
  const login = await post(edge, "/auth/login", { username, password: "password123" });
  return {
    user: registered.user,
    cookie: login.headers.get("Set-Cookie")?.split(";")[0] as string,
  };
}

async function until<Value>(read: () => Promise<Value>, done: (value: Value) => boolean) {
  let value = await read();
  for (let attempt = 0; attempt < 60 && !done(value); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    value = await read();
  }
  return value;
}

interface Wall {
  number: number;
  title: string;
  open: boolean;
  openedAt: string | null;
  closedAt: string | null;
  questions: {
    prompt: string;
    choices: string[];
    parts: string[];
    cap: number;
    context: unknown[];
    contextUse: string;
    position: number;
  }[];
  failure: string | null;
  failedAt: string | null;
  notes: string;
  sortPending: boolean;
  asksOut: number;
  begun: number;
  handedIn: number;
  begunByModel: number;
  handedInByModel: number;
  cards: {
    card: string;
    value: string;
    part: string;
    pile: string | null;
    model: boolean;
    mine: boolean;
  }[];
  piles: {
    pile: string;
    name: string;
    description: string;
    definition: string;
    legacyText: string;
    count: number;
    picked: string | null;
  }[];
}

let edge: Edge;
let cookie: string;

const call = async (path: string, body: unknown, as = cookie) =>
  json(await post(edge, path, body, as));

const readWall = async (round: string) =>
  (await call("/live/walls/read", { round })).wall as unknown as Wall;

async function openRound(title: string, parts: string[]) {
  const { relay } = await call("/live/relays/plan", { title });
  const { leg } = await call("/live/relays/add-round", {
    relay,
    title,
    prompt: `${title}?`,
    parts,
    cap: 0,
    choices: [],
  });
  return { relay, leg };
}

async function face(token: string) {
  return until(
    async () =>
      (await json(await post(edge, "/live/p/arrive", { token }))).relay as unknown as {
        openRound: string | null;
        questions: { question: string }[];
      },
    (found) => found.openRound !== null && found.questions.length > 0,
  );
}

async function handIn(token: string, device: string, value: string) {
  const arrived = await face(token);
  const { response } = await call("/live/p/begin", { token, device });
  await call("/live/p/answer", { response, question: arrived.questions[0]!.question, value });
  await call("/live/p/submit", { response });
  return response as string;
}

const quoted = (text: string) => JSON.stringify(text);
const listed = (items: unknown[]) => (items.length === 0 ? "none" : items.map(String).join(", "));

/** One line per fact of the wall, with no identity or date on any of them. */
function digest(moment: string, wall: Wall): string[] {
  const named = new Map(wall.piles.map((pile) => [pile.pile, pile.name]));
  const flags = [
    wall.open ? "open" : "closed",
    wall.openedAt === null ? "not opened" : "opened",
    wall.closedAt === null ? "not closed" : "closed at a time",
    `${wall.asksOut} ask${wall.asksOut === 1 ? "" : "s"} out`,
    wall.sortPending ? "sort pending" : "sort settled",
  ];
  const lines = [
    `# ${moment}`,
    `round ${wall.number} ${quoted(wall.title)}: ${flags.join(", ")}`,
    ...wall.questions.map(
      (question) =>
        `question ${question.position} ${quoted(question.prompt)}: parts ${listed(question.parts)}; choices ${listed(question.choices)}; cap ${question.cap}; context ${question.context.length} as ${question.contextUse}`,
    ),
    `notes ${wall.notes === "" ? "none" : quoted(wall.notes)}`,
    `failure ${wall.failure === null ? "none" : quoted(wall.failure)}${wall.failedAt === null ? "" : " at a time"}`,
    `figures ${wall.begun} begun, ${wall.handedIn} handed in, ${wall.begunByModel} begun by model, ${wall.handedInByModel} handed in by model`,
  ];
  for (const [index, card] of wall.cards.entries()) {
    const marks = [card.model ? "model" : "", card.mine ? "mine" : ""].filter(Boolean);
    lines.push(
      `card ${index + 1} ${quoted(card.value)}${card.part === "" ? "" : ` part ${quoted(card.part)}`} ${card.pile === null ? "in the tray" : `in ${quoted(named.get(card.pile) ?? "a pile not on this wall")}`}${marks.length === 0 ? "" : ` ${marks.join(" ")}`}`,
    );
  }
  for (const [index, pile] of wall.piles.entries()) {
    const texts = [
      pile.description === "" ? "" : `description ${quoted(pile.description)}`,
      pile.definition === "" ? "" : `definition ${quoted(pile.definition)}`,
      pile.legacyText === "" ? "" : `legacy text ${quoted(pile.legacyText)}`,
    ].filter(Boolean);
    lines.push(
      `pile ${index + 1} ${quoted(pile.name)}: ${pile.count} card${pile.count === 1 ? "" : "s"}; ${texts.length === 0 ? "no text" : texts.join("; ")}; ${pile.picked === null ? "not picked" : "picked"}`,
    );
  }
  return lines;
}

beforeAll(async () => {
  edge = createEdge(mongoImplementations(await testDb()));
  cookie = (await register(edge, "omar", true)).cookie;
});

afterAll(stopTestDb);

test("the wall's digest on a fixed room matches the golden line for line", async () => {
  const reads: [string, Wall][] = [];
  const read = async (moment: string, path: string, body: unknown, as?: string) => {
    const wall = (await call(path, body, as)).wall as unknown as Wall;
    reads.push([moment, wall]);
    return wall;
  };

  // An anonymous run: one written round, ten phones and two model seats.
  const written = await openRound("What would help", []);
  const launched = await call("/live/relays/launch", { relay: written.relay });
  const run = launched.run as string;
  const token = launched.token as string;
  const { round } = await call("/live/relays/open-round", { run, leg: written.leg });
  await call("/live/walls/set-notes", { round, body: "Group by the kind of help asked for." });
  for (const seat of ["seat-1", "seat-2"]) {
    await call("/live/runs/invite", { run, device: seat });
  }
  const responses: string[] = [];
  for (let phone = 0; phone < 10; phone += 1) {
    responses.push(await handIn(token, `phone-${phone}`, `answer ${phone}`));
  }
  for (const seat of ["seat-1", "seat-2"]) {
    responses.push(await handIn(token, seat, `a seat's answer from ${seat}`));
  }
  const cards = (
    await until(
      () => readWall(round),
      (wall) => wall.cards.length === 12,
    )
  ).cards;
  expect(cards).toHaveLength(12);

  // Three piles, nine cards placed, the tenth and the seats' two left in the tray.
  const piles: string[] = [];
  for (const [index, name] of ["more help", "more time", "better tools"].entries()) {
    const opened = await call("/live/walls/open-pile", { round, name, card: cards[index]!.card });
    piles.push(opened.pile as string);
  }
  for (let index = 3; index < 9; index += 1) {
    await call("/live/walls/move-card", { card: cards[index]!.card, pile: piles[index % 3]! });
  }
  for (const [index, pile] of piles.slice(0, 2).entries()) {
    await edge.application.concepts.Guiding.set({
      subject: pile,
      use: "pile-definition",
      title: "",
      body: `Cards asking for ${["help", "time"][index]}.`,
    });
  }
  await call("/live/walls/describe-pile", {
    pile: piles[1],
    description: "The room wants more of this.",
  });
  // One placed card removed: the hand-in stays counted, the card is gone.
  await call("/live/walls/remove-card", { round, card: cards[6]!.card });

  // A sort asked by hand: an ask is out and the round's lock is held.
  expect((await call("/live/walls/sort-now", { round })).asked).toBe(true);
  const openStaff = await read("open, staff", "/live/walls/read", { round });
  const openPhone = await read("open, phone", "/live/p/wall", { response: responses[4] });
  const openSeat = await read("open, model seat", "/live/p/wall", { response: responses[11] });
  expect(openStaff.asksOut).toBe(1);
  expect(openStaff.sortPending).toBe(true);
  expect(openPhone.cards.filter((card) => card.mine)).toHaveLength(1);
  expect(openSeat.cards.filter((card) => card.model)).toHaveLength(2);

  // The ask fails; the lock is released once the failure's consequences settle.
  const pending = (await edge.application.concepts.Reasoning._pending()).filter(
    (ask) => ask.about === round,
  );
  await edge.application.concepts.Reasoning.fail({
    asking: pending[0]!.asking,
    account: "no reasoner",
    at: new Date(),
  });
  await until(
    () => readWall(round),
    (wall) => !wall.sortPending && wall.asksOut === 0,
  );
  await read("failed, staff", "/live/walls/read", { round });

  // Closed, with two piles picked to carry forward, the third pile first.
  await call("/live/relays/close-round", { round });
  await call("/live/walls/pick", { round, pile: piles[2] });
  await call("/live/walls/pick", { round, pile: piles[0] });
  const closedStaff = await read("closed, staff", "/live/walls/read", { round });
  await read("closed, phone", "/live/p/wall", { response: responses[4] });
  expect(closedStaff.piles.filter((pile) => pile.picked !== null)).toHaveLength(2);

  // A signed run: a two-part round, two signed phones, one pile.
  const parts = await openRound("Idea and why", ["Idea", "Why"]);
  const signed = await call("/live/relays/launch", { relay: parts.relay, requireSignIn: true });
  const signedRound = (await call("/live/relays/open-round", { run: signed.run, leg: parts.leg }))
    .round as string;
  const students = [];
  for (const name of ["alice", "bao"]) students.push(await register(edge, name));
  const signedResponses: string[] = [];
  for (const [index, student] of students.entries()) {
    const arrived = await face(signed.token as string);
    const begun = await call("/live/p/begin-signed", { token: signed.token }, student.cookie);
    const question = arrived.questions[0]!.question;
    await call(
      "/live/p/answer-signed",
      { response: begun.response, question: `${question}#1`, value: `idea ${index}` },
      student.cookie,
    );
    await call(
      "/live/p/answer-signed",
      { response: begun.response, question: `${question}#2`, value: `because ${index}` },
      student.cookie,
    );
    await call("/live/p/submit-signed", { response: begun.response }, student.cookie);
    signedResponses.push(begun.response as string);
  }
  const signedCards = (
    await until(
      () => readWall(signedRound),
      (wall) => wall.cards.length === 4,
    )
  ).cards;
  await call("/live/walls/open-pile", {
    round: signedRound,
    name: "ideas",
    card: signedCards[0]!.card,
  });
  await read("signed, staff", "/live/walls/read", { round: signedRound });
  const signedPhone = await read(
    "signed, phone",
    "/live/p/wall-signed",
    { response: signedResponses[1] },
    students[1]!.cookie,
  );
  expect(signedPhone.cards.filter((card) => card.mine)).toHaveLength(2);

  const actual = `${reads.flatMap(([moment, wall]) => [...digest(moment, wall), ""]).join("\n")}`;
  if (process.env.WALL_GOLDEN === "pin" || !existsSync(GOLDEN)) writeFileSync(GOLDEN, actual);
  expect(actual).toBe(readFileSync(GOLDEN, "utf8"));
}, 120_000);
