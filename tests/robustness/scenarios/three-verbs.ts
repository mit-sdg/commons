/**
 * The exemplar scenario: Three verbs, then a stranger, end to end. Two model
 * participants, the model sorting, the pick taken to three piles, round two,
 * the run closed, the wall read back. A screenshot at each state, and every
 * refusal, delay over three seconds, and surprise logged as a finding.
 *
 *   bun tests/robustness/scenarios/three-verbs.ts [arm-name]
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
  until,
} from "../drive.ts";

const ARM = process.argv[2] ?? "three-verbs";
const STAFF = [1440, 390] as const;
const WALL = [1920] as const;
const SCRIPTED = 30;
const MODELS = 2;
/** How many piles round two takes: the Top number the pick control is set to. */
const PICKED = 3;
const WORDS = ["add", "save", "keep", "see", "open", "visit", "delete", "remove", "forget"];

const log = new Log(ARM, outDir(ARM));
const host = await signIn();
const web = await pages(host, log);

/**
 * Watches the wall until the model has every card in a pile. One round holds
 * one sort lock, so only one ticker asks for a sort: the dashboard's own
 * "Model sorts" switch. A second asker meets a 409 CONFLICT that the board
 * swallows by design, which would read on the page as a broken finding.
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
  // The relay, copied from the deck, launched; every screen before a round opens.
  const relay = await log.timed("copy the deck relay", () => copyDeck(host, "three-verbs"));
  const { run, token } = await log.timed("launch", () => launch(host, relay.relay));
  const dashboard = await web.staff(`/staff/live/run/${run}`);
  const projector = await web.staff(`/staff/live/run/${run}/project`, 1920);
  const phone = await web.phone(token);
  await sleep(2500);
  await snap(dashboard, log, "DashboardBefore", STAFF);
  await snap(projector, log, "ProjectorBefore", WALL, false);
  await snap(phone, log, "PhoneBefore", [390]);

  // Round one opens from the dashboard's button, as staff would do it.
  await log.timed("open round one from the dashboard", async () => {
    await dashboard.setViewportSize({ width: 1440, height: 900 });
    await dashboard.getByRole("button", { name: /^Open.*Three verbs/ }).click();
    await openFace(host, token);
  });
  const one = await openFace(host, token);
  log.note(`round one ${one.round}; parts ${JSON.stringify(one.question.parts)}`);
  if (one.question.parts.join(",") !== "one,two,three") {
    log.finding({
      kind: "broken",
      title: "round one's face does not carry the deck's three parts",
      steps: "Copy Three verbs, launch, open round one, read /live/p/arrive",
      evidence: JSON.stringify(one.question),
    });
  }
  await sleep(3000);
  await snap(dashboard, log, "DashboardOpen", STAFF);
  await snap(projector, log, "ProjectorOpen", WALL, false);
  await snap(phone, log, "PhoneOpen", [390]);

  // Thirty scripted phones hand in; the real phone fills its parts and hands in.
  await log.timed(
    `${SCRIPTED} scripted phones hand in`,
    () =>
      phones(
        token,
        SCRIPTED,
        one.question,
        (seat, part) => WORDS[(seat * 3 + part) % WORDS.length] as string,
      ),
    15000,
  );
  await phone.getByRole("textbox", { name: "one" }).fill("bookmark");
  await phone.getByRole("textbox", { name: "two" }).fill("revisit");
  await phone.getByRole("textbox", { name: "three" }).fill("forget");
  await snap(phone, log, "PhoneFilling", [390]);
  await log.timed("the phone hands in", async () => {
    await phone.getByRole("button", { name: "Hand in" }).click();
    await phone
      .getByRole("button", { name: "Hand in" })
      .waitFor({ state: "hidden", timeout: 10000 });
  });
  await sleep(4000);
  await snap(phone, log, "PhoneAfterHandIn", [390]);
  if (
    !(await phone
      .getByText(/^bookmark/)
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    log.finding({
      kind: "unclear",
      title: "after hand-in the phone does not show the holder's own card",
      steps: "Fill three parts on the phone, Hand in, wait four seconds",
      screenshot: "PhoneAfterHandIn@390.png",
    });
  }
  await snap(dashboard, log, "DashboardTray", STAFF);
  await snap(projector, log, "ProjectorTray", WALL, false);

  // Two model participants, invited from the dashboard's knob.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await dashboard.getByRole("textbox", { name: "Seats" }).fill(String(MODELS));
  await log.timed(
    `${MODELS} model participants hand in`,
    async () => {
      await dashboard.getByRole("button", { name: "Invite" }).click();
      const wall = await until(
        () => readWall(host, one.round),
        (value) => (value.wall?.cards.filter((card) => card.model).length ?? 0) >= MODELS * 3,
        60,
      );
      const modelCards = wall.wall?.cards.filter((card) => card.model) ?? [];
      log.note(`model cards: ${JSON.stringify(modelCards.map((card) => card.value))}`);
      if (modelCards.length < MODELS * 3) {
        log.finding({
          kind: "broken",
          title: `only ${modelCards.length} of ${MODELS * 3} model cards landed in a minute`,
          steps: `Invite ${MODELS} model participants on round one; wait 60s; read the wall`,
          evidence: JSON.stringify(wall.wall?.cards.filter((card) => card.model)),
        });
      }
    },
    30000,
  );

  // The model sorts. The switch on the dashboard is the one ticker; the
  // driver only watches the wall, so the round's sort lock is never contested.
  await dashboard.getByRole("switch", { name: "Model sorts" }).click();
  const sorted = await log.timed(
    "the model sorts every card",
    () => everyCardPlaced(one.round, (SCRIPTED + 1 + MODELS) * 3),
    45000,
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
      steps:
        "Thirty phones plus two model participants on Three verbs; Model sorts on; wait two minutes",
      evidence: JSON.stringify(sorted.wall?.cards.filter((card) => card.pile === null)),
    });
  }
  await sleep(3500);
  await snap(dashboard, log, "DashboardSorted", STAFF);
  await snap(projector, log, "ProjectorSorted", WALL, false);
  await snap(phone, log, "PhoneSorted", [390]);

  // Close round one; take the pick to three piles; open round two.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await log.timed("close round one", async () => {
    await dashboard.getByRole("button", { name: /^Close.*Three verbs/ }).click();
    await dashboard
      .getByRole("button", { name: /^Open.*The stranger/ })
      .waitFor({ timeout: 20000 });
  });
  await sleep(3000);
  await snap(dashboard, log, "DashboardClosedRound", STAFF);
  await snap(phone, log, "PhoneWaiting", [390]);
  // A closed round starts in Top, with the four fullest piles already picked
  // and maintained, so the Open button says "4 piles" before anything is
  // touched. Three piles is asked for by the Top number: a tap on a pile
  // would take the pick into By hand and toggle that pile *out* of the four.
  const closedWall = (await readWall(host, one.round)).wall;
  const names = (closedWall?.piles ?? [])
    .slice()
    .sort((left, right) => right.count - left.count)
    .slice(0, PICKED)
    .map((pile) => pile.name)
    .sort();
  await log.timed(
    "the fresh pick is the top four",
    () =>
      dashboard
        .getByRole("button", { name: /^Open.*The stranger.*4 piles/ })
        .waitFor({ timeout: 20000 }),
    8000,
  );
  await dashboard.getByRole("spinbutton", { name: "Top piles" }).fill(String(PICKED));
  await log.timed(
    `Top ${PICKED} picks the ${PICKED} fullest piles`,
    () =>
      dashboard
        .getByRole("button", { name: new RegExp(`^Open.*The stranger.*${PICKED} piles`) })
        .waitFor({ timeout: 20000 }),
    8000,
  );
  const pickedNames = await until(
    async () =>
      ((await readWall(host, one.round)).wall?.piles ?? [])
        .filter((pile) => pile.picked !== null)
        .map((pile) => pile.name)
        .sort(),
    (found) => found.length === PICKED,
    12,
  );
  log.note(`Top ${PICKED} picked ${JSON.stringify(pickedNames)} of ${JSON.stringify(names)}`);
  if (pickedNames.join("|") !== names.join("|")) {
    log.finding({
      kind: "broken",
      title: `Top ${PICKED} did not pick the ${PICKED} fullest piles`,
      steps: `Close round one; set the Top number to ${PICKED}; read the wall's picked piles`,
      evidence: JSON.stringify({
        picked: pickedNames,
        fullest: names,
        piles: closedWall?.piles.map((pile) => [pile.name, pile.count]),
      }),
    });
  }
  await sleep(1500);
  await snap(dashboard, log, "DashboardPicked", STAFF);
  await snap(projector, log, "ProjectorPicked", WALL, false);

  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await log.timed("open round two", async () => {
    await dashboard.getByRole("button", { name: /^Open.*The stranger/ }).click();
    await openFace(host, token, one.round);
  });
  const two = await openFace(host, token, one.round);
  // The stranger takes round one as context, so the picked piles stand above
  // its prompt as groups; a context round writes, and carries no choices.
  const context = ((two.question as { context?: { name: string }[] }).context ?? [])
    .map((group) => group.name)
    .sort();
  log.note(`round two context ${JSON.stringify(context)}`);
  if (context.join("|") !== pickedNames.join("|")) {
    log.finding({
      kind: "broken",
      title: "round two's context is not the picked piles",
      steps: `Pick ${pickedNames.join(", ")} with Top ${PICKED}; open The stranger; read the face`,
      evidence: JSON.stringify({ context, picked: pickedNames, question: two.question }),
    });
  }
  await sleep(3000);
  await snap(phone, log, "PhoneRoundTwo", [390]);
  await snap(projector, log, "ProjectorRoundTwo", WALL, false);
  await snap(dashboard, log, "DashboardRoundTwo", STAFF);

  // The room names the stranger; the real phone writes its own and hands in.
  await log.timed(
    `${SCRIPTED} scripted phones answer round two`,
    () =>
      phones(token, SCRIPTED, two.question, (seat) =>
        seat % 2 === 0 ? "a bookmark" : "a reading list",
      ),
    15000,
  );
  await phone.getByRole("textbox").first().fill("a bookmark");
  await phone.getByRole("button", { name: "Hand in" }).click();
  await sleep(4000);
  await snap(phone, log, "PhoneAfterVote", [390]);
  await snap(dashboard, log, "DashboardVote", STAFF);
  await snap(projector, log, "ProjectorVote", WALL, false);

  // Close the run through the dialog; the wall reads back.
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
  const expected = (SCRIPTED + 1 + MODELS) * 3;
  log.note(
    `wall read back: ${counted} cards in piles of ${expected}; picked ${(wall?.piles ?? []).filter((pile) => pile.picked !== null).length}`,
  );
  if (
    counted !== expected ||
    (wall?.piles ?? []).filter((pile) => pile.picked !== null).length !== PICKED
  ) {
    log.finding({
      kind: "broken",
      title: `the closed wall does not read back every card in a pile with ${PICKED} picked`,
      steps: "Run Three verbs end to end; close the run; read /live/walls/read for round one",
      evidence: JSON.stringify({ counted, expected, piles: wall?.piles }),
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
