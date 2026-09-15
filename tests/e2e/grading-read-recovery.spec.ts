import { expect, type BrowserContext, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const shots = resolve(import.meta.dirname, "../../test-results/grading-read-recovery");

async function setupAssignment(
  context: BrowserContext,
  baseURL: string,
  method: "POINTS" | "COMPETENCY",
) {
  let cookie = "";
  const call = async (path: string, data: unknown) => {
    const response = await context.request.post(`${baseURL}/api${path}`, {
      headers: cookie ? { Cookie: cookie } : {},
      data,
    });
    cookie = response.headers()["set-cookie"]?.split(";")[0] ?? cookie;
    const result = await response.json();
    expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBe(true);
    expect(result).not.toHaveProperty("error");
    return result;
  };
  await call("/auth/login", { username: "mara", password: "password123" });
  await call("/roster/import", {
    rows: [{ email: "noah@example.edu", kind: "STUDENT" }],
  });
  const now = Date.now();
  const { assignment } = await call("/assignments/create-draft", {
    title: `${method === "POINTS" ? "Points" : "Competency"} recovery audit`,
    instructions: "Explain your reasoning.",
    kind: "EXERCISE",
    availableAt: new Date(now - 86_400_000).toISOString(),
    dueAt: new Date(now + 7 * 86_400_000).toISOString(),
    acceptsSubmissions: true,
    audience: "EVERYONE",
    targets: [],
  });
  if (method === "POINTS") {
    await call("/grades/configure-method", {
      item: assignment,
      method,
      maxPoints: 10,
      generation: 0,
      discard: false,
    });
  } else {
    const { edition } = await call("/grades/define-standard", {
      name: "Reasoning",
      description: "",
      deficient: "",
      emergent: "",
      competent: "",
      expert: "",
      referenceUrl: "",
    });
    await call("/grades/add-criterion", {
      item: assignment,
      basis: edition,
      position: 0,
    });
  }
  await call("/assignments/publish", { assignment });
  return { assignment, call };
}

async function submitAsStudent(context: BrowserContext, baseURL: string, assignment: string) {
  const login = await context.request.post(`${baseURL}/api/auth/login`, {
    data: { username: "noah", password: "password123" },
  });
  expect(login.ok()).toBe(true);
  const cookie = login.headers()["set-cookie"]?.split(";")[0] ?? "";
  const response = await context.request.post(`${baseURL}/api/assignments/submit`, {
    headers: { Cookie: cookie },
    data: { assignment, content: "Evidence to assess" },
  });
  const result = await response.json();
  expect(response.ok(), JSON.stringify(result)).toBe(true);
  expect(result).not.toHaveProperty("error");
  return result.submission as string;
}

async function recoverAllNotices(page: import("@playwright/test").Page) {
  const panel = page.getByRole("tabpanel", { name: "Submissions" });
  const notice = panel.getByText("Grading data could not be refreshed");
  for (let attempt = 0; attempt < 3 && (await notice.first().isVisible()); attempt += 1) {
    await panel.getByRole("button", { name: "Retry grading data", exact: true }).first().click();
    await expect(panel.getByRole("button", { name: "Retrying…" })).toHaveCount(0);
  }
  await expect(notice).toHaveCount(0);
}

test("points grading retains its mode and unsaved editor through read failures", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  await mkdir(shots, { recursive: true });
  const staff = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const student = await browser.newContext();
  try {
    const { assignment } = await setupAssignment(staff, baseURL!, "POINTS");
    const submission = await submitAsStudent(student, baseURL!, assignment);

    const page = await staff.newPage();
    await page.goto(`${baseURL}/staff/assignments/${assignment}#attempt-${submission}`);
    await page.getByRole("button", { name: "Assess this attempt" }).click();
    const score = page.getByRole("spinbutton", { name: "Score / 10" });
    const feedback = page.getByRole("textbox", { name: "Feedback (optional)" });
    await score.fill("7.75");
    await feedback.fill("Keep this unsaved points feedback");

    await page.route("**/api/grades/item", (route) =>
      route.fulfill({ json: { error: "NETWORK_ERROR" } }),
    );
    await page.getByRole("tab", { name: "Student preview" }).click();
    await expect(
      page
        .getByRole("tabpanel", { name: "Student preview" })
        .getByText("Grading data could not be refreshed"),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Submissions" }).click();
    await expect(score).toHaveValue("7.75");
    await expect(feedback).toHaveValue("Keep this unsaved points feedback");
    await expect(score).toBeDisabled();
    await expect(
      page
        .getByRole("tabpanel", { name: "Submissions" })
        .getByText("Grading data could not be refreshed"),
    ).toHaveCount(1);
    await page.screenshot({
      path: resolve(shots, "points-setup-unavailable-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.unroute("**/api/grades/item");
    await recoverAllNotices(page);
    await expect(score).toBeEnabled();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("7.75 / 10", { exact: true })).toBeVisible();

    await score.fill("9.25");
    await feedback.fill("Keep this newer unsaved points feedback");
    await page.route("**/api/marks/for-item", (route) =>
      route.fulfill({ json: { error: "NETWORK_ERROR" } }),
    );
    await page.route("**/api/marks/record", (route) => route.abort("failed"));
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/save outcome could not be confirmed/i)).toBeVisible();
    await expect(
      page
        .getByRole("tabpanel", { name: "Submissions" })
        .getByText("Grading data could not be refreshed"),
    ).toHaveCount(1);
    await expect(score).toHaveValue("9.25");
    await expect(feedback).toHaveValue("Keep this newer unsaved points feedback");
    await expect(page.getByText("7.75 / 10", { exact: true })).toBeVisible();
    await expect(score).toBeDisabled();
    await expect(page.getByText(/save outcome could not be confirmed/i)).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate("window.scrollTo(0, 0)");
    await page.screenshot({
      path: resolve(shots, "points-results-unavailable-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.unroute("**/api/marks/for-item");
    await page.unroute("**/api/marks/record");
    await recoverAllNotices(page);
    await expect(score).toHaveValue("9.25");
    await expect(feedback).toHaveValue("Keep this newer unsaved points feedback");
    await expect(score).toBeEnabled();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("9.25 / 10", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Release drafts (1)", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Release grades", exact: true })
      .click();
    await expect(page.getByText("released", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retract to correct", exact: true }),
    ).toBeVisible();
  } finally {
    await staff.close();
    await student.close();
  }
});

test("competency grading retains unsaved judgments through uncertain actions and recovery", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  await mkdir(shots, { recursive: true });
  const staff = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const student = await browser.newContext();
  try {
    const { assignment } = await setupAssignment(staff, baseURL!, "COMPETENCY");
    const submission = await submitAsStudent(student, baseURL!, assignment);

    const page = await staff.newPage();
    await page.goto(`${baseURL}/staff/assignments/${assignment}#attempt-${submission}`);
    await page.getByRole("button", { name: "Assess this attempt" }).click();
    await page.route("**/api/grades/record", (route) => route.abort("failed"));
    await page.getByRole("button", { name: "Start assessment" }).click();
    await expect(page.getByText(/assessment start could not be confirmed/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Start assessment" })).toBeVisible();

    await page.unroute("**/api/grades/record");
    await page.getByRole("button", { name: "Start assessment" }).click();
    await expect(
      page.getByRole("button", { name: "Release drafts (1)", exact: true }),
    ).toBeEnabled();
    await expect(page.getByText("1 assessment", { exact: true })).toBeVisible();
    const rating = page.getByRole("combobox", { name: "Assessment" });
    const feedback = page.getByRole("textbox", {
      name: "Overall feedback (optional)",
    });
    await rating.click();
    await page.getByRole("option", { name: "Competent", exact: true }).click();
    await feedback.fill("Keep this unsaved competency feedback");

    await page.route("**/api/grades/for-item", (route) =>
      route.fulfill({ json: { error: "NETWORK_ERROR" } }),
    );
    await page.route("**/api/grades/save", (route) => route.abort("failed"));
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/update outcome could not be confirmed/i)).toBeVisible();
    await expect(
      page
        .getByRole("tabpanel", { name: "Submissions" })
        .getByText("Grading data could not be refreshed"),
    ).toHaveCount(1);
    await expect(feedback).toHaveValue("Keep this unsaved competency feedback");
    await expect(rating).toHaveText("Competent");
    await expect(feedback).toBeDisabled();
    await expect(page.getByText(/update outcome could not be confirmed/i)).toBeHidden();
    await page.evaluate("window.scrollTo(0, 0)");
    await page.screenshot({
      path: resolve(shots, "competency-results-unavailable-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });

    await page.unroute("**/api/grades/for-item");
    await page.unroute("**/api/grades/save");
    await recoverAllNotices(page);
    await expect(feedback).toHaveValue("Keep this unsaved competency feedback");
    await expect(rating).toHaveText("Competent");
    await expect(feedback).toBeEnabled();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Release drafts (1)", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Release grades", exact: true })
      .click();
    await expect(page.getByText("released", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retract to correct", exact: true }),
    ).toBeVisible();
  } finally {
    await staff.close();
    await student.close();
  }
});
