/**
 * R3, skip and return, every refusal named. A three-round relay: round two
 * takes context from round one, round three takes nothing, so the staff member
 * may skip ahead and come back. Every refusal the open-round path can give is
 * asked for in turn — the source that has not run, the round already open, the
 * round that already ran, nothing picked, the closed run — beside the sentence
 * the screen says for it, with a screenshot of each. Twenty scripted phones and
 * one real one; the phone's own refusals — handed in already, answered after
 * the close, arriving at a closed run — are asked the same way.
 *
 *   bun tests/robustness/scenarios/r3-skip-and-return.ts [arm-name]
 */

import type { Page } from "playwright";
import {
  arrive,
  Client,
  invite,
  launch,
  Log,
  openFace,
  outDir,
  pages,
  Phone,
  phones,
  readRun,
  readWall,
  type Reply,
  signIn,
  sleep,
  snap,
  sortUntilPlaced,
  until,
} from "../drive.ts";

const ARM = process.argv[2] ?? "r3-skip-and-return";
const STAFF = [1440] as const;
const WALL = [1920] as const;
const PHONE = [390] as const;
const SCRIPTED = 20;
const TITLE = "Skip and return";

/** The three rounds, written through the edge as a staff member would write them. */
const ROUNDS = [
  { title: "One word", prompt: "One word for what a relay lets a room do." },
  { title: "The purpose", prompt: "Only these words. What is the purpose?" },
  { title: "Aside", prompt: "Aside from all that: what did you expect today?" },
];

/** The sentences the screens say, copied from frontend/src/components/live/refusals.ts. */
const SAYS = {
  ROUND_OPEN: (round: number) => `Close round ${round} first.`,
  ROUND_DONE: (round: number) => `Round ${round} already ran.`,
  SOURCE_OPEN: (round: number) => `Close round ${round} first. This one takes from it.`,
  SOURCE_UNRUN: (round: number) => `Run round ${round} first. This one takes from it.`,
  NOTHING_PICKED: "Pick at least one pile.",
  CLOSED: "The run is closed.",
  ALREADY_SUBMITTED: "You already handed in.",
  INCOMPLETE: "Answer every box first.",
};

/** What each refusal step asked, what the edge answered, and what a screen said. */
const said: { step: string; edge: string; screen: string }[] = [];

const log = new Log(ARM, outDir(ARM));
const host = await signIn();
const web = await pages(host, log);

/** Writes the relay by hand: three rounds, the second taking context from the first. */
async function build(): Promise<{ relay: string; legs: string[] }> {
  const planned = await host.call<{ relay: string }>("/live/relays/plan", { title: TITLE });
  if (planned.error) throw new Error(`plan: ${planned.error}`);
  const legs: string[] = [];
  for (const round of ROUNDS) {
    const added = await host.call<{ leg: string }>("/live/relays/add-round", {
      relay: planned.relay,
      title: round.title,
      prompt: round.prompt,
      parts: [],
      cap: 0,
      choices: [],
    });
    if (added.error) throw new Error(`add-round ${round.title}: ${added.error}`);
    legs.push(added.leg);
  }
  const drawn = await host.call("/live/relays/set-takes", {
    leg: legs[1],
    source: legs[0],
    shape: "context",
  });
  if (drawn.error) throw new Error(`set-takes: ${drawn.error}`);
  return { relay: planned.relay, legs };
}

/**
 * Asks the edge for one refusal and records it beside the sentence the screen
 * says. An answer that is not refused at all is broken; a refusal in a
 * category the step did not expect is refused wrongly.
 */
async function refusal(
  step: string,
  expected: string[],
  screen: string,
  ask: () => Promise<Reply>,
): Promise<Reply> {
  const reply = await ask();
  const word = reply.error ?? "(not refused)";
  said.push({ step, edge: word, screen });
  log.note(`${step}: the edge answers ${word}; the screen says “${screen}”`);
  if (reply.error === undefined) {
    log.finding({
      kind: "broken",
      title: `${step} was not refused`,
      steps: step,
      evidence: JSON.stringify(reply),
    });
  } else if (!expected.includes(reply.error)) {
    log.refused(`${step} answered ${reply.error}, not ${expected.join(" or ")}`, step, reply);
  }
  return reply;
}

/** What the dashboard's one moving button offers, and the line printed under it. */
async function board(
  page: Page,
): Promise<{ label: string; disabled: boolean | null; line: string }> {
  const open = page.getByRole("button", { name: /^Open/ }).first();
  const offered = (await open.count()) > 0;
  const line = page.locator("#open-refusal").first();
  const flat = (text: string) => text.replace(/\s+/g, " ").trim();
  return {
    label: offered ? flat((await open.textContent()) ?? "") : "(no Open button)",
    disabled: offered ? await open.isDisabled() : null,
    line: (await line.count()) > 0 ? flat((await line.textContent()) ?? "") : "(no refusal line)",
  };
}

const flatten = (text: string) => text.replace(/\s+/g, " ").trim();
const reads = async (page: Page, selector: string) =>
  flatten(await page.locator(selector).first().innerText());
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

try {
  const { relay, legs } = await log.timed("write the three-round relay", build);
  const [one, two, three] = legs as [string, string, string];
  const { run, token } = await log.timed("launch", () => launch(host, relay));
  const dashboard = await web.staff(`/staff/live/run/${run}`);
  const projector = await web.staff(`/staff/live/run/${run}/project`, 1920);
  const phone = await web.phone(token);
  const atBoard = () => dashboard.setViewportSize({ width: 1440, height: 900 });
  await sleep(2500);
  await snap(dashboard, log, "DashboardBefore", STAFF);
  await snap(projector, log, "ProjectorBefore", WALL, false);
  await snap(phone, log, "PhoneBefore", PHONE);

  // 1. Round two before round one has run. The dashboard cannot even offer it:
  // its Open button is the first round that has not run.
  await atBoard();
  const beforeAny = await board(dashboard);
  log.note(`with nothing run the dashboard offers “${beforeAny.label}”; line ${beforeAny.line}`);
  await refusal("open round 2 before round 1 ran", ["CONFLICT"], SAYS.SOURCE_UNRUN(1), () =>
    host.call("/live/relays/open-round", { run, leg: two }),
  );
  said.push({
    step: "…as the dashboard stands then",
    edge: "(not asked: the dashboard offers only round 1)",
    screen: `Open button “${beforeAny.label}”, ${beforeAny.line}`,
  });
  await snap(dashboard, log, "DashboardNothingRun", STAFF);
  log.finding({
    kind: "unclear",
    title:
      "an unrun source and an open one are the same refusal, and only the screen tells them apart",
    steps:
      "Launch with nothing run; POST /live/relays/open-round for round two, which takes from round one",
    evidence:
      "OpenRoundRefused answers SOURCE_OPEN — “Close round 1 first. This one takes from it.” — because legHasAnOpenSource holds for a source with no closed round at all, run or not. The dashboard reads SOURCE_UNRUN instead — “Run round 1 first.” — from what it can see, so the sentence a staff member reads is right only because the screen looked again.",
    screenshot: "DashboardNothingRun@1440.png",
  });

  // 2. Round three, which takes nothing, opens whatever its number.
  const skipped = await log.timed("open round 3 first", () =>
    host.call<{ round: string }>("/live/relays/open-round", { run, leg: three }),
  );
  if (skipped.error) {
    log.refused(
      "round 3, which takes nothing, would not open before round 1",
      "POST /live/relays/open-round for the third leg with nothing run",
      skipped,
    );
    throw new Error(`round three would not open: ${skipped.error}`);
  }
  const aside = await openFace(host, token);
  log.note(`round 3 open as ${aside.round}; prompt ${JSON.stringify(aside.question.prompt)}`);
  await sleep(3000);
  await atBoard();
  const skippedBoard = await board(dashboard);
  const strip = await reads(dashboard, "main header");
  const phoneOnThree = await reads(phone, "body");
  log.note(`strip with round 3 open: ${strip}`);
  log.note(
    `the dashboard offers “${skippedBoard.label}” (disabled ${skippedBoard.disabled}); line ${skippedBoard.line}`,
  );
  log.note(`the phone on round 3 reads: ${phoneOnThree.slice(0, 200)}`);
  said.push({
    step: "round 3 open, rounds 1–2 unrun (dashboard)",
    edge: "(not refused: a round taking nothing opens whatever its number)",
    screen: `Open “${skippedBoard.label}” disabled ${skippedBoard.disabled}, ${skippedBoard.line}`,
  });
  await snap(dashboard, log, "DashboardRoundThreeOpen", STAFF);
  await snap(projector, log, "ProjectorRoundThreeOpen", WALL, false);
  await snap(phone, log, "PhoneRoundThreeOpen", PHONE);
  if (!phoneOnThree.includes(ROUNDS[2]?.prompt ?? "")) {
    log.finding({
      kind: "unclear",
      title: "the phone does not show round three's prompt while round three is open",
      steps: "Open round 3 first, before rounds 1 and 2 have run; look at the phone",
      evidence: phoneOnThree.slice(0, 300),
      screenshot: "PhoneRoundThreeOpen@390.png",
    });
  }

  await log.timed(
    `${SCRIPTED} scripted phones answer round 3`,
    () => phones(token, SCRIPTED, aside.question, (seat) => `expectation ${seat % 5}`),
    20000,
  );
  await atBoard();
  await log.timed("close round 3", async () => {
    await dashboard.getByRole("button", { name: /^Close.*Aside/ }).click();
    await until(
      () => readRun(host, run),
      (value) => value.run?.openRound === null,
      20,
    );
  });
  await sleep(2500);
  await snap(dashboard, log, "DashboardRoundThreeClosed", STAFF);

  // 3. Round one from the dashboard's button, which offers it again.
  await atBoard();
  await log.timed("open round 1 from the dashboard", async () => {
    await dashboard.getByRole("button", { name: /^Open.*One word/ }).click();
    await openFace(host, token, aside.round);
  });
  const first = await openFace(host, token, aside.round);
  log.note(`round 1 open as ${first.round}`);
  await refusal("open round 2 while round 1 is open", ["CONFLICT"], SAYS.ROUND_OPEN(1), () =>
    host.call("/live/relays/open-round", { run, leg: two }),
  );
  await refusal("open round 1 again while it is open", ["CONFLICT"], SAYS.ROUND_OPEN(1), () =>
    host.call("/live/relays/open-round", { run, leg: one }),
  );
  await atBoard();
  const whileOpen = await board(dashboard);
  log.note(
    `while round 1 is open the dashboard offers “${whileOpen.label}”; line ${whileOpen.line}`,
  );
  await snap(dashboard, log, "DashboardRoundOneOpen", STAFF);
  await snap(phone, log, "PhoneRoundOneOpen", PHONE);

  const seats = await log.timed(
    `${SCRIPTED} scripted phones answer round 1`,
    () => phones(token, SCRIPTED, first.question, (seat) => `relay word ${seat % 6}`),
    20000,
  );

  // The real phone hands in, then hands the same response in a second time.
  await phone.getByRole("textbox").first().fill("relaying");
  await log.timed("the phone hands in", async () => {
    await phone.getByRole("button", { name: "Hand in" }).click();
    await phone
      .getByRole("button", { name: "Hand in" })
      .waitFor({ state: "hidden", timeout: 10000 });
  });
  await sleep(2500);
  const held = JSON.parse(
    (await phone.evaluate(
      `JSON.stringify(Object.keys(localStorage).filter((key) => key.startsWith("commons-live-${token}:")).map((key) => localStorage.getItem(key)))`,
    )) as string,
  ) as string[];
  const mine = held
    .map((raw) => JSON.parse(raw) as { response?: string; submitted?: boolean })
    .find((progress) => progress.submitted === true);
  if (mine?.response === undefined) {
    log.finding({
      kind: "broken",
      title: "the real phone kept no handed-in response to try again with",
      steps: "Hand in on the phone; read commons-live-<token>:* out of its localStorage",
      evidence: JSON.stringify(held).slice(0, 300),
    });
  } else {
    const again = new Client();
    await refusal(
      "the real phone hands the same response in twice",
      ["CONFLICT"],
      SAYS.ALREADY_SUBMITTED,
      () => again.call("/live/p/submit", { response: mine.response }),
    );
  }
  await snap(phone, log, "PhoneHandedIn", PHONE);

  // A fresh phone that answers nothing and hands in. A relay round is a survey
  // and a survey may be handed in as it stands, so this one is expected to land.
  const blank = new Phone(token, "blank-phone");
  const begun = await blank.begin();
  if (begun.error) {
    log.refused("a fresh phone could not begin round 1", "POST /live/p/begin", begun);
  } else {
    const empty = await blank.submit();
    const word = empty.error ?? "(not refused: a relay round is a survey, handed in as it stands)";
    said.push({
      step: "a phone hands in having answered nothing",
      edge: word,
      screen: SAYS.INCOMPLETE,
    });
    log.note(`a phone hands in having answered nothing: the edge answers ${word}`);
    if (empty.error !== undefined && empty.error !== "CONFLICT") {
      log.refused(
        "a blank hand-in was refused in an unexpected category",
        "POST /live/p/submit",
        empty,
      );
    }
  }

  // The model sorts round one's wall.
  await atBoard();
  await dashboard.getByRole("switch", { name: "Model sorts" }).click();
  const sorted = await log.timed(
    "the model places every card",
    () => sortUntilPlaced(host, first.round, SCRIPTED + 1, 40),
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
      title: "the model never placed every card of round one",
      steps: `Model sorts on with ${SCRIPTED + 1} cards on round one's wall; wait two minutes`,
      evidence: JSON.stringify(sorted.wall?.cards.filter((card) => card.pile === null)),
    });
  }
  await sleep(3000);
  await snap(dashboard, log, "DashboardRoundOneSorted", STAFF);

  await atBoard();
  await log.timed("close round 1", async () => {
    await dashboard.getByRole("button", { name: /^Close.*One word/ }).click();
    await dashboard.getByRole("button", { name: /^Open.*The purpose/ }).waitFor({ timeout: 20000 });
  });
  const late = seats[0];
  if (late !== undefined) {
    await refusal("a phone answers round 1 after it closed", ["CONFLICT"], SAYS.CLOSED, () =>
      late.answer(first.question.question, null, "too late"),
    );
  }
  await sleep(3000);
  await snap(phone, log, "PhoneAfterRoundOneClosed", PHONE);
  const phoneWaiting = await reads(phone, "body");
  log.note(`the phone after round 1 closed reads: ${phoneWaiting.slice(0, 200)}`);

  // 4. Nothing picked: the Open button is disabled and says why.
  await atBoard();
  await dashboard.getByRole("button", { name: "By hand" }).waitFor({ timeout: 20000 });
  await dashboard.getByRole("button", { name: "By hand" }).click();
  const pickedNow = async () =>
    ((await readWall(host, first.round)).wall?.piles ?? [])
      .filter((pile) => pile.picked !== null)
      .map((pile) => pile.name)
      .sort();
  const tapPile = async (name: string) => {
    await atBoard();
    await dashboard
      .getByRole("button", { name: new RegExp(escape(name)) })
      .first()
      .click();
  };
  for (const name of await pickedNow()) await tapPile(name);
  const emptied = await until(pickedNow, (names) => names.length === 0, 15);
  if (emptied.length !== 0) {
    log.finding({
      kind: "broken",
      title: `${emptied.length} piles stayed picked after every one was untapped by hand`,
      steps: "Close round one; set Pick to By hand; tap every picked pile off; read the wall",
      evidence: JSON.stringify(emptied),
    });
  }
  await sleep(2500);
  await atBoard();
  const unpicked = await board(dashboard);
  log.note(
    `with nothing picked the dashboard offers “${unpicked.label}” (disabled ${unpicked.disabled}); line ${unpicked.line}`,
  );
  await snap(dashboard, log, "DashboardNothingPicked", STAFF);
  said.push({
    step: "nothing picked (dashboard)",
    edge: "(not asked: the Open button is disabled)",
    screen: `Open “${unpicked.label}” disabled ${unpicked.disabled}, ${unpicked.line}`,
  });
  if (unpicked.disabled !== true || unpicked.line !== SAYS.NOTHING_PICKED) {
    log.finding({
      kind: "unclear",
      title: `with nothing picked the Open button reads “${unpicked.line}” (disabled ${unpicked.disabled}), not “${SAYS.NOTHING_PICKED}”`,
      steps: "Close round one; set Pick to By hand; untap every pile; look at the Open button",
      evidence: JSON.stringify(unpicked),
      screenshot: "DashboardNothingPicked@1440.png",
    });
  }
  await refusal("open round 2 with nothing picked", ["CONFLICT"], SAYS.NOTHING_PICKED, () =>
    host.call("/live/relays/open-round", { run, leg: two }),
  );

  // Two piles picked by hand, and round two opens on them.
  const fullest = (sorted.wall?.piles ?? [])
    .slice()
    .sort((left, right) => right.count - left.count)
    .slice(0, 2)
    .map((pile) => pile.name);
  for (const name of fullest) await tapPile(name);
  const picks = await until(pickedNow, (names) => names.length === 2, 15);
  log.note(`picked by hand: ${JSON.stringify(picks)} of ${JSON.stringify(fullest)}`);
  await sleep(1500);
  await snap(dashboard, log, "DashboardTwoPicked", STAFF);
  await atBoard();
  await log.timed("open round 2 on the two picked piles", async () => {
    await dashboard.getByRole("button", { name: /^Open.*The purpose/ }).click();
    await openFace(host, token, first.round);
  });
  const purpose = await openFace(host, token, first.round);
  const context = ((purpose.question as { context?: { name: string }[] }).context ?? [])
    .map((group) => group.name)
    .sort();
  log.note(`round 2 context ${JSON.stringify(context)}`);
  if (context.join("|") !== picks.join("|")) {
    log.finding({
      kind: "broken",
      title: "round two's context is not the two piles picked by hand",
      steps: `Pick ${picks.join(", ")} by hand on round one's wall; open round two; read the face`,
      evidence: JSON.stringify({ context, picks }),
    });
  }
  await sleep(3000);
  await snap(dashboard, log, "DashboardRoundTwoOpen", STAFF);
  await snap(phone, log, "PhoneRoundTwoOpen", PHONE);
  await log.timed(
    `${SCRIPTED} scripted phones answer round 2`,
    () => phones(token, SCRIPTED, purpose.question, (seat) => `purpose ${seat % 4}`),
    20000,
  );
  await atBoard();
  await log.timed("close round 2", async () => {
    await dashboard.getByRole("button", { name: /^Close.*The purpose/ }).click();
    await until(
      () => readRun(host, run),
      (value) => value.run?.openRound === null,
      20,
    );
  });

  // 5. Every round has run; then the run closes and everything is refused.
  await refusal("open round 3 again after it ran", ["CONFLICT"], SAYS.ROUND_DONE(3), () =>
    host.call("/live/relays/open-round", { run, leg: three }),
  );
  await sleep(2500);
  await atBoard();
  const done = flatten(await dashboard.locator("aside").first().innerText());
  log.note(`the dashboard's aside once every round ran: ${done}`);
  await snap(dashboard, log, "DashboardEveryRoundRan", STAFF);
  if (!done.includes("Every round has run.")) {
    log.finding({
      kind: "unclear",
      title: "the dashboard does not say every round has run once all three have",
      steps: "Run rounds 3, 1 and 2 in that order; close round two; look at the dashboard",
      evidence: done.slice(0, 300),
      screenshot: "DashboardEveryRoundRan@1440.png",
    });
  }

  await atBoard();
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
  await refusal("open a round in a closed run", ["CONFLICT"], SAYS.CLOSED, () =>
    host.call("/live/relays/open-round", { run, leg: one }),
  );
  await refusal("invite a model seat into a closed run", ["CONFLICT"], SAYS.CLOSED, async () => {
    const replies = await invite(host, run, 1);
    return replies[0] ?? { error: "(no reply)" };
  });
  await refusal("a phone begins in a closed run", ["CONFLICT"], SAYS.CLOSED, () =>
    new Phone(token, "late-arrival").begin(),
  );
  await sleep(3500);
  await snap(dashboard, log, "DashboardClosed", STAFF);
  await snap(projector, log, "ProjectorClosed", WALL, false);
  await snap(phone, log, "PhoneClosed", PHONE);
  const phoneClosed = await reads(phone, "body");
  log.note(`the phone in a closed run reads: ${phoneClosed.slice(0, 200)}`);
  said.push({
    step: "the phone in a closed run",
    edge: "CONFLICT",
    screen: phoneClosed.slice(0, 120),
  });
  if (!phoneClosed.includes(SAYS.CLOSED)) {
    log.finding({
      kind: "unclear",
      title: `the phone in a closed run does not say “${SAYS.CLOSED}”`,
      steps: "Close the run; look at the phone",
      evidence: phoneClosed.slice(0, 300),
      screenshot: "PhoneClosed@390.png",
    });
  }

  // The boundary answers a category, never the word, so no screen and no
  // scenario can tell one refusal of a path from another by what it is sent.
  const categories = new Set(said.map((row) => row.edge));
  log.note(`refusals asked: ${JSON.stringify(said, null, 2)}`);
  log.finding({
    kind: "unclear",
    title: `the edge answers ${[...categories].filter((word) => !word.startsWith("(")).join(", ")} for every relay refusal, never the word`,
    steps:
      "Ask the edge for each open-round and phone refusal in turn; read the error each answers",
    evidence: JSON.stringify(said),
  });

  const standing = await readRun(host, run);
  log.note(
    `run read back: ${JSON.stringify(
      standing.run.rounds.map((round) => [round.number, round.title, round.figure.handedIn]),
    )}`,
  );
  const ran = standing.run.rounds.filter((round) => round.round !== null).length;
  if (ran !== 3) {
    log.finding({
      kind: "broken",
      title: `${ran} of three rounds ran after the skip and the return`,
      steps: "Run rounds 3, 1 and 2 in that order; close the run; read /live/relays/run",
      evidence: JSON.stringify(standing.run.rounds),
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
