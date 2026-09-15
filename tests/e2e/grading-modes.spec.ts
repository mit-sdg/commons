import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const shots = resolve(import.meta.dirname, "../../test-results/grading-modes");

test("points grading is private until release and mode changes delete only after confirmation", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  await mkdir(shots, { recursive: true });
  const staff = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const student = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
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

    await call(staff, "/auth/login", { username: "mara", password: "password123" });
    await call(staff, "/roster/import", {
      rows: [{ email: "noah@example.edu", kind: "STUDENT" }],
    });
    await call(student, "/auth/login", { username: "noah", password: "password123" });
    const today = Date.now();
    const { assignment } = await call(staff, "/assignments/create-draft", {
      title: "Problem Set 1",
      instructions: "Show your reasoning and submit one response.",
      kind: "EXERCISE",
      availableAt: new Date(today - 86_400_000).toISOString(),
      dueAt: new Date(today + 7 * 86_400_000).toISOString(),
      acceptsSubmissions: true,
      audience: "EVERYONE",
      targets: [],
    });
    await call(staff, "/grades/configure-method", {
      item: assignment,
      method: "POINTS",
      maxPoints: 10,
      generation: 0,
      discard: false,
    });
    await call(staff, "/assignments/publish", { assignment });
    const { submission } = await call(student, "/assignments/submit", {
      assignment,
      content: "My first solution",
    });

    const staffPage = await staff.newPage();
    await staffPage.goto(`${baseURL}/staff/assignments/${assignment}#attempt-${submission}`);
    await staffPage.getByRole("button", { name: "Assess this attempt" }).click();
    const score = staffPage.getByRole("spinbutton", { name: "Score / 10" });
    await score.fill("8.5");
    await staffPage
      .getByRole("textbox", { name: "Feedback (optional)" })
      .fill("Clear method; revisit the final step.");
    await staffPage.screenshot({
      path: resolve(shots, "problem-set-1-points-entry-desktop.png"),
      fullPage: true,
    });
    await staffPage.setViewportSize({ width: 390, height: 844 });
    await staffPage.screenshot({
      path: resolve(shots, "problem-set-1-points-entry-mobile.png"),
      fullPage: true,
    });
    await staffPage.setViewportSize({ width: 1440, height: 1000 });
    await staffPage.getByRole("button", { name: "Save draft" }).click();
    await expect(staffPage.getByText("draft", { exact: true })).toBeVisible();

    const studentPage = await student.newPage();
    await studentPage.goto(`${baseURL}/grades`);
    await expect(studentPage.getByText("8.5", { exact: true })).toHaveCount(0);

    await staffPage.getByRole("button", { name: "Release", exact: true }).click();
    await staffPage.getByRole("button", { name: "Release grade", exact: true }).click();
    await expect(staffPage.getByText("released", { exact: true })).toBeVisible();
    await studentPage.reload();
    await expect(studentPage.getByText("8.5", { exact: true })).toBeVisible();
    await expect(studentPage.getByText("/ 10", { exact: true })).toBeVisible();
    await expect(studentPage.getByText("Clear method; revisit the final step.")).toBeVisible();
    await studentPage.screenshot({
      path: resolve(shots, "problem-set-1-released-learner-desktop.png"),
      fullPage: true,
    });
    await studentPage.setViewportSize({ width: 390, height: 844 });
    await studentPage.screenshot({
      path: resolve(shots, "problem-set-1-released-learner-mobile.png"),
      fullPage: true,
    });

    await staffPage.getByRole("tab", { name: "Overview", exact: true }).click();
    await staffPage.getByRole("button", { name: "Competency", exact: true }).click();
    const dialog = staffPage.getByRole("dialog");
    await expect(dialog.getByText(/permanently delete 1 existing grade/)).toBeVisible();
    await staffPage.screenshot({
      path: resolve(shots, "problem-set-1-mode-change-confirmation-desktop.png"),
      fullPage: false,
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(staffPage.getByRole("button", { name: "Points", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await studentPage.reload();
    await expect(studentPage.getByText("8.5", { exact: true })).toBeVisible();

    await staffPage.getByRole("button", { name: "Competency", exact: true }).click();
    await staffPage
      .getByRole("dialog")
      .getByRole("button", { name: "Delete 1 and change grading", exact: true })
      .click();
    await expect(
      staffPage.getByRole("button", { name: "Competency", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await studentPage.reload();
    await expect(studentPage.getByText("8.5", { exact: true })).toHaveCount(0);
  } finally {
    await staff.close();
    await student.close();
  }
});

test("a failed points setup retains the saved assignment identity for repair", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const staff = await browser.newContext();
  try {
    const login = await staff.request.post(`${baseURL}/api/auth/login`, {
      data: { username: "mara", password: "password123" },
    });
    expect(login.ok()).toBe(true);
    const page = await staff.newPage();
    await page.goto(`${baseURL}/staff/assignments/new`);
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Points setup recovery");
    await page.getByRole("button", { name: "Points", exact: true }).click();
    const maximum = page.getByRole("spinbutton", { name: "Maximum points" });
    await maximum.fill("");
    await expect(page.getByRole("button", { name: "Create draft", exact: true })).toBeDisabled();
    await maximum.fill("20");
    await page.route("**/api/grades/configure-method", (route) => route.abort("connectionfailed"));
    await page.getByRole("button", { name: "Create draft", exact: true }).click();
    await page.waitForURL(/\/staff\/assignments\/[\da-f-]+$/);
    await expect(
      page.getByText(/Draft saved, but points grading could not be configured/),
    ).toBeVisible();
  } finally {
    await staff.close();
  }
});
