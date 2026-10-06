import { expect, type Page, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const shots = resolve(import.meta.dirname, "../../test-results/grading-modes");

async function saveAndRelease(page: Page) {
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review release", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Review release", exact: true }).click();
  await page.getByRole("button", { name: "Confirm release to learner", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retract to correct", exact: true })).toBeVisible();
}

test("attempts retain frozen point setups, corrections, and scoped excusals", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(360_000);
  await mkdir(shots, { recursive: true });
  const staff = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const student = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const cookies = new Map<typeof staff, string>();
  const call = async (context: typeof staff, path: string, data: unknown) => {
    const response = await context.request.post(`${baseURL}/api${path}`, {
      headers: cookies.has(context) ? { Cookie: cookies.get(context)! } : {},
      data,
    });
    const cookie = response.headers()["set-cookie"]?.split(";")[0];
    if (cookie) cookies.set(context, cookie);
    const result = await response.json();
    expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBe(true);
    expect(result).not.toHaveProperty("error");
    return result;
  };

  await call(staff, "/auth/login", {
    username: "mara",
    password: "password123",
  });
  await call(staff, "/roster/import", {
    rows: [{ email: "noah@example.edu", kind: "STUDENT" }],
  });
  await call(student, "/auth/login", {
    username: "noah",
    password: "password123",
  });
  const now = Date.now();
  const { assignment } = await call(staff, "/assignments/create-draft", {
    title: "Snapshot scoring studio",
    instructions: "Show your reasoning and submit one response.",
    kind: "EXERCISE",
    availableAt: new Date(now - 86_400_000).toISOString(),
    dueAt: new Date(now + 7 * 86_400_000).toISOString(),
    acceptsSubmissions: true,
    audience: "EVERYONE",
    targets: [],
  });
  const initialSetup = await call(staff, "/grades/item", {
    item: assignment,
  });
  const tenPointSetup = await call(staff, "/grades/configure-setup", {
    item: assignment,
    method: "POINTS",
    revision: initialSetup.revision,
    criteria: [{ kind: "POINTS", name: "Overall", maxPoints: 10, position: 0 }],
  });
  await call(staff, "/assignments/publish", { assignment });
  const first = await call(student, "/assignments/submit", {
    assignment,
    content: "My first solution",
  });

  const learnerGrades = await student.newPage();
  await learnerGrades.goto(`${baseURL}/grades`);
  const assignmentGradeCards = learnerGrades.locator('[data-slot="card"]').filter({
    has: learnerGrades.locator(`a[href="/assignments/${assignment}"]`),
  });
  const staffPage = await staff.newPage();
  await staffPage.goto(`${baseURL}/staff/assignments/${assignment}#attempt-${first.submission}`);
  await staffPage.getByRole("button", { name: "Assess this attempt", exact: true }).click();
  await staffPage.getByRole("button", { name: "Start assessment", exact: true }).click();
  const firstScore = staffPage.getByRole("spinbutton", {
    name: "Score / 10",
  });
  await firstScore.fill("7");
  await staffPage
    .getByRole("textbox", { name: "Overall feedback (optional)" })
    .fill("First release");
  await staffPage.getByRole("button", { name: "Save draft", exact: true }).click();
  await learnerGrades.reload();
  await expect(assignmentGradeCards.getByText("7 / 10", { exact: true })).toHaveCount(0);
  await staffPage.getByRole("button", { name: "Review release", exact: true }).click();
  await staffPage
    .getByRole("button", {
      name: "Confirm release to learner",
      exact: true,
    })
    .click();

  await staffPage.getByRole("button", { name: "Retract to correct", exact: true }).click();
  await firstScore.fill("8");
  await staffPage
    .getByRole("textbox", { name: "Overall feedback (optional)" })
    .fill("Corrected after review");
  await saveAndRelease(staffPage);

  // This submission predates the setup edit, but its first assessment does
  // not start until afterward and therefore snapshots the newer setup.
  const second = await call(student, "/assignments/submit", {
    assignment,
    content: "My revised solution",
  });

  await staffPage.getByRole("tab", { name: "Overview" }).click();
  await staffPage.getByRole("textbox", { name: "Criterion", exact: true }).fill("Analysis");
  await staffPage.getByRole("spinbutton", { name: "Maximum points", exact: true }).fill("12");
  await staffPage.getByRole("button", { name: "Add criterion", exact: true }).click();
  await staffPage.getByRole("textbox", { name: "Criterion", exact: true }).nth(1).fill("Clarity");
  await staffPage.getByRole("spinbutton", { name: "Maximum points", exact: true }).nth(1).fill("8");
  await expect(staffPage.getByText("Total: 20 points")).toBeVisible();
  await expect(
    staffPage.getByText(/Changes apply only to assessments started after/),
  ).toBeVisible();
  await staffPage.screenshot({
    path: resolve(shots, "non-destructive-setup-editor-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await staffPage.getByRole("button", { name: "Review and save", exact: true }).click();
  const setupDialog = staffPage.getByRole("dialog");
  await expect(setupDialog.getByText(/Existing drafts, released grades, excusals/)).toBeVisible();
  await setupDialog.getByRole("button", { name: "Save grading setup", exact: true }).click();
  await expect(staffPage.getByText("Setup saved", { exact: true })).toBeVisible();

  await learnerGrades.reload();
  await expect(assignmentGradeCards.getByText("8 / 10", { exact: true }).first()).toBeVisible();
  await assignmentGradeCards.first().getByText("Correction history", { exact: true }).click();
  await expect(assignmentGradeCards.getByText("7 / 10", { exact: true }).first()).toBeVisible();
  await assignmentGradeCards.first().screenshot({
    path: resolve(shots, "retained-8-of-10-history-desktop.png"),
    animations: "disabled",
  });

  const assignmentPage = await student.newPage();
  await assignmentPage.goto(`${baseURL}/assignments/${assignment}`);
  await expect(
    assignmentPage.getByText("The latest submitted attempt has not been assessed yet."),
  ).toBeVisible();
  await expect(assignmentPage.getByRole("heading", { name: "Previous assessments" })).toBeVisible();
  await expect(assignmentPage.getByText("8 / 10", { exact: true }).first()).toBeVisible();

  await staffPage.goto(`${baseURL}/staff/assignments/${assignment}#attempt-${second.submission}`);
  await staffPage.reload();
  const secondAttempt = staffPage.locator(`#attempt-${second.submission}`);
  await expect(secondAttempt).toContainText("Attempt #2");
  await secondAttempt.getByRole("button", { name: "Assess this attempt", exact: true }).click();
  await staffPage.getByRole("button", { name: "Start assessment", exact: true }).click();
  await staffPage.getByRole("spinbutton", { name: "Score / 12" }).fill("10");
  await staffPage.getByRole("spinbutton", { name: "Score / 8" }).fill("7");
  await expect(staffPage.getByText("17 / 20", { exact: true })).toBeVisible();
  await staffPage.screenshot({
    path: resolve(shots, "multi-criterion-points-entry-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await staffPage.setViewportSize({ width: 390, height: 844 });
  await staffPage.screenshot({
    path: resolve(shots, "multi-criterion-points-entry-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await staffPage.setViewportSize({ width: 1440, height: 1000 });
  await saveAndRelease(staffPage);

  const frozen = await call(staff, "/grades/for-item", { item: assignment });
  const firstAssessment = frozen.grades.find(
    (grade: { evidence: string }) => grade.evidence === first.submission,
  );
  const secondAssessment = frozen.grades.find(
    (grade: { evidence: string }) => grade.evidence === second.submission,
  );
  expect(firstAssessment.setupRevision).toBe(tenPointSetup.revision);
  expect(firstAssessment.outOf).toBe(10);
  expect(firstAssessment.criteria.map((criterion: { name: string }) => criterion.name)).toEqual([
    "Overall",
  ]);
  expect(secondAssessment.setupRevision).toBeGreaterThan(firstAssessment.setupRevision);
  expect(secondAssessment.outOf).toBe(20);
  expect(secondAssessment.criteria.map((criterion: { name: string }) => criterion.name)).toEqual([
    "Analysis",
    "Clarity",
  ]);

  await assignmentPage.reload();
  await expect(assignmentPage.getByText("17 / 20", { exact: true }).first()).toBeVisible();
  await expect(assignmentPage.getByText("8 / 10", { exact: true }).first()).toBeVisible();

  // Empty evidence is an assignment excusal; an exact attempt result still
  // wins the current-result summary.
  await staffPage.getByRole("combobox", { name: "Evidence being assessed" }).click();
  await staffPage.getByRole("option", { name: "Assignment excusal (no attempt)" }).click();
  await staffPage.getByRole("button", { name: "Record assignment excusal" }).click();
  await staffPage.getByRole("button", { name: "Excuse assignment", exact: true }).click();
  await staffPage.getByRole("button", { name: "Confirm excusal to learner" }).click();
  await assignmentPage.reload();
  await expect(assignmentPage.getByText("17 / 20", { exact: true }).first()).toBeVisible();

  const third = await call(student, "/assignments/submit", {
    assignment,
    content: "A third attempt for scoped excusal",
  });
  await staffPage.goto(`${baseURL}/staff/assignments/${assignment}#attempt-${third.submission}`);
  // A hash-only navigation keeps the existing assignment page mounted. Reload
  // once so this API-seeded submission is present before following its anchor.
  await staffPage.reload();
  const thirdAttempt = staffPage.locator(`#attempt-${third.submission}`);
  await expect(thirdAttempt).toContainText("Attempt #3");
  await thirdAttempt.getByRole("button", { name: "Assess this attempt", exact: true }).click();
  await staffPage.getByRole("button", { name: "Start assessment", exact: true }).click();
  await staffPage.getByRole("button", { name: "Excuse this assessment", exact: true }).click();
  await staffPage.getByRole("button", { name: "Confirm excusal to learner" }).click();
  await learnerGrades.reload();
  await expect(assignmentGradeCards.getByText("Assignment excused.")).toBeVisible();
  await expect(assignmentGradeCards.getByText("Attempt 3 excused.")).toBeVisible();
});
