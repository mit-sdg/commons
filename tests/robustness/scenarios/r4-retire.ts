/**
 * R4, retire mid-course. A deck relay copied, launched, and run through round
 * one with ten phones and the model sorting; retiring refused while the run is
 * open, at the edge and on the screen; then the run closed and the relay
 * retired from its overview — its launch refused, its rounds and its one run
 * still reading, the closed wall still shown, the shelf folding it away, and
 * the editor route asked what it does with a retired relay. A survey follows
 * the same road, and retiring is asked twice and asked of a relay that does
 * not exist. A screenshot at each state; every refusal that surprises, every
 * step over three seconds, and every screen that reads wrongly is a finding.
 *
 * The domain words are the composition's; the HTTP boundary answers with its
 * category only (`src/assembly/http-policy.ts`), so `RUN_OPEN`, `RELAY_RETIRED`
 * and `QUESTIONNAIRE_RETIRED` arrive as `CONFLICT`, and `RELAY_NOT_FOUND` and
 * `ITEM_ALREADY_TRASHED` as `NOT_FOUND`. This scenario expects the category and
 * says what that costs the screens once, as a finding of its own.
 *
 *   bun tests/robustness/scenarios/r4-retire.ts [arm-name]
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
  type Phone,
  phones,
  readRun,
  readWall,
  signIn,
  sleep,
  snap,
  sortUntilPlaced,
  until,
  WEB,
} from "../drive.ts";

const ARM = process.argv[2] ?? "r4-retire";
const STAFF = [1440, 390] as const;
const SCRIPTED = 10;
const PARTS = 3;
const ANSWERERS = 4;
const WORDS = ["add", "save", "keep", "see", "open", "visit", "delete", "remove", "forget"];
/** Other arms share the shelf, so this arm's two things carry their own names. */
const MARK = crypto.randomUUID().slice(0, 8);
const RELAY_TITLE = `Retire mid-course ${MARK}`;
const SURVEY_TITLE = `Retire the survey ${MARK}`;
const CHOICES = ["add", "revisit", "forget"];

/** The face a questionnaire run shows a phone; a relay's face is the driver's. */
interface SheetFace {
  face: {
    open: boolean;
    title: string;
    questions: { question: string; prompt: string; parts: string[]; cap: number }[];
  } | null;
}

const log = new Log(ARM, outDir(ARM));
const host = await signIn();
const web = await pages(host, log);

/** What a page says right now, so a screen's own words go into the log. */
const words = async (page: Page): Promise<string> =>
  ((await page.evaluate("document.querySelector('main')?.innerText ?? ''")) as string)
    .replace(/\s+/g, " ")
    .trim();

/** The toast a refused screen raises, or "" when it raises none. */
async function toastText(page: Page): Promise<string> {
  try {
    const toast = page.locator("[data-sonner-toast]").first();
    await toast.waitFor({ timeout: 6000 });
    return (await toast.innerText()).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

const seen = (page: Page, name: string) =>
  page
    .getByRole("button", { name, exact: true })
    .first()
    .isVisible()
    .catch(() => false);

try {
  // The relay, copied under its own title, launched, and run through round one.
  const relay = await log.timed("copy the deck relay", () =>
    copyDeck(host, "three-verbs", RELAY_TITLE),
  );
  const { run, token } = await log.timed("launch", () => launch(host, relay.relay));
  const dashboard = await web.staff(`/staff/live/run/${run}`);
  await sleep(2000);
  await snap(dashboard, log, "DashboardBefore", STAFF);

  await log.timed("open round one from the dashboard", async () => {
    await dashboard.setViewportSize({ width: 1440, height: 900 });
    await dashboard.getByRole("button", { name: /^Open.*Three verbs/ }).click();
    await openFace(host, token);
  });
  const one = await openFace(host, token);
  log.note(`round one ${one.round}; parts ${JSON.stringify(one.question.parts)}`);
  await dashboard.getByRole("switch", { name: "Model sorts" }).click();
  await log.timed(
    `${SCRIPTED} scripted phones hand in`,
    () =>
      phones(
        token,
        SCRIPTED,
        one.question,
        (seat, part) => WORDS[(seat * PARTS + part) % WORDS.length] as string,
      ),
    20000,
  );
  const sorted = await log.timed(
    "the model places every card",
    () => sortUntilPlaced(host, one.round, SCRIPTED * PARTS, 40),
    60000,
  );
  log.note(
    `sorted: ${sorted.settled}, ticks ${sorted.ticks}, piles ${JSON.stringify(
      sorted.wall?.piles.map((pile) => [pile.name, pile.count]),
    )}`,
  );
  if (!sorted.settled) {
    log.finding({
      kind: "broken",
      title: "the model never placed every card before the run was retired",
      steps: `Model sorts on; ${SCRIPTED} phones hand in three verbs each; wait two minutes`,
      evidence: JSON.stringify(sorted.wall?.cards.filter((card) => card.pile === null)),
    });
  }
  const pileName = sorted.wall?.piles[0]?.name ?? "";
  await sleep(2500);
  await snap(dashboard, log, "DashboardRoundOne", STAFF);

  // Retiring while the run is open: the edge first.
  const refusedAtEdge = await log.timed("retire through the edge with the run open", () =>
    host.call("/live/relays/retire", { relay: relay.relay }),
  );
  log.note(
    `retire with the run open answered ${JSON.stringify(refusedAtEdge)} (RUN_OPEN is CONFLICT at the boundary)`,
  );
  if (refusedAtEdge.error !== "CONFLICT") {
    log.finding({
      kind: refusedAtEdge.error === undefined ? "broken" : "refused-wrongly",
      title:
        refusedAtEdge.error === undefined
          ? "a relay was retired while its run was open"
          : `retiring an open relay answered ${refusedAtEdge.error}; RUN_OPEN is CONFLICT`,
      steps: "Launch a relay, open round one, POST /live/relays/retire",
      evidence: JSON.stringify(refusedAtEdge),
    });
  }

  // Then the screen. The overview offers Retire only when no run is open, so
  // what the staff member meets is the absence of the control, not a sentence.
  const overview = await web.staff(`/staff/live/relay/${relay.relay}`);
  await overview.getByRole("heading", { name: RELAY_TITLE }).waitFor({ timeout: 20000 });
  await sleep(1200);
  const retireWhileOpen = await seen(overview, "Retire");
  const headerWhileOpen = await words(overview);
  log.note(`the overview with the run open says: ${headerWhileOpen.slice(0, 200)}`);
  if (retireWhileOpen) {
    await overview.getByRole("button", { name: "Retire", exact: true }).click();
    await overview.getByRole("dialog").getByRole("button", { name: "Retire", exact: true }).click();
    const said = await toastText(overview);
    log.note(`the overview's Retire with the run open said: ${said}`);
    if (said !== "This round is in the run. It stays as it is.") {
      log.finding({
        kind: "unclear",
        title: `the refused Retire says "${said}", not the RUN_OPEN sentence`,
        steps: "With a run open, open the relay's overview, click Retire, confirm",
        evidence: `said "${said}"; the sentence is "This round is in the run. It stays as it is."`,
        screenshot: "OverviewRunOpen@1440.png",
      });
    }
  } else {
    log.finding({
      kind: "unclear",
      title: "the relay's overview offers no Retire while a run is open, and says nothing about it",
      steps: "Launch a relay, open round one, open /staff/live/relay/<id>",
      evidence: `the header offers ${
        (await seen(overview, "Edit")) ? "Edit and " : ""
      }Run and no Retire; nothing on the page names retiring. Page reads: ${headerWhileOpen.slice(0, 300)}`,
      screenshot: "OverviewRunOpen@1440.png",
    });
  }
  await snap(overview, log, "OverviewRunOpen", STAFF);

  // The shelf while the run stands: this relay's row offers Run, not Retire.
  const shelf = await web.staff("/staff/live");
  await shelf.getByRole("link", { name: RELAY_TITLE }).waitFor({ timeout: 20000 });
  await sleep(1000);
  const liveRow = shelf
    .getByRole("link", { name: RELAY_TITLE })
    .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
  const liveRowWords = (await liveRow.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  log.note(`the shelf's row while the run is open reads "${liveRowWords}"`);
  await snap(shelf, log, "ShelfRunOpen", STAFF);

  // Round one closes; the run closes through the dashboard's dialog.
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await log.timed("close round one", async () => {
    await dashboard.getByRole("button", { name: /^Close.*Three verbs/ }).click();
    await dashboard.getByRole("button", { name: /^Open.*The stranger/ }).waitFor({
      timeout: 20000,
    });
  });
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
  await sleep(2500);
  await snap(dashboard, log, "DashboardRunClosed", STAFF);

  // The relay is retired from its overview.
  await overview.setViewportSize({ width: 1440, height: 900 });
  await overview.goto(`${WEB}/staff/live/relay/${relay.relay}`);
  await overview.getByRole("heading", { name: RELAY_TITLE }).waitFor({ timeout: 20000 });
  await log.timed(
    "retire the relay from its overview",
    async () => {
      await overview.getByRole("button", { name: "Retire", exact: true }).click();
      await overview
        .getByRole("dialog")
        .getByRole("button", { name: "Retire", exact: true })
        .click();
      await overview.getByText("Retired", { exact: true }).waitFor({ timeout: 20000 });
    },
    8000,
  );
  await sleep(1500);
  await snap(overview, log, "OverviewRetired", STAFF);

  // A retired relay is refused a launch.
  const refusedLaunch = await log.timed("launch the retired relay", () =>
    host.call("/live/relays/launch", { relay: relay.relay }),
  );
  log.note(
    `launching the retired relay answered ${JSON.stringify(refusedLaunch)} (RELAY_RETIRED is CONFLICT at the boundary)`,
  );
  if (refusedLaunch.error !== "CONFLICT") {
    log.finding({
      kind: refusedLaunch.error === undefined ? "broken" : "refused-wrongly",
      title:
        refusedLaunch.error === undefined
          ? "a retired relay launched"
          : `launching a retired relay answered ${refusedLaunch.error}; RELAY_RETIRED is CONFLICT`,
      steps: "Retire a relay, POST /live/relays/launch",
      evidence: JSON.stringify(refusedLaunch),
    });
  }

  // Its rounds and its one run still read on the overview.
  const overviewWords = await words(overview);
  log.note(`the retired overview reads: ${overviewWords.slice(0, 400)}`);
  for (const title of ["Three verbs", "The stranger"]) {
    if (!overviewWords.includes(title)) {
      log.finding({
        kind: "broken",
        title: `the retired relay's overview does not read its round "${title}"`,
        steps: "Retire a relay that has run; read /staff/live/relay/<id>",
        evidence: overviewWords.slice(0, 400),
        screenshot: "OverviewRetired@1440.png",
      });
    }
  }
  const runRow = overview.locator(`a[href="/staff/live/run/${run}"]`).first();
  const runRows = await overview.locator(`a[href^="/staff/live/run/"]`).count();
  const runRowWords =
    (await runRow.isVisible().catch(() => false)) === true
      ? (await runRow.innerText()).replace(/\s+/g, " ").trim()
      : "";
  log.note(`the retired overview lists ${runRows} run(s); the one row reads "${runRowWords}"`);
  if (runRowWords === "") {
    log.finding({
      kind: "broken",
      title: "the retired relay's overview shows no link into the run it held",
      steps: "Run a relay once, close it, retire it, read /staff/live/relay/<id>",
      evidence: overviewWords.slice(0, 400),
      screenshot: "OverviewRetired@1440.png",
    });
  } else if (!/\d+\s*(handed|answer|card|response|phone)/i.test(runRowWords)) {
    log.finding({
      kind: "unclear",
      title: "the retired relay's run is listed with dates but no counts",
      steps: `Run ${SCRIPTED} phones through round one, close the run, retire the relay, read its overview`,
      evidence: `the row reads "${runRowWords}"; /live/relays/get carries a run's openedAt, closedAt, open, code and token, and no figure, so no screen can say how many handed in`,
      screenshot: "OverviewRetired@1440.png",
    });
  }

  // The link into the run: a closed dashboard, the wall of round one read-only.
  await log.timed(
    "follow the retired relay's run link",
    async () => {
      await runRow.click();
      await overview.waitForURL(`**/staff/live/run/${run}`, { timeout: 20000 });
      await overview.getByText("Closed", { exact: true }).waitFor({ timeout: 20000 });
    },
    10000,
  );
  await sleep(3000);
  const closedBoard = await words(overview);
  log.note(`the closed board of the retired relay reads: ${closedBoard.slice(0, 300)}`);
  if (pileName !== "" && !closedBoard.includes(pileName)) {
    log.finding({
      kind: "broken",
      title: "the closed run of a retired relay does not show round one's wall",
      steps: "Retire a relay, follow its overview's run link, wait for the board",
      evidence: `expected the pile "${pileName}"; the board reads ${closedBoard.slice(0, 300)}`,
      screenshot: "RunClosedRetired@1440.png",
    });
  }
  if (await seen(overview, "Close run")) {
    log.finding({
      kind: "broken",
      title: "the closed run still offers Close run",
      steps: "Open a closed run's dashboard",
      screenshot: "RunClosedRetired@1440.png",
    });
  }
  if (
    await overview
      .getByText("new pile", { exact: true })
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    log.finding({
      kind: "broken",
      title: "the closed wall still offers a new pile to drop cards into",
      steps: "Open a closed run's dashboard and look at the wall",
      screenshot: "RunClosedRetired@1440.png",
    });
  }
  if (await seen(overview, "Summarize")) {
    log.finding({
      kind: "unclear",
      title: "the closed wall still offers Summarize on every pile",
      steps: "Retire a relay whose run has closed; open that run's dashboard and look at the piles",
      evidence:
        "the wall drops the new-pile target once the round is closed, but each pile keeps its Summarize button, so the read-only wall still shows a control that changes it",
      screenshot: "RunClosedRetired@1440.png",
    });
  }
  if (await seen(overview, "Draft a round")) {
    log.finding({
      kind: "unclear",
      title: "a closed run of a retired relay still offers Draft a round into its editor",
      steps: "Retire a relay whose run has closed; open that run's dashboard",
      evidence:
        "the aside links to /staff/live/relay/<id>/edit?draft=1 for a relay that is retired",
      screenshot: "RunClosedRetired@1440.png",
    });
  }
  await snap(overview, log, "RunClosedRetired", STAFF);

  // The shelf: gone from the list, folded under Show retired.
  await shelf.setViewportSize({ width: 1440, height: 900 });
  await shelf.goto(`${WEB}/staff/live`);
  await shelf.getByRole("button", { name: /^Show retired/ }).waitFor({ timeout: 20000 });
  await sleep(1000);
  const standing = shelf.getByRole("link", { name: RELAY_TITLE });
  if (await standing.isVisible().catch(() => false)) {
    log.finding({
      kind: "broken",
      title: "the retired relay still stands in the shelf's main list",
      steps: "Retire a relay; open /staff/live",
      screenshot: "ShelfStanding@1440.png",
    });
  }
  await snap(shelf, log, "ShelfStanding", STAFF);
  await shelf.setViewportSize({ width: 1440, height: 900 });
  await log.timed(
    "show the retired rows",
    async () => {
      await shelf.getByRole("button", { name: /^Show retired/ }).click();
      await standing.waitFor({ timeout: 15000 });
    },
    6000,
  );
  await sleep(1000);
  await snap(shelf, log, "ShelfRetired", STAFF);

  // The editor route for a retired relay.
  const editor = await web.staff(`/staff/live/relay/${relay.relay}/edit`);
  await editor.getByRole("button", { name: "Add a round" }).waitFor({ timeout: 20000 });
  await sleep(1200);
  const editorWords = await words(editor);
  const titleBox = editor.getByRole("textbox", { name: "Title" }).first();
  const editable = await titleBox.isEditable().catch(() => false);
  const canAdd = await editor
    .getByRole("button", { name: "Add a round" })
    .first()
    .isVisible()
    .catch(() => false);
  const launchButton = editor.getByRole("button", { name: "Launch", exact: true }).first();
  const canLaunch = await launchButton.isEnabled().catch(() => false);
  log.note(
    `the retired relay's editor: title editable ${editable}, Add a round ${canAdd}, Launch enabled ${canLaunch}`,
  );
  await snap(editor, log, "EditorRetired", STAFF);
  if (editable || canAdd || canLaunch) {
    let said = "";
    if (canLaunch) {
      await launchButton.click();
      said = await toastText(editor);
      log.note(`the retired relay's editor answered a Launch with: ${said}`);
    }
    log.finding({
      kind: "unclear",
      title: "the editor opens a retired relay fully editable, with a Launch it cannot honour",
      steps: `Retire a relay; open /staff/live/relay/<id>/edit`,
      evidence: `title editable ${editable}, Add a round offered ${canAdd}, Launch enabled ${canLaunch}, no Retired badge (${!editorWords.includes(
        "Retired",
      )}); Launch said "${said}"`,
      screenshot: "EditorRetired@1440.png",
    });
  }

  // Retiring twice, and retiring a relay that is not there.
  const twice = await host.call("/live/relays/retire", { relay: relay.relay });
  log.note(
    `retiring the relay a second time answered ${JSON.stringify(twice)} (RELAY_RETIRED is CONFLICT, ITEM_ALREADY_TRASHED is NOT_FOUND)`,
  );
  if (twice.error === undefined) {
    log.finding({
      kind: "broken",
      title: "retiring an already retired relay is answered as a success",
      steps: "Retire a relay; POST /live/relays/retire again",
      evidence: JSON.stringify(twice),
    });
  }
  const nowhere = await host.call("/live/relays/retire", { relay: crypto.randomUUID() });
  log.note(
    `retiring a relay that does not exist answered ${JSON.stringify(nowhere)} (RELAY_NOT_FOUND is NOT_FOUND)`,
  );
  if (nowhere.error !== "NOT_FOUND") {
    log.finding({
      kind: nowhere.error === undefined ? "broken" : "refused-wrongly",
      title:
        nowhere.error === undefined
          ? "retiring a relay that does not exist is answered as a success"
          : `retiring a relay that does not exist answered ${nowhere.error}; RELAY_NOT_FOUND is NOT_FOUND`,
      steps: "POST /live/relays/retire with a fresh uuid",
      evidence: JSON.stringify(nowhere),
    });
  }
  log.finding({
    kind: "unclear",
    title:
      "every way retiring can be refused arrives as one of two categories, so no screen can say which",
    steps:
      "Retire with a run open, retire twice, retire a relay that is not there, launch a retired relay",
    evidence: JSON.stringify({
      retireWithRunOpen: refusedAtEdge.error,
      retireTwice: twice.error,
      retireNothing: nowhere.error,
      launchRetired: refusedLaunch.error,
      note: 'refusals.ts holds the RUN_OPEN sentence, but the retire and launch handlers on the shelf, the overview and the editor all fall back to publicErrorMessage, which says "That change cannot be made right now." for CONFLICT and "That item is not available." for NOT_FOUND',
    }),
  });

  // ---------------------------------------------------------------------
  // A questionnaire retires the same way.
  // ---------------------------------------------------------------------

  const created = await log.timed("create the survey", () =>
    host.call<{ questionnaire: string }>("/live/quizzes/create", {
      title: SURVEY_TITLE,
      form: "survey",
      disclosure: "answers",
    }),
  );
  if (created.error) throw new Error(`create the survey: ${created.error}`);
  const questionnaire = created.questionnaire;
  const asked = await host.call("/live/quizzes/add-question", {
    questionnaire,
    prompt: "Which verb does a bookmark need most?",
    choices: CHOICES,
    expected: "",
    explanation: "",
  });
  if (asked.error) throw new Error(`add-question: ${asked.error}`);
  const sheetRun = await log.timed("launch the survey", () =>
    host.call<{ run: string; token: string; code: string }>("/live/runs/launch", {
      questionnaire,
    }),
  );
  if (sheetRun.error) throw new Error(`launch the survey: ${sheetRun.error}`);
  const face = await until(
    () => host.call<SheetFace>("/live/p/arrive", { token: sheetRun.token }),
    (value) => (value.face?.questions.length ?? 0) > 0,
    20,
  );
  const question = face.face?.questions[0];
  if (question === undefined) throw new Error(`the survey's face carries no question`);
  const answered: Phone[] = await log.timed(
    `${ANSWERERS} phones answer the survey`,
    () =>
      phones(
        sheetRun.token,
        ANSWERERS,
        { question: question.question, parts: question.parts, cap: question.cap },
        (seat) => CHOICES[seat % CHOICES.length] as string,
        "sheet",
      ),
    15000,
  );
  log.note(`${answered.length} phones answered the survey`);
  const closedSheet = await host.call("/live/runs/close", { run: sheetRun.run });
  if (closedSheet.error)
    log.refused("close the survey's run", "POST /live/runs/close", closedSheet);

  const sheet = await web.staff(`/staff/live/${questionnaire}`);
  await sheet.getByRole("heading", { name: SURVEY_TITLE }).waitFor({ timeout: 20000 });
  await sleep(1200);
  const sheetHasRetire = await seen(sheet, "Retire");
  if (sheetHasRetire) {
    await log.timed(
      "retire the survey from its overview",
      async () => {
        await sheet.getByRole("button", { name: "Retire", exact: true }).click();
        await sheet
          .getByRole("dialog")
          .getByRole("button", { name: "Retire", exact: true })
          .click();
        await sheet.getByText("Retired", { exact: true }).waitFor({ timeout: 20000 });
      },
      8000,
    );
  } else {
    log.finding({
      kind: "unclear",
      title: "the questionnaire's overview offers no Retire once its run has closed",
      steps: "Launch a survey, close the run, open /staff/live/<questionnaire>",
      evidence: (await words(sheet)).slice(0, 300),
    });
    const retired = await host.call("/live/quizzes/retire", { questionnaire });
    if (retired.error) log.refused("retire the survey", "POST /live/quizzes/retire", retired);
    await sheet.reload();
    await sheet.getByText("Retired", { exact: true }).waitFor({ timeout: 20000 });
  }
  await sleep(1200);
  await snap(sheet, log, "SurveyRetired", STAFF);

  const relaunch = await host.call("/live/runs/launch", { questionnaire });
  log.note(
    `launching the retired survey answered ${JSON.stringify(relaunch)} (QUESTIONNAIRE_RETIRED is CONFLICT)`,
  );
  if (relaunch.error !== "CONFLICT") {
    log.finding({
      kind: relaunch.error === undefined ? "broken" : "refused-wrongly",
      title:
        relaunch.error === undefined
          ? "a retired questionnaire launched again"
          : `launching a retired questionnaire answered ${relaunch.error}; QUESTIONNAIRE_RETIRED is CONFLICT`,
      steps: "Retire a questionnaire, POST /live/runs/launch",
      evidence: JSON.stringify(relaunch),
    });
  }

  const sheetWords = await words(sheet);
  log.note(`the retired survey's overview reads: ${sheetWords.slice(0, 300)}`);
  if (!sheetWords.includes("Which verb does a bookmark need most?") || !/Opened/.test(sheetWords)) {
    log.finding({
      kind: "broken",
      title: "the retired questionnaire's overview does not read its question and its run",
      steps: "Retire a survey that has run; read /staff/live/<questionnaire>",
      evidence: sheetWords.slice(0, 400),
      screenshot: "SurveyRetired@1440.png",
    });
  }

  const board = await log.timed("read the retired survey's results", () =>
    host.call<{ board: { handedIn: number; questions: unknown[] } }>("/live/runs/results", {
      run: sheetRun.run,
    }),
  );
  log.note(`the retired survey's board: handed in ${board.board?.handedIn}`);
  if (board.error || board.board?.handedIn !== ANSWERERS) {
    log.finding({
      kind: "broken",
      title: `the retired questionnaire's board reads ${board.board?.handedIn} hand-ins, not ${ANSWERERS}`,
      steps: `${ANSWERERS} phones answer a survey; close it; retire it; POST /live/runs/results`,
      evidence: JSON.stringify(board).slice(0, 400),
    });
  }
  await sheet.setViewportSize({ width: 1440, height: 900 });
  await sheet.goto(`${WEB}/staff/live/run/${sheetRun.run}`);
  await sheet.getByText("Which verb does a bookmark need most?").first().waitFor({
    timeout: 20000,
  });
  await sleep(1500);
  await snap(sheet, log, "SurveyBoardRetired", STAFF);

  // The shelf folds the survey away too.
  await shelf.setViewportSize({ width: 1440, height: 900 });
  await shelf.goto(`${WEB}/staff/live`);
  await shelf.getByRole("button", { name: /^Show retired/ }).waitFor({ timeout: 20000 });
  await sleep(1000);
  const surveyRow = shelf.getByRole("link", { name: SURVEY_TITLE });
  if (await surveyRow.isVisible().catch(() => false)) {
    log.finding({
      kind: "broken",
      title: "the retired questionnaire still stands in the shelf's main list",
      steps: "Retire a questionnaire; open /staff/live",
      screenshot: "ShelfBothRetired@1440.png",
    });
  }
  await shelf.getByRole("button", { name: /^Show retired/ }).click();
  await log.timed(
    "both retired things fold out of the shelf",
    async () => {
      await surveyRow.waitFor({ timeout: 15000 });
      await shelf.getByRole("link", { name: RELAY_TITLE }).waitFor({ timeout: 15000 });
    },
    6000,
  );
  await sleep(1000);
  await snap(shelf, log, "ShelfBothRetired", STAFF);

  // The run of the retired relay still reads at the edge, whole.
  const standingRun = await readRun(host, run);
  const wall = (await readWall(host, one.round)).wall;
  const counted = (wall?.piles ?? []).reduce((sum, pile) => sum + pile.count, 0);
  log.note(
    `after retiring: ${counted} cards of ${SCRIPTED * PARTS} in piles; rounds ${JSON.stringify(
      standingRun.run?.rounds.map((round) => [round.title, round.figure.handedIn]),
    )}`,
  );
  if (counted !== SCRIPTED * PARTS || standingRun.run?.rounds[0]?.figure.handedIn !== SCRIPTED) {
    log.finding({
      kind: "broken",
      title: "the retired relay's run does not read back every card and every hand-in",
      steps: "Retire a relay whose run has closed; read /live/relays/run and /live/walls/read",
      evidence: JSON.stringify({
        counted,
        expected: SCRIPTED * PARTS,
        rounds: standingRun.run?.rounds.map((round) => round.figure),
      }),
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
