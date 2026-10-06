import { type BrowserContext, expect, type Locator, type Page } from "@playwright/test";
import { test } from "./support/browser.ts";
import {
  EVIDENCE,
  type ExpectedReadiness,
  type Level,
  MODEL,
  LARGE_POINT_CRITERIA,
  POINT_CRITERIA,
  type Rating,
  type SeededLearner,
  retireGradeScenarios,
  type ScenarioName,
  type SeededScenario,
  seedGradeScenario,
} from "./support/grade-scenarios.ts";

/**
 * Does the Grades tab read each seeded scenario as the seeder recorded it?
 * Each file seeds and retires its own learners. Tests share a read-only
 * competency scenario; the points journey seeds its own assignment.
 */

const PASSWORD = "password123";
const LEVEL_NAMES: Record<Rating, string> = {
  DEFICIENT: "Deficient",
  EMERGENT: "Emergent",
  COMPETENT: "Competent",
  EXPERT: "Expert",
  NOT_ASSESSED: "Not assessed",
};
const LEVELS: Level[] = ["DEFICIENT", "EMERGENT", "COMPETENT", "EXPERT"];
const EACH_PAPER = 40;
const FRESH_MS = 10_000;
const NEAR_B = "Cites the interview data but does not use it to argue why the design works.";
const NAMES_LABEL = /^(Anonymous|Grader names|Student names|Names shown)$/;

let seeded: SeededScenario;
let origin: string;

const seedings: Promise<SeededScenario>[] = [];

function seed(name: ScenarioName) {
  const seeding = seedGradeScenario(origin, name);
  seedings.push(seeding);
  return seeding;
}

test.beforeAll(async ({ browserName: _browserName }, testInfo) => {
  test.setTimeout(180_000);
  origin = String(testInfo.project.use.baseURL);
  seeded = await seed("small-mixed");
});

test.afterAll(async () => {
  test.setTimeout(180_000);
  const settled = await Promise.allSettled(seedings);
  await retireGradeScenarios(
    origin,
    settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
  );
});
let pointsSeeded: Promise<SeededScenario> | undefined;

function pointsScenario() {
  pointsSeeded ??= seed("points");
  return pointsSeeded;
}

// ---------------------------------------------------------------- expectations

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

function escaped(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toFinishOf(expected: ExpectedReadiness) {
  return expected.incomplete + expected.notStarted + expected.newAttempts;
}

function headlineOf(expected: ExpectedReadiness) {
  return `${expected.complete} of ${expected.counted - expected.excused} complete`;
}

function partsOf(expected: ExpectedReadiness): string[] {
  const drafts = expected.complete - expected.released;
  const toFinish = toFinishOf(expected);
  const parts: [number, string][] = [
    [expected.released, `${expected.released} released`],
    [drafts, `${drafts} ${plural(drafts, "complete draft", "complete drafts")}`],
    [toFinish, `${toFinish} to finish`],
    [expected.withoutFeedback, `${expected.withoutFeedback} without feedback`],
    [expected.withoutGrader, `${expected.withoutGrader} without a grader`],
  ];
  return parts.filter(([n]) => n > 0).map(([, said]) => said);
}

function barOf(expected: ExpectedReadiness) {
  return `${expected.released} released, ${expected.complete - expected.released} complete drafts, ${toFinishOf(expected)} to finish`;
}

function letters(scenario: SeededScenario = seeded): Map<string, string> {
  const ids = scenario.graders
    .filter((grader) => grader.delegated > 0)
    .map((grader) => grader.id)
    .sort();
  return new Map(ids.map((id, index) => [id, String.fromCharCode(65 + index)]));
}

function graderAt(letter: string, scenario: SeededScenario = seeded) {
  const id = [...letters(scenario)].find(([, own]) => own === letter)?.[0];
  const grader = scenario.graders.find((entry) => entry.id === id);
  if (!grader) throw new Error(`${scenario.scenario} has no grader ${letter}`);
  return grader;
}

function labelOf(grader: string | null, scenario: SeededScenario = seeded, viewer?: string) {
  const letter = grader === null ? undefined : letters(scenario).get(grader);
  if (!letter) return "Without a grader";
  return grader === viewer ? `Grader ${letter} (you)` : `Grader ${letter}`;
}

function chipOf(grader: string | null, scenario: SeededScenario = seeded, named = false) {
  const letter = grader === null ? undefined : letters(scenario).get(grader);
  if (!letter) return "–";
  if (!named) return letter;
  const name = scenario.graders.find((entry) => entry.id === grader)?.name ?? "";
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("");
}

function owners(scenario: SeededScenario = seeded): (string | null)[] {
  return [...letters(scenario).keys(), null];
}

function onCriteria(scenario: SeededScenario = seeded) {
  return scenario.learners.filter(
    (learner) =>
      learner.state === "released" ||
      learner.state === "complete" ||
      learner.state === "incomplete",
  );
}

function tallyOf(criterion: number, learners: readonly SeededLearner[] = onCriteria()) {
  const levels: Record<Level, number> = { DEFICIENT: 0, EMERGENT: 0, COMPETENT: 0, EXPERT: 0 };
  for (const learner of learners) {
    const mark = learner.marks[criterion];
    if (typeof mark === "string" && mark !== "NOT_ASSESSED") levels[mark] += 1;
  }
  const rated = LEVELS.reduce((sum, level) => sum + levels[level], 0);
  const competentOrAbove = levels.COMPETENT + levels.EXPERT;
  return { levels, rated, competentOrAbove, below: rated - competentOrAbove };
}

function barLabelOf(label: string, tally: ReturnType<typeof tallyOf>) {
  return `${label}: ${tally.below} below Competent, ${tally.competentOrAbove} Competent or above`;
}

function feedbackOf(learner: SeededLearner, criterion: number) {
  return (learner.criterionFeedback[criterion] ?? "").trim();
}

function byFeedbackThenName(feedback: (learner: SeededLearner) => string) {
  return (left: SeededLearner, right: SeededLearner) =>
    Number(feedback(left) !== "") - Number(feedback(right) !== "") ||
    left.name.localeCompare(right.name);
}

function pilesOf(
  criterion: number,
  rating: Rating,
  scenario: SeededScenario = seeded,
): { grader: string | null; learners: SeededLearner[] }[] {
  return owners(scenario).flatMap((grader) => {
    const learners = onCriteria(scenario)
      .filter((learner) => learner.grader === grader && learner.marks[criterion] === rating)
      .sort(byFeedbackThenName((learner) => feedbackOf(learner, criterion)));
    return learners.length === 0 ? [] : [{ grader, learners }];
  });
}

interface ColumnReading {
  scenario?: SeededScenario;
  students?: boolean;
  graders?: boolean;
  viewer?: string;
}

function columnOf(
  criterion: number,
  rating: Rating,
  { scenario = seeded, students = false, graders = false, viewer }: ColumnReading = {},
) {
  return pilesOf(criterion, rating, scenario).flatMap(({ grader, learners }) => {
    const name = scenario.graders.find((entry) => entry.id === grader)?.name;
    const said = graders && name ? name : labelOf(grader, scenario);
    const title = grader !== null && grader === viewer ? `${said} (you)` : said;
    return learners.map((learner) => ({
      chip: chipOf(grader, scenario, graders),
      title,
      text: `${students ? learner.name : ""}${feedbackOf(learner, criterion) || "No feedback"}`,
    }));
  });
}

function learnerAt(index: number) {
  const learner = seeded.learners[index];
  if (!learner) throw new Error(`small-mixed has no learner ${index}`);
  return learner;
}

function median(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

function mean(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreText(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

type Statistic = "median" | "mean";

function statisticOf(statistic: Statistic, scores: readonly number[]) {
  return statistic === "mean" ? mean(scores) : median(scores);
}

function statText(statistic: Statistic, scores: readonly number[]) {
  const value = statisticOf(statistic, scores);
  return statistic === "mean" ? scoreText(Number(value.toFixed(1))) : scoreText(value);
}

interface PointsLine {
  name: string;
  max: number;
  papers: { learner: SeededLearner; score: number }[];
}

function pointsLines(scenario: SeededScenario): PointsLine[] {
  const counted = onCriteria(scenario);
  const criteria = scenario.scenario === "large-points" ? LARGE_POINT_CRITERIA : POINT_CRITERIA;
  const questions = criteria.map(({ name, maxPoints }, index) => ({
    name,
    max: maxPoints,
    papers: counted.flatMap((learner) => {
      const mark = learner.marks[index];
      return typeof mark === "number" ? [{ learner, score: mark }] : [];
    }),
  }));
  const total = {
    name: "Total",
    max: criteria.reduce((sum, { maxPoints }) => sum + maxPoints, 0),
    papers: counted.flatMap((learner) =>
      learner.marks.length === criteria.length &&
      learner.marks.every((mark) => typeof mark === "number")
        ? [{ learner, score: (learner.marks as number[]).reduce((sum, mark) => sum + mark, 0) }]
        : [],
    ),
  };
  return [...questions, total];
}

function scoresOf(line: PointsLine, grader?: string | null) {
  return line.papers
    .filter((paper) => grader === undefined || paper.learner.grader === grader)
    .map((paper) => paper.score);
}

function pointsName(line: PointsLine) {
  return `${line.name} out of ${line.max}`;
}

// ---------------------------------------------------------------- the browser

async function signIn(context: BrowserContext, username: string) {
  const response = await context.request.post(`${origin}/api/auth/login`, {
    data: { username, password: PASSWORD },
  });
  expect(response.ok(), `log in as ${username}`).toBe(true);
  const cookie = response.headers()["set-cookie"]?.split(";")[0];
  if (!cookie) throw new Error(`No session cookie for ${username}`);
  return cookie;
}

async function openAs(page: Page, username = "mara") {
  const cookie = await signIn(page.context(), username);
  await page.route("**/api/**", async (route) => {
    const response = await route.fetch({
      maxRetries: 2,
      headers: { ...route.request().headers(), cookie },
    });
    await route.fulfill({ response });
  });
  return cookie;
}

function gradesPanel(page: Page) {
  return page.getByRole("tabpanel", { name: "Grades" });
}

function gradesTab(page: Page) {
  return page.getByRole("tab", { name: "Grades", exact: true });
}

async function openGrades(page: Page, query = "", scenario: SeededScenario = seeded) {
  await page.goto(`${origin}${scenario.path}${query}`);
  if (!query.includes("tab=grades")) await gradesTab(page).click();
  await expect(gradesTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(headline(page)).toBeVisible();
}

function headline(page: Page): Locator {
  return gradesPanel(page).getByRole("button", { name: /^\d+ of \d+ complete$/ });
}

function summary(page: Page): Locator {
  return headline(page).locator("xpath=../../..");
}

async function summaryOf(page: Page) {
  const parts = summary(page).locator(":scope > div").nth(2);
  return {
    headline: ((await headline(page).textContent()) ?? "").trim(),
    bar: await summary(page).getByRole("img").getAttribute("aria-label"),
    parts: (
      await parts.locator("button:not([aria-label]):not([aria-expanded])").allTextContents()
    ).map((text) => text.trim()),
  };
}

function expectedSummary(expected: ExpectedReadiness) {
  return { headline: headlineOf(expected), bar: barOf(expected), parts: partsOf(expected) };
}

async function openHint(scope: Locator, label: "To finish" | "Not counted" | "Not rated") {
  await scope.getByRole("button", { name: label, exact: true }).click();
  const hint = scope.page().getByRole("dialog", { name: label });
  await expect(hint).toBeVisible();
  return hint;
}

function linkOf(page: Page) {
  const params = new URL(page.url()).searchParams;
  return {
    by: params.get("by"),
    criterion: params.get("criterion"),
    grader: params.get("grader"),
    keys: [...params.keys()].sort(),
  };
}

async function expectLink(page: Page, expected: Partial<ReturnType<typeof linkOf>>) {
  await expect.poll(() => linkOf(page)).toMatchObject(expected);
}

function namesButton(page: Page) {
  return summary(page).getByRole("button", { name: NAMES_LABEL });
}

function namesPopover(page: Page) {
  return page.getByRole("dialog").filter({ has: page.getByRole("switch") });
}

async function setNames(page: Page, change: { graders?: boolean; students?: boolean }) {
  await namesButton(page).click();
  const popover = namesPopover(page);
  await expect(popover).toBeVisible();
  for (const [label, on] of [
    ["Graders", change.graders],
    ["Students", change.students],
  ] as const) {
    if (on === undefined) continue;
    const toggle = popover.getByRole("switch", { name: label, exact: true });
    if ((await toggle.getAttribute("aria-checked")) !== String(on)) await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", String(on));
  }
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
}

async function namesShown(page: Page, scenario: SeededScenario = seeded) {
  const text = (await gradesPanel(page).textContent()) ?? "";
  return {
    students: scenario.learners
      .map((learner) => learner.name)
      .filter((name) => text.includes(name)),
    graders: scenario.graders.map((grader) => grader.name).filter((name) => text.includes(name)),
  };
}

function gradersToggle(page: Page) {
  return gradesPanel(page).getByRole("button", { name: "Graders", exact: true });
}

async function showGraders(page: Page) {
  const toggle = gradersToggle(page);
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(graderTable(page)).toBeVisible();
}

function graderTable(page: Page) {
  return gradesPanel(page).getByRole("table");
}

function viewButton(page: Page, said: "Class" | "By grader") {
  return gradesPanel(page)
    .getByRole("group", { name: "Criteria view" })
    .getByRole("button", { name: said, exact: true });
}

function formButton(page: Page, said: "Bars" | "Dots") {
  return gradesPanel(page)
    .getByRole("group", { name: "Points view" })
    .getByRole("button", { name: said, exact: true });
}

function statisticButton(page: Page, said: "Median" | "Mean") {
  return gradesPanel(page)
    .getByRole("group", { name: "Statistic" })
    .getByRole("button", { name: said, exact: true });
}

function row(page: Page, name: string): Locator {
  return gradesPanel(page)
    .locator('li[id^="criterion-"]')
    .filter({ has: page.getByText(name, { exact: true }) });
}

function opener(page: Page, name: string) {
  return gradesPanel(page).getByRole("button", { name, exact: true });
}

async function openCriterion(page: Page, name: string) {
  const button = opener(page, name);
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
}

function classBar(page: Page, name: string) {
  return row(page, name).getByRole("group", {
    name: new RegExp(`^${escaped(name)}: \\d+ below Competent, \\d+ Competent or above$`),
  });
}

async function barLabels(page: Page, name: string): Promise<string[]> {
  return row(page, name)
    .getByRole("group")
    .evaluateAll((groups) => groups.map((group) => group.getAttribute("aria-label") ?? ""));
}

function column(scope: Locator, rating: Rating): Locator {
  return scope.getByRole("region", { name: LEVEL_NAMES[rating], exact: true });
}

function columnHeading(scope: Locator, rating: Rating) {
  return scope.getByRole("heading", { name: new RegExp(`^${LEVEL_NAMES[rating]} \\d+$`) });
}

async function columnCount(scope: Locator, rating: Rating): Promise<number> {
  const heading = (await columnHeading(scope, rating).textContent()) ?? "";
  return Number(heading.match(/(\d+)\s*$/)?.[1] ?? Number.NaN);
}

async function papersIn(scope: Locator) {
  return scope.locator("li > button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const [chip, body] = [...button.children];
      return {
        chip: chip?.textContent?.trim() ?? "",
        title: chip?.getAttribute("title") ?? "",
        text: body?.textContent?.trim() ?? "",
      };
    }),
  );
}

interface GridRow {
  grader: string;
  label: string;
  expanded: string | null;
  cells: { papers: string[]; squares: number; count: string | null }[];
}

async function gridOf(scope: Locator): Promise<{ heads: string[]; rows: GridRow[] }> {
  return scope.locator('div.grid:has(> [id*="-column-"])').evaluate((grid) => {
    const cells = [...grid.children];
    const width = cells.filter((cell) => cell.id.includes("-column-")).length;
    const heads = cells.slice(1, 1 + width).map((cell) =>
      [...(cell.querySelector("h3")?.childNodes ?? [])]
        .map((node) => (node.textContent ?? "").trim())
        .filter((text) => text !== "")
        .join(" "),
    );
    const rows: GridRow[] = [];
    for (let at = 1 + width; at < cells.length; at += 1 + width) {
      const name = cells[at];
      if (!name) break;
      rows.push({
        grader: name.getAttribute("data-grader") ?? "",
        label: (name.textContent ?? "").trim(),
        expanded: name.querySelector("button")?.getAttribute("aria-expanded") ?? null,
        cells: cells.slice(at + 1, at + 1 + width).map((cell) => {
          const buttons = [...cell.querySelectorAll("button")];
          const squares = buttons.filter((button) => button.hasAttribute("aria-label"));
          return {
            papers: buttons
              .filter((button) => !button.hasAttribute("aria-label"))
              .map((button) => (button.textContent ?? "").trim()),
            squares: squares.length,
            count: squares.length > 0 ? (cell.textContent ?? "").trim() : null,
          };
        }),
      });
    }
    return { heads, rows };
  });
}

function rowStatistic(page: Page, name: string) {
  return row(page, name).locator(":scope > div").first().locator("span[tabindex='0']");
}

function rowChart(page: Page, name: string) {
  return row(page, name).locator(":scope > div").first();
}

function leftOf(style: string | null) {
  return Number.parseFloat(style?.match(/left:\s*([\d.]+)%/)?.[1] ?? "NaN");
}

async function caretAt(chart: Locator) {
  return leftOf(await chart.locator("span.border-x-transparent").getAttribute("style"));
}

function paperDialog(page: Page) {
  return page.getByRole("dialog");
}

async function later(page: Page, ms: number) {
  const now = await page.evaluate<number>("Date.now()");
  await page.clock.setSystemTime(now + ms);
}

async function refocus(page: Page) {
  await page.evaluate("window.dispatchEvent(new Event('focus'))");
}

test("competency readiness and level bars open the expected learner scopes", async ({ page }) => {
  await test.step("Read readiness and its hints", async () => {
    await openAs(page);
    await openGrades(page);
    await expect(page).toHaveURL(/[?&]tab=grades(&|$)/);
    expect(await summaryOf(page)).toEqual(expectedSummary(seeded.expected));
    expect(partsOf(seeded.expected)).toHaveLength(5);
    await expect(gradersToggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(graderTable(page)).toHaveCount(0);

    const toFinish = await openHint(summary(page), "To finish");
    const { incomplete, notStarted, newAttempts, excused, dropped } = seeded.expected;
    expect([incomplete, notStarted, newAttempts, excused, dropped].every((n) => n > 0)).toBe(true);
    expect(
      (await toFinish.getByRole("button").allTextContents()).map((text) => text.trim()),
    ).toEqual([
      `${incomplete} incomplete`,
      `${notStarted} not started`,
      `${newAttempts} new ${plural(newAttempts, "attempt", "attempts")}`,
    ]);
    await page.keyboard.press("Escape");
    await expect(toFinish).toHaveCount(0);

    const apart = await openHint(summary(page), "Not counted");
    expect((await apart.getByRole("button").allTextContents()).map((text) => text.trim())).toEqual([
      `${excused} excused`,
      `${dropped} dropped`,
    ]);
  });
  await page.keyboard.press("Escape");
  await test.step("Open class and grader level segments", async () => {
    const model = row(page, MODEL.name);
    const emergent = tallyOf(0).levels.EMERGENT;
    await classBar(page, MODEL.name)
      .getByRole("button", { name: `${emergent} Emergent`, exact: true })
      .first()
      .click();
    await expect(opener(page, MODEL.name)).toHaveAttribute("aria-expanded", "true");
    await expect(opener(page, EVIDENCE.name)).toHaveAttribute("aria-expanded", "false");
    await expectLink(page, { grader: null, by: null });
    expect(linkOf(page).criterion).toMatch(/^competency:/);
    await expect(column(model, "EMERGENT")).toBeInViewport();
    expect(await columnCount(model, "EMERGENT")).toBe(emergent);

    await viewButton(page, "By grader").click();
    const b = graderAt("B");
    const evidence = row(page, EVIDENCE.name);
    const own = tallyOf(
      1,
      onCriteria().filter((learner) => learner.grader === b.id),
    );
    expect(own.levels.COMPETENT).toBeGreaterThan(0);
    await evidence
      .getByRole("group", { name: barLabelOf("Grader B", own), exact: true })
      .getByRole("button", { name: `${own.levels.COMPETENT} Competent`, exact: true })
      .first()
      .click();
    await expect(opener(page, EVIDENCE.name)).toHaveAttribute("aria-expanded", "true");
    await expect(opener(page, MODEL.name)).toHaveAttribute("aria-expanded", "false");
    await expectLink(page, { by: "grader", grader: b.id });
    expect(linkOf(page).criterion).toMatch(/^competency:/);
    await expect(columnHeading(evidence, "COMPETENT")).toBeInViewport();
  });
});

test("names stay private until enabled, and a paper opens its submission with working Back navigation", async ({
  page,
}) => {
  await test.step("Toggle names across the class and grader views", async () => {
    await openAs(page);
    await openGrades(page);
    await showGraders(page);
    await openCriterion(page, EVIDENCE.name);
    await expect(column(row(page, EVIDENCE.name), "EMERGENT")).toBeVisible();
    expect(await namesShown(page)).toEqual({ students: [], graders: [] });
    await viewButton(page, "By grader").click();
    expect(await namesShown(page)).toEqual({ students: [], graders: [] });
    expect(seeded.graders.some((grader) => grader.username === "mara")).toBe(false);
    await expect(gradesPanel(page).getByText(/\(you\)/)).toHaveCount(0);

    const learner = learnerAt(2);
    const evidence = row(page, EVIDENCE.name);
    await setNames(page, { students: true });
    await expect(evidence.getByText(learner.name, { exact: true })).toBeVisible();
    expect((await namesShown(page)).graders).toEqual([]);
    expect((await namesShown(page)).students.sort()).toEqual(
      onCriteria()
        .filter((entry) => typeof entry.marks[1] === "string")
        .map((entry) => entry.name)
        .sort(),
    );

    await setNames(page, { graders: true });
    const owner = seeded.graders.find((grader) => grader.id === learner.grader);
    if (!owner) throw new Error("learner 2 has no seeded grader");
    expect((await gridOf(evidence)).rows.map((line) => line.label)).toContain(owner.name);
    expect(
      (await barLabels(page, EVIDENCE.name)).some((label) => label.startsWith(`${owner.name}:`)),
    ).toBe(true);
    await expect(
      graderTable(page).getByRole("cell", { name: owner.name, exact: true }),
    ).toBeVisible();
    expect((await namesShown(page)).graders.sort()).toEqual(
      seeded.graders.map((grader) => grader.name).sort(),
    );

    await viewButton(page, "Class").click();
    expect(await papersIn(column(evidence, "EMERGENT"))).toEqual(
      columnOf(1, "EMERGENT", { students: true, graders: true }),
    );
  });
  await setNames(page, { graders: false, students: false });
  await test.step("Read a paper and open its attempt", async () => {
    await openGrades(page);
    const closedUrl = page.url();
    await opener(page, EVIDENCE.name).click();
    await expect(page).toHaveURL(/[?&]criterion=[^&]+/);
    const openUrl = page.url();

    const learner = learnerAt(2);
    expect(learner.submission).toBeTruthy();
    const paper = column(row(page, EVIDENCE.name), "EMERGENT").getByRole("button", {
      name: new RegExp(NEAR_B.slice(0, 40)),
    });
    await paper.click();
    const dialog = paperDialog(page);
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(openUrl);
    await expect(dialog.locator('[data-slot="dialog-title"]')).toHaveText("Paper");
    await expect(dialog.locator('[data-slot="dialog-header"]')).toContainText("attempt 1");
    const ratings = dialog.locator("dl");
    await expect(ratings).toContainText(MODEL.name);
    await expect(ratings).toContainText(EVIDENCE.name);
    await expect(ratings).toContainText(NEAR_B);
    await expect(ratings).toContainText("Emergent");
    await expect(ratings).toContainText("Competent");
    const content = learner.content ?? "";
    await expect(dialog).toContainText(content.slice(content.indexOf(": ") + 2));

    await dialog.getByRole("button", { name: "Open in Submissions", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(
      new RegExp(`[?&]tab=submissions[^#]*#attempt-${learner.submission}$`),
    );
    await expect(page.getByRole("tab", { name: "Submissions", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const attempt = page.locator(`[id="attempt-${learner.submission}"]`);
    await expect(attempt).toHaveAttribute("open", "");
    await expect(attempt).toBeInViewport();

    await page.goBack();
    await expect(page).toHaveURL(openUrl);
    await expect(gradesTab(page)).toHaveAttribute("aria-selected", "true");
    await expect(paperDialog(page)).toHaveCount(0);
    await expect(opener(page, EVIDENCE.name)).toHaveAttribute("aria-expanded", "true");
    await expect(opener(page, MODEL.name)).toBeVisible();
    await expect(column(row(page, EVIDENCE.name), "EMERGENT")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(closedUrl);
    await expect(opener(page, EVIDENCE.name)).toHaveAttribute("aria-expanded", "false");
    await expect(column(row(page, EVIDENCE.name), "EMERGENT")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------- points

test("points rows show each question's scores with a caret at the median, and Mean reads to one decimal and is remembered", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const points = await pointsScenario();
  const lines = pointsLines(points);
  await openAs(page);
  await openGrades(page, "", points);
  await formButton(page, "Dots").click();
  await expect(statisticButton(page, "Median")).toHaveAttribute("aria-pressed", "true");
  await expect(statisticButton(page, "Mean")).toHaveAttribute("aria-pressed", "false");
  await expect(gradesPanel(page).getByRole("list", { name: "Rating levels" })).toHaveCount(0);

  for (const line of lines) {
    const scores = scoresOf(line);
    const chart = rowChart(page, pointsName(line));
    await expect(rowStatistic(page, pointsName(line))).toHaveText(
      `median ${statText("median", scores)}`,
    );
    expect(scores.length).toBeLessThanOrEqual(EACH_PAPER);
    await expect(chart.locator("span.rounded-full")).toHaveCount(scores.length);
    expect(await caretAt(chart)).toBeCloseTo((median(scores) / line.max) * 100, 3);
  }
  const unscored = onCriteria(points).filter((learner) => learner.marks[2] === null).length;
  expect(unscored).toBeGreaterThan(0);
  const [, , q2, total] = lines as [PointsLine, PointsLine, PointsLine, PointsLine];
  await expect(rowChart(page, pointsName(q2))).toContainText(`${unscored} not scored`);
  await expect(rowChart(page, pointsName(total))).toContainText(`${unscored} without a total`);

  await statisticButton(page, "Mean").click();
  await expect(statisticButton(page, "Mean")).toHaveAttribute("aria-pressed", "true");
  const means = lines.map((line) => `mean ${statText("mean", scoresOf(line))}`);
  expect(
    lines.some((line) => statText("mean", scoresOf(line)) !== String(mean(scoresOf(line)))),
  ).toBe(true);
  for (const [index, line] of lines.entries()) {
    await expect(rowStatistic(page, pointsName(line))).toHaveText(means[index] ?? "");
    expect(await caretAt(rowChart(page, pointsName(line)))).toBeCloseTo(
      (mean(scoresOf(line)) / line.max) * 100,
      3,
    );
  }
  expect(linkOf(page).keys).toEqual(["tab"]);

  await page.reload();
  await expect(headline(page)).toBeVisible();
  await expect(statisticButton(page, "Mean")).toHaveAttribute("aria-pressed", "true");
  for (const [index, line] of lines.entries())
    await expect(rowStatistic(page, pointsName(line))).toHaveText(means[index] ?? "");
  await statisticButton(page, "Median").click();
  await page.reload();
  await expect(headline(page)).toBeVisible();
  await expect(statisticButton(page, "Median")).toHaveAttribute("aria-pressed", "true");
  await expect(rowStatistic(page, pointsName(lines[0] as PointsLine))).toHaveText(
    `median ${statText("median", scoresOf(lines[0] as PointsLine))}`,
  );
});

test("a failed refetch says so, keeps the last view, and Retry clears it", async ({ page }) => {
  await page.clock.install();
  await openAs(page);
  await openGrades(page);
  await openCriterion(page, EVIDENCE.name);
  await expect(page).toHaveURL(/[?&]criterion=[^&]+/);
  const openUrl = page.url();
  const evidence = row(page, EVIDENCE.name);
  const counts = async () =>
    Object.fromEntries(
      await Promise.all(
        LEVELS.map(async (level) => [level, await columnCount(evidence, level)] as const),
      ),
    );
  const before = await counts();
  expect(before).toEqual(tallyOf(1).levels);
  const shown = await summaryOf(page);
  expect(shown).toEqual(expectedSummary(seeded.expected));

  let aborted = 0;
  await page.route(
    "**/api/grades/for-item",
    async (route) => {
      aborted += 1;
      await route.abort("connectionfailed");
    },
    { times: 1 },
  );
  await later(page, FRESH_MS + 1_000);
  await refocus(page);
  const notice = gradesPanel(page).getByRole("status").filter({
    hasText: "Grades could not be refreshed.",
  });
  await expect(notice).toBeVisible();
  expect(aborted).toBe(1);
  await expect(page).toHaveURL(openUrl);
  expect(await counts()).toEqual(before);
  expect(await summaryOf(page)).toEqual(shown);
  await expect(
    column(evidence, "EMERGENT").getByRole("button", { name: new RegExp(NEAR_B.slice(0, 40)) }),
  ).toBeVisible();

  await notice.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(gradesPanel(page).getByText("Grades could not be refreshed.")).toHaveCount(0);
  expect(await counts()).toEqual(before);
  expect(await summaryOf(page)).toEqual(shown);
  await expect(page).toHaveURL(openUrl);
});
