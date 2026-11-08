import { expect, type Page } from "@playwright/test";
import { authenticate, test } from "./support/browser.ts";
import {
  retireGradeScenarios,
  type SeededScenario,
  seedGradeScenario,
} from "./support/grade-scenarios.ts";

/**
 * Does each new screen open in a browser and carry its first journey: a
 * policy saved, marked final, and released; a student reading their card;
 * the late days page; and the attendance pages?
 */

let seeded: SeededScenario;
let origin: string;

test.beforeAll(async ({ browserName: _browserName }, testInfo) => {
  test.setTimeout(180_000);
  origin = String(testInfo.project.use.baseURL);
  seeded = await seedGradeScenario(origin, "small-mixed");
});

test.afterAll(async () => {
  test.setTimeout(180_000);
  if (seeded) await retireGradeScenarios(origin, [seeded]);
});

function failOnPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return () => expect(errors).toEqual([]);
}

test("staff save a policy, mark it final, and release it; a student reads their card", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const noErrors = failOnPageErrors(page);
  await authenticate(page);
  await page.goto("/staff/gradebook");
  await expect(page.getByRole("heading", { name: "Course grades" })).toBeVisible();
  await expect(page.getByText(/median of \d+ students?/)).toBeVisible();
  await expect(page.getByText("Not saved yet")).toBeVisible();

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Version 1")).toBeVisible();
  await page.getByRole("button", { name: /More actions for/ }).click();
  await page.getByRole("menuitem", { name: "Mark final" }).click();
  await expect(page.getByText("Final", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Release to students" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Held for review")).toBeVisible();
  await dialog.getByRole("button", { name: /^Release to \d+ students?$/ }).click();
  await expect(page.getByText(/Released to students [A-Z]/).first()).toBeVisible();

  const learner =
    seeded.learners.find((entry) => entry.state === "released") ?? seeded.learners[0]!;
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await authenticate(page, learner.username);
  await page.goto("/grades");
  await expect(page.getByText("Course grade", { exact: true })).toBeVisible();
  noErrors();
});

test("a student opens the late days page", async ({ page }) => {
  const noErrors = failOnPageErrors(page);
  await authenticate(page, seeded.learners[0]!.username);
  await page.goto("/late-days");
  await expect(page.getByRole("heading", { name: "Late days" })).toBeVisible();
  await expect(page.getByText(/\d+ of \d+ left/)).toBeVisible();
  await expect(page.getByText(seeded.title).first()).toBeVisible();
  noErrors();
});

test("staff open attendance and the marking list", async ({ page }) => {
  const noErrors = failOnPageErrors(page);
  await authenticate(page);
  await page.goto("/staff/attendance");
  await expect(page.getByRole("heading", { name: "Attendance" })).toBeVisible();
  await page.goto("/staff/attendance/runs");
  await expect(page.getByRole("heading", { name: "Mark lectures" })).toBeVisible();
  noErrors();
});
