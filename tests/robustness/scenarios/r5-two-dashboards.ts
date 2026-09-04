/**
 * R5, two dashboards. A lecturer's laptop and a TA's laptop on the same run:
 * round one opened from one and closed from the other, forty seats invited
 * between the rounds and dismissed from both sides, and the pick walked from
 * Top 4 to All on one laptop while the other watches. The picked set on the
 * server is one set, so two maintained controls on one run are the thing under
 * test. A screenshot at each state; every refusal, delay over three seconds,
 * and screen that reads wrongly logged as a finding.
 *
 *   bun tests/robustness/scenarios/r5-two-dashboards.ts [arm-name]
 */

import type { Page } from "playwright";
import {
  arrive,
  type Client,
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
  until,
} from "../drive.ts";

const ARM = process.argv[2] ?? "r5-two-dashboards";
const STAFF = [1440, 390] as const;
const WALL = [1920] as const;
const SCRIPTED = 20;
const PARTS = 3;
const SEATS = 40;
const TOP = 2;
/** What a newly closed round picks before anyone touches it (pick-control.tsx). */
const FRESH_TOP = 4;
const WORDS = ["add", "save", "keep", "see", "open", "visit", "delete", "remove", "forget"];

/** The button that opens the second round, whichever laptop is asked. */
const OPEN_TWO = /^Open.*The stranger/;

/** The run's read carries its seats, which the driver's type does not name. */
interface SeatedRun {
  run: { seats: { participant: string }[] } | null;
}

/** How many seats the run holds, read through the edge. */
async function seatsSeated(host: Client, run: string): Promise<number> {
  const read = (await readRun(host, run)) as unknown as SeatedRun;
  return read.run?.seats.length ?? 0;
}

/** What one dashboard's Open button says it will carry forward. */
async function openPiles(page: Page): Promise<number | null> {
  const said = await page
    .getByRole("button", { name: OPEN_TWO })
    .first()
    .innerText()
    .catch(() => "");
  const found = /(\d+)\s+piles?/.exec(said.replace(/\s+/g, " "));
  return found === null ? null : Number(found[1]);
}

/** Waits for a dashboard's Open button to say a count; answers what it says. */
async function untilPiles(page: Page, want: number, ms: number): Promise<number | null> {
  const by = Date.now() + ms;
  let said = await openPiles(page);
  while (said !== want && Date.now() < by) {
    await sleep(500);
    said = await openPiles(page);
  }
  return said;
}

/** Which segment of the pick control a dashboard shows as pressed. */
async function pickMode(page: Page): Promise<string> {
  for (const name of ["Top", "All", "By hand"]) {
    const pressed = await page
      .getByRole("button", { name, exact: true })
      .first()
      .getAttribute("aria-pressed")
      .catch(() => null);
    if (pressed === "true") return name;
  }
  return "none";
}

/** The seat count the model row prints on a dashboard. */
async function seatsShown(page: Page): Promise<number | null> {
  const said = (await page
    .evaluate(
      `(() => {
       const rows = Array.from(document.querySelectorAll("span"));
       const row = rows.find(
         (one) => one.firstChild?.nodeValue?.trim() === "Model seats",
       );
       const count = row?.querySelector("span")?.textContent?.trim() ?? "";
       return count === "" ? null : count;
     })()`,
    )
    .catch(() => null)) as string | null;
  // The row reads "40 seated", so the number is the figure the words count.
  const figure = said === null ? null : /(\d+)\s*seated/.exec(said);
  return figure === null ? null : Number(figure[1]);
}

/** Types a number into one dashboard's Top control. */
async function setTop(page: Page, top: number) {
  const box = page.getByRole("spinbutton", { name: "Top piles" }).first();
  await box.fill(String(top));
  await box.blur();
}

/** Waits for a dashboard's model row to print a seat count; answers what it prints. */
async function untilSeats(page: Page, want: number, ms: number): Promise<number | null> {
  const by = Date.now() + ms;
  let said = await seatsShown(page);
  while (said !== want && Date.now() < by) {
    await sleep(500);
    said = await seatsShown(page);
  }
  return said;
}

const log = new Log(ARM, outDir(ARM));
const host = await signIn();
const web = await pages(host, log);

/**
 * Watches the wall until the model has every card in a pile. One round holds
 * one sort lock, so only one ticker asks for a sort: laptop A's own "Model
 * sorts" switch. A second asker meets a 409 CONFLICT that the board swallows
 * by design, which would read on the page as a broken finding.
 */
async function everyCardPlaced(round: string, expected: number, tries = 45) {
  const read = await until(
    () => readWall(host, round),
    (value) =>
      (value.wall?.cards.length ?? 0) >= expected &&
      (value.wall?.cards ?? []).every((card) => card.pile !== null),
    tries,
    2000,
  );
  const wall = read.wall;
  const settled =
    wall !== null &&
    wall.cards.length >= expected &&
    wall.cards.every((card) => card.pile !== null);
  return { wall, settled };
}

try {
  // The relay, copied from the deck, launched; two laptops, a projector, a phone.
  const relay = await log.timed("copy the deck relay", () => copyDeck(host, "three-verbs"));
  const { run, token } = await log.timed("launch", () => launch(host, relay.relay));
  const laptopA = await web.staff(`/staff/live/run/${run}`);
  const laptopB = await web.staff(`/staff/live/run/${run}`);
  const projector = await web.staff(`/staff/live/run/${run}/project`, 1920);
  const phone = await web.phone(token);
  for (const [name, page] of [
    ["A", laptopA],
    ["B", laptopB],
  ] as const) {
    page.on("framenavigated", (frame) => {
      if (frame.parentFrame() === null) log.note(`laptop ${name} navigated to ${frame.url()}`);
    });
  }
  const seated = () => seatsSeated(host, run);
  const pickedNow = async () =>
    ((await readWall(host, one.round)).wall?.piles ?? [])
      .filter((pile) => pile.picked !== null)
      .map((pile) => pile.name)
      .sort();
  await sleep(2500);
  await snap(laptopA, log, "DashboardABefore", STAFF);
  await snap(laptopB, log, "DashboardBBefore", STAFF);
  await snap(projector, log, "ProjectorBefore", WALL, false);
  await snap(phone, log, "PhoneBefore", [390]);

  // Round one opens from A. Twenty phones hand in; A sets the model sorting.
  await log.timed("open round one from laptop A", async () => {
    await laptopA.setViewportSize({ width: 1440, height: 900 });
    await laptopA.getByRole("button", { name: /^Open.*Three verbs/ }).click();
    await openFace(host, token);
  });
  const one = await openFace(host, token);
  log.note(`round one ${one.round}; parts ${JSON.stringify(one.question.parts)}`);
  await log.timed(
    `${SCRIPTED} scripted phones hand in`,
    () =>
      phones(
        token,
        SCRIPTED,
        one.question,
        (seat, part) => WORDS[(seat * 3 + part) % WORDS.length] as string,
      ),
    20000,
  );
  await laptopA.setViewportSize({ width: 1440, height: 900 });
  await laptopA.getByRole("switch", { name: "Model sorts" }).click();
  const sorted = await log.timed(
    "the model places every card",
    () => everyCardPlaced(one.round, SCRIPTED * PARTS),
    60000,
  );
  log.note(
    `sorted: ${sorted.settled}, piles ${JSON.stringify(
      sorted.wall?.piles.map((pile) => [pile.name, pile.count]),
    )}`,
  );
  if (!sorted.settled) {
    log.finding({
      kind: "broken",
      title: "the model never placed every card",
      steps: `${SCRIPTED} phones hand in three verbs each; Model sorts on from laptop A; wait two minutes`,
      evidence: JSON.stringify(sorted.wall?.cards.filter((card) => card.pile === null)),
    });
  }
  await sleep(3500);
  await snap(laptopA, log, "DashboardASorted", STAFF);
  await snap(laptopB, log, "DashboardBSorted", STAFF);
  await snap(projector, log, "ProjectorSorted", WALL, false);

  // The other laptop closes the round.
  await laptopB.setViewportSize({ width: 1440, height: 900 });
  await log.timed("close round one from laptop B", async () => {
    await laptopB.getByRole("button", { name: /^Close.*Three verbs/ }).click();
    await laptopB.getByRole("button", { name: OPEN_TWO }).waitFor({ timeout: 20000 });
  });
  await log.timed(
    "laptop A sees round one closed",
    () => laptopA.getByRole("button", { name: OPEN_TWO }).waitFor({ timeout: 20000 }),
    8000,
  );

  // A closed round starts both laptops in Top, with the four fullest piles
  // already picked and maintained. Top and All are maintained modes: every
  // time the wall moves under one, the whole set is sent again. The design
  // does not have two of them fight — a set a page did not send is another
  // hand's, and that page follows it into By hand — so what is read here is
  // which laptop keeps its maintained mode and which one follows.
  const closedWall = (await readWall(host, one.round)).wall;
  const pileCount = closedWall?.piles.length ?? 0;
  const fresh = Math.min(FRESH_TOP, pileCount);
  const topWanted = Math.min(TOP, pileCount);
  const fullest = (closedWall?.piles ?? [])
    .slice()
    .sort((left, right) => right.count - left.count)
    .slice(0, topWanted)
    .map((pile) => pile.name)
    .sort();
  log.note(
    `round one closed with ${pileCount} piles; the fresh pick is Top ${FRESH_TOP} (${fresh} here) and Top ${TOP} stands for ${JSON.stringify(fullest)}`,
  );
  if (pileCount <= TOP) {
    log.note(
      `Top ${TOP} and All name the same ${pileCount} piles on this wall, so neither control can pick against the other`,
    );
  }
  const freshA = await untilPiles(laptopA, fresh, 15000);
  const freshB = await untilPiles(laptopB, fresh, 15000);
  log.note(`the fresh pick reads ${freshA} piles on A and ${freshB} on B, of ${fresh}`);
  if (freshA !== fresh || freshB !== fresh) {
    log.finding({
      kind: "broken",
      title: `a newly closed round does not start both dashboards on Top ${FRESH_TOP} (A says ${freshA}, B says ${freshB}, of ${fresh})`,
      steps:
        "Open round one from A, close it from B, read both Open buttons without touching the pick",
      evidence: JSON.stringify({ freshA, freshB, fresh, pileCount }),
    });
  }

  // Both laptops are asked for the same two piles, which is the one case two
  // maintained controls agree on: whichever follows into By hand is left
  // holding the set it would have sent anyway.
  await setTop(laptopA, TOP);
  await setTop(laptopB, TOP);
  const saidA = await untilPiles(laptopA, topWanted, 15000);
  const saidB = await untilPiles(laptopB, topWanted, 15000);
  const pickedTop = await until(pickedNow, (names) => names.join("|") === fullest.join("|"), 12);
  const modeTopA = await pickMode(laptopA);
  const modeTopB = await pickMode(laptopB);
  log.note(
    `Top ${TOP} on both: Open says ${saidA} piles on A and ${saidB} on B, the controls show ${modeTopA} and ${modeTopB}, and the server picks ${JSON.stringify(pickedTop)}`,
  );
  if (pickedTop.join("|") !== fullest.join("|")) {
    log.finding({
      kind: "broken",
      title: `Top ${TOP} on both dashboards does not converge on the ${topWanted} fullest piles`,
      steps: `Open round one from A, close it from B, set the Top number to ${TOP} on both; read the wall's picked piles`,
      evidence: JSON.stringify({ picked: pickedTop, fullest, saidA, saidB, modeTopA, modeTopB }),
    });
  }
  await sleep(2000);
  const pickedAgain = await pickedNow();
  if (pickedAgain.join("|") !== pickedTop.join("|")) {
    log.finding({
      kind: "broken",
      title: `the picked set moved on the server while both dashboards sat on Top ${TOP}`,
      steps: `Two dashboards on one run, both on Top ${TOP}; read /live/walls/read twice, two seconds apart`,
      evidence: JSON.stringify({ first: pickedTop, then: pickedAgain }),
    });
  }
  await snap(laptopA, log, "DashboardATopTwo", STAFF);
  await snap(laptopB, log, "DashboardBTopTwo", STAFF);

  // A takes the pick to All while B sits on Top 2. One of the two has to give
  // way, and the design says it is the page whose sent set was overwritten:
  // it follows into By hand rather than fighting over the wall. What each
  // laptop ends on is recorded; only a set that will not settle, or a page
  // that shows a mode it did not choose and goes on sending, is a finding.
  const chosenA = "All";
  const chosenB = `Top ${TOP}`;
  await laptopA.setViewportSize({ width: 1440, height: 900 });
  await laptopA.getByRole("button", { name: "All", exact: true }).click();
  const allOnA = await untilPiles(laptopA, pileCount, 10000);
  const allOnB = await untilPiles(laptopB, pileCount, 10000);
  log.note(`after All: A says ${allOnA} piles, B says ${allOnB}, of ${pileCount}`);
  const trail: number[] = [];
  const seen: string[] = [];
  for (let read = 0; read < 12; read += 1) {
    const names = await pickedNow();
    trail.push(names.length);
    seen.push(names.join(","));
    await sleep(1500);
  }
  const flips = trail.filter((count, index) => index > 0 && count !== trail[index - 1]).length;
  // Two dashboards handing one set over take a move each, so a set that
  // changes once or twice is the hand-over; one that keeps changing is a fight.
  const fought = flips > 2;
  const settledLate = trail.slice(-4).every((count) => count === trail[trail.length - 1]);
  const modeA = await pickMode(laptopA);
  const modeB = await pickMode(laptopB);
  log.note(
    `the server's picked count over eighteen seconds: ${JSON.stringify(trail)}; it flipped ${flips} times`,
  );
  log.note(
    `A chose ${chosenA} and shows ${modeA}; B chose ${chosenB} and shows ${modeB}; the wall ends on ${trail[trail.length - 1]} of ${pileCount} piles`,
  );
  if (modeA === "By hand" || modeB === "By hand") {
    log.note(
      "a laptop showing By hand it did not choose is the design's follow: the set it sent was overwritten by the other hand, so it stopped maintaining instead of fighting",
    );
  }
  if (fought) {
    log.finding({
      kind: "broken",
      title: `two dashboards fight over one picked set: it flipped ${flips} times in eighteen seconds`,
      steps: `Open two dashboards on one run; close round one; tap All on A while B's control is still on Top ${TOP}; read the wall every 1.5s`,
      evidence: JSON.stringify({ trail, sets: seen, modeA, modeB, pileCount }),
    });
  } else if ((modeA === "By hand" || modeB === "By hand") && !settledLate) {
    log.finding({
      kind: "broken",
      title: "a dashboard shows a mode it did not choose and goes on sending the set",
      steps: `Tap All on A while B is on Top ${TOP}; watch both pick controls and the wall for eighteen seconds`,
      evidence: JSON.stringify({ modeA, chosenA, modeB, chosenB, trail, sets: seen }),
    });
  }
  await snap(laptopA, log, "DashboardAAll", STAFF);
  await snap(laptopB, log, "DashboardBAll", STAFF);

  // A reloads. The mode is kept per tab in sessionStorage, against this run
  // and this round, and a reload keeps a tab's session — so what comes back
  // is the mode the page was last left holding, whether A chose it or
  // followed the other hand into it, not the mode A first tapped.
  const modeBefore = modeA;
  const pilesBefore = await openPiles(laptopA);
  await log.timed(
    "reload laptop A",
    async () => {
      await laptopA.reload({ waitUntil: "domcontentloaded" });
      await laptopA.getByRole("button", { name: OPEN_TWO }).waitFor({ timeout: 30000 });
    },
    12000,
  );
  const modeReloaded = await pickMode(laptopA);
  const wantedPiles = modeBefore === "All" ? pileCount : (pilesBefore ?? 0);
  const pilesReloaded = await untilPiles(laptopA, wantedPiles, 12000);
  log.note(
    `A was left on ${modeBefore} with ${pilesBefore} piles; after the reload it shows ${modeReloaded} and ${pilesReloaded}`,
  );
  if (modeReloaded !== modeBefore) {
    log.finding({
      kind: "broken",
      title: `laptop A came back on ${modeReloaded}, not the ${modeBefore} it was left on, after a reload`,
      steps: "Leave A on a mode; reload the page; read the pick control",
      evidence: JSON.stringify({ modeBefore, modeReloaded, pilesBefore, pilesReloaded, pileCount }),
      screenshot: "DashboardAReloaded@1440.png",
    });
  }
  if (pilesReloaded !== wantedPiles && !fought) {
    log.finding({
      kind: "broken",
      title: `laptop A's Open button says ${pilesReloaded} piles after the reload, not ${wantedPiles}`,
      steps: "Reload A; read the Open button against the set it was left holding",
      evidence: JSON.stringify({ modeBefore, modeReloaded, pilesBefore, pilesReloaded, pileCount }),
    });
  }
  await snap(laptopA, log, "DashboardAReloaded", STAFF);

  // Between the rounds: forty seats invited from A, which is forty requests.
  await laptopA.setViewportSize({ width: 1440, height: 900 });
  await laptopA.getByRole("textbox", { name: "Seats" }).fill(String(SEATS));
  const took = await log.timed(
    `${SEATS} seats invited from laptop A`,
    async () => {
      await laptopA.getByRole("button", { name: "Invite" }).click();
      return await until(seated, (count) => count >= SEATS, 60, 1000);
    },
    10000,
  );
  log.note(`the run seats ${took} of ${SEATS}`);
  if (took !== SEATS) {
    log.finding({
      kind: "broken",
      title: `the run seats ${took} of the ${SEATS} asked for between the rounds`,
      steps: `Type ${SEATS} in Model participants on A between rounds and Invite; read /live/relays/run`,
      evidence: JSON.stringify({ seated: took, asked: SEATS }),
    });
  }
  const rowA = await untilSeats(laptopA, SEATS, 15000);
  const rowB = await untilSeats(laptopB, SEATS, 15000);
  log.note(`the model row says ${rowA} on A and ${rowB} on B`);
  if (rowA !== took || rowB !== took) {
    log.finding({
      kind: "broken",
      title: `the two model rows do not say the run's ${took} seats (A says ${rowA}, B says ${rowB})`,
      steps: `Invite ${SEATS} seats from A; wait fifteen seconds; read both model rows`,
      evidence: JSON.stringify({ rowA, rowB, seated: took }),
      screenshot: "ModelRowB@1440.png",
    });
  }
  await snap(laptopA, log, "ModelRowA", STAFF);
  await snap(laptopB, log, "ModelRowB", STAFF);

  // One seat dropped from the other laptop.
  await laptopB.setViewportSize({ width: 1440, height: 900 });
  await log.timed("dismiss one seat from laptop B", async () => {
    await laptopB.getByRole("button", { name: "Dismiss last", exact: true }).click();
    await until(seated, (count) => count === SEATS - 1, 20);
  });
  const left = await seated();
  const oneLessA = await untilSeats(laptopA, SEATS - 1, 15000);
  const oneLessB = await untilSeats(laptopB, SEATS - 1, 15000);
  log.note(`after Dismiss one the run holds ${left}; A says ${oneLessA} and B says ${oneLessB}`);
  if (left !== SEATS - 1 || oneLessA !== SEATS - 1 || oneLessB !== SEATS - 1) {
    log.finding({
      kind: "broken",
      title: `Dismiss one from B left ${left} seats, and the rows say A ${oneLessA} and B ${oneLessB}, not ${SEATS - 1}`,
      steps: "With forty seats on the run, press Dismiss one on B; read the run and both rows",
      evidence: JSON.stringify({ left, oneLessA, oneLessB }),
    });
  }

  // Round two opens from A on the picked piles, and the seats answer it
  // without a second invitation.
  const pickedBefore = await pickedNow();
  await laptopA.setViewportSize({ width: 1440, height: 900 });
  await log.timed(
    "open round two from laptop A",
    async () => {
      await laptopA.getByRole("button", { name: OPEN_TWO }).click();
      await openFace(host, token, one.round);
    },
    10000,
  );
  const two = await openFace(host, token, one.round);
  const context = ((two.question as { context?: { name: string }[] }).context ?? [])
    .map((group) => group.name)
    .sort();
  log.note(
    `round two context ${JSON.stringify(context)} against pick ${JSON.stringify(pickedBefore)}`,
  );
  if (context.join("|") !== pickedBefore.join("|")) {
    if (fought) {
      log.note(
        "the context differs from the pick read before it opened, under a pick that flickered",
      );
    } else {
      log.finding({
        kind: "broken",
        title: "round two's context is not the picked piles",
        steps: "Pick the piles from A, open The stranger from A, read /live/p/arrive",
        evidence: JSON.stringify({ context, pickedBefore }),
      });
    }
  }
  const from = Date.now();
  const answered = await until(
    () => readWall(host, two.round),
    (value) => (value.wall?.cards.filter((card) => card.model).length ?? 0) >= left,
    60,
    1000,
  );
  const handedIn = answered.wall?.cards.filter((card) => card.model).length ?? 0;
  log.note(`${handedIn} of the ${left} seats handed round two in within ${Date.now() - from}ms`);
  if (handedIn < left) {
    log.finding({
      kind: "broken",
      title: `only ${handedIn} of the run's ${left} seats handed round two in within a minute`,
      steps: `Invite ${SEATS} seats between the rounds, dismiss one, open round two; read the wall for a minute`,
      evidence: JSON.stringify({ handedIn, left, waited: Date.now() - from }),
    });
  }

  // The real phone answers the context round and hands in.
  await phone.getByRole("textbox").first().waitFor({ timeout: 30000 });
  await phone.getByRole("textbox").first().fill("a bookmark");
  await log.timed("the phone hands round two in", async () => {
    await phone.getByRole("button", { name: "Hand in" }).click();
    await phone
      .getByRole("button", { name: "Hand in" })
      .waitFor({ state: "hidden", timeout: 15000 });
  });
  await sleep(4000);
  await snap(laptopA, log, "DashboardAModelCards", STAFF);
  await snap(laptopB, log, "DashboardBModelCards", STAFF);
  await snap(projector, log, "ProjectorModelCards", WALL, false);
  await snap(phone, log, "PhoneAfterHandIn", [390]);

  // Every seat dropped from A. What they handed in stays on the wall.
  const beforeDismissAll = handedIn;
  await laptopA.setViewportSize({ width: 1440, height: 900 });
  await log.timed("dismiss every seat from laptop A", async () => {
    await laptopA.getByRole("button", { name: "Dismiss all", exact: true }).click();
    await until(seated, (count) => count === 0, 20);
  });
  const none = await seated();
  const stayed = ((await readWall(host, two.round)).wall?.cards ?? []).filter(
    (card) => card.model,
  ).length;
  log.note(
    `after Dismiss all the run holds ${none} seats; ${stayed} model cards stand on the wall`,
  );
  if (none !== 0) {
    log.finding({
      kind: "broken",
      title: `Dismiss all from A left ${none} seats on the run`,
      steps:
        "With thirty-nine seats and round two open, press Dismiss all on A; read /live/relays/run",
      evidence: JSON.stringify({ none }),
    });
  }
  if (stayed < beforeDismissAll) {
    log.finding({
      kind: "broken",
      title: `${beforeDismissAll - stayed} model cards left the wall when the seats were dismissed`,
      steps: "Let the seats hand round two in; press Dismiss all on A; read the wall",
      evidence: JSON.stringify({ beforeDismissAll, stayed }),
    });
  }
  await snap(laptopA, log, "DashboardADismissedAll", STAFF);
  await snap(laptopB, log, "DashboardBDismissedAll", STAFF);

  // B closes the round; A closes the run through the dialog.
  await laptopB.setViewportSize({ width: 1440, height: 900 });
  await log.timed("close round two from laptop B", async () => {
    await laptopB.getByRole("button", { name: /^Close.*The stranger/ }).click();
    await until(
      () => readRun(host, run),
      (value) => value.run?.openRound === null,
      20,
    );
  });
  await sleep(2500);
  await laptopA.setViewportSize({ width: 1440, height: 900 });
  await log.timed("close the run from laptop A", async () => {
    await laptopA.getByRole("button", { name: "Close run", exact: true }).click();
    await laptopA
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
  await sleep(4000);
  await snap(laptopA, log, "DashboardAClosed", STAFF);
  await snap(laptopB, log, "DashboardBClosed", STAFF);
  await snap(projector, log, "ProjectorClosed", WALL, false);
  await snap(phone, log, "PhoneClosed", [390]);

  // A closed relay board says so in its own words: the moves panel becomes
  // "No more rounds." with the way back to the relay. The "Closed" badge is a
  // questionnaire run's, not this board's, so that is what is read for here.
  for (const [name, page] of [
    ["A", laptopA],
    ["B", laptopB],
  ] as const) {
    const says = await page
      .getByRole("link", { name: "Back to the relay" })
      .first()
      .isVisible()
      .catch(() => false);
    if (!says) {
      log.finding({
        kind: "unclear",
        title: `laptop ${name} does not say the run is over after A closed it`,
        steps:
          "Close the run from A through the dialog; wait four seconds; look at both dashboards",
        evidence: `the closed board should read "No more rounds." with a way back to the relay; page reads ${(
          (await page.evaluate("document.querySelector('main')?.innerText ?? ''")) as string
        )
          .replace(/\s+/g, " ")
          .slice(0, 200)}`,
        screenshot: `Dashboard${name}Closed@1440.png`,
      });
    }
  }

  const wall = (await readWall(host, one.round)).wall;
  const counted = (wall?.piles ?? []).reduce((sum, pile) => sum + pile.count, 0);
  log.note(
    `round one reads back ${counted} cards of ${SCRIPTED * PARTS} in ${wall?.piles.length ?? 0} piles`,
  );
  if (counted !== SCRIPTED * PARTS) {
    log.finding({
      kind: "broken",
      title: `round one's closed wall reads back ${counted} cards, not ${SCRIPTED * PARTS}`,
      steps: "Run R5 end to end; read /live/walls/read for round one",
      evidence: JSON.stringify({ counted, piles: wall?.piles }),
    });
  }
  const standing = await readRun(host, run);
  log.note(
    `run read back: ${JSON.stringify(standing.run.rounds.map((round) => [round.title, round.figure.handedIn]))}`,
  );
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
