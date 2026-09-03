/**
 * The exemplar scenario: Three verbs, then a stranger, end to end. Two model
 * participants, the model sorting, three picks, round two, the run closed,
 * the wall read back. A screenshot at each state, and every refusal, delay
 * over three seconds, and surprise logged as a finding.
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
  sortUntilPlaced,
  until,
} from "../drive.ts";

const ARM = process.argv[2] ?? "three-verbs";
const STAFF = [1440, 390] as const;
const WALL = [1920] as const;
const SCRIPTED = 30;
const MODELS = 2;
const WORDS = ["add", "save", "keep", "see", "open", "visit", "delete", "remove", "forget"];

const log = new Log(ARM, outDir(ARM));
const host = await signIn();
const web = await pages(host, log);

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
  await dashboard.getByRole("textbox", { name: "Seats to invite" }).fill(String(MODELS));
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

  // The model sorts. The switch on the dashboard drives the ticks; the driver
  // also ticks so the outcome does not hang on the page's poll.
  await dashboard.getByRole("switch", { name: "Model sorts" }).click();
  const sorted = await log.timed(
    "the model sorts every card",
    () => sortUntilPlaced(host, one.round, (SCRIPTED + 1 + MODELS) * 3, 40),
    45000,
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
      steps:
        "Thirty phones plus two model participants on Three verbs; Model sorts on; wait two minutes",
      evidence: JSON.stringify(sorted.wall?.cards.filter((card) => card.pile === null)),
    });
  }
  await sleep(3500);
  await snap(dashboard, log, "DashboardSorted", STAFF);
  await snap(projector, log, "ProjectorSorted", WALL, false);
  await snap(phone, log, "PhoneSorted", [390]);

  // Close round one; pick three piles; open round two.
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
  const names = (sorted.wall?.piles ?? [])
    .slice()
    .sort((left, right) => right.count - left.count)
    .slice(0, 3)
    .map((pile) => pile.name);
  let picked = 0;
  for (const name of names) {
    await dashboard.setViewportSize({ width: 1440, height: 900 });
    await log.timed(`pick ${name}`, async () => {
      await dashboard
        .getByRole("button", {
          name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`),
        })
        .first()
        .click();
      picked += 1;
      await dashboard
        .getByRole("button", { name: new RegExp(`^Open.*The stranger.*${picked} pile`) })
        .waitFor({ timeout: 20000 });
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
  log.note(`round two choices ${JSON.stringify(two.question.choices)}`);
  if (two.question.choices.slice().sort().join("|") !== names.slice().sort().join("|")) {
    log.finding({
      kind: "broken",
      title: "round two's choices are not the picked piles",
      steps: `Pick ${names.join(", ")}; open The stranger; read the face`,
      evidence: JSON.stringify(two.question),
    });
  }
  await sleep(3000);
  await snap(phone, log, "PhoneRoundTwo", [390]);
  await snap(projector, log, "ProjectorRoundTwo", WALL, false);
  await snap(dashboard, log, "DashboardRoundTwo", STAFF);

  // The room votes; the real phone taps a choice and hands in.
  await log.timed(
    `${SCRIPTED} scripted phones vote`,
    () => phones(token, SCRIPTED, two.question, (seat) => names[seat % names.length] as string),
    15000,
  );
  const choice = names[0] as string;
  await phone.getByText(choice, { exact: true }).first().click();
  await phone.getByRole("button", { name: "Hand in" }).click();
  await sleep(4000);
  await snap(phone, log, "PhoneAfterVote", [390]);
  await snap(dashboard, log, "DashboardVote", STAFF);
  await snap(projector, log, "ProjectorVote", WALL, false);

  // Close the run through the dialog; the wall reads back.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await log.timed("close the run", async () => {
    await dashboard.getByRole("button", { name: "Close", exact: true }).click();
    await dashboard
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
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
    (wall?.piles ?? []).filter((pile) => pile.picked !== null).length !== 3
  ) {
    log.finding({
      kind: "broken",
      title: "the closed wall does not read back every card in a pile with three picked",
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
