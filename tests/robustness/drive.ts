/**
 * The driver the robustness scenarios share: one signed-in staff member over
 * the edge, relays played in from the deck below, real browser pages for the staff
 * dashboard, the projector, and a phone, scripted phones over the participant
 * endpoints, the wall read back, screenshots to a named directory, and a log
 * of findings. Scenarios run with `bun tests/robustness/scenarios/<name>.ts`
 * against a stack already up on the default ports (`bun dev`).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright";

export const EDGE = process.env.EDGE ?? "http://127.0.0.1:4000";
export const WEB = process.env.WEB ?? "http://127.0.0.1:3000";
export const HOST = { username: "mara", password: "password123" };

export const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Kinds of finding, as the pass types them. */
export type Kind = "broken" | "refused-wrongly" | "slow" | "unclear" | "visual";

export interface Finding {
  kind: Kind;
  title: string;
  steps: string;
  evidence?: string;
  screenshot?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// The log: findings, timings, refusals, and page errors, written at the end.
// ---------------------------------------------------------------------------

export class Log {
  readonly findings: Finding[] = [];
  readonly events: string[] = [];
  private readonly started = Date.now();

  constructor(
    readonly arm: string,
    readonly dir: string,
  ) {
    mkdirSync(dir, { recursive: true });
  }

  stamp(): string {
    return `[${((Date.now() - this.started) / 1000).toFixed(1)}s]`;
  }

  note(text: string) {
    const line = `${this.stamp()} ${text}`;
    this.events.push(line);
    console.log(line);
  }

  finding(finding: Finding) {
    this.findings.push(finding);
    this.note(`FINDING ${finding.kind}: ${finding.title}`);
  }

  /** Times a step; anything over three seconds is a `slow` finding. */
  async timed<Value>(title: string, run: () => Promise<Value>, limit = 3000): Promise<Value> {
    const from = Date.now();
    try {
      return await run();
    } finally {
      const took = Date.now() - from;
      this.note(`${title} took ${took}ms`);
      if (took > limit) {
        this.finding({
          kind: "slow",
          title: `${title} took ${(took / 1000).toFixed(1)}s`,
          steps: title,
        });
      }
    }
  }

  /** Records a refusal the scenario did not expect. */
  refused(title: string, steps: string, reply: unknown) {
    this.finding({
      kind: "refused-wrongly",
      title,
      steps,
      error: JSON.stringify(reply),
    });
  }

  write() {
    writeFileSync(
      resolve(this.dir, "findings.json"),
      JSON.stringify({ arm: this.arm, findings: this.findings, events: this.events }, null, 2),
    );
    this.note(`wrote ${this.findings.length} findings to ${this.dir}/findings.json`);
  }
}

// ---------------------------------------------------------------------------
// The edge: a cookie-carrying client over `/api`.
// ---------------------------------------------------------------------------

export type Reply<Value = Record<string, unknown>> = Value & { error?: string };

export class Client {
  cookie = "";

  constructor(readonly base = `${EDGE}/api`) {}

  async call<Value = Record<string, unknown>>(path: string, data: unknown): Promise<Reply<Value>> {
    const response = await fetch(this.base + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.cookie === "" ? {} : { Cookie: this.cookie }),
      },
      body: JSON.stringify(data),
    });
    const set = response.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0] ?? "";
    const text = await response.text();
    try {
      return JSON.parse(text) as Reply<Value>;
    } catch {
      return { error: `HTTP ${response.status}: ${text.slice(0, 200)}` } as Reply<Value>;
    }
  }
}

export async function signIn(account = HOST): Promise<Client> {
  const client = new Client();
  const reply = await client.call("/auth/login", account);
  if (reply.error) throw new Error(`sign in as ${account.username}: ${reply.error}`);
  return client;
}

// ---------------------------------------------------------------------------
// Relays: the deck copied, launched, and run.
// ---------------------------------------------------------------------------

/**
 * The deck the scenarios play in: relays as a staff member would write them,
 * kept here because the harness is the only thing that still copies one.
 */
export interface DeckRound {
  title: string;
  prompt: string;
  parts: string[];
  cap: number;
  choices: string[];
  /** The round it takes from, by number, and the use; absent when it takes nothing. */
  takes?: { from: number; use: "context" | "choices" | "parts" };
}

export interface DeckRelay {
  key: string;
  title: string;
  rounds: DeckRound[];
}

export const DECK: DeckRelay[] = [
  {
    key: "three-verbs",
    title: "Three verbs, then a stranger",
    rounds: [
      {
        title: "Three verbs",
        prompt: "Three verbs a bookmark needs.",
        parts: ["one", "two", "three"],
        cap: 0,
        choices: [],
      },
      {
        title: "The stranger",
        prompt: "Only these verbs. What is it?",
        parts: [],
        cap: 0,
        choices: [],
        takes: { from: 1, use: "context" },
      },
    ],
  },
  {
    key: "name-the-activity",
    title: "Name the activity",
    rounds: [
      {
        title: "One word",
        prompt: "DoorDash, the screen before you order. One word for what this lets you do.",
        parts: [],
        cap: 0,
        choices: [],
      },
    ],
  },
  {
    key: "fix-the-spec",
    title: "Fix the spec",
    rounds: [
      {
        title: "Rewrite",
        prompt:
          "“Manages the lifecycle of bookings, including creation, modification, and cancellation.” Rewrite it as a purpose.",
        parts: [],
        cap: 0,
        choices: [],
      },
      {
        title: "Vote",
        prompt: "Which rewrite is the purpose?",
        parts: [],
        cap: 0,
        choices: [],
        takes: { from: 1, use: "choices" },
      },
    ],
  },
];

export interface Relay {
  relay: string;
  legs: string[];
  title: string;
}

export function deck(key: string): DeckRelay {
  const found = DECK.find((entry) => entry.key === key);
  if (found === undefined) throw new Error(`no deck relay ${key}`);
  return found;
}

/** Copies a deck relay exactly as a staff member would write it by hand. */
export async function copyDeck(host: Client, key: string, title?: string): Promise<Relay> {
  const source = deck(key);
  const planned = await host.call<{ relay: string }>("/live/relays/plan", {
    title: title ?? source.title,
  });
  if (planned.error) throw new Error(`plan: ${planned.error}`);
  const legs: string[] = [];
  for (const round of source.rounds) {
    const added = await host.call<{ leg: string }>("/live/relays/add-round", {
      relay: planned.relay,
      title: round.title,
      prompt: round.prompt,
      parts: round.parts,
      cap: round.cap,
      choices: round.choices,
    });
    if (added.error) throw new Error(`add-round: ${added.error}`);
    legs.push(added.leg);
  }
  for (const [index, round] of source.rounds.entries()) {
    if (round.takes === undefined) continue;
    const drawn = await host.call("/live/relays/set-takes", {
      leg: legs[index],
      source: legs[round.takes.from - 1],
      use: round.takes.use,
    });
    if (drawn.error) throw new Error(`set-takes: ${drawn.error}`);
  }
  return { relay: planned.relay, legs, title: title ?? source.title };
}

export interface Run {
  run: string;
  token: string;
  code: string;
}

export async function launch(host: Client, relay: string): Promise<Run> {
  const launched = await host.call<Run>("/live/relays/launch", { relay });
  if (launched.error) throw new Error(`launch: ${launched.error}`);
  return { run: launched.run, token: launched.token, code: launched.code };
}

/** Opens a round and answers its edition id, or throws with the refusal. */
export async function openRound(host: Client, run: string, leg: string): Promise<string> {
  const opened = await host.call<{ round: string }>("/live/relays/open-round", { run, leg });
  if (opened.error) throw new Error(`open-round: ${opened.error}`);
  return opened.round;
}

// ---------------------------------------------------------------------------
// Reads.
// ---------------------------------------------------------------------------

export interface Face {
  relay: {
    run: string;
    title: string;
    open: boolean;
    openRound: string | null;
    questions: {
      question: string;
      prompt: string;
      choices: string[];
      parts: string[];
      cap: number;
      position: number;
    }[];
    rounds: {
      leg: string;
      number: number;
      title: string;
      round: string | null;
      open: boolean | null;
    }[];
  } | null;
}

export interface Wall {
  round: string;
  number: number;
  title: string;
  open: boolean;
  begun: number;
  handedIn: number;
  questions: Face["relay"] extends infer R ? (R extends { questions: infer Q } ? Q : never) : never;
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
    count: number;
    picked: string | null;
  }[];
}

export interface RunRead {
  run: {
    run: string;
    relay: string;
    title: string;
    open: boolean;
    token: string;
    code: string;
    openRound: string | null;
    rounds: {
      leg: string;
      number: number;
      title: string;
      round: string | null;
      figure: { round: string | null; open: boolean | null; begun: number; handedIn: number };
      takes: number;
    }[];
  };
}

export const arrive = (client: Client, token: string) =>
  client.call<Face>("/live/p/arrive", { token });
export const readWall = (host: Client, round: string) =>
  host.call<{ wall: Wall | null }>("/live/walls/read", { round });
export const readRun = (host: Client, run: string) =>
  host.call<RunRead>("/live/relays/run", { run });

/** Polls a read until it settles; answers the last value either way. */
export async function until<Value>(
  read: () => Promise<Value>,
  done: (value: Value) => boolean,
  tries = 60,
  every = 1000,
): Promise<Value> {
  let value = await read();
  for (let attempt = 0; attempt < tries && !done(value); attempt += 1) {
    await sleep(every);
    value = await read();
  }
  return value;
}

/** Waits for the open round's face and answers it with the round and its question. */
export async function openFace(client: Client, token: string, notRound?: string | null) {
  const face = await until(
    () => arrive(client, token),
    (value) =>
      value.relay?.openRound != null &&
      value.relay.openRound !== notRound &&
      (value.relay.questions.length ?? 0) > 0,
  );
  const relay = face.relay;
  if (relay?.openRound == null) throw new Error(`no round open: ${JSON.stringify(face)}`);
  const question = relay.questions[0];
  if (question === undefined) throw new Error("the open round has no question");
  return { round: relay.openRound, question, face };
}

// ---------------------------------------------------------------------------
// Scripted phones over the participant endpoints. No session; a device name.
// ---------------------------------------------------------------------------

export class Phone {
  readonly client = new Client();
  response = "";

  constructor(
    readonly token: string,
    readonly device: string,
  ) {}

  async begin() {
    const begun = await this.client.call<{ response: string }>("/live/p/begin", {
      token: this.token,
      device: this.device,
    });
    if (!begun.error) this.response = begun.response;
    return begun;
  }

  answer(question: string, part: number | null, value: string) {
    return this.client.call("/live/p/answer", {
      response: this.response,
      question: part === null ? question : `${question}#${part}`,
      value,
    });
  }

  submit() {
    return this.client.call("/live/p/submit", { response: this.response });
  }

  wall() {
    return this.client.call<{ wall: Wall | null }>("/live/p/wall", { response: this.response });
  }

  /** Begin, answer every part (or the one box), hand in; answers every reply. */
  async handIn(
    question: { question: string; parts: string[]; cap: number },
    valueFor: (part: number) => string,
  ) {
    const begun = await this.begin();
    if (begun.error) return { begun, answers: [], submitted: begun };
    const boxes =
      question.parts.length > 1 || question.cap > 1
        ? question.cap > 1
          ? question.cap
          : question.parts.length
        : question.parts.length === 1
          ? 1
          : 0;
    const answers = [];
    if (boxes === 0) answers.push(await this.answer(question.question, null, valueFor(1)));
    for (let part = 1; part <= boxes; part += 1) {
      answers.push(await this.answer(question.question, part, valueFor(part)));
    }
    const submitted = await this.submit();
    return { begun, answers, submitted };
  }
}

/** N scripted phones handing in, in order; answers the phones for later rounds. */
export async function phones(
  token: string,
  count: number,
  question: { question: string; parts: string[]; cap: number },
  valueFor: (seat: number, part: number) => string,
  prefix = "phone",
): Promise<Phone[]> {
  const seats: Phone[] = [];
  for (let seat = 0; seat < count; seat += 1) {
    const phone = new Phone(token, `${prefix}-${seat}`);
    await phone.handIn(question, (part) => valueFor(seat, part));
    seats.push(phone);
  }
  return seats;
}

// ---------------------------------------------------------------------------
// The model: participants invited, the sort switch ticked.
// ---------------------------------------------------------------------------

export async function invite(host: Client, run: string, count: number) {
  const replies = [];
  for (let seat = 0; seat < count; seat += 1) {
    replies.push(
      await host.call<{ participant: string }>("/live/relays/invite", {
        run,
        device: `model-${crypto.randomUUID()}`,
      }),
    );
  }
  return replies;
}

/**
 * Plays the dashboard's "Model sorts" switch: asks the wall to sort every
 * three seconds until nothing sits in the tray (or the tries run out), and
 * answers how many ticks and asks it took.
 */
export async function sortUntilPlaced(
  host: Client,
  round: string,
  expectedCards: number | null = null,
  tries = 60,
) {
  let ticks = 0;
  let asks = 0;
  let wall = (await readWall(host, round)).wall;
  const settled = (value: Wall | null) =>
    value !== null &&
    value.cards.length > 0 &&
    (expectedCards === null || value.cards.length >= expectedCards) &&
    value.cards.every((card) => card.pile !== null);
  while (!settled(wall) && ticks < tries) {
    const asked = await host.call<{ asked: boolean }>("/live/walls/sort", { round });
    if (asked.asked) asks += 1;
    ticks += 1;
    await sleep(3000);
    wall = (await readWall(host, round)).wall;
  }
  return { wall, ticks, asks, settled: settled(wall) };
}

// ---------------------------------------------------------------------------
// Browser pages: staff, projector, phone. Console and network errors are logged.
// ---------------------------------------------------------------------------

export interface Pages {
  browser: Browser;
  close: () => Promise<void>;
  staff: (path: string, width?: number) => Promise<Page>;
  phone: (token: string) => Promise<Page>;
}

const heights: Record<number, number> = { 1920: 1080, 1440: 900, 768: 1024, 390: 844 };

/** Every page reports console errors and failed requests into the log. */
export function watch(page: Page, log: Log, name: string) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (/favicon|Download the React DevTools|Failed to load resource/.test(text)) return;
      log.finding({
        kind: "broken",
        title: `${name}: console error: ${text.slice(0, 120)}`,
        steps: `Open ${name} at ${page.url()}`,
        error: text,
      });
    }
  });
  page.on("pageerror", (error) => {
    log.finding({
      kind: "broken",
      title: `${name}: page error: ${error.message.slice(0, 120)}`,
      steps: `Open ${name} at ${page.url()}`,
      error: error.stack ?? error.message,
    });
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/")) return;
    const path = url.replace(/^.*\/api/, "/api");
    if (response.status() === 401 && name.startsWith("phone")) {
      log.note(`${name}: 401 from ${path}`);
      return;
    }
    // A phone reads its wall only for a response that is in; one that missed
    // the round asks once and is refused, by design, and says so itself.
    if (response.status() === 409 && name.startsWith("phone") && /\/p\/wall/.test(path)) {
      log.note(`${name}: 409 from ${path} (the wall answers only a response that is in)`);
      return;
    }
    if (response.status() >= 400 && response.status() < 500) {
      const body = await response.text().catch(() => "");
      let sent = "";
      try {
        sent = response.request().postData() ?? "";
      } catch {}
      log.note(
        `${name}: ${response.status()} from ${path} sent ${sent.slice(0, 300)} got ${body.slice(0, 300)}`,
      );
      if (path.startsWith("/api/live/")) {
        log.finding({
          kind: "broken",
          title: `${name}: ${response.status()} from ${path}: ${body.slice(0, 80)}`,
          steps: `On ${name} at ${page.url()}; the page sent ${sent.slice(0, 200)}`,
          error: body.slice(0, 500),
        });
      }
      return;
    }
    if (response.status() >= 500) {
      log.finding({
        kind: "broken",
        title: `${name}: ${response.status()} from ${url.replace(/^.*\/api/, "/api")}`,
        steps: `On ${name} at ${page.url()}`,
        error: `${response.status()} ${url}`,
      });
    }
  });
}

export async function pages(_host: Client, log: Log, account = HOST): Promise<Pages> {
  const browser = await chromium.launch();
  const contexts: BrowserContext[] = [];
  let staffContext: BrowserContext | undefined;
  /** Staff pages share one context, signed in once through the login form. */
  const signedIn = async (width: number) => {
    if (staffContext !== undefined) return staffContext;
    staffContext = await browser.newContext({
      viewport: { width, height: heights[width] ?? 900 },
    });
    contexts.push(staffContext);
    const page = await staffContext.newPage();
    await page.goto(`${WEB}/login`);
    await page.getByRole("textbox", { name: "Username" }).fill(account.username);
    await page.getByRole("textbox", { name: "Password" }).fill(account.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/");
    await page.close();
    return staffContext;
  };
  return {
    browser,
    close: async () => {
      for (const context of contexts) await context.close().catch(() => undefined);
      await browser.close();
    },
    staff: async (path, width = 1440) => {
      const context = await signedIn(width);
      const page = await context.newPage();
      await page.setViewportSize({ width, height: heights[width] ?? 900 });
      watch(page, log, `staff ${path}`);
      await page.goto(`${WEB}${path}`);
      return page;
    },
    phone: async (token) => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      contexts.push(context);
      const page = await context.newPage();
      watch(page, log, `phone ${token.slice(0, 8)}`);
      await page.goto(`${WEB}/q/${token}`);
      return page;
    },
  };
}

/** One screenshot at each width, the page grown to its own height. */
export async function snap(
  page: Page,
  log: Log,
  name: string,
  widths: readonly number[] = [1440],
  whole = true,
): Promise<string[]> {
  const paths: string[] = [];
  for (const width of widths) {
    const base = heights[width] ?? 900;
    await page.setViewportSize({ width, height: base });
    await sleep(400);
    if (whole) {
      const tall = (await page.evaluate("document.documentElement.scrollHeight")) as number;
      await page.setViewportSize({ width, height: Math.min(Math.max(base, tall), 5000) });
      await sleep(400);
    }
    const path = resolve(log.dir, `${name}@${width}.png`);
    await page.screenshot({ path });
    paths.push(path);
  }
  return paths;
}

/** The output directory for one arm. */
export function outDir(arm: string): string {
  return resolve(import.meta.dirname, "../../test-results/robustness", arm);
}
