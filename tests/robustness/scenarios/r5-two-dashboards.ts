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
  sortUntilPlaced,
  until,
} from "../drive.ts";

const ARM = process.argv[2] ?? "r5-two-dashboards";
const STAFF = [1440, 390] as const;
const WALL = [1920] as const;
const SCRIPTED = 20;
const PARTS = 3;
const SEATS = 40;
const TOP = 2;
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
  return said === null ? null : Number(said);
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
    () => sortUntilPlaced(host, one.round, SCRIPTED * PARTS, 40),
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

  // The default pick: the top four piles, or every pile when there are fewer.
  const closedWall = (await readWall(host, one.round)).wall;
  const pileCount = closedWall?.piles.length ?? 0;
  const topWanted = Math.min(TOP, pileCount);
  log.note(`round one closed with ${pileCount} piles; Top ${TOP} stands for ${topWanted}`);
  if (pileCount <= TOP) {
    log.note(
      `Top ${TOP} and All name the same ${pileCount} piles on this wall, so neither control can pick against the other`,
    );
  }
  await setTop(laptopA, TOP);
  await setTop(laptopB, TOP);
  const saidA = await untilPiles(laptopA, topWanted, 15000);
  const saidB = await untilPiles(laptopB, topWanted, 15000);
  const pickedTop = await until(pickedNow, (names) => names.length === topWanted, 12);
  log.note(
    `Open says ${saidA} piles on A and ${saidB} on B; the server picks ${JSON.stringify(pickedTop)}`,
  );
  if (saidA !== topWanted || saidB !== topWanted || pickedTop.length !== topWanted) {
    log.finding({
      kind: "broken",
      title: `the two dashboards do not read the same default pick (A says ${saidA}, B says ${saidB}, the server picks ${pickedTop.length} of ${topWanted})`,
      steps: "Open round one from A, close it from B, leave both pick controls on Top 4",
      evidence: JSON.stringify({ saidA, saidB, pickedTop, pileCount }),
    });
  }
  await sleep(2000);
  const pickedAgain = await pickedNow();
  if (pickedAgain.join("|") !== pickedTop.join("|")) {
    log.finding({
      kind: "broken",
      title: "the picked set moved on the server while both dashboards sat on Top 4",
      steps:
        "Two dashboards on one run, both on Top 4; read /live/walls/pick twice, two seconds apart",
      evidence: JSON.stringify({ first: pickedTop, then: pickedAgain }),
    });
  }
  await snap(laptopA, log, "DashboardATopFour", STAFF);
  await snap(laptopB, log, "DashboardBTopFour", STAFF);

  // A takes the pick to All. B's own control is still on Top 4, and both are
  // maintained, so this is where two dashboards can fight over one picked set.
  await laptopA.setViewportSize({ width: 1440, height: 900 });
  await laptopA.getByRole("button", { name: "All", exact: true }).click();
  const allOnA = await untilPiles(laptopA, pileCount, 10000);
  const allOnB = await untilPiles(laptopB, pileCount, 10000);
  log.note(`after All: A says ${allOnA} piles, B says ${allOnB}, of ${pileCount}`);
  if (allOnA !== pileCount) {
    log.finding({
      kind: "broken",
      title: `All did not take laptop A's Open button to every pile (${allOnA} of ${pileCount})`,
      steps: "On a closed round one with two dashboards open, tap All on A; read A's Open button",
      evidence: JSON.stringify({ allOnA, pileCount }),
    });
  }
  const trail: number[] = [];
  const seen: string[] = [];
  for (let read = 0; read < 12; read += 1) {
    const names = await pickedNow();
    trail.push(names.length);
    seen.push(names.join(","));
    await sleep(1500);
  }
  const flips = trail.filter((count, index) => index > 0 && count !== trail[index - 1]).length;
  const fought = flips > 1;
  log.note(`the server's picked count over eighteen seconds: ${JSON.stringify(trail)}`);
  const modeA = await pickMode(laptopA);
  const modeB = await pickMode(laptopB);
  log.note(
    `A's control shows ${modeA} and B's shows ${modeB}; the picked set flipped ${flips} times under them`,
  );
  if (fought) {
    log.finding({
      kind: "broken",
      title: `two dashboards fight over one picked set: it flipped ${flips} times in eighteen seconds`,
      steps:
        "Open two dashboards on one run; close round one; tap All on A while B's control is still on Top 4; read the wall every 1.5s",
      evidence: JSON.stringify({ trail, sets: seen, modeA, modeB, pileCount }),
    });
  } else if (allOnB !== pileCount) {
    log.finding({
      kind: "unclear",
      title: `laptop B's Open button says ${allOnB} piles after A picked all ${pileCount}`,
      steps: "Tap All on A; wait two polls; read B's Open button",
      evidence: JSON.stringify({ allOnA, allOnB, pileCount, modeA, modeB }),
      screenshot: "DashboardBAll@1440.png",
    });
  }
  await snap(laptopA, log, "DashboardAAll", STAFF);
  await snap(laptopB, log, "DashboardBAll", STAFF);

  // A reloads: the mode is what the browser holds, so All comes back with it.
  await log.timed(
    "reload laptop A",
    async () => {
      await laptopA.reload({ waitUntil: "domcontentloaded" });
      await laptopA.getByRole("button", { name: OPEN_TWO }).waitFor({ timeout: 30000 });
    },
    12000,
  );
  const modeReloaded = await pickMode(laptopA);
  const pilesReloaded = await untilPiles(laptopA, pileCount, 12000);
  log.note(`after the reload A shows ${modeReloaded} and ${pilesReloaded} piles`);
  if (modeReloaded !== "All") {
    log.finding({
      kind: "broken",
      title: `laptop A came back on ${modeReloaded}, not All, after a reload`,
      steps: "Tap All on A; reload the page; read the pick control",
      evidence: JSON.stringify({ modeReloaded, pilesReloaded, pileCount }),
      screenshot: "DashboardAReloaded@1440.png",
    });
  }
  if (pilesReloaded !== pileCount && !fought) {
    log.finding({
      kind: "broken",
      title: `laptop A's Open button says ${pilesReloaded} piles after the reload, not ${pileCount}`,
      steps: "Tap All on A; reload the page; read the Open button",
      evidence: JSON.stringify({ modeReloaded, pilesReloaded, pileCount }),
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

  for (const [name, page] of [
    ["A", laptopA],
    ["B", laptopB],
  ] as const) {
    const says = await page
      .getByText("Closed", { exact: true })
      .first()
      .isVisible()
      .catch(() => false);
    if (!says) {
      log.finding({
        kind: "unclear",
        title: `laptop ${name} does not say the run is closed after A closed it`,
        steps:
          "Close the run from A through the dialog; wait four seconds; look at both dashboards",
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
