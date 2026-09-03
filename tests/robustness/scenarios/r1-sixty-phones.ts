/**
 * R1, sixty phones. One list round with the model sorting while the room
 * streams in, five piles on the wall (three the model opened, two opened by
 * hand), the pick control walked through Top, All, and back, and a context
 * round opened on the top four. A screenshot at each state; every refusal,
 * delay over three seconds, and surprise logged as a finding, and how long
 * the dashboard's staged wall takes to catch the server up once it settles.
 *
 *   bun tests/robustness/scenarios/r1-sixty-phones.ts [arm-name]
 */

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

const ARM = process.argv[2] ?? "r1-sixty-phones";
const STAFF = [1440, 390] as const;
const WALL = [1920] as const;
const SCRIPTED = 60;
const PARTS = 3;
const TOP = 4;
const WORDS = ["add", "save", "keep", "see", "open", "visit", "delete", "remove", "forget"];

const log = new Log(ARM, outDir(ARM));
const host = await signIn();
const web = await pages(host, log);

try {
  const relay = await log.timed("copy the deck relay", () => copyDeck(host, "three-verbs"));
  const { run, token } = await log.timed("launch", () => launch(host, relay.relay));
  const dashboard = await web.staff(`/staff/live/run/${run}`);
  dashboard.on("framenavigated", (frame) => {
    if (frame === dashboard.mainFrame()) log.note(`the dashboard navigated to ${frame.url()}`);
  });
  const projector = await web.staff(`/staff/live/run/${run}/project`, 1920);
  const phone = await web.phone(token);
  await sleep(2500);
  await snap(dashboard, log, "DashboardBefore", STAFF);
  await snap(projector, log, "ProjectorBefore", WALL, false);
  await snap(phone, log, "PhoneBefore", [390]);

  // Round one opens, and the model is set sorting before a single card lands.
  await log.timed("open round one from the dashboard", async () => {
    await dashboard.setViewportSize({ width: 1440, height: 900 });
    await dashboard.getByRole("button", { name: /^Open.*Three verbs/ }).click();
    await openFace(host, token);
  });
  const one = await openFace(host, token);
  if (one.question.parts.join(",") !== "one,two,three") {
    log.finding({
      kind: "broken",
      title: "round one's face does not carry the deck's three parts",
      steps: "Copy Three verbs, launch, open round one, read /live/p/arrive",
      evidence: JSON.stringify(one.question),
    });
  }
  await dashboard.getByRole("switch", { name: "Model sorts" }).click();
  await sleep(1500);
  await snap(dashboard, log, "DashboardOpen", STAFF);
  await snap(phone, log, "PhoneOpen", [390]);

  // The real phone hands in first, then sixty phones stream in while the
  // model sorts under them.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await phone.getByRole("textbox", { name: "one" }).fill("bookmark");
  await phone.getByRole("textbox", { name: "two" }).fill("revisit");
  await phone.getByRole("textbox", { name: "three" }).fill("forget");
  await log.timed("the phone hands in", async () => {
    await phone.getByRole("button", { name: "Hand in" }).click();
    await phone
      .getByRole("button", { name: "Hand in" })
      .waitFor({ state: "hidden", timeout: 10000 });
  });
  const streaming = log.timed(
    `${SCRIPTED} scripted phones hand in`,
    () =>
      phones(
        token,
        SCRIPTED,
        one.question,
        (seat, part) => WORDS[(seat * 3 + part) % WORDS.length] as string,
      ),
    40000,
  );
  await sleep(6000);
  await snap(dashboard, log, "DashboardStreaming", STAFF);
  await snap(projector, log, "ProjectorStreaming", WALL, false);
  await streaming;
  const expected = (SCRIPTED + 1) * PARTS;
  const sorted = await log.timed(
    "the model places every card",
    () => sortUntilPlaced(host, one.round, expected, 60),
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
      steps: `Model sorts on, then ${SCRIPTED} phones hand in three verbs each; wait three minutes`,
      evidence: JSON.stringify(sorted.wall?.cards.filter((card) => card.pile === null)),
    });
  }

  // How long the dashboard's staged wall takes to catch the settled server up.
  const settledAt = Date.now();
  let lastChange = settledAt;
  let seen = "";
  for (;;) {
    const text = (await dashboard
      .evaluate("document.querySelector('main')?.innerText ?? ''")
      .catch(async (reason) => {
        log.note(`reading the dashboard failed: ${String(reason).slice(0, 120)}`);
        await sleep(500);
        return dashboard
          .evaluate("document.querySelector('main')?.innerText ?? ''")
          .catch(() => seen);
      })) as string;
    if (text !== seen) {
      seen = text;
      lastChange = Date.now();
    } else if (Date.now() - lastChange > 2500) {
      break;
    }
    if (Date.now() - settledAt > 30000) break;
    await sleep(500);
  }
  const catchUp = lastChange - settledAt;
  log.note(`the dashboard's wall settled ${catchUp}ms after the server did`);
  if (catchUp > 6500) {
    log.finding({
      kind: "slow",
      title: `the staged wall settled ${(catchUp / 1000).toFixed(1)}s after the server did`,
      steps: `Model sorts on; ${SCRIPTED} phones hand in; watch the dashboard after the wall reads every card placed`,
      evidence: `catch-up ${catchUp}ms against a 3s poll`,
    });
  }
  await snap(dashboard, log, "DashboardSorted", STAFF);
  await snap(projector, log, "ProjectorSorted", WALL, false);
  await snap(phone, log, "PhoneSorted", [390]);

  // Two piles opened by hand beside the model's three: five piles, so the
  // top four leave one behind.
  const placed = sorted.wall?.cards.filter((card) => card.pile !== null) ?? [];
  const [odd1, odd2, stray] = placed.slice(-3);
  if (odd1 === undefined || odd2 === undefined || stray === undefined) {
    throw new Error("fewer than three placed cards to open hand piles with");
  }
  const opened = await host.call<{ pile: string }>("/live/walls/open-pile", {
    round: one.round,
    name: "Odd one out",
    card: odd1.card,
  });
  if (opened.error) log.refused("open a pile by hand", "POST /live/walls/open-pile", opened);
  const moved = await host.call("/live/walls/move-card", { card: odd2.card, pile: opened.pile });
  if (moved.error)
    log.refused("move a card into the hand pile", "POST /live/walls/move-card", moved);
  const strayed = await host.call("/live/walls/open-pile", {
    round: one.round,
    name: "Stray",
    card: stray.card,
  });
  if (strayed.error)
    log.refused("open a second pile by hand", "POST /live/walls/open-pile", strayed);
  const five = await until(
    () => readWall(host, one.round),
    (value) => (value.wall?.piles.length ?? 0) >= 5,
    10,
  );
  const pileNames = (five.wall?.piles ?? []).map((pile) => [pile.name, pile.count]);
  log.note(`piles now ${JSON.stringify(pileNames)}`);
  if ((five.wall?.piles.length ?? 0) !== 5) {
    log.finding({
      kind: "broken",
      title: `the wall holds ${five.wall?.piles.length ?? 0} piles after two were opened by hand, not five`,
      steps:
        "After the model sorts, open-pile twice and move-card once through the edge; read the wall",
      evidence: JSON.stringify(pileNames),
    });
  }
  await sleep(3500);
  await snap(dashboard, log, "DashboardFivePiles", STAFF);

  // Round one closes. The pick control's default is the top four; the Open
  // button says how many piles the next round takes.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  const openTwo = (piles: number) =>
    dashboard.getByRole("button", { name: new RegExp(`^Open.*The stranger.*${piles} piles?`) });
  await log.timed("close round one", async () => {
    await dashboard.getByRole("button", { name: /^Close.*Three verbs/ }).click();
    await dashboard
      .getByRole("button", { name: /^Open.*The stranger/ })
      .waitFor({ timeout: 20000 });
  });
  await log.timed("the top four are picked", () => openTwo(TOP).waitFor({ timeout: 15000 }), 8000);
  await sleep(1500);
  await snap(dashboard, log, "DashboardTopFour", STAFF);
  await snap(projector, log, "ProjectorTopFour", WALL, false);
  await snap(phone, log, "PhoneWaiting", [390]);

  const byCount = (five.wall?.piles ?? []).slice().sort((left, right) => right.count - left.count);
  const fullest = byCount
    .slice(0, TOP)
    .map((pile) => pile.name)
    .sort();
  const pickedNow = async () =>
    ((await readWall(host, one.round)).wall?.piles ?? [])
      .filter((pile) => pile.picked !== null)
      .map((pile) => pile.name)
      .sort();
  const topPicked = await until(pickedNow, (names) => names.length === TOP, 10);
  if (topPicked.join("|") !== fullest.join("|")) {
    log.finding({
      kind: "broken",
      title: "Top 4 did not pick the four fullest piles",
      steps:
        "Five piles on a closed wall; leave the pick control on Top 4; read the wall's picked piles",
      evidence: JSON.stringify({ picked: topPicked, fullest, piles: pileNames }),
    });
  }

  // Top 2, then All, then Top again, then 4 by hand in the number box.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await dashboard.getByRole("spinbutton", { name: "Top piles" }).fill("2");
  await log.timed("Top 2 picks two", () => openTwo(2).waitFor({ timeout: 15000 }), 8000);
  await dashboard.getByRole("button", { name: "All", exact: true }).click();
  await log.timed("All picks five", () => openTwo(5).waitFor({ timeout: 15000 }), 8000);
  await sleep(1000);
  await snap(dashboard, log, "DashboardAll", STAFF);
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await dashboard.getByRole("button", { name: "Top", exact: true }).click();
  await log.timed("Top again keeps its two", () => openTwo(2).waitFor({ timeout: 15000 }), 8000);
  await dashboard.getByRole("spinbutton", { name: "Top piles" }).fill(String(TOP));
  await log.timed("Top 4 picks four again", () => openTwo(TOP).waitFor({ timeout: 15000 }), 8000);
  const picked = await until(pickedNow, (names) => names.length === TOP, 10);
  await sleep(1500);
  await snap(dashboard, log, "DashboardPicked", STAFF);

  // Round two opens on the pick: the four groups stand above its prompt.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await log.timed("open round two", async () => {
    await dashboard.getByRole("button", { name: /^Open.*The stranger/ }).click();
    await openFace(host, token, one.round);
  });
  const two = await openFace(host, token, one.round);
  const context = ((two.question as { context?: { name: string }[] }).context ?? [])
    .map((group) => group.name)
    .sort();
  log.note(`round two context ${JSON.stringify(context)}`);
  if (context.join("|") !== picked.join("|")) {
    log.finding({
      kind: "broken",
      title: "round two's context is not the picked piles",
      steps: `Pick ${picked.join(", ")} with Top 4; open The stranger; read the face`,
      evidence: JSON.stringify({ context, picked, question: two.question }),
    });
  }
  if (two.question.choices.length !== 0 || two.question.parts.length !== 0) {
    log.finding({
      kind: "broken",
      title: "a context round opened with choices or parts of its own",
      steps: "Open The stranger, which takes context from round one; read the face",
      evidence: JSON.stringify(two.question),
    });
  }
  await sleep(3500);
  await snap(phone, log, "PhoneContext", [390]);
  await snap(dashboard, log, "DashboardRoundTwo", STAFF);
  await snap(projector, log, "ProjectorRoundTwo", WALL, false);
  for (const name of picked) {
    if (
      !(await phone
        .getByText(name, { exact: true })
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      log.finding({
        kind: "unclear",
        title: `the phone does not show the picked group "${name}" above round two's prompt`,
        steps: "Open The stranger on a Top 4 pick; look at the phone",
        screenshot: "PhoneContext@390.png",
      });
    }
  }

  // The room answers round two; the phone answers; the round and the run close.
  await log.timed(
    `${SCRIPTED} scripted phones answer round two`,
    () =>
      phones(token, SCRIPTED, two.question, (seat) =>
        seat % 2 === 0 ? "a bookmark" : "a reading list",
      ),
    40000,
  );
  await phone.getByRole("textbox").first().fill("a bookmark");
  await phone.getByRole("button", { name: "Hand in" }).click();
  await sleep(4000);
  await snap(phone, log, "PhoneAfterRoundTwo", [390]);
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await log.timed("close round two", async () => {
    await dashboard.getByRole("button", { name: /^Close.*The stranger/ }).click();
    await until(
      () => readRun(host, run),
      (value) => value.run?.openRound === null,
      20,
    );
  });
  await sleep(2500);
  await snap(dashboard, log, "DashboardEveryRoundRan", STAFF);
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
  await snap(dashboard, log, "DashboardClosed", STAFF);
  await snap(projector, log, "ProjectorClosed", WALL, false);
  await snap(phone, log, "PhoneClosed", [390]);

  const wall = (await readWall(host, one.round)).wall;
  const counted = (wall?.piles ?? []).reduce((sum, pile) => sum + pile.count, 0);
  const pickedAtClose = (wall?.piles ?? []).filter((pile) => pile.picked !== null).length;
  log.note(`wall read back: ${counted} cards in piles of ${expected}; picked ${pickedAtClose}`);
  if (counted !== expected || pickedAtClose !== TOP) {
    log.finding({
      kind: "broken",
      title: "the closed wall does not read back every card in a pile with four picked",
      steps: "Run R1 end to end; close the run; read /live/walls/read for round one",
      evidence: JSON.stringify({ counted, expected, pickedAtClose, piles: wall?.piles }),
    });
  }
  const standing = await readRun(host, run);
  log.note(
    `run read back: ${JSON.stringify(standing.run.rounds.map((round) => [round.title, round.figure.handedIn]))}`,
  );
  const [first, second] = standing.run.rounds;
  if (first?.figure.handedIn !== SCRIPTED + 1 || second?.figure.handedIn !== SCRIPTED + 1) {
    log.finding({
      kind: "broken",
      title: "the run's figures do not count every phone that handed in",
      steps: "Sixty-one phones hand in on both rounds; read /live/relays/run",
      evidence: JSON.stringify(standing.run.rounds.map((round) => round.figure)),
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
