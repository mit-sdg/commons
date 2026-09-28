import {
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import { test } from "./support/browser.ts";
import {
  EVIDENCE,
  EVIDENCE_REVISED,
  type ExpectedReadiness,
  expectedOf,
  type Level,
  MODEL,
  POINT_CRITERIA,
  type Rating,
  SEPARATION,
  type SeededLearner,
  type SeededScenario,
  seedGradeScenario,
} from "./support/grade-scenarios.ts";

/**
 * Does the Grades tab read each seeded scenario as the seeder recorded it?
 * Checks share `small-mixed` and seed any other scenario they use; the last
 * check changes a rating on `small-mixed`, so it stays last.
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

test.beforeAll(async ({ browserName: _browserName }, testInfo) => {
  test.setTimeout(180_000);
  origin = String(testInfo.project.use.baseURL);
  seeded = await seedGradeScenario(origin, "small-mixed");
});

let largeSeeded: Promise<SeededScenario> | undefined;
let pointsSeeded: Promise<SeededScenario> | undefined;
let largePointsSeeded: Promise<SeededScenario> | undefined;

function largeScenario() {
  largeSeeded ??= seedGradeScenario(origin, "large");
  return largeSeeded;
}

function pointsScenario() {
  pointsSeeded ??= seedGradeScenario(origin, "points");
  return pointsSeeded;
}

function largePointsScenario() {
  largePointsSeeded ??= seedGradeScenario(origin, "large-points");
  return largePointsSeeded;
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

function unratedOf(criterion: number, scenario: SeededScenario = seeded) {
  return onCriteria(scenario).filter((learner) => learner.marks[criterion] === null).length;
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

function holders(criterion: number, scenario: SeededScenario = seeded) {
  return owners(scenario).filter((grader) =>
    onCriteria(scenario).some(
      (learner) => learner.grader === grader && typeof learner.marks[criterion] === "string",
    ),
  );
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
  const questions = POINT_CRITERIA.map(({ name, maxPoints }, index) => ({
    name,
    max: maxPoints,
    papers: counted.flatMap((learner) => {
      const mark = learner.marks[index];
      return typeof mark === "number" ? [{ learner, score: mark }] : [];
    }),
  }));
  const total = {
    name: "Total",
    max: POINT_CRITERIA.reduce((sum, { maxPoints }) => sum + maxPoints, 0),
    papers: counted.flatMap((learner) =>
      learner.marks.length === POINT_CRITERIA.length &&
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

interface SetupRow {
  label: string;
  name: string;
  kind: "COMPETENCY" | "POINTS" | "TOTAL";
  max: number | null;
  criterion: number;
  first: number;
  learners: SeededLearner[];
}

function setupRows(scenario: SeededScenario): SetupRow[] {
  const built = new Map<string, SetupRow>();
  const totals = new Map<number, SetupRow>();
  for (const learner of onCriteria(scenario)) {
    const graded = learner.graded;
    if (!graded) continue;
    graded.criteria.forEach((criterion, index) => {
      const kind = criterion.basis === null ? "POINTS" : "COMPETENCY";
      const key = criterion.basis ?? `${criterion.name}:${criterion.maxPoints}`;
      const entry = built.get(key) ?? {
        label: "",
        name: criterion.name,
        kind,
        max: criterion.maxPoints,
        criterion: index,
        first: graded.revision,
        learners: [],
      };
      entry.first = Math.min(entry.first, graded.revision);
      entry.learners.push(learner);
      built.set(key, entry);
    });
    if (graded.criteria.every((criterion) => criterion.maxPoints !== null)) {
      const outOf = graded.criteria.reduce((sum, criterion) => sum + (criterion.maxPoints ?? 0), 0);
      const total = totals.get(outOf) ?? {
        label: `Total out of ${outOf}`,
        name: "Total",
        kind: "TOTAL",
        max: outOf,
        criterion: -1,
        first: graded.revision,
        learners: [],
      };
      total.learners.push(learner);
      totals.set(outOf, total);
    }
  }
  const rows = [...built.values()];
  const methodFirst = (kind: SetupRow["kind"]) =>
    Math.min(...rows.filter((row) => row.kind === kind).map((row) => row.first));
  rows.sort(
    (left, right) =>
      methodFirst(left.kind) - methodFirst(right.kind) ||
      left.criterion - right.criterion ||
      left.first - right.first,
  );
  for (const row of rows) {
    const editions = rows
      .filter((other) => other.kind === "COMPETENCY" && other.name === row.name)
      .sort((left, right) => left.first - right.first);
    row.label =
      row.kind === "POINTS"
        ? `${row.name} out of ${row.max}`
        : editions.length > 1
          ? `${row.name}, edition ${editions.indexOf(row) + 1}`
          : row.name;
  }
  return [
    ...rows,
    ...[...totals.values()].sort((left, right) => (left.max ?? 0) - (right.max ?? 0)),
  ];
}

function headingsOf(rows: readonly SetupRow[]) {
  const twoMethods =
    rows.some((row) => row.kind === "COMPETENCY") && rows.some((row) => row.kind !== "COMPETENCY");
  return rows.flatMap((row, index) => {
    const previous = rows[index - 1];
    const starts = !previous || (previous.kind === "COMPETENCY") !== (row.kind === "COMPETENCY");
    if (!twoMethods || !starts) return [];
    return [row.kind === "COMPETENCY" ? "Rated by level" : "Scored in points"];
  });
}

function axesOfRows(rows: readonly SetupRow[]) {
  let last: number | null = null;
  return rows.flatMap((row) => {
    if (row.kind === "COMPETENCY") return [];
    const starts = row.max !== last;
    last = row.max;
    return starts ? [String(row.max)] : [];
  });
}

function scoresIn(row: SetupRow): number[] {
  return row.learners.flatMap((learner) => {
    if (row.kind === "TOTAL")
      return learner.marks.every((mark) => typeof mark === "number")
        ? [(learner.marks as number[]).reduce((sum, mark) => sum + mark, 0)]
        : [];
    const mark = learner.marks[row.criterion];
    return typeof mark === "number" ? [mark] : [];
  });
}

function unratedIn(row: SetupRow) {
  return row.learners.filter((learner) =>
    row.kind === "TOTAL"
      ? learner.marks.some((mark) => mark === null)
      : learner.marks[row.criterion] === null,
  ).length;
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

async function call<T>(context: BrowserContext, cookie: string, path: string, data: unknown) {
  const response = await context.request.post(`${origin}/api${path}`, {
    headers: { Cookie: cookie },
    data,
  });
  const result = await response.json();
  expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBe(true);
  expect(result, path).not.toHaveProperty("error");
  return result as T;
}

function gradesPanel(page: Page) {
  return page.getByRole("tabpanel", { name: "Grades" });
}

function submissionsPanel(page: Page) {
  return page.getByRole("tabpanel", { name: "Submissions" });
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

async function switchesOf(page: Page) {
  await namesButton(page).click();
  const popover = namesPopover(page);
  const state = async (label: string) =>
    popover.getByRole("switch", { name: label, exact: true }).getAttribute("aria-checked");
  const read = { graders: await state("Graders"), students: await state("Students") };
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  return read;
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

async function tableRows(page: Page): Promise<string[][]> {
  const rows = graderTable(page).locator("tbody tr");
  const read: string[][] = [];
  for (let index = 0; index < (await rows.count()); index += 1)
    read.push(
      (await rows.nth(index).locator("td").allTextContents()).map((text) =>
        text.replace(/\s+/g, " ").trim(),
      ),
    );
  return read;
}

function tableRowOf(label: string, expected: ExpectedReadiness): string[] {
  const toFinish = toFinishOf(expected);
  return [
    label,
    `${expected.complete} of ${expected.counted - expected.excused}`,
    toFinish > 0 ? String(toFinish) : "",
    expected.withoutFeedback > 0 ? String(expected.withoutFeedback) : "",
  ];
}

function expectedTable(scenario: SeededScenario = seeded, viewer?: string): string[][] {
  return owners(scenario).flatMap((grader) => {
    const own = expectedOf(scenario.learners.filter((learner) => learner.grader === grader));
    return own.counted === 0 ? [] : [tableRowOf(labelOf(grader, scenario, viewer), own)];
  });
}

function viewButton(page: Page, said: "Class" | "By grader") {
  return gradesPanel(page)
    .getByRole("group", { name: "Criteria view" })
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

async function barGeometry(bar: Locator) {
  return bar.evaluate((group) => {
    const [line, below, above] = [...group.querySelectorAll(":scope > span")];
    const box = (element: {
      getBoundingClientRect(): { left: number; right: number; width: number };
    }) => element.getBoundingClientRect();
    return {
      line: line ? box(line).left + box(line).width / 2 : Number.NaN,
      segments: [...group.querySelectorAll(":scope > button")].map((segment) => ({
        level: (segment.getAttribute("aria-label") ?? "").replace(/^\d+ /, ""),
        left: box(segment).left,
        right: box(segment).right,
      })),
      below: { text: below?.textContent ?? "", right: below ? box(below).right : Number.NaN },
      above: { text: above?.textContent ?? "", left: above ? box(above).left : Number.NaN },
    };
  });
}

function notRated(page: Page, name: string) {
  return row(page, name).getByText(/^\d+ not rated$/);
}

async function rowFacts(page: Page, name: string) {
  const bar = await classBar(page, name).getAttribute("aria-label");
  const unrated = (await notRated(page, name).allTextContents()).map((text) => text.trim());
  return [bar, ...unrated];
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

function gridPapersOf(
  criterion: number,
  rating: Rating,
  grader: string | null,
  scenario: SeededScenario = seeded,
  students = false,
) {
  return (
    pilesOf(criterion, rating, scenario)
      .find((pile) => pile.grader === grader)
      ?.learners.map(
        (learner) =>
          `${students ? learner.name : ""}${feedbackOf(learner, criterion) || "No feedback"}`,
      ) ?? []
  );
}

function rowStatistic(page: Page, name: string) {
  return row(page, name).locator(":scope > div").first().locator("span[tabindex='0']");
}

function rowChart(page: Page, name: string) {
  return row(page, name).locator(":scope > div").first();
}

function card(page: Page) {
  return gradesPanel(page).getByRole("tooltip");
}

async function pointAt(page: Page, target: Locator) {
  await expect(async () => {
    await page.mouse.move(0, 0);
    await target.hover();
    await expect(card(page)).toBeVisible({ timeout: 1_000 });
  }).toPass();
  return card(page);
}

async function statisticsOf(page: Page) {
  await expect(card(page)).toBeVisible();
  const terms = await card(page).locator("dt").allTextContents();
  const values = await card(page).locator("dd").allTextContents();
  return terms.map((term, index) => [term.trim(), (values[index] ?? "").trim()]);
}

function expectedStatistics(scores: readonly number[], max: number) {
  const full = scores.filter((value) => value === max).length;
  const zero = scores.filter((value) => value === 0).length;
  return [
    ["Median", statText("median", scores)],
    ["Mean", statText("mean", scores)],
    ["Lowest to highest", `${scoreText(Math.min(...scores))} to ${scoreText(Math.max(...scores))}`],
    ...(full > 0 ? [["Full marks", String(full)]] : []),
    ...(zero > 0 ? [["Zero", String(zero)]] : []),
    ["Scored", String(scores.length)],
  ];
}

function leftOf(style: string | null) {
  return Number.parseFloat(style?.match(/left:\s*([\d.]+)%/)?.[1] ?? "NaN");
}

async function caretAt(chart: Locator) {
  return leftOf(await chart.locator("span.border-x-transparent").getAttribute("style"));
}

function learnerRow(page: Page, name: string): Locator {
  return submissionsPanel(page).locator("p.font-medium", {
    hasText: new RegExp(`^${name}(dropped)?$`, "i"),
  });
}

function learnerCard(page: Page, name: string): Locator {
  return learnerRow(page, name).locator(
    "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' rounded-lg ')][1]",
  );
}

async function expectOpened(page: Page, said: string, shown: readonly SeededLearner[]) {
  await expect(page.getByRole("tab", { name: "Submissions", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page).toHaveURL(/[?&]tab=submissions(&|$)/);
  const panel = submissionsPanel(page);
  await expect(panel.getByText(`${said} from Grades`, { exact: true })).toBeVisible();
  await expect(
    panel.getByText(`${shown.length} of ${seeded.learners.length} learners shown`, {
      exact: true,
    }),
  ).toBeVisible();
  for (const learner of seeded.learners) {
    if (shown.includes(learner))
      await expect(learnerRow(page, learner.name), `${said}: ${learner.name}`).toBeVisible();
    else await expect(learnerRow(page, learner.name), `${said}: ${learner.name}`).toBeHidden();
  }
}

async function backToGrades(page: Page) {
  await gradesTab(page).click();
  await expect(gradesTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(headline(page)).toBeVisible();
}

function paperDialog(page: Page) {
  return page.getByRole("dialog");
}

async function dialogNames(page: Page, scenario: SeededScenario = seeded) {
  const dialog = paperDialog(page);
  const text = [
    (await dialog.locator('[data-slot="dialog-header"]').textContent()) ?? "",
    (await dialog.locator("dl").textContent()) ?? "",
  ].join("\n");
  return {
    students: scenario.learners
      .map((learner) => learner.name)
      .filter((name) => text.includes(name)),
    graders: scenario.graders.map((grader) => grader.name).filter((name) => text.includes(name)),
  };
}

async function freshPage(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

function countReads(page: Page) {
  let reads = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/grades/for-item") reads += 1;
  });
  return () => reads;
}

async function later(page: Page, ms: number) {
  const now = await page.evaluate<number>("Date.now()");
  await page.clock.setSystemTime(now + ms);
}

async function refocus(page: Page) {
  await page.evaluate("window.dispatchEvent(new Event('focus'))");
}

async function reveal(page: Page) {
  await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");
}

async function rowNames(page: Page) {
  return (
    await gradesPanel(page).locator('li[id^="criterion-"] > div > :first-child').allTextContents()
  ).map((text) => text.trim());
}

async function axisMaxima(page: Page) {
  return gradesPanel(page)
    .locator('li[aria-hidden="true"] div[aria-hidden="true"]')
    .evaluateAll((axes) => axes.map((axis) => axis.lastElementChild?.textContent?.trim() ?? ""));
}

async function expectCompetencyRow(page: Page, row: SetupRow) {
  const tally = tallyOf(row.criterion, row.learners);
  const scope = gradesPanel(page).locator("li", {
    has: page.getByRole("button", { name: row.label, exact: true }),
  });
  await expect(scope.getByRole("group").first()).toHaveAttribute(
    "aria-label",
    barLabelOf(row.name, tally),
  );
  const unrated = unratedIn(row);
  if (unrated > 0) await expect(notRated(page, row.label)).toHaveText(`${unrated} not rated`);
  else await expect(notRated(page, row.label)).toHaveCount(0);
  await openCriterion(page, row.label);
  for (const level of LEVELS) {
    expect(await columnCount(scope, level), `${row.label}, ${level}`).toBe(tally.levels[level]);
    await expect(column(scope, level).getByRole("listitem")).toHaveCount(tally.levels[level]);
  }
}

async function expectPointsRow(page: Page, row: SetupRow) {
  const scores = scoresIn(row);
  expect(scores.length).toBeLessThanOrEqual(EACH_PAPER);
  await expect(rowChart(page, row.label).locator("span.rounded-full")).toHaveCount(scores.length);
  await expect(rowStatistic(page, row.label)).toHaveText(`median ${statText("median", scores)}`);
  const unrated = unratedIn(row);
  const said = row.kind === "TOTAL" ? "without a total" : "not scored";
  if (unrated > 0) await expect(rowChart(page, row.label)).toContainText(`${unrated} ${said}`);
  else await expect(rowChart(page, row.label)).not.toContainText(said);
}

// ---------------------------------------------------------------- the summary

test("the summary reads the expected headline, bar, and parts, and its hints list the rest", async ({
  page,
}) => {
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
  expect((await toFinish.getByRole("button").allTextContents()).map((text) => text.trim())).toEqual(
    [
      `${incomplete} incomplete`,
      `${notStarted} not started`,
      `${newAttempts} new ${plural(newAttempts, "attempt", "attempts")}`,
    ],
  );
  await page.keyboard.press("Escape");
  await expect(toFinish).toHaveCount(0);

  const apart = await openHint(summary(page), "Not counted");
  expect((await apart.getByRole("button").allTextContents()).map((text) => text.trim())).toEqual([
    `${excused} excused`,
    `${dropped} dropped`,
  ]);
});

test("every summary part and hint entry opens its learners in Submissions under its words", async ({
  page,
}) => {
  await openAs(page);
  await openGrades(page);
  const expected = seeded.expected;
  const who = (keep: (learner: SeededLearner) => boolean) =>
    seeded.learners.filter((learner) => learner.state !== "dropped" && keep(learner));
  const complete = who((learner) => learner.state === "released" || learner.state === "complete");
  const drafts = who((learner) => learner.state === "complete");
  const entries: [string, SeededLearner[], ("To finish" | "Not counted")?][] = [
    [headlineOf(expected), complete],
    [`${expected.released} released`, who((learner) => learner.state === "released")],
    [`${drafts.length} ${plural(drafts.length, "complete draft", "complete drafts")}`, drafts],
    [
      `${toFinishOf(expected)} to finish`,
      who((learner) => ["incomplete", "not-started", "new-attempt"].includes(learner.state)),
    ],
    [`${expected.withoutFeedback} without feedback`, who((learner) => learner.withoutFeedback)],
    [
      `${expected.withoutGrader} without a grader`,
      who((learner) => learner.grader === null && learner.state !== "excused"),
    ],
    [
      `${expected.incomplete} incomplete`,
      who((learner) => learner.state === "incomplete"),
      "To finish",
    ],
    [
      `${expected.notStarted} not started`,
      who((learner) => learner.state === "not-started"),
      "To finish",
    ],
    [
      `${expected.newAttempts} new ${plural(expected.newAttempts, "attempt", "attempts")}`,
      who((learner) => learner.state === "new-attempt"),
      "To finish",
    ],
    [`${expected.excused} excused`, who((learner) => learner.state === "excused"), "Not counted"],
    [
      `${expected.dropped} dropped`,
      seeded.learners.filter((learner) => learner.state === "dropped"),
      "Not counted",
    ],
  ];
  for (const [said, learners, hint] of entries) {
    expect(learners.length, said).toBe(Number(said.match(/^\d+/)?.[0]));
    const scope = hint ? await openHint(summary(page), hint) : summary(page);
    await scope.getByRole("button", { name: said, exact: true }).click();
    await expectOpened(page, said, learners);
    await backToGrades(page);
  }

  const dropped = seeded.learners.filter((learner) => learner.state === "dropped");
  expect(dropped).toHaveLength(1);
  await (
    await openHint(summary(page), "Not counted")
  )
    .getByRole("button", { name: "1 dropped", exact: true })
    .click();
  await expect(learnerCard(page, dropped[0]?.name ?? "")).toBeVisible();
  await expect(learnerRow(page, dropped[0]?.name ?? "").getByText(/^dropped$/i)).toBeVisible();
  const panel = submissionsPanel(page);
  await panel.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(panel.getByText(/from Grades$/)).toHaveCount(0);
  await expect(
    panel.getByText(`${seeded.learners.length} of ${seeded.learners.length} learners shown`, {
      exact: true,
    }),
  ).toBeVisible();
  for (const learner of seeded.learners) await expect(learnerRow(page, learner.name)).toBeVisible();
  await expect(panel.locator("p.font-medium").getByText(/^dropped$/i)).toHaveCount(1);
});

// ---------------------------------------------------------------- level bars

test("every level bar hangs off one Emergent|Competent line, with the count below at its left end and the count at or above at its right end", async ({
  page,
}) => {
  await openAs(page);
  await openGrades(page);
  await expect(gradesPanel(page).getByRole("group", { name: "Statistic" })).toHaveCount(0);
  await expect(viewButton(page, "Class")).toHaveAttribute("aria-pressed", "true");

  for (const [index, text] of [MODEL, EVIDENCE].entries()) {
    const tally = tallyOf(index);
    const bar = classBar(page, text.name);
    await expect(bar).toHaveAttribute("aria-label", barLabelOf(text.name, tally));
    const held = LEVELS.filter((level) => tally.levels[level] > 0);
    await expect(bar.getByRole("button")).toHaveCount(held.length);
    for (const level of held)
      await expect(
        bar.getByRole("button", {
          name: `${tally.levels[level]} ${LEVEL_NAMES[level]}`,
          exact: true,
        }),
      ).toHaveCount(1);

    const geometry = await barGeometry(bar);
    expect(geometry.below.text).toBe(String(tally.below));
    expect(geometry.above.text).toBe(String(tally.competentOrAbove));
    for (const segment of geometry.segments) {
      const where = `${text.name}, ${segment.level}`;
      if (segment.level === "Competent" || segment.level === "Expert")
        expect(segment.left, where).toBeGreaterThanOrEqual(geometry.line);
      else expect(segment.right, where).toBeLessThanOrEqual(geometry.line);
    }
    expect(geometry.below.right).toBeLessThanOrEqual(
      Math.min(...geometry.segments.map((segment) => segment.left)),
    );
    expect(geometry.above.left).toBeGreaterThanOrEqual(
      Math.max(...geometry.segments.map((segment) => segment.right)),
    );

    await expect(notRated(page, text.name)).toHaveText(`${unratedOf(index)} not rated`);
    await expect(
      row(page, text.name).getByRole("button", { name: "Not rated", exact: true }),
    ).toHaveCount(0);
  }

  await viewButton(page, "By grader").click();
  const bars = gradesPanel(page).getByRole("group", { name: /below Competent/ });
  await expect(bars).toHaveCount(2 + holders(0).length + holders(1).length);
  const lines: number[] = [];
  for (const bar of await bars.all()) lines.push((await barGeometry(bar)).line);
  for (const line of lines) expect(Math.abs(line - (lines[0] ?? 0))).toBeLessThanOrEqual(1);
});

test("a level segment opens its criterion at that level's column, and a grader's segment opens that grader too", async ({
  page,
}) => {
  await openAs(page);
  await openGrades(page);
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

// ---------------------------------------------------------------- Class

test("Class opens a criterion into level columns listing every paper in the analysis order, each with its grader's letter", async ({
  page,
}) => {
  await openAs(page);
  await openGrades(page);
  for (const students of [false, true]) {
    if (students) await setNames(page, { students: true });
    for (const [index, text] of [MODEL, EVIDENCE].entries()) {
      await openCriterion(page, text.name);
      const scope = row(page, text.name);
      const tally = tallyOf(index);
      for (const level of LEVELS) {
        const where = `${text.name}, ${LEVEL_NAMES[level]}${students ? ", student names on" : ""}`;
        expect(await columnCount(scope, level), where).toBe(tally.levels[level]);
        expect(await papersIn(column(scope, level)), where).toEqual(
          columnOf(index, level, { students }),
        );
      }
      await expect(column(scope, "NOT_ASSESSED")).toHaveCount(0);
    }
  }
  const evidence = row(page, EVIDENCE.name);
  await expect(
    column(evidence, "COMPETENT").locator("header").getByText(EVIDENCE.competent, { exact: true }),
  ).toBeVisible();
  await expect(
    column(evidence, "DEFICIENT").locator("header").getByText(EVIDENCE.deficient, { exact: true }),
  ).toBeVisible();
  await expect(opener(page, MODEL.name)).toHaveAttribute("aria-expanded", "false");
});

test("a column scrolls inside its own height, so the page grows by one column at most", async ({
  page,
}) => {
  test.setTimeout(420_000);
  const large = await largeScenario();
  const papers = pilesOf(1, "EMERGENT", large).reduce((sum, pile) => sum + pile.learners.length, 0);
  expect(papers).toBeGreaterThanOrEqual(60);
  await openAs(page);
  await openGrades(page, "", large);
  const tally = tallyOf(1, onCriteria(large));
  const bar = classBar(page, EVIDENCE.name);
  await expect(bar).toHaveAttribute("aria-label", barLabelOf(EVIDENCE.name, tally));
  await expect(bar.getByRole("button")).toHaveCount(
    LEVELS.filter((level) => tally.levels[level] > 0).length,
  );
  const height = () => page.evaluate<number>("document.documentElement.scrollHeight");
  const before = await height();

  await openCriterion(page, EVIDENCE.name);
  const evidence = row(page, EVIDENCE.name);
  const emergent = column(evidence, "EMERGENT");
  await expect(emergent.getByRole("listitem")).toHaveCount(papers);
  expect(await columnCount(evidence, "EMERGENT")).toBe(papers);
  expect(await papersIn(emergent)).toEqual(columnOf(1, "EMERGENT", { scenario: large }));

  const scroller = emergent.locator(":scope > ul");
  const box = await scroller.evaluate((element) => {
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    return {
      maxHeight: Number.parseFloat(style?.maxHeight ?? ""),
      overflowY: style?.overflowY,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    };
  });
  expect(box.maxHeight).toBeGreaterThan(0);
  expect(box.overflowY).toBe("auto");
  expect(box.clientHeight).toBeLessThanOrEqual(box.maxHeight);
  expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);

  const header = await emergent
    .locator("header")
    .evaluate((element) => element.getBoundingClientRect().height);
  const grown = (await height()) - before;
  expect(grown).toBeGreaterThan(0);
  expect(grown).toBeLessThanOrEqual(box.maxHeight + header + 48);
});

test("a criterion's not-rated count splits marked Not assessed from not rated yet in its hint", async ({
  page,
}) => {
  test.setTimeout(420_000);
  const large = await largeScenario();
  const marked = onCriteria(large).filter((learner) => learner.marks[2] === "NOT_ASSESSED");
  const pending = unratedOf(2, large);
  expect(marked.length).toBeGreaterThan(0);
  expect(pending).toBeGreaterThan(0);
  await openAs(page);
  await openGrades(page, "", large);

  const separation = row(page, SEPARATION.name);
  await expect(notRated(page, SEPARATION.name)).toHaveText(`${marked.length + pending} not rated`);
  const hint = await openHint(separation, "Not rated");
  await expect(hint).toContainText(`${marked.length} marked Not assessed`);
  await expect(hint).toContainText(`${pending} not rated yet`);
  await page.keyboard.press("Escape");
  await expect(hint).toHaveCount(0);
  await expect(classBar(page, SEPARATION.name)).toHaveAttribute(
    "aria-label",
    barLabelOf(SEPARATION.name, tallyOf(2, onCriteria(large))),
  );
  await openCriterion(page, SEPARATION.name);
  expect(await columnCount(separation, "NOT_ASSESSED")).toBe(marked.length);
  expect(await papersIn(column(separation, "NOT_ASSESSED"))).toEqual(
    columnOf(2, "NOT_ASSESSED", { scenario: large }),
  );
  const evidencePending = unratedOf(1, large);
  expect(evidencePending).toBeGreaterThan(0);
  await expect(notRated(page, EVIDENCE.name)).toHaveText(`${evidencePending} not rated`);
  await expect(
    row(page, EVIDENCE.name).getByRole("button", { name: "Not rated", exact: true }),
  ).toHaveCount(0);
});

// ---------------------------------------------------------------- By grader

test("By grader puts a bar per grader under each criterion and opens a criterion into a row per grader across the level columns", async ({
  page,
}) => {
  await openAs(page);
  await openGrades(page);
  const entries = await page.evaluate<number>("window.history.length");
  await viewButton(page, "By grader").click();
  await expect(viewButton(page, "By grader")).toHaveAttribute("aria-pressed", "true");
  await expect(viewButton(page, "Class")).toHaveAttribute("aria-pressed", "false");
  await expectLink(page, { by: "grader" });
  expect(await page.evaluate<number>("window.history.length")).toBe(entries);

  for (const [index, text] of [MODEL, EVIDENCE].entries()) {
    const graders = holders(index);
    expect(await barLabels(page, text.name), text.name).toEqual([
      barLabelOf(text.name, tallyOf(index)),
      ...graders.map((grader) =>
        barLabelOf(
          labelOf(grader),
          tallyOf(
            index,
            onCriteria().filter((learner) => learner.grader === grader),
          ),
        ),
      ),
    ]);
    for (const grader of graders)
      await expect(
        row(page, text.name).getByRole("button", { name: labelOf(grader), exact: true }),
      ).toBeVisible();
  }
  expect(await namesShown(page)).toEqual({ students: [], graders: [] });

  await openCriterion(page, EVIDENCE.name);
  const evidence = row(page, EVIDENCE.name);
  const tally = tallyOf(1);
  const grid = await gridOf(evidence);
  expect(grid.heads).toEqual(LEVELS.map((level) => `${LEVEL_NAMES[level]} ${tally.levels[level]}`));
  expect(grid.rows).toEqual(
    holders(1).map((grader) => ({
      grader: grader ?? "none",
      label: labelOf(grader),
      expanded: null,
      cells: LEVELS.map((level) => ({
        papers: gridPapersOf(1, level, grader),
        squares: 0,
        count: null,
      })),
    })),
  );
  await evidence.getByRole("button", { name: NEAR_B, exact: true }).click();
  await expect(paperDialog(page).locator("dl")).toContainText(NEAR_B);
  await page.keyboard.press("Escape");
  await expect(paperDialog(page)).toHaveCount(0);

  await viewButton(page, "Class").click();
  await expectLink(page, { by: null });
  expect(await barLabels(page, MODEL.name)).toEqual([barLabelOf(MODEL.name, tallyOf(0))]);
  await expect(opener(page, EVIDENCE.name)).toHaveAttribute("aria-expanded", "true");
  await expect(column(evidence, "EMERGENT")).toBeVisible();
});

test("By grader in a large class shows each grader's papers as squares, and a grader's name expands their row and enters the link", async ({
  page,
  browser,
}) => {
  test.setTimeout(420_000);
  const large = await largeScenario();
  const counted = onCriteria(large);
  expect(counted.filter((learner) => typeof learner.marks[1] === "string").length).toBeGreaterThan(
    EACH_PAPER,
  );
  await openAs(page);
  await openGrades(page, "?tab=grades&by=grader", large);
  await expect(viewButton(page, "By grader")).toHaveAttribute("aria-pressed", "true");

  const c = graderAt("C", large);
  const own = tallyOf(
    0,
    counted.filter((learner) => learner.grader === c.id),
  );
  const cBar = row(page, MODEL.name).getByRole("group", {
    name: barLabelOf("Grader C", own),
    exact: true,
  });
  await expect(cBar.getByRole("button")).toHaveCount(
    LEVELS.filter((level) => own.levels[level] > 0).length,
  );

  await openCriterion(page, EVIDENCE.name);
  const evidence = row(page, EVIDENCE.name);
  const closed = holders(1, large).map((grader) => ({
    grader: grader ?? "none",
    label: labelOf(grader, large),
    expanded: "false",
    cells: LEVELS.map((level) => {
      const n = gridPapersOf(1, level, grader, large).length;
      return { papers: [], squares: n, count: n > 0 ? String(n) : null };
    }),
  }));
  expect((await gridOf(evidence)).rows).toEqual(closed);
  const closedLink = page.url();

  const square = evidence
    .getByRole("button", { name: /^Grader A, (Deficient|Emergent|Competent|Expert)/ })
    .first();
  const shown = await pointAt(page, square);
  await expect(shown).toContainText("Grader A");
  await expect(shown).toContainText("Feedback");
  await square.click();
  await expect(paperDialog(page)).toBeVisible();
  await expect(paperDialog(page).locator('[data-slot="dialog-header"]')).toContainText("Grader A");
  await page.keyboard.press("Escape");
  await expect(paperDialog(page)).toHaveCount(0);

  await evidence.getByRole("button", { name: "Grader C", exact: true }).last().click();
  await expectLink(page, { grader: c.id });
  const expanded = closed.map((line) =>
    line.grader === c.id
      ? {
          ...line,
          expanded: "true",
          cells: LEVELS.map((level) => ({
            papers: gridPapersOf(1, level, c.id, large),
            squares: 0,
            count: null,
          })),
        }
      : line,
  );
  await expect.poll(async () => (await gridOf(evidence)).rows).toEqual(expanded);
  const chosenLink = page.url();
  await page.goBack();
  await expect(page).toHaveURL(closedLink);
  await expect.poll(async () => (await gridOf(evidence)).rows).toEqual(closed);
  await page.goForward();
  await expect(page).toHaveURL(chosenLink);
  await expect.poll(async () => (await gridOf(evidence)).rows).toEqual(expanded);

  await cBar.getByRole("button", { name: `${own.levels.EMERGENT} Emergent`, exact: true }).click();
  await expect(opener(page, MODEL.name)).toHaveAttribute("aria-expanded", "true");
  await expectLink(page, { grader: c.id });
  const model = row(page, MODEL.name);
  await expect(columnHeading(model, "EMERGENT")).toBeInViewport();
  const rows = (await gridOf(model)).rows;
  expect(rows.find((line) => line.grader === c.id)?.expanded).toBe("true");
  expect(rows.filter((line) => line.expanded === "true")).toHaveLength(1);

  const fresh = await freshPage(browser);
  try {
    await openAs(fresh.page);
    await fresh.page.goto(chosenLink);
    await expect(opener(fresh.page, EVIDENCE.name)).toHaveAttribute("aria-expanded", "true");
    await expect(viewButton(fresh.page, "By grader")).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => (await gridOf(row(fresh.page, EVIDENCE.name))).rows)
      .toEqual(expanded);
    expect(await namesShown(fresh.page, large)).toEqual({ students: [], graders: [] });
  } finally {
    await fresh.page.unrouteAll({ behavior: "ignoreErrors" });
    await fresh.context.close();
  }
});

// ---------------------------------------------------------------- Graders

test("the Graders disclosure shows each grader's counts and stays open across a reload", async ({
  page,
}) => {
  await openAs(page);
  await openGrades(page);
  await showGraders(page);
  expect(
    (await graderTable(page).locator("thead th").allTextContents()).map((text) => text.trim()),
  ).toEqual(["Grader", "Complete", "To finish", "Without feedback"]);
  const expected = expectedTable();
  expect(expected).toHaveLength(3);
  expect(expected.some((cells) => cells.includes(""))).toBe(true);
  expect(await tableRows(page)).toEqual(expected);
  expect(await summaryOf(page)).toEqual(expectedSummary(seeded.expected));
  expect(await namesShown(page)).toEqual({ students: [], graders: [] });

  expect(linkOf(page).keys).toEqual(["tab"]);
  await page.reload();
  await expect(headline(page)).toBeVisible();
  await expect(gradersToggle(page)).toHaveAttribute("aria-expanded", "true");
  expect(await tableRows(page)).toEqual(expected);

  await gradersToggle(page).click();
  await expect(gradersToggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(graderTable(page)).toHaveCount(0);
  await page.reload();
  await expect(headline(page)).toBeVisible();
  await expect(gradersToggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(graderTable(page)).toHaveCount(0);
});

test("each number in the grader table opens that grader's learners, and an empty scope offers everyone", async ({
  page,
}) => {
  await openAs(page);
  await openGrades(page);
  await showGraders(page);
  const rows = graderTable(page).locator("tbody tr");
  let opened = 0;
  for (const grader of owners()) {
    const own = seeded.learners.filter(
      (learner) => learner.grader === grader && learner.state !== "dropped",
    );
    if (expectedOf(own).counted === 0) continue;
    const label = labelOf(grader);
    const line = rows.filter({ has: page.getByRole("cell", { name: label, exact: true }) });
    await expect(line, label).toHaveCount(1);
    const complete = own.filter((learner) => ["released", "complete"].includes(learner.state));
    const toFinish = own.filter((learner) =>
      ["incomplete", "not-started", "new-attempt"].includes(learner.state),
    );
    const noFeedback = own.filter((learner) => learner.withoutFeedback);
    const cells: [number, string, SeededLearner[], string][] = [
      [
        1,
        `${complete.length} of ${expectedOf(own).counted - expectedOf(own).excused}`,
        complete,
        `${label}, ${complete.length} complete`,
      ],
      [2, String(toFinish.length), toFinish, `${label}, ${toFinish.length} to finish`],
      [3, String(noFeedback.length), noFeedback, `${label}, ${noFeedback.length} without feedback`],
    ];
    for (const [cell, text, learners, said] of cells) {
      if (learners.length === 0) {
        if (cell > 1) await expect(line.locator("td").nth(cell).getByRole("button")).toHaveCount(0);
        continue;
      }
      await line.locator("td").nth(cell).getByRole("button", { name: text, exact: true }).click();
      await expectOpened(page, said, learners);
      await backToGrades(page);
      await expect(graderTable(page)).toBeVisible();
      opened += 1;
    }
  }
  expect(opened).toBeGreaterThanOrEqual(5);

  const [id] = [...letters().keys()];
  const pile = seeded.learners.filter(
    (learner) =>
      learner.grader === id && ["incomplete", "not-started", "new-attempt"].includes(learner.state),
  );
  await rows
    .filter({ has: page.getByRole("cell", { name: labelOf(id ?? null), exact: true }) })
    .locator("td")
    .nth(2)
    .getByRole("button")
    .click();
  await expectOpened(page, `${labelOf(id ?? null)}, ${pile.length} to finish`, pile);
  const panel = submissionsPanel(page);
  await page.getByRole("combobox", { name: "Show learners" }).click();
  await page.getByRole("option", { name: "Assigned to me", exact: true }).click();
  await expect(panel.getByText("No learners match.", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Show all learners", exact: true }).click();
  await expect(panel.getByText(/from Grades$/)).toHaveCount(0);
  await expect(panel.getByText("No learners match.", { exact: true })).toHaveCount(0);
  for (const learner of seeded.learners) await expect(learnerRow(page, learner.name)).toBeVisible();
});

test("a grader reads their own table row, paper chips, bars, and grid row as (you) while grader names are off", async ({
  page,
}) => {
  const a = graderAt("A");
  const you = labelOf(a.id, seeded, a.id);
  await openAs(page, a.username);
  await openGrades(page);
  await showGraders(page);
  expect(await tableRows(page)).toEqual(expectedTable(seeded, a.id));
  await expect(graderTable(page).getByRole("cell", { name: you, exact: true })).toBeVisible();

  await openCriterion(page, EVIDENCE.name);
  const evidence = row(page, EVIDENCE.name);
  const read = await evidence.locator("li > button > span:first-child").evaluateAll((spans) =>
    spans.map((span) => ({
      title: span.getAttribute("title") ?? "",
      bold: span.classList.contains("border-foreground"),
    })),
  );
  const expected = LEVELS.flatMap((level) => columnOf(1, level, { viewer: a.id }));
  expect(read).toEqual(
    expected.map((paper) => ({ title: paper.title, bold: paper.title === you })),
  );
  expect(read.some((chip) => chip.bold)).toBe(true);

  await viewButton(page, "By grader").click();
  expect((await barLabels(page, EVIDENCE.name)).some((label) => label.startsWith(`${you}:`))).toBe(
    true,
  );
  expect((await gridOf(evidence)).rows.map((line) => line.label)).toContain(you);
  expect(await namesShown(page)).toEqual({ students: [], graders: [] });

  await setNames(page, { graders: true });
  await expect(
    graderTable(page).getByRole("cell", { name: `${a.name} (you)`, exact: true }),
  ).toBeVisible();
  expect((await gridOf(evidence)).rows.map((line) => line.label)).toContain(`${a.name} (you)`);
  expect(
    (await barLabels(page, EVIDENCE.name)).some((label) => label.startsWith(`${a.name} (you):`)),
  ).toBe(true);
  await expect(gradesPanel(page).getByText(/^Grader [A-Z] \(you\)$/)).toHaveCount(0);
});

// ---------------------------------------------------------------- names

test("the Names button says which names show, and its switches survive a reload without entering the link", async ({
  page,
}) => {
  await openAs(page);
  await openGrades(page);
  await expect(namesButton(page)).toHaveText("Anonymous");
  expect(await switchesOf(page)).toEqual({ graders: "false", students: "false" });

  await setNames(page, { graders: true });
  await expect(namesButton(page)).toHaveText("Grader names");
  await setNames(page, { students: true });
  await expect(namesButton(page)).toHaveText("Names shown");
  await setNames(page, { graders: false });
  await expect(namesButton(page)).toHaveText("Student names");
  expect(linkOf(page).keys).toEqual(["tab"]);

  await page.reload();
  await expect(headline(page)).toBeVisible();
  await expect(namesButton(page)).toHaveText("Student names");
  expect(await switchesOf(page)).toEqual({ graders: "false", students: "true" });

  await setNames(page, { students: false });
  await expect(namesButton(page)).toHaveText("Anonymous");
  await page.reload();
  await expect(headline(page)).toBeVisible();
  await expect(namesButton(page)).toHaveText("Anonymous");
  expect(linkOf(page).keys).toEqual(["tab"]);
});

test("names stay hidden until their switch is on, everywhere a name could show", async ({
  page,
}) => {
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

test("a link reopened in a fresh browser restores the tab, criterion, By grader, and grader, and shows no names", async ({
  page,
  browser,
}) => {
  await openAs(page);
  await openGrades(page);
  await setNames(page, { graders: true, students: true });
  await showGraders(page);
  await viewButton(page, "By grader").click();
  const b = graderAt("B");
  await row(page, EVIDENCE.name).getByRole("button", { name: b.name, exact: true }).click();
  await expect(opener(page, EVIDENCE.name)).toHaveAttribute("aria-expanded", "true");
  await expectLink(page, { by: "grader", grader: b.id });
  await expect(row(page, EVIDENCE.name).getByText(learnerAt(2).name)).toBeVisible();
  const link = page.url();
  expect(link).not.toMatch(/name/i);
  expect(linkOf(page).keys).toEqual(["by", "criterion", "grader", "tab"]);

  const fresh = await freshPage(browser);
  try {
    await openAs(fresh.page);
    await fresh.page.goto(link);
    await expect(gradesTab(fresh.page)).toHaveAttribute("aria-selected", "true");
    await expect(opener(fresh.page, EVIDENCE.name)).toHaveAttribute("aria-expanded", "true");
    await expect(opener(fresh.page, MODEL.name)).toHaveAttribute("aria-expanded", "false");
    await expect(viewButton(fresh.page, "By grader")).toHaveAttribute("aria-pressed", "true");
    expect(linkOf(fresh.page)).toEqual(linkOf(page));
    expect((await gridOf(row(fresh.page, EVIDENCE.name))).rows.map((line) => line.label)).toEqual(
      holders(1).map((grader) => labelOf(grader)),
    );
    await expect(namesButton(fresh.page)).toHaveText("Anonymous");
    await expect(gradersToggle(fresh.page)).toHaveAttribute("aria-expanded", "false");
    await expect(graderTable(fresh.page)).toHaveCount(0);
    expect(await namesShown(fresh.page)).toEqual({ students: [], graders: [] });
  } finally {
    await fresh.page.unrouteAll({ behavior: "ignoreErrors" });
    await fresh.context.close();
  }

  await page.goBack();
  await expectLink(page, { criterion: null, grader: null, by: "grader" });
  await expect(opener(page, EVIDENCE.name)).toHaveAttribute("aria-expanded", "false");
});

test("grader and admin read the same summary and rows, and the dropped learner counts nowhere", async ({
  page,
  browser,
}) => {
  const dropped = seeded.learners.filter((learner) => learner.state === "dropped");
  expect(dropped).toHaveLength(1);
  expect(seeded.expected.dropped).toBe(1);

  await openAs(page);
  await openGrades(page);
  const adminSummary = await summaryOf(page);
  expect(adminSummary).toEqual(expectedSummary(seeded.expected));
  const adminRows = [await rowFacts(page, MODEL.name), await rowFacts(page, EVIDENCE.name)];
  expect(adminRows).toEqual(
    [MODEL, EVIDENCE].map((text, index) => [
      barLabelOf(text.name, tallyOf(index)),
      `${unratedOf(index)} not rated`,
    ]),
  );

  await setNames(page, { students: true });
  for (const text of [MODEL, EVIDENCE]) {
    await openCriterion(page, text.name);
    await expect(column(row(page, text.name), "COMPETENT")).toBeVisible();
    expect(await gradesPanel(page).textContent()).not.toContain(dropped[0]?.name);
  }

  for (const grader of seeded.graders) {
    const fresh = await freshPage(browser);
    try {
      await openAs(fresh.page, grader.username);
      await openGrades(fresh.page);
      expect(await summaryOf(fresh.page), grader.name).toEqual(adminSummary);
      expect(
        [await rowFacts(fresh.page, MODEL.name), await rowFacts(fresh.page, EVIDENCE.name)],
        grader.name,
      ).toEqual(adminRows);
      const hint = await openHint(summary(fresh.page), "Not counted");
      await expect(hint.getByRole("button", { name: "1 dropped", exact: true })).toBeVisible();
    } finally {
      await fresh.page.unrouteAll({ behavior: "ignoreErrors" });
      await fresh.context.close();
    }
  }
});

// ---------------------------------------------------------------- the paper

test("a paper reads in place and opens its attempt, and Back walks the place back", async ({
  page,
}) => {
  await openAs(page);
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

test("a paper read in place follows both name switches and shows no name with them off", async ({
  page,
}) => {
  await openAs(page);
  await openGrades(page);
  await openCriterion(page, EVIDENCE.name);
  const learner = learnerAt(2);
  const owner = seeded.graders.find((grader) => grader.id === learner.grader);
  const letter = letters().get(learner.grader ?? "");
  if (!owner || !letter) throw new Error("learner 2 has no seeded grader");
  const dialog = paperDialog(page);
  const title = dialog.locator('[data-slot="dialog-title"]');
  const header = dialog.locator('[data-slot="dialog-header"]');

  async function read() {
    await column(row(page, EVIDENCE.name), "EMERGENT")
      .getByRole("button", { name: new RegExp(NEAR_B.slice(0, 40)) })
      .click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("dl")).toContainText(NEAR_B);
  }
  async function close() {
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }

  await read();
  await expect(title).toHaveText("Paper");
  await expect(header).toContainText(`Grader ${letter}`);
  expect(await dialogNames(page)).toEqual({ students: [], graders: [] });
  await close();

  await setNames(page, { students: true });
  await read();
  await expect(title).toHaveText(learner.name);
  await expect(header).toContainText(`Grader ${letter}`);
  expect(await dialogNames(page)).toEqual({ students: [learner.name], graders: [] });
  await close();

  await setNames(page, { graders: true });
  await read();
  await expect(title).toHaveText(learner.name);
  await expect(header).toContainText(owner.name);
  expect(await dialogNames(page)).toEqual({ students: [learner.name], graders: [owner.name] });
  await close();

  await setNames(page, { students: false });
  await read();
  await expect(title).toHaveText("Paper");
  await expect(header).toContainText(owner.name);
  expect(await dialogNames(page)).toEqual({ students: [], graders: [owner.name] });
  await close();
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

test("pointing at or focusing a points statistic shows its median, mean, range, full marks, zeros, and count", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const points = await pointsScenario();
  const [first, , third] = pointsLines(points) as [PointsLine, PointsLine, PointsLine];
  await openAs(page);
  await openGrades(page, "", points);

  await pointAt(page, rowStatistic(page, pointsName(first)));
  expect(await statisticsOf(page)).toEqual(expectedStatistics(scoresOf(first), first.max));
  await headline(page).hover();
  await expect(card(page)).toHaveCount(0);

  await rowStatistic(page, pointsName(third)).focus();
  expect(await statisticsOf(page)).toEqual(expectedStatistics(scoresOf(third), third.max));
  const terms = expectedStatistics(scoresOf(third), third.max).map(([term]) => term);
  expect(terms).not.toContain("Full marks");
  expect(terms).toContain("Zero");
  await rowStatistic(page, pointsName(third)).blur();
  await expect(card(page)).toHaveCount(0);
});

test("By grader puts each grader's papers under every points row on its axis, with their statistic", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const points = await pointsScenario();
  const lines = pointsLines(points);
  await openAs(page);
  await openGrades(page, "?tab=grades&by=grader", points);

  for (const statistic of ["median", "mean"] as const) {
    if (statistic === "mean") await statisticButton(page, "Mean").click();
    for (const line of lines) {
      const scope = row(page, pointsName(line));
      const graders = [...letters(points).keys()].filter(
        (grader) => scoresOf(line, grader).length > 0,
      );
      await expect(scope.locator("[data-grader][data-lights]")).toHaveCount(graders.length);
      for (const grader of graders) {
        const strip = scope.locator(`[data-grader="${grader}"][data-lights]`);
        const scores = scoresOf(line, grader);
        await expect(strip).toContainText(labelOf(grader, points));
        await expect(strip.locator("button[data-dot]")).toHaveCount(scores.length);
        await expect(strip.locator("span[tabindex='0']")).toHaveText(
          `${statistic} ${statText(statistic, scores)}`,
        );
        expect(await caretAt(strip)).toBeCloseTo(
          (statisticOf(statistic, scores) / line.max) * 100,
          3,
        );
      }
      await expect(rowStatistic(page, pointsName(line))).toHaveText(
        `${statistic} ${statText(statistic, scoresOf(line))}`,
      );
      await expect(scope.locator("button[aria-expanded]")).toHaveCount(0);
    }
  }
  expect(await namesShown(page, points)).toEqual({ students: [], graders: [] });

  await viewButton(page, "Class").click();
  for (const line of lines)
    await expect(row(page, pointsName(line)).locator("[data-grader][data-lights]")).toHaveCount(0);
});

test("By grader in a large points class gives each grader a bar per score, each opening their learners", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const large = await largePointsScenario();
  const question = pointsLines(large)[0] as PointsLine;
  expect(question.papers.length).toBeGreaterThan(EACH_PAPER);
  await openAs(page);
  await openGrades(page, "?tab=grades&by=grader", large);

  const scope = row(page, pointsName(question));
  await expect(scope.locator("button[data-dot]")).toHaveCount(0);
  const graders = [...letters(large).keys()];
  await expect(scope.locator("[data-grader][data-lights]")).toHaveCount(graders.length);
  for (const grader of graders) {
    const strip = scope.locator(`[data-grader="${grader}"][data-lights]`);
    const scores = scoresOf(question, grader);
    const counts = new Map<number, number>();
    for (const value of scores) counts.set(value, (counts.get(value) ?? 0) + 1);
    await expect(strip.getByRole("button", { name: / at \d+$/ })).toHaveCount(counts.size);
    for (const [value, count] of counts)
      await expect(
        strip.getByRole("button", { name: `${count} at ${value}`, exact: true }),
      ).toBeVisible();
    await expect(strip.locator("span[tabindex='0']")).toHaveText(
      `median ${statText("median", scores)}`,
    );
  }

  const [grader] = graders as [string];
  const scores = scoresOf(question, grader);
  const value = Math.max(...scores);
  const count = scores.filter((own) => own === value).length;
  await scope
    .locator(`[data-grader="${grader}"][data-lights]`)
    .getByRole("button", { name: `${count} at ${value}`, exact: true })
    .click();
  await expect(page).toHaveURL(/[?&]tab=submissions(&|$)/);
  await expect(
    submissionsPanel(page).getByText(
      `${count} scored ${value} on ${question.name}, graded by ${labelOf(grader, large)} from Grades`,
      { exact: true },
    ),
  ).toBeVisible();
});

test("a question's dots are its papers and nothing opens, and pointing at a grader's row darkens their papers and fades the rest", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const points = await pointsScenario();
  const question = pointsLines(points)[0] as PointsLine;
  const name = pointsName(question);
  const dotName = (paper: PointsLine["papers"][number]) =>
    `${labelOf(paper.learner.grader, points)}, ${paper.score} of ${question.max}`;
  await openAs(page);
  await openGrades(page, "", points);

  const scope = row(page, name);
  const dots = scope.getByRole("button", { name: /, \d+ of \d+$/ });
  await expect(dots).toHaveCount(question.papers.length);
  expect(
    (await dots.evaluateAll((all) => all.map((dot) => dot.getAttribute("aria-label") ?? ""))).sort(
      (left, right) => left.localeCompare(right),
    ),
  ).toEqual(question.papers.map(dotName).sort((left, right) => left.localeCompare(right)));
  await expect(scope.locator("[data-grader][data-lights]")).toHaveCount(0);

  const zero = question.papers.find((paper) => paper.score === 0);
  if (!zero) throw new Error("points has no zero on the first question");
  const dot = scope.getByRole("button", { name: dotName(zero), exact: true });
  const shown = await pointAt(page, dot);
  await expect(shown).toContainText(`0 of ${question.max}`);
  await expect(shown).toContainText("Overall feedback");
  await expect(shown).toContainText(zero.learner.feedback.trim());
  await dot.click();
  const dialog = paperDialog(page);
  await expect(dialog.locator("dl")).toContainText(`${question.name}0 of ${question.max}`);
  await expect(dialog.locator('[data-slot="dialog-header"]')).toContainText(
    labelOf(zero.learner.grader, points),
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(linkOf(page).criterion).toBeFalsy();

  await expect(scope.locator("button[aria-expanded]")).toHaveCount(0);

  await viewButton(page, "By grader").click();
  await expect(dots).toHaveCount(question.papers.length * 2);
  const [first, second] = [...letters(points).keys()].filter(
    (grader) => scoresOf(question, grader).length > 0,
  ) as [string, string];
  const ink = (grader: string) =>
    scope
      .locator(`button[data-dot][data-grader="${grader}"] > span`)
      .first()
      .evaluate((dot) => {
        const view = (
          dot as unknown as {
            ownerDocument: {
              defaultView: { getComputedStyle(element: unknown): { backgroundColor: string } };
            };
          }
        ).ownerDocument.defaultView;
        return view.getComputedStyle(dot).backgroundColor;
      });
  const faded = (grader: string) =>
    scope
      .locator(`button[data-dot][data-grader="${grader}"] > span`)
      .first()
      .evaluate((dot) => dot.ownerDocument.defaultView?.getComputedStyle(dot).opacity);
  const before = await ink(first);
  await scope
    .locator(`[data-grader="${first}"][data-lights]`)
    .getByText(labelOf(first, points), { exact: true })
    .hover();
  await expect.poll(() => ink(first)).not.toBe(before);
  expect(await ink(second)).toBe(before);
  expect(await faded(first)).toBe("1");
  expect(await faded(second)).toBe("0.3");
});

test("the total's dots are its papers, each showing its total and overall feedback", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const points = await pointsScenario();
  const total = pointsLines(points)[3] as PointsLine;
  const name = pointsName(total);
  await openAs(page);
  await openGrades(page, "", points);

  const scope = row(page, name);
  await expect(scope.locator("button[aria-expanded]")).toHaveCount(0);
  await expect(scope.getByRole("button", { name: /, \d+ of \d+$/ })).toHaveCount(
    total.papers.length,
  );
  const top = [...total.papers].sort((left, right) => right.score - left.score)[0];
  if (!top) throw new Error("points has no totals");
  const dot = scope
    .getByRole("button", {
      name: `${labelOf(top.learner.grader, points)}, ${top.score} of ${total.max}`,
      exact: true,
    })
    .first();
  const shown = await pointAt(page, dot);
  await expect(shown).toContainText(`${top.score} of ${total.max}`);
  await expect(shown).toContainText("Overall feedback");
  await dot.click();
  await expect(paperDialog(page)).toContainText("Overall feedback");
});

// ---------------------------------------------------------------- refetching

test("a return to the window refetches only when the last load is at least 10 s old and no paper is open", async ({
  page,
}) => {
  await openAs(page);
  await openGrades(page);
  await openCriterion(page, EVIDENCE.name);
  const reads = countReads(page);

  await refocus(page);
  await reveal(page);
  await page.waitForTimeout(1_000);
  expect(reads()).toBe(0);

  await later(page, FRESH_MS + 1_000);
  await column(row(page, EVIDENCE.name), "EMERGENT")
    .getByRole("button", { name: new RegExp(NEAR_B.slice(0, 40)) })
    .click();
  await expect(paperDialog(page)).toBeVisible();
  await refocus(page);
  await reveal(page);
  await page.waitForTimeout(1_000);
  expect(reads()).toBe(0);
  await page.keyboard.press("Escape");
  await expect(paperDialog(page)).toHaveCount(0);
  expect(reads()).toBe(0);

  await refocus(page);
  await expect.poll(reads).toBe(1);
  await page.waitForTimeout(500);
  await refocus(page);
  await page.waitForTimeout(1_000);
  expect(reads()).toBe(1);

  await later(page, FRESH_MS + 1_000);
  await reveal(page);
  await expect.poll(reads).toBe(2);

  await page.getByRole("tab", { name: "Submissions", exact: true }).click();
  await expect(submissionsPanel(page)).toBeVisible();
  await later(page, FRESH_MS + 1_000);
  await page.waitForTimeout(500);
  const before = reads();
  await backToGrades(page);
  await expect.poll(reads).toBeGreaterThan(before);
  await expect(opener(page, EVIDENCE.name)).toHaveAttribute("aria-expanded", "true");
});

test("a failed refetch says so, keeps the last view, and Retry clears it", async ({ page }) => {
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

// ---------------------------------------------------------------- changed setups

test("an assignment whose method changed shows the rows of the method assessed first under its heading first, with the legend and Median | Mean, and shows each points row's papers in place", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const scenario = await seedGradeScenario(origin, "method-switch");
  const rows = setupRows(scenario);
  const headings = headingsOf(rows);
  expect(headings).toHaveLength(2);
  await openAs(page);
  await openGrades(page, "", scenario);

  expect(await rowNames(page)).toEqual(rows.map((line) => line.label));
  await expect(gradesPanel(page).getByText(/^(Rated by level|Scored in points)$/)).toHaveText(
    headings,
  );
  await expect(gradesPanel(page).getByRole("list", { name: "Rating levels" })).toBeVisible();
  await expect(statisticButton(page, "Median")).toHaveAttribute("aria-pressed", "true");
  await expect(statisticButton(page, "Mean")).toHaveAttribute("aria-pressed", "false");
  expect(await namesShown(page, scenario)).toEqual({ students: [], graders: [] });

  for (const line of rows.filter((entry) => entry.kind !== "COMPETENCY"))
    await expectPointsRow(page, line);

  const rated = rows.find((line) => line.kind === "COMPETENCY");
  const scored = rows.find((line) => line.kind === "POINTS");
  const total = rows.find((line) => line.kind === "TOTAL");
  if (!rated || !scored || !total) throw new Error("method-switch lacks a row of each kind");
  await expectCompetencyRow(page, rated);

  for (const line of [scored, total]) {
    await expect(row(page, line.label).locator("button[aria-expanded]")).toHaveCount(0);
    await expect(row(page, line.label).getByRole("button", { name: /, \d+ of \d+$/ })).toHaveCount(
      scoresIn(line).length,
    );
  }
});

test("a revised standard reads as one criterion per edition, each named by its edition and counted from its own papers", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const scenario = await seedGradeScenario(origin, "setup-edited-rubric");
  const rows = setupRows(scenario);
  const editions = rows.filter((line) => line.label !== line.name);
  expect(editions).toHaveLength(2);
  expect(new Set(editions.map((line) => line.name)).size).toBe(1);
  await openAs(page);
  await openGrades(page, "", scenario);

  expect(await rowNames(page)).toEqual(rows.map((line) => line.label));
  await expect(gradesPanel(page).getByText(/^(Rated by level|Scored in points)$/)).toHaveCount(0);
  for (const line of rows) await expectCompetencyRow(page, line);

  const [first, second] = editions as [SetupRow, SetupRow];
  await openCriterion(page, first.label);
  await expect(
    column(row(page, first.label), "COMPETENT")
      .locator("header")
      .getByText(EVIDENCE.competent, { exact: true }),
  ).toBeVisible();
  await openCriterion(page, second.label);
  await expect(
    column(row(page, second.label), "COMPETENT")
      .locator("header")
      .getByText(EVIDENCE_REVISED.competent, { exact: true }),
  ).toBeVisible();
});

test("a points criterion whose maximum changed reads as one row per maximum, and each new maximum draws its own axis", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const scenario = await seedGradeScenario(origin, "setup-edited-points");
  const rows = setupRows(scenario);
  const names = rows.filter((line) => line.kind === "POINTS").map((line) => line.name);
  expect(new Set(names).size).toBeLessThan(names.length);
  expect(rows.filter((line) => line.kind === "TOTAL")).toHaveLength(2);
  await openAs(page);
  await openGrades(page, "", scenario);

  expect(await rowNames(page)).toEqual(rows.map((line) => line.label));
  expect(await axisMaxima(page)).toEqual(axesOfRows(rows));
  await expect(gradesPanel(page).getByRole("list", { name: "Rating levels" })).toHaveCount(0);
  for (const line of rows) await expectPointsRow(page, line);
});

// ---------------------------------------------------------------- other shapes

test("a grader with nothing submitted yet still finds their own row, and zero parts stay hidden", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const idle = await seedGradeScenario(origin, "idle-grader");
  const grader = idle.graders.find(
    (entry) =>
      entry.delegated > 0 &&
      idle.learners.every(
        (learner) => learner.grader !== entry.id || learner.state === "not-submitted",
      ),
  );
  if (!grader) throw new Error("idle-grader has no grader whose learners never submitted");
  const you = labelOf(grader.id, idle, grader.id);
  await openAs(page, grader.username);
  await openGrades(page, "", idle);

  const expected = idle.expected;
  expect([
    toFinishOf(expected),
    expected.withoutFeedback,
    expected.withoutGrader,
    expected.excused,
    expected.dropped,
  ]).toEqual([0, 0, 0, 0, 0]);
  expect(await summaryOf(page)).toEqual(expectedSummary(expected));
  expect(partsOf(expected)).toHaveLength(2);
  await expect(summary(page).getByRole("button", { name: "To finish", exact: true })).toHaveCount(
    0,
  );
  await expect(summary(page).getByRole("button", { name: "Not counted", exact: true })).toHaveCount(
    0,
  );

  await showGraders(page);
  const busy = expectedTable(idle, grader.id);
  expect(busy.length).toBeGreaterThan(0);
  expect(busy.every((cells) => cells[2] === "" && cells[3] === "")).toBe(true);
  expect(await tableRows(page)).toEqual([...busy, [you, "No submitted work yet"]]);
  const own = graderTable(page).locator("tbody tr").last();
  await expect(own.getByRole("button")).toHaveCount(0);
  expect(await namesShown(page, idle)).toEqual({ students: [], graders: [] });

  await gradersToggle(page).click();
  await expect(gradesPanel(page).getByText("No submitted work yet", { exact: true })).toHaveCount(
    0,
  );
  await expect(graderTable(page)).toHaveCount(0);
});

test("Submissions says Not started, and New attempt needs review only after an assessed attempt", async ({
  page,
}) => {
  await openAs(page);
  await page.goto(`${origin}${seeded.path}?tab=submissions`);
  const panel = submissionsPanel(page);
  for (const learner of seeded.learners) await expect(learnerRow(page, learner.name)).toBeVisible();

  const notStarted = seeded.learners.filter((learner) => learner.state === "not-started");
  const newAttempts = seeded.learners.filter((learner) => learner.state === "new-attempt");
  expect(notStarted.length).toBeGreaterThan(0);
  expect(newAttempts.length).toBeGreaterThan(0);
  for (const learner of notStarted) {
    const card = learnerCard(page, learner.name);
    await expect(card.getByText("Not started", { exact: true })).toBeVisible();
    await expect(card.getByText("New attempt needs review", { exact: true })).toHaveCount(0);
  }
  for (const learner of newAttempts)
    await expect(
      learnerCard(page, learner.name).getByText("New attempt needs review", { exact: true }),
    ).toBeVisible();
  await expect(panel.getByText("New attempt needs review", { exact: true })).toHaveCount(
    newAttempts.length,
  );
  await expect(panel.getByText("Not assessed", { exact: true })).toHaveCount(0);
  for (const learner of seeded.learners.filter((entry) => entry.state === "excused"))
    await expect(
      learnerCard(page, learner.name).getByText("Assignment excused", { exact: true }),
    ).toBeVisible();
});

test("a return to the window moves a paper after its grader changes the rating", async ({
  page,
  browser,
}) => {
  await openAs(page);
  await openGrades(page);
  await openCriterion(page, EVIDENCE.name);
  const evidence = row(page, EVIDENCE.name);
  const before = tallyOf(1);
  const paper = (level: Level) =>
    column(evidence, level).getByRole("button", { name: new RegExp(NEAR_B.slice(0, 40)) });
  await expect(paper("EMERGENT")).toBeVisible();
  await expect(paper("COMPETENT")).toHaveCount(0);

  const learner = learnerAt(2);
  const grader = seeded.graders.find((entry) => entry.id === learner.grader);
  if (!grader || !learner.submission) throw new Error("learner 2 has no grader or attempt");
  const api = await browser.newContext();
  try {
    const cookie = await signIn(api, grader.username);
    const { grades } = await call<{
      grades: {
        learner: string;
        evidence: string;
        setupRevision: number;
        feedback: string;
        criteria: { criterion: string; name: string }[];
        judgments: { kind: string; criterion: string; rating: string; feedback: string }[];
      }[];
    }>(api, cookie, "/grades/for-item", { item: seeded.assignment });
    const draft = grades.find(
      (grade) => grade.learner === learner.id && grade.evidence === learner.submission,
    );
    if (!draft) throw new Error("learner 2's draft is missing");
    const target = draft.criteria.find((criterion) => criterion.name === EVIDENCE.name)?.criterion;
    const recorded = await call<{ grade: string; version: number }>(api, cookie, "/grades/record", {
      learner: learner.id,
      item: seeded.assignment,
      evidence: learner.submission,
      revision: draft.setupRevision,
    });
    await call(api, cookie, "/grades/save", {
      grade: recorded.grade,
      version: recorded.version,
      judgments: draft.judgments.map(({ kind, criterion, rating, feedback }) => ({
        kind,
        criterion,
        rating: criterion === target ? "COMPETENT" : rating,
        feedback,
      })),
      feedback: draft.feedback,
    });
  } finally {
    await api.close();
  }

  await expect(paper("EMERGENT")).toBeVisible();
  await later(page, FRESH_MS + 1_000);
  await refocus(page);
  await expect(paper("COMPETENT")).toBeVisible();
  await expect(paper("EMERGENT")).toHaveCount(0);
  expect(await columnCount(evidence, "EMERGENT")).toBe(before.levels.EMERGENT - 1);
  expect(await columnCount(evidence, "COMPETENT")).toBe(before.levels.COMPETENT + 1);
  await expect(classBar(page, EVIDENCE.name)).toHaveAttribute(
    "aria-label",
    barLabelOf(EVIDENCE.name, {
      ...before,
      competentOrAbove: before.competentOrAbove + 1,
      below: before.below - 1,
    }),
  );
});
