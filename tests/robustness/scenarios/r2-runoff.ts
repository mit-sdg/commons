/**
 * R2, a runoff. Fix the spec with a third round added through the edge: a
 * write round the room rewrites and the model sorts, a vote round that takes
 * the top piles as its choices, and a runoff that takes the two fullest bars
 * of that vote. The pick is walked on a vote wall — Top 2, one bar tapped by
 * hand and tapped back — and every ballot is read back against the piles it
 * filed into. A screenshot at each state; every unexpected refusal, delay over
 * three seconds, and screen that reads wrongly logged as a finding.
 *
 *   bun tests/robustness/scenarios/r2-runoff.ts [arm-name]
 */

import type { Page } from "playwright";
import {
  arrive,
  copyDeck,
  launch,
  Log,
  openFace,
  outDir,
  pages,
  phones,
  readRun,
  readWall,
  signIn,
  sleep,
  snap,
  sortUntilPlaced,
  until,
} from "../drive.ts";

const ARM = process.argv[2] ?? "r2-runoff";
const STAFF = [1440, 390] as const;
const WALL = [1920] as const;
const SCRIPTED = 30;
const TOP = 4;
const RUNOFF = 2;

/** Six rewrites the room hands in, so the sorter has something to make piles of. */
const REWRITES = [
  "Let a guest hold a room for the nights they need.",
  "Help someone reserve a table before they arrive.",
  "Keep a record of who booked what, and when.",
  "Give a traveller a seat they can count on.",
  "Let people change or drop a booking they made.",
  "Say what a room costs on the nights it is free.",
];

/** What the one real phone writes, in its own words. */
const MINE = "Let a guest keep a room until they say otherwise.";

/** How a room's votes lean, fullest choice first, so two lead clearly. */
const WEIGHTS = [5, 4, 2, 1];

/** How long a screen may take to catch a settled wall up before it is a finding. */
const CATCH_UP = 6500;

/** The ballots a skewed room casts, one per seat, over the choices offered. */
function ballots(count: number, choices: string[]): string[] {
  const cycle: string[] = [];
  for (const [index, choice] of choices.entries()) {
    for (let repeat = 0; repeat < (WEIGHTS[index] ?? 1); repeat += 1) cycle.push(choice);
  }
  return Array.from({ length: count }, (_, seat) => cycle[seat % cycle.length] as string);
}

/**
 * How long a screen goes on moving after the wall has settled on the server:
 * the page is read until its text stops changing, as R1 reads the staged wall.
 */
async function settles(page: Page, since: number): Promise<number> {
  let lastChange = Date.now();
  let seen = "";
  for (;;) {
    const text = (await page.evaluate("document.body?.innerText ?? ''")) as string;
    if (text !== seen) {
      seen = text;
      lastChange = Date.now();
    } else if (Date.now() - lastChange > 2500) {
      break;
    }
    if (Date.now() - since > 45000) break;
    await sleep(500);
  }
  return Math.max(0, lastChange - since);
}

/** Piles fullest first, ties in the order the wall opened them, as the pick reads them. */
function byCount<Pile extends { count: number }>(piles: Pile[]): Pile[] {
  return piles
    .map((pile, index) => ({ pile, index }))
    .sort((left, right) => right.pile.count - left.pile.count || left.index - right.index)
    .map(({ pile }) => pile);
}

/** A screenshot that survives the dev server reloading the page under it. */
async function shot(
  page: Page,
  name: string,
  widths: readonly number[] = [1440],
  whole = true,
): Promise<string[]> {
  try {
    await ready(page, name);
    return await snap(page, log, name, widths, whole);
  } catch (error) {
    log.note(
      `${name}: the page went away under the screenshot (${String(error).slice(0, 80)}); waiting and taking it again`,
    );
    await sleep(5000);
    await ready(page, name);
    return await snap(page, log, name, widths, whole);
  }
}

/**
 * The dev server reloads a page under the run now and then; a screenshot taken
 * while the reload is checking the session shows nothing, so the shot waits.
 */
async function ready(page: Page, name: string): Promise<void> {
  const from = Date.now();
  for (;;) {
    const text = (await page.evaluate("document.body?.innerText ?? ''").catch(() => "")) as string;
    if (text.trim() !== "" && !text.includes("Checking your session")) return;
    if (Date.now() - from > 20000) {
      log.note(`${name}: the page still read "${text.trim().slice(0, 40)}" after 20s`);
      return;
    }
    await sleep(1000);
  }
}

const log = new Log(ARM, outDir(ARM));
const host = await signIn();
const web = await pages(host, log);

try {
  // The relay: the deck's write round and vote round, then a runoff that takes
  // its choices from the vote, added through the edge as staff would draft it.
  const relay = await log.timed("copy the deck relay", () => copyDeck(host, "fix-the-spec"));
  const added = await host.call<{ leg: string }>("/live/relays/add-round", {
    relay: relay.relay,
    title: "Runoff",
    prompt: "Of these two, which is the purpose?",
    parts: [],
    cap: 0,
    choices: [],
  });
  if (added.error) throw new Error(`add-round Runoff: ${added.error}`);
  const drawn = await host.call("/live/relays/set-takes", {
    leg: added.leg,
    source: relay.legs[1],
    use: "choices",
  });
  if (drawn.error) log.refused("the runoff takes its choices from the vote", "set-takes", drawn);

  const { run, token } = await log.timed("launch", () => launch(host, relay.relay));
  const dashboard = await web.staff(`/staff/live/run/${run}`);
  const projector = await web.staff(`/staff/live/run/${run}/project`, 1920);
  const phone = await web.phone(token);
  await sleep(2500);
  await shot(dashboard, "DashboardBefore", STAFF);
  await shot(projector, "ProjectorBefore", WALL, false);
  await shot(phone, "PhoneBefore", [390]);

  // Round one: the room rewrites the spec while the model sorts under it.
  await log.timed("open round one from the dashboard", async () => {
    await dashboard.setViewportSize({ width: 1440, height: 900 });
    await dashboard.getByRole("button", { name: /^Open.*Rewrite/ }).click();
    await openFace(host, token);
  });
  const one = await openFace(host, token);
  log.note(`round one ${one.round}; parts ${JSON.stringify(one.question.parts)}`);
  if (one.question.parts.length !== 0 || one.question.choices.length !== 0) {
    log.finding({
      kind: "broken",
      title: "the write round's face carries parts or choices of its own",
      steps: "Copy Fix the spec, launch, open Rewrite, read /live/p/arrive",
      evidence: JSON.stringify(one.question),
    });
  }
  await dashboard.getByRole("switch", { name: "Model sorts" }).click();
  await sleep(1500);
  await shot(dashboard, "DashboardOpen", STAFF);
  await shot(phone, "PhoneOpen", [390]);

  await log.timed(
    `${SCRIPTED} scripted phones write a rewrite`,
    () =>
      phones(token, SCRIPTED, one.question, (seat) => REWRITES[seat % REWRITES.length] as string),
    25000,
  );
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await phone.getByRole("textbox").first().waitFor({ timeout: 20000 });
  await phone.getByRole("textbox").first().fill(MINE);
  await log.timed("the phone hands in", async () => {
    await phone.getByRole("button", { name: "Hand in" }).click();
    await phone
      .getByRole("button", { name: "Hand in" })
      .waitFor({ state: "hidden", timeout: 10000 });
  });

  const written = SCRIPTED + 1;
  const sorted = await log.timed(
    "the model places every card",
    () => sortUntilPlaced(host, one.round, written, 40),
    60000,
  );
  log.note(
    `sorted: ${sorted.settled}, ticks ${sorted.ticks}, asks ${sorted.asks}, piles ${JSON.stringify(
      sorted.wall?.piles.map((pile) => [pile.name, pile.count]),
    )}`,
  );
  if (!sorted.settled) {
    log.finding({
      kind: "broken",
      title: "the model never placed every rewrite",
      steps: `Model sorts on, then ${written} phones hand in a rewrite; wait two minutes`,
      evidence: JSON.stringify(sorted.wall?.cards.filter((card) => card.pile === null)),
    });
  }
  await sleep(3500);
  await shot(dashboard, "DashboardSorted", STAFF);
  await shot(projector, "ProjectorSorted", WALL, false);
  await shot(phone, "PhoneSorted", [390]);

  // Round one closes on the Top 4 pick: the button says how many piles the
  // vote takes, which is four only when the wall holds four.
  const piles = sorted.wall?.piles ?? [];
  const carried = Math.min(TOP, piles.length);
  const openVote = (count: number) =>
    dashboard.getByRole("button", { name: new RegExp(`^Open.*Vote.*${count} piles?`) });
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await log.timed("close round one", async () => {
    await dashboard.getByRole("button", { name: /^Close.*Rewrite/ }).click();
    await dashboard.getByRole("button", { name: /^Open.*Vote/ }).waitFor({ timeout: 20000 });
  });
  await log.timed(
    `the Open button reads ${carried} piles`,
    () => openVote(carried).waitFor({ timeout: 15000 }),
    8000,
  );
  await sleep(1500);
  await shot(dashboard, "DashboardTopPick", STAFF);
  await shot(phone, "PhoneWaiting", [390]);

  const fullest = byCount(piles)
    .slice(0, carried)
    .map((pile) => pile.name)
    .sort();
  const pickedOn = async (round: string) =>
    ((await readWall(host, round)).wall?.piles ?? [])
      .filter((pile) => pile.picked !== null)
      .map((pile) => pile.name)
      .sort();
  const pickedOne = await until(
    () => pickedOn(one.round),
    (names) => names.length === carried,
    15,
  );
  log.note(`picked on round one ${JSON.stringify(pickedOne)}`);
  if (pickedOne.join("|") !== fullest.join("|")) {
    log.finding({
      kind: "broken",
      title: `Top ${TOP} did not pick the ${carried} fullest piles of the write round`,
      steps: "Close Rewrite, leave the pick control on Top 4, read the wall's picked piles",
      evidence: JSON.stringify({
        picked: pickedOne,
        fullest,
        piles: piles.map((pile) => [pile.name, pile.count]),
      }),
    });
  }

  // Round two opens on that pick: its choices are the picked piles' names.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await log.timed("open round two", async () => {
    await openVote(carried).click();
    await openFace(host, token, one.round);
  });
  const two = await openFace(host, token, one.round);
  const choices = two.question.choices;
  log.note(`round two choices ${JSON.stringify(choices)}`);
  if (choices.slice().sort().join("|") !== pickedOne.join("|")) {
    log.finding({
      kind: "broken",
      title: "the vote round's choices are not the picked piles",
      steps: `Pick ${pickedOne.join(", ")} on Rewrite; open Vote; read the face`,
      evidence: JSON.stringify({ choices, picked: pickedOne }),
    });
  }
  if (two.question.parts.length !== 0) {
    log.finding({
      kind: "broken",
      title: "a round that takes its choices opened with parts of its own",
      steps: "Open Vote, which takes choices from Rewrite; read the face",
      evidence: JSON.stringify(two.question),
    });
  }
  await sleep(2500);
  await shot(phone, "PhoneVote", [390]);
  await shot(dashboard, "DashboardRoundTwo", STAFF);

  // The room votes, skewed so two choices lead clearly.
  const cast = ballots(SCRIPTED, choices);
  const lead = choices[0] ?? "";
  await log.timed(
    `${SCRIPTED} scripted phones vote`,
    () => phones(token, SCRIPTED, two.question, (seat) => cast[seat] as string),
    25000,
  );
  await phone.getByText(lead, { exact: true }).first().waitFor({ timeout: 20000 });
  await phone.getByText(lead, { exact: true }).first().click();
  await phone.getByRole("button", { name: "Hand in" }).click();

  // A vote's ballots file into a pile per choice, and the bars read those piles.
  const intended = new Map<string, number>();
  for (const choice of [...cast, lead]) intended.set(choice, (intended.get(choice) ?? 0) + 1);
  const votes = await until(
    () => readWall(host, two.round),
    (value) =>
      (value.wall?.piles.length ?? 0) >= choices.length &&
      (value.wall?.piles ?? []).reduce((sum, pile) => sum + pile.count, 0) >= written,
    20,
  );
  const voteWall = votes.wall;
  const tally = new Map<string, number>();
  for (const card of voteWall?.cards ?? []) tally.set(card.value, (tally.get(card.value) ?? 0) + 1);
  log.note(
    `round two piles ${JSON.stringify(voteWall?.piles.map((pile) => [pile.name, pile.count]))}; intended ${JSON.stringify([...intended])}`,
  );
  const misfiled = choices.filter((choice) => {
    const pile = voteWall?.piles.find((one) => one.name === choice) ?? null;
    return pile === null || pile.count !== (tally.get(choice) ?? 0);
  });
  if (misfiled.length > 0 || (voteWall?.piles.length ?? 0) !== choices.length) {
    log.finding({
      kind: "broken",
      title: "the vote wall does not hold one pile per choice with the choice's tally",
      steps: `${written} phones vote on Vote; read /live/walls/read for the round`,
      evidence: JSON.stringify({
        misfiled,
        piles: voteWall?.piles.map((pile) => [pile.name, pile.count]),
        tally: [...tally],
        intended: [...intended],
      }),
    });
  }
  const strays = (voteWall?.cards ?? []).filter((card) => {
    const pile = voteWall?.piles.find((one) => one.name === card.value) ?? null;
    return pile === null || card.pile !== pile.pile;
  });
  if (strays.length > 0) {
    log.finding({
      kind: "broken",
      title: `${strays.length} ballots did not file into the pile of their choice`,
      steps: "Read the vote round's wall and compare each card's value against its pile",
      evidence: JSON.stringify(strays.slice(0, 5)),
    });
  }

  // Every ballot is in, and the figure says so; the bars stage one card at a
  // time, so both screens go on filling long after the wall has settled.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  const landed = Date.now();
  const [dashLag, wallLag] = await Promise.all([
    settles(dashboard, landed),
    settles(projector, landed),
  ]);
  log.note(
    `the vote bars settled ${dashLag}ms (dashboard) and ${wallLag}ms (projector) after the wall did`,
  );
  for (const [screen, lag] of [
    ["dashboard", dashLag],
    ["projector", wallLag],
  ] as const) {
    if (lag <= CATCH_UP) continue;
    log.finding({
      kind: "slow",
      title: `the ${screen}'s vote bars settled ${(lag / 1000).toFixed(1)}s after the wall held every ballot`,
      steps: `${written} phones vote on Vote; read /live/walls/read until it holds every ballot; watch the ${screen}`,
      evidence: `the bars stage one ballot at a time, so they read short of the figure printed beside them — ${written} of ${written} — for ${lag}ms`,
      screenshot: `${screen === "dashboard" ? "DashboardVoteBars@1440" : "ProjectorVoteBars@1920"}.png`,
    });
  }
  await shot(phone, "PhoneAfterVote", [390]);
  await shot(dashboard, "DashboardVoteBars", STAFF);
  await shot(projector, "ProjectorVoteBars", WALL, false);

  // Round two closes, and the pick moves onto the vote wall: Top 2 carries the
  // two bars with the most ballots.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await log.timed("close round two", async () => {
    await dashboard.getByRole("button", { name: /^Close.*Vote/ }).click();
    await dashboard.getByRole("button", { name: /^Open.*Runoff/ }).waitFor({ timeout: 20000 });
  });
  const openRunoff = (count: number) =>
    dashboard.getByRole("button", { name: new RegExp(`^Open.*Runoff.*${count} piles?`) });
  await dashboard.getByRole("spinbutton", { name: "Top piles" }).fill(String(RUNOFF));
  await log.timed(
    `the Open button reads ${RUNOFF} piles`,
    () => openRunoff(RUNOFF).waitFor({ timeout: 15000 }),
    8000,
  );
  const mostVoted = byCount(voteWall?.piles ?? [])
    .slice(0, RUNOFF)
    .map((pile) => pile.name)
    .sort();
  const pickedTwo = await until(
    () => pickedOn(two.round),
    (names) => names.length === RUNOFF,
    15,
  );
  log.note(
    `picked on round two ${JSON.stringify(pickedTwo)}; most voted ${JSON.stringify(mostVoted)}`,
  );
  if (pickedTwo.join("|") !== mostVoted.join("|")) {
    log.finding({
      kind: "broken",
      title: "Top 2 on the vote wall did not pick the two most-voted choices",
      steps: "Close Vote; set Top to 2 in the pick control; read the wall's picked piles",
      evidence: JSON.stringify({
        picked: pickedTwo,
        mostVoted,
        piles: voteWall?.piles.map((pile) => [pile.name, pile.count]),
      }),
    });
  }
  await sleep(1500);
  await shot(dashboard, "DashboardRunoffPick", STAFF);
  await shot(projector, "ProjectorRunoffPick", WALL, false);

  // One more bar taken in by hand, and given back.
  const spare = choices.find((choice) => !pickedTwo.includes(choice));
  if (spare === undefined) {
    log.note("no third bar to tap: the vote offered only the two that carry");
  } else {
    const bar = () =>
      dashboard
        .getByRole("button")
        .filter({ has: dashboard.getByText(spare, { exact: true }) })
        .first();
    await dashboard.setViewportSize({ width: 1440, height: 900 });
    await log.timed(
      `tapping ${spare} by hand carries three`,
      async () => {
        await bar().click();
        await openRunoff(RUNOFF + 1).waitFor({ timeout: 15000 });
      },
      8000,
    );
    await sleep(1000);
    await shot(dashboard, "DashboardByHand", STAFF);
    await dashboard.setViewportSize({ width: 1440, height: 900 });
    await log.timed(
      `tapping ${spare} again gives it back`,
      async () => {
        await bar().click();
        await openRunoff(RUNOFF).waitFor({ timeout: 15000 });
      },
      8000,
    );
    const back = await until(
      () => pickedOn(two.round),
      (names) => names.length === RUNOFF,
      15,
    );
    if (back.join("|") !== pickedTwo.join("|")) {
      log.finding({
        kind: "broken",
        title: "tapping a bar twice did not return the pick to the two it started on",
        steps: `Top 2 on the vote wall; tap ${spare}; tap it again; read the picked piles`,
        evidence: JSON.stringify({ before: pickedTwo, after: back }),
      });
    }
  }

  // Nothing picked at all: the Open button is dead and says which word stands
  // behind it — the guard the amendments keep at opening a dependent round.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  for (const name of pickedTwo) {
    await dashboard
      .getByRole("button")
      .filter({ has: dashboard.getByText(name, { exact: true }) })
      .first()
      .click();
    await sleep(600);
  }
  const bare = dashboard.getByRole("button", { name: /^Open.*Runoff/ });
  await bare.waitFor({ timeout: 15000 });
  await sleep(1200);
  const dead = await bare.isDisabled();
  const line = (
    await dashboard
      .locator("#open-refusal")
      .innerText()
      .catch(() => "")
  ).trim();
  log.note(`nothing picked: Open ${dead ? "is" : "is NOT"} dead; the line reads "${line}"`);
  await shot(dashboard, "DashboardNothingPicked", STAFF);
  if (!dead || line !== "Pick at least one pile.") {
    log.finding({
      kind: dead ? "unclear" : "broken",
      title: dead
        ? `the Open button with nothing picked says "${line}" instead of the NOTHING_PICKED sentence`
        : "the Open button stays live with nothing picked on the wall it takes from",
      steps:
        "Close Vote; tap every picked bar off so nothing carries; read the Open button and the line under it",
      evidence: JSON.stringify({ disabled: dead, line }),
      screenshot: "DashboardNothingPicked@1440.png",
    });
  }
  // Top takes the pick back, so the runoff opens on the two it started on.
  await dashboard.getByRole("button", { name: "Top", exact: true }).click();
  await log.timed(
    "Top takes the pick back",
    () => openRunoff(RUNOFF).waitFor({ timeout: 15000 }),
    8000,
  );

  // The runoff opens on exactly those two, and the room votes again.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await log.timed("open the runoff", async () => {
    await openRunoff(RUNOFF).click();
    await openFace(host, token, two.round);
  });
  const three = await openFace(host, token, two.round);
  const runoffChoices = three.question.choices;
  log.note(`runoff choices ${JSON.stringify(runoffChoices)}`);
  if (runoffChoices.slice().sort().join("|") !== pickedTwo.join("|")) {
    log.finding({
      kind: "broken",
      title: "the runoff's choices are not the two picked bars",
      steps: `Pick ${pickedTwo.join(", ")} on the vote wall; open Runoff; read the face`,
      evidence: JSON.stringify({ choices: runoffChoices, picked: pickedTwo }),
    });
  }
  await sleep(2500);
  await shot(phone, "PhoneRunoff", [390]);
  await shot(dashboard, "DashboardRunoff", STAFF);
  await shot(projector, "ProjectorRunoff", WALL, false);

  const runoffCast = ballots(SCRIPTED, runoffChoices);
  const runoffLead = runoffChoices[0] ?? "";
  await log.timed(
    `${SCRIPTED} scripted phones vote in the runoff`,
    () => phones(token, SCRIPTED, three.question, (seat) => runoffCast[seat] as string),
    25000,
  );
  await phone.getByText(runoffLead, { exact: true }).first().waitFor({ timeout: 20000 });
  await phone.getByText(runoffLead, { exact: true }).first().click();
  await phone.getByRole("button", { name: "Hand in" }).click();
  await until(
    () => readWall(host, three.round),
    (value) => (value.wall?.piles ?? []).reduce((sum, pile) => sum + pile.count, 0) >= written,
    20,
  );
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  const runoffLanded = Date.now();
  const [runoffDash, runoffWall] = await Promise.all([
    settles(dashboard, runoffLanded),
    settles(projector, runoffLanded),
  ]);
  log.note(
    `the runoff bars settled ${runoffDash}ms (dashboard) and ${runoffWall}ms (projector) after the wall did`,
  );
  await shot(phone, "PhoneAfterRunoff", [390]);
  await shot(dashboard, "DashboardRunoffBars", STAFF);
  await shot(projector, "ProjectorRunoffBars", WALL, false);

  // The runoff closes, then the run, through the dialog.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await log.timed("close the runoff", async () => {
    await dashboard.getByRole("button", { name: /^Close.*Runoff/ }).click();
    await until(
      () => readRun(host, run),
      (value) => value.run?.openRound === null,
      20,
    );
  });
  await sleep(2500);
  await shot(dashboard, "DashboardEveryRoundRan", STAFF);
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await log.timed("close the run", async () => {
    await dashboard.getByRole("button", { name: "Close run", exact: true }).click();
    await dashboard
      .getByRole("dialog")
      .getByRole("button", { name: "Close run", exact: true })
      .first()
      .click();
    await until(
      () => arrive(host, token),
      (value) => value.relay?.open === false,
      20,
    );
  });
  await sleep(3500);
  await shot(dashboard, "DashboardClosed", STAFF);
  await shot(projector, "ProjectorClosed", WALL, false);
  await shot(phone, "PhoneClosed", [390]);

  // Both vote walls and the run's figures, read back on a closed run.
  for (const [title, round, offered] of [
    ["Vote", two.round, choices],
    ["Runoff", three.round, runoffChoices],
  ] as const) {
    const wall = (await readWall(host, round)).wall;
    const counted = (wall?.piles ?? []).reduce((sum, pile) => sum + pile.count, 0);
    log.note(
      `${title} read back: ${counted} ballots in ${wall?.piles.length ?? 0} piles ${JSON.stringify(
        wall?.piles.map((pile) => [pile.name, pile.count]),
      )}`,
    );
    if (counted !== written || (wall?.piles.length ?? 0) !== offered.length) {
      log.finding({
        kind: "broken",
        title: `${title} does not read back ${written} ballots in one pile per choice`,
        steps: "Run R2 end to end; close the run; read /live/walls/read for the vote round",
        evidence: JSON.stringify({
          counted,
          written,
          offered,
          piles: wall?.piles.map((pile) => [pile.name, pile.count]),
        }),
      });
    }
  }
  const standing = await readRun(host, run);
  log.note(
    `run read back: ${JSON.stringify(standing.run.rounds.map((round) => [round.title, round.figure.handedIn]))}`,
  );
  const short = standing.run.rounds.filter((round) => round.figure.handedIn !== written);
  if (short.length > 0) {
    log.finding({
      kind: "broken",
      title: "the run's figures do not count every phone that handed in",
      steps: `${written} phones hand in on all three rounds; read /live/relays/run`,
      evidence: JSON.stringify(standing.run.rounds.map((round) => [round.title, round.figure])),
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
