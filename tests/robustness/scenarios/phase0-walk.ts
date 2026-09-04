/**
 * The polish pass's phase 0: one Thursday-shaped class walked by hand. A
 * three-round relay (write → list → vote), thirty model seats and one real
 * phone, the dashboard at 1280, the projector at 1920, the phone at 390, in
 * light with dark twins of the two walls. Long animation frames are observed
 * on every wall, the projector is traced through the flood, each screen is
 * reloaded mid-round, and every screen's words are written down at each state.
 *
 *   bun tests/robustness/scenarios/phase0-walk.ts [out-dir]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "playwright";
import {
  invite,
  launch,
  Log,
  openFace,
  pages,
  readWall,
  signIn,
  sleep,
  snap,
  sortUntilPlaced,
  until,
  WEB,
} from "../drive.ts";

const OUT =
  process.argv[2] ?? resolve(process.env.HOME ?? "", "ctx/evaluation/rounds-polish/phase0");
mkdirSync(OUT, { recursive: true });
const log = new Log("phase0", OUT);
const SEATS = 30;
const DASH = 1280;
const WALL = 1920;

/** Chooses dark before the page's first paint, the way the toggle remembers it. */
const darken = `try { localStorage.setItem("theme", "dark"); } catch {}`;

/** Long animation frames, kept on the window for reading back. */
const observeFrames = `
  window.__frames = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__frames.push({ t: entry.startTime, d: entry.duration });
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch {}
`;

async function frames(page: Page, name: string, since: number) {
  const all = (await page.evaluate("(window.__frames ?? [])").catch(() => [])) as {
    t: number;
    d: number;
  }[];
  const recent = all.filter((frame) => frame.t >= since);
  const max = Math.max(0, ...recent.map((frame) => frame.d));
  const over50 = recent.filter((frame) => frame.d > 50).length;
  const over100 = recent.filter((frame) => frame.d > 100).length;
  log.note(
    `${name} frames since ${since.toFixed(0)}: ${recent.length} long, max ${max.toFixed(0)}ms, >50 ${over50}, >100 ${over100}`,
  );
  return { recent, max, over50, over100 };
}

const now = (page: Page) => page.evaluate("performance.now()") as Promise<number>;

async function words(page: Page, name: string) {
  const text = (await page
    .evaluate("document.querySelector('main')?.innerText ?? document.body.innerText")
    .catch(() => "")) as string;
  writeFileSync(resolve(OUT, `${name}.txt`), text);
}

async function reloadTimed(page: Page, name: string, ready: () => Promise<unknown>) {
  const from = Date.now();
  await page.reload();
  await ready();
  const took = Date.now() - from;
  log.note(`${name} reload to interactive: ${took}ms`);
  if (took > 2000)
    log.finding({
      kind: "slow",
      title: `${name} took ${took}ms to reload`,
      steps: `Reload ${name} mid-round`,
    });
}

const host = await signIn();
const web = await pages(host, log);

try {
  // The relay: one word, three verbs over the picked words, a vote over the verbs.
  const planned = await host.call<{ relay: string }>("/live/relays/plan", { title: "Cart" });
  if (planned.error) throw new Error(planned.error);
  const relay = planned.relay;
  const rounds = [
    {
      title: "Name it",
      prompt: "One thing a shopper does with a cart.",
      parts: [],
      cap: 0,
      choices: [],
    },
    {
      title: "Three verbs",
      prompt: "Three verbs the cart needs for these.",
      parts: ["one", "two", "three"],
      cap: 0,
      choices: [],
    },
    { title: "Which one", prompt: "Which verb matters most?", parts: [], cap: 0, choices: [] },
  ];
  const legs: string[] = [];
  for (const round of rounds) {
    const added = await host.call<{ leg: string }>("/live/relays/add-round", { relay, ...round });
    if (added.error) throw new Error(added.error);
    legs.push(added.leg);
  }
  for (const [leg, source, use] of [
    [1, 0, "context"],
    [2, 1, "choices"],
  ] as const) {
    const took = await host.call("/live/relays/set-takes", {
      leg: legs[leg],
      source: legs[source],
      use,
    });
    if (took.error) throw new Error(took.error);
  }
  const { run, token } = await launch(host, relay);
  log.note(`run ${run} token ${token}`);

  const dashboard = await web.staff(`/staff/live/run/${run}`, DASH);
  await dashboard.addInitScript(observeFrames);
  await dashboard.reload();
  const projector = await web.staff(`/staff/live/run/${run}/project`, WALL);
  await projector.addInitScript(observeFrames);
  await projector.reload();
  const phone = await web.phone(token);
  // Dark twins of the two walls.
  const darkContext = await web.browser.newContext({ viewport: { width: WALL, height: 1080 } });
  await darkContext.addInitScript(darken);
  const cookies = await dashboard.context().cookies();
  await darkContext.addCookies(cookies);
  const darkProjector = await darkContext.newPage();
  await darkProjector.goto(`${WEB}/staff/live/run/${run}/project`);
  const darkDashboard = await darkContext.newPage();
  await darkDashboard.setViewportSize({ width: DASH, height: 900 });
  await darkDashboard.goto(`${WEB}/staff/live/run/${run}`);
  await sleep(2500);
  await snap(dashboard, log, "01-dashboard-before", [DASH]);
  await snap(projector, log, "01-projector-before", [WALL], false);
  await snap(phone, log, "01-phone-before", [390]);
  await words(dashboard, "01-dashboard-before");
  await words(phone, "01-phone-before");

  // Thirty seats take their places before the first round.
  const seated = await invite(host, run, SEATS);
  const refusedSeats = seated.filter((reply) => reply.error);
  if (refusedSeats.length > 0)
    log.finding({
      kind: "broken",
      title: `${refusedSeats.length} seats refused`,
      steps: "invite 30",
      evidence: JSON.stringify(refusedSeats[0]),
    });
  await sleep(3500);
  await snap(dashboard, log, "02-dashboard-seated", [DASH]);
  await words(dashboard, "02-dashboard-seated");

  // Round one: one word. The model seats answer; the phone answers too.
  await dashboard.getByRole("button", { name: /^Open.*Name it/ }).click();
  const one = await openFace(host, token);
  await dashboard.getByRole("switch", { name: "Model sorts" }).click();
  await sleep(2000);
  await snap(phone, log, "03-phone-round-one", [390]);
  await words(phone, "03-phone-round-one");
  const fromOne = await now(dashboard);
  const fromOneP = await now(projector);
  // The phone hands in; the hand-in reaches the dashboard's wall when?
  await phone.getByRole("textbox").first().fill("compare prices");
  const handedAt = Date.now();
  await phone.getByRole("button", { name: "Hand in" }).click();
  await dashboard
    .getByText("compare prices", { exact: false })
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() =>
      log.finding({
        kind: "slow",
        title: "the phone's card never reached the dashboard in 15s",
        steps: "hand in on the phone, watch the dashboard",
      }),
    );
  log.note(`hand-in reached the dashboard in ${Date.now() - handedAt}ms`);
  await sleep(6000);
  await snap(dashboard, log, "04-dashboard-streaming", [DASH]);
  await snap(projector, log, "04-projector-streaming", [WALL], false);
  await snap(darkProjector, log, "04-projector-streaming-dark", [WALL], false);
  await snap(phone, log, "04-phone-handed-in", [390]);
  await words(dashboard, "04-dashboard-streaming");
  await words(phone, "04-phone-handed-in");
  const sortedOne = await sortUntilPlaced(host, one.round, SEATS + 1, 80);
  log.note(
    `round one sorted ${sortedOne.settled} ticks ${sortedOne.ticks} asks ${sortedOne.asks} piles ${JSON.stringify(sortedOne.wall?.piles.map((pile) => [pile.name, pile.count]))}`,
  );
  // The projector catches the server up when?
  const settledAt = Date.now();
  const serverCounts = JSON.stringify(
    (sortedOne.wall?.piles ?? []).map((pile) => pile.count).sort((a, b) => b - a),
  );
  await until(
    async () => (await projector.evaluate("document.body.innerText").catch(() => "")) as string,
    (text) => !/Tray\s+[1-9]/.test(text),
    20,
  );
  log.note(
    `the projector's tray emptied ${Date.now() - settledAt}ms after the server settled (${serverCounts})`,
  );
  await frames(dashboard, "dashboard round one", fromOne);
  await frames(projector, "projector round one", fromOneP);
  await sleep(1500);
  await snap(dashboard, log, "05-dashboard-sorted", [DASH]);
  await snap(projector, log, "05-projector-sorted", [WALL], false);
  await snap(darkDashboard, log, "05-dashboard-sorted-dark", [DASH]);
  await snap(phone, log, "05-phone-sorted", [390]);
  await words(dashboard, "05-dashboard-sorted");
  await words(projector, "05-projector-sorted");
  await words(phone, "05-phone-sorted");

  // Close round one; the pick control carries the top piles into round two.
  await dashboard.setViewportSize({ width: DASH, height: 900 });
  await dashboard.getByRole("button", { name: /^Close.*Name it/ }).click();
  await sleep(3000);
  await snap(dashboard, log, "06-dashboard-picked", [DASH]);
  await snap(projector, log, "06-projector-picked", [WALL], false);
  await snap(phone, log, "06-phone-between", [390]);
  await words(dashboard, "06-dashboard-picked");
  await words(phone, "06-phone-between");

  // Round two: three verbs, the flood. Trace the projector through it.
  await web.browser.startTracing(projector, {
    path: resolve(OUT, "projector-round-two.trace.json"),
    screenshots: false,
    categories: [
      "devtools.timeline",
      "disabled-by-default-devtools.timeline.frame",
      "blink.user_timing",
    ],
  });
  await dashboard.getByRole("button", { name: /^Open.*Three verbs/ }).click();
  const two = await openFace(host, token, one.round);
  await sleep(2500);
  await snap(phone, log, "07-phone-round-two", [390]);
  await words(phone, "07-phone-round-two");
  await phone.getByRole("textbox", { name: "one" }).fill("add");
  await phone.getByRole("textbox", { name: "two" }).fill("remove");
  await phone.getByRole("textbox", { name: "three" }).fill("save");
  await phone.getByRole("button", { name: "Hand in" }).click();
  await sleep(5000);
  await snap(dashboard, log, "08-dashboard-flood", [DASH]);
  await snap(projector, log, "08-projector-flood", [WALL], false);
  await snap(darkProjector, log, "08-projector-flood-dark", [WALL], false);
  await words(dashboard, "08-dashboard-flood");
  await words(projector, "08-projector-flood");
  // Reload every screen while the flood is on.
  await reloadTimed(dashboard, "dashboard", () =>
    dashboard.getByText("Tray").first().waitFor({ timeout: 15000 }),
  );
  await reloadTimed(projector, "projector", () =>
    projector.getByText("Three verbs").first().waitFor({ timeout: 15000 }),
  );
  await reloadTimed(phone, "phone", () =>
    phone.getByText("handed in", { exact: false }).first().waitFor({ timeout: 15000 }),
  );
  await sleep(3000);
  await snap(dashboard, log, "09-dashboard-reloaded", [DASH]);
  await snap(projector, log, "09-projector-reloaded", [WALL], false);
  await snap(phone, log, "09-phone-reloaded", [390]);
  await words(phone, "09-phone-reloaded");
  const sortedTwo = await sortUntilPlaced(host, two.round, (SEATS + 1) * 3, 100);
  log.note(
    `round two sorted ${sortedTwo.settled} ticks ${sortedTwo.ticks} asks ${sortedTwo.asks} piles ${JSON.stringify(sortedTwo.wall?.piles.map((pile) => [pile.name, pile.count]))}`,
  );
  const settledTwo = Date.now();
  await until(
    async () => (await projector.evaluate("document.body.innerText").catch(() => "")) as string,
    (text) => !/Tray\s+[1-9]/.test(text),
    20,
  );
  log.note(`the projector's tray emptied ${Date.now() - settledTwo}ms after the server settled`);
  await web.browser.stopTracing();
  await frames(dashboard, "dashboard round two (after reload)", 0);
  await frames(projector, "projector round two (after reload)", 0);
  await sleep(1500);
  await snap(dashboard, log, "10-dashboard-sorted-two", [DASH]);
  await snap(projector, log, "10-projector-sorted-two", [WALL], false);
  await snap(darkProjector, log, "10-projector-sorted-two-dark", [WALL], false);
  await snap(phone, log, "10-phone-sorted-two", [390]);
  await words(dashboard, "10-dashboard-sorted-two");
  await words(projector, "10-projector-sorted-two");

  // Close two; round three votes over the picked verbs.
  await dashboard.setViewportSize({ width: DASH, height: 900 });
  await dashboard.getByRole("button", { name: /^Close.*Three verbs/ }).click();
  await sleep(3000);
  await snap(dashboard, log, "11-dashboard-picked-two", [DASH]);
  await words(dashboard, "11-dashboard-picked-two");
  await dashboard.getByRole("button", { name: /^Open.*Which one/ }).click();
  const three = await openFace(host, token, two.round);
  await sleep(2500);
  await snap(phone, log, "12-phone-vote", [390]);
  await words(phone, "12-phone-vote");
  const choice = three.question.choices[0];
  if (choice !== undefined) {
    await phone
      .getByRole("radio", { name: choice })
      .click()
      .catch(async () => {
        await phone.getByText(choice, { exact: true }).first().click();
      });
    await phone.getByRole("button", { name: "Hand in" }).click();
  } else {
    log.finding({
      kind: "broken",
      title: "the vote round carries no choices",
      steps: "close round two with picks, open round three",
      evidence: JSON.stringify(three.question),
    });
  }
  await until(
    () => readWall(host, three.round),
    (value) => (value.wall?.handedIn ?? 0) >= SEATS,
    40,
  );
  await sleep(4000);
  await snap(dashboard, log, "13-dashboard-vote", [DASH]);
  await snap(projector, log, "13-projector-vote", [WALL], false);
  await snap(darkProjector, log, "13-projector-vote-dark", [WALL], false);
  await snap(phone, log, "13-phone-voted", [390]);
  await words(dashboard, "13-dashboard-vote");
  await words(projector, "13-projector-vote");
  await words(phone, "13-phone-voted");

  // Close the run.
  await dashboard.setViewportSize({ width: DASH, height: 900 });
  await dashboard.getByRole("button", { name: /^Close.*Which one/ }).click();
  await sleep(2000);
  await dashboard.getByRole("button", { name: "Close run" }).first().click();
  await dashboard.getByRole("button", { name: "Close run" }).last().click();
  await sleep(4000);
  await snap(dashboard, log, "14-dashboard-closed", [DASH]);
  await snap(projector, log, "14-projector-closed", [WALL], false);
  await snap(phone, log, "14-phone-closed", [390]);
  await words(dashboard, "14-dashboard-closed");
  await words(projector, "14-projector-closed");
  await words(phone, "14-phone-closed");
  await dashboard.goto(`${WEB}/staff/live/relay/${relay}`);
  await sleep(2500);
  await snap(dashboard, log, "15-overview", [DASH, 768, 390]);
  await words(dashboard, "15-overview");
} catch (error) {
  log.finding({
    kind: "broken",
    title: `the walk stopped: ${String(error).slice(0, 160)}`,
    steps: "phase0-walk",
    error: String(error),
  });
} finally {
  log.write();
  await web.close();
}
