/**
 * R7, the sort fan-out. Three dashboards on one run with the model sorting, a
 * wall of 360 cards handed in by scripted phones, and ten minutes of the
 * three-second tick. What is under test is that three dashboards ticking
 * together ask once: no request faults, no insistence over a card the wall
 * already holds, and no more asks than replies.
 *
 * The counts come from the concept floor when `MONGO_URL` names the stack's
 * database — the stack prints it as it starts — and from the dashboards' own
 * sort replies either way.
 *
 *   MONGO_URL=… bun tests/robustness/scenarios/r7-sort-fanout.ts [arm-name]
 */

import type { Page } from "playwright";
import {
  arrive,
  type Client,
  Log,
  outDir,
  pages,
  Phone,
  readWall,
  signIn,
  sleep,
  snap,
  type Wall,
} from "../drive.ts";

const ARM = process.argv[2] ?? "r7-sort-fanout";
const CARDS = Number(process.env.CARDS ?? 360);
const MINUTES = Number(process.env.MINUTES ?? 10);
const AT_ONCE = 12;
const STAFF = [1440] as const;
const MONGO_URL = process.env.MONGO_URL ?? "";

const WORDS = [
  "double booked",
  "lost my place",
  "charged twice",
  "cannot find it",
  "signed out again",
  "the wrong address",
  "too many taps",
  "no receipt",
  "it forgot my cart",
  "the price changed",
];

const log = new Log(ARM, outDir(ARM));

/** One round, one box: every phone's hand-in is one card. */
async function planOneRound(host: Client): Promise<{ relay: string; leg: string }> {
  const planned = await host.call<{ relay: string }>("/live/relays/plan", {
    title: "Sort fan-out",
  });
  if (planned.error) throw new Error(`plan: ${planned.error}`);
  const added = await host.call<{ leg: string }>("/live/relays/add-round", {
    relay: planned.relay,
    title: "One thing",
    prompt: "One thing that went wrong the last time you bought something online.",
    parts: [],
    cap: 0,
    choices: [],
  });
  if (added.error) throw new Error(`add-round: ${added.error}`);
  return { relay: planned.relay, leg: added.leg };
}

/** The phones hand in a dozen at a time, the way a room answers. */
async function fill(token: string, question: { question: string; parts: string[]; cap: number }) {
  let handedIn = 0;
  for (let from = 0; from < CARDS; from += AT_ONCE) {
    const batch = Array.from({ length: Math.min(AT_ONCE, CARDS - from) }, (_, index) => {
      const seat = from + index;
      const phone = new Phone(token, `phone-${seat}`);
      return phone
        .handIn(question, () => `${WORDS[seat % WORDS.length]} ${Math.floor(seat / WORDS.length)}`)
        .then((replies) => (replies.submitted.error === undefined ? 1 : 0));
    });
    for (const done of await Promise.all(batch)) handedIn += done;
  }
  return handedIn;
}

/** What one dashboard's Model sorts switch says. */
async function switchSays(page: Page): Promise<string | null> {
  return await page
    .getByRole("switch", { name: "Model sorts" })
    .first()
    .getAttribute("aria-checked")
    .catch(() => null);
}

interface Counts {
  asks: number;
  replies: number;
  failures: number;
  insistences: number;
  accounts: string[];
}

/** The asks, replies, and complaints the floor recorded about the round. */
async function counts(round: string): Promise<Counts | null> {
  if (MONGO_URL === "") return null;
  // The driver reads the floor the way the stack script does, around Bun's v8.
  const v8 = await import("node:v8");
  v8.startupSnapshot.isBuildingSnapshot = () => false;
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(MONGO_URL);
  try {
    await client.connect();
    const database = client.db();
    const askings = await database
      .collection<{ _id: string; about: string }>("reasoning.askings")
      .find({ about: round })
      .toArray();
    const ids = askings.map((asking) => asking._id);
    const replies = await database
      .collection<{ asking: string }>("reasoning.replies")
      .countDocuments({ asking: { $in: ids } });
    const failures = await database
      .collection<{ asking: string }>("reasoning.failures")
      .countDocuments({ asking: { $in: ids } });
    const insistences = await database
      .collection<{ _id: string; aim: string }>("insisting.insistences")
      .find({ aim: round })
      .toArray();
    const complaints = await database
      .collection<{ insistence: string; account: string }>("insisting.complaints")
      .find({ insistence: { $in: insistences.map((one) => one._id) } })
      .toArray();
    return {
      asks: askings.length,
      replies,
      failures,
      insistences: complaints.length,
      accounts: complaints.map((one) => one.account),
    };
  } finally {
    await client.close();
  }
}

const host = await signIn();
const web = await pages(host, log);
/** Every sort reply the three dashboards read, so the ticks can be counted. */
const ticks: { page: string; asked: boolean }[] = [];
let longest = 0;

try {
  const { relay, leg } = await planOneRound(host);
  const launched = await host.call<{ run: string; token: string }>("/live/relays/launch", {
    relay,
  });
  if (launched.error) throw new Error(`launch: ${launched.error}`);
  const { run, token } = launched;
  const opened = await host.call<{ round: string }>("/live/relays/open-round", { run, leg });
  if (opened.error) throw new Error(`open-round: ${opened.error}`);
  const round = opened.round;
  log.note(`run ${run}, round ${round}`);

  const face = await arrive(host, token);
  const question = face.relay?.questions[0];
  if (question === undefined) throw new Error("the open round has no question");

  const dashboards: Page[] = [];
  for (const name of ["A", "B", "C"]) {
    const page = await web.staff(`/staff/live/run/${run}`);
    page.on("response", (response) => {
      const url = response.url();
      if (!url.includes("/api/live/walls/sort")) return;
      void response
        .json()
        .then((body: { asked?: boolean }) => {
          ticks.push({ page: name, asked: body.asked === true });
        })
        .catch(() => undefined);
    });
    dashboards.push(page);
  }
  await sleep(3000);

  // One dashboard flips the switch; it is the run's, so all three read it on.
  await dashboards[0]?.getByRole("switch", { name: "Model sorts" }).click();
  await sleep(4000);
  const said = await Promise.all(dashboards.map(switchSays));
  log.note(`the three switches read ${JSON.stringify(said)}`);
  if (said.some((one) => one !== "true")) {
    log.finding({
      kind: "broken",
      title: `the run's Model sorts switch does not read on from every dashboard (${JSON.stringify(said)})`,
      steps: "Open three dashboards on one run; turn Model sorts on from the first; wait two polls",
      screenshot: "DashboardBSwitch@1440.png",
    });
  }
  await snap(dashboards[1] as Page, log, "DashboardBSwitch", STAFF);

  const from = Date.now();
  const handedIn = await log.timed(
    `${CARDS} scripted phones hand in`,
    () => fill(token, question),
    300000,
  );
  log.note(`${handedIn} of ${CARDS} phones handed in within ${Date.now() - from}ms`);

  // Ten minutes of the tick, sampled every fifteen seconds.
  const until = Date.now() + MINUTES * 60_000;
  let wall: Wall | null = null;
  while (Date.now() < until) {
    const asked = Date.now();
    const read = await readWall(host, round);
    longest = Math.max(longest, Date.now() - asked);
    wall = read.wall;
    const placed = (wall?.cards ?? []).filter((card) => card.pile !== null).length;
    log.note(
      `${placed} of ${wall?.cards.length ?? 0} cards in ${wall?.piles.length ?? 0} piles; ${ticks.filter((tick) => tick.asked).length} asks sent`,
    );
    await sleep(15000);
  }
  const placed = (wall?.cards ?? []).filter((card) => card.pile !== null).length;
  log.note(
    `after ${Math.round((Date.now() - from) / 1000)}s: ${placed} of ${wall?.cards.length ?? 0} cards placed in ${wall?.piles.length ?? 0} piles`,
  );
  // The wall's own failure line, which the driver's shape does not name.
  const failure = (wall as { failure?: string | null } | null)?.failure ?? null;
  if (failure !== null) log.note(`the wall's last failure: ${failure}`);
  await snap(dashboards[0] as Page, log, "DashboardASorted", STAFF);

  const asked = ticks.filter((tick) => tick.asked).length;
  const recorded = await counts(round);
  log.note(
    `ticks ${ticks.length}, of which asked ${asked}; floor: ${recorded === null ? "not read (no MONGO_URL)" : JSON.stringify(recorded)}; longest wall read ${longest}ms`,
  );
  if (recorded !== null) {
    if (recorded.asks > recorded.replies + recorded.failures + 1) {
      log.finding({
        kind: "broken",
        title: `${recorded.asks} asks stand against ${recorded.replies} replies and ${recorded.failures} failures: the tick asked more than once per reply`,
        steps: `Three dashboards on one ${CARDS}-card wall with Model sorts on for ${MINUTES} minutes`,
        evidence: JSON.stringify(recorded),
      });
    }
    const stale = recorded.accounts.filter((account) => account.includes("waiting in the tray"));
    if (stale.length > 0) {
      log.finding({
        kind: "broken",
        title: `${stale.length} insistences name a card that is not waiting in the tray`,
        steps: `Three dashboards on one ${CARDS}-card wall with Model sorts on for ${MINUTES} minutes`,
        evidence: JSON.stringify(stale.slice(0, 5)),
      });
    }
  }
  if (placed < (wall?.cards.length ?? 0)) {
    log.finding({
      kind: "broken",
      title: `${(wall?.cards.length ?? 0) - placed} of ${wall?.cards.length ?? 0} cards were still in the tray after ${MINUTES} minutes`,
      steps: `Three dashboards on one ${CARDS}-card wall with Model sorts on`,
      evidence: JSON.stringify({ placed, cards: wall?.cards.length, asked }),
    });
  }
} catch (error) {
  log.finding({
    kind: "broken",
    title: `the scenario stopped: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`,
    steps: "See the events log",
    error: error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
} finally {
  await web.close();
  log.write();
}
