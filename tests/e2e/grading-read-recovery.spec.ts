import { expect, type BrowserContext, type Page, test } from "@playwright/test";

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
  const setup = await call("/grades/item", { item: assignment });
  if (method === "POINTS") {
    await call("/grades/configure-setup", {
      item: assignment,
      method,
      revision: setup.revision,
      criteria: [{ kind: "POINTS", name: "Overall", maxPoints: 10, position: 0 }],
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
    await call("/grades/configure-setup", {
      item: assignment,
      method,
      revision: setup.revision,
      criteria: [{ kind: "COMPETENCY", basis: edition, position: 0 }],
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

async function recoverAllNotices(page: Page, readPath: string) {
  const panel = page.getByRole("tabpanel", { name: "Submissions" });
  const notice = panel.getByText("Grading data could not be refreshed");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const alert = panel
      .getByRole("alert")
      .filter({ hasText: "Grading data could not be refreshed" })
      .first();
    if ((await alert.count()) === 0) break;

    // A parent read notice can be replaced by an editor read notice. Keep the
    // clicked DOM node so the locator cannot silently retarget the next notice.
    const alertElement = await alert.elementHandle();
    const readResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === readPath && response.request().method() === "POST",
    );
    await alert.getByRole("button", { name: "Retry grading data", exact: true }).click();
    expect((await readResponse).ok()).toBe(true);
    await expect
      .poll(async () =>
        alertElement
          ? alertElement.evaluate((element) => element.isConnected).catch(() => false)
          : false,
      )
      .toBe(false);
    await alertElement?.dispose();
  }
  await expect(notice).toHaveCount(0);
}

test("atomic setup reconciles uncertain saves and retains a stale CAS draft", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const staff = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  try {
    const { assignment, call } = await setupAssignment(staff, baseURL!, "POINTS");
    const page = await staff.newPage();
    await page.goto(`${baseURL}/staff/assignments/${assignment}`);
    const criterion = page.getByRole("textbox", {
      name: "Criterion",
      exact: true,
    });
    await criterion.fill("Response-lost criterion");

    await page.route("**/api/grades/configure-setup", async (route) => {
      const committed = await route.fetch();
      expect(committed.ok()).toBe(true);
      await route.fulfill({ status: 200, json: { error: "NETWORK_ERROR" } });
    });
    await page.getByRole("button", { name: "Review and save", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save grading setup", exact: true })
      .click();
    await expect(criterion).toHaveValue("Response-lost criterion");
    await expect(page.getByText("Setup saved", { exact: true })).toBeVisible();
    await page.unroute("**/api/grades/configure-setup");
    const confirmed = await call("/grades/item", { item: assignment });
    expect(confirmed.criteria[0].name).toBe("Response-lost criterion");

    await criterion.fill("Local unsaved criterion");
    const concurrent = await call("/grades/configure-setup", {
      item: assignment,
      method: "POINTS",
      revision: confirmed.revision,
      criteria: [
        {
          kind: "POINTS",
          criterion: confirmed.criteria[0].criterion,
          name: "Concurrent saved criterion",
          maxPoints: 10,
          position: 0,
        },
      ],
    });
    expect(concurrent.revision).toBeGreaterThan(confirmed.revision);
    await page.getByRole("button", { name: "Review and save", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save grading setup", exact: true })
      .click();
    await expect(criterion).toHaveValue("Local unsaved criterion");
    await expect(
      page.getByText("The saved setup changed elsewhere", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Review saved setup", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Reload saved setup", exact: true })
      .click();
    await expect(criterion).toHaveValue("Concurrent saved criterion");
  } finally {
    await staff.close();
  }
});

test("points grading retains its mode and unsaved editor through read failures", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const staff = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const student = await browser.newContext();
  try {
    const { assignment } = await setupAssignment(staff, baseURL!, "POINTS");
    const submission = await submitAsStudent(student, baseURL!, assignment);

    const page = await staff.newPage();
    await page.goto(`${baseURL}/staff/assignments/${assignment}#attempt-${submission}`);
    await page.getByRole("button", { name: "Assess this attempt" }).click();
    await page.getByRole("button", { name: "Start assessment" }).click();
    const score = page.getByRole("spinbutton", { name: "Score / 10" });
    const feedback = page.getByRole("textbox", {
      name: "Overall feedback (optional)",
    });
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
    await page.unroute("**/api/grades/item");
    await recoverAllNotices(page, "/api/grades/item");
    await expect(score).toBeEnabled();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("7.75 / 10", { exact: true })).toBeVisible();

    await score.fill("9.25");
    await feedback.fill("Keep this newer unsaved points feedback");
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
    await expect(score).toHaveValue("9.25");
    await expect(feedback).toHaveValue("Keep this newer unsaved points feedback");
    await expect(page.getByText("7.75 / 10", { exact: true })).toBeVisible();
    await expect(score).toBeDisabled();
    await expect(page.getByText(/update outcome could not be confirmed/i)).toBeHidden();
    await page.unroute("**/api/grades/for-item");
    await page.unroute("**/api/grades/save");
    await recoverAllNotices(page, "/api/grades/for-item");
    await expect(score).toHaveValue("9.25");
    await expect(feedback).toHaveValue("Keep this newer unsaved points feedback");
    await expect(score).toBeEnabled();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("9.25 / 10", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Release all drafts (1)", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Release all assignment drafts", exact: true })
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
  test.setTimeout(180_000);
  const staff = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const student = await browser.newContext();
  try {
    const { assignment, call } = await setupAssignment(staff, baseURL!, "COMPETENCY");
    const submission = await submitAsStudent(student, baseURL!, assignment);

    const page = await staff.newPage();
    await page.goto(`${baseURL}/staff/assignments/${assignment}#attempt-${submission}`);
    const staleSetup = await call("/grades/item", { item: assignment });
    await page.route("**/api/grades/item", (route) =>
      route.fulfill({ status: 200, json: staleSetup }),
    );
    await page.getByRole("button", { name: "Assess this attempt" }).click();
    await expect(page.getByRole("button", { name: "Start assessment" })).toBeEnabled();
    const replacement = await call("/grades/define-standard", {
      name: "Updated reasoning",
      description: "",
      deficient: "",
      emergent: "",
      competent: "",
      expert: "",
      referenceUrl: "",
    });
    const advancedSetup = await call("/grades/configure-setup", {
      item: assignment,
      method: staleSetup.method,
      revision: staleSetup.revision,
      criteria: [
        {
          kind: "COMPETENCY",
          basis: replacement.edition,
          position: 0,
        },
      ],
    });
    expect(advancedSetup.revision).toBeGreaterThan(staleSetup.revision);
    await page.unroute("**/api/grades/item");
    await page.getByRole("button", { name: "Start assessment" }).click();
    await expect(page.getByText(/grading setup changed before this assessment/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Start assessment" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Start assessment" })).toBeEnabled();
    await page.getByRole("button", { name: "Start assessment" }).click();
    await expect(
      page.getByRole("button", { name: "Release all drafts (1)", exact: true }),
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
    await page.unroute("**/api/grades/for-item");
    await page.unroute("**/api/grades/save");
    await recoverAllNotices(page, "/api/grades/for-item");
    await expect(feedback).toHaveValue("Keep this unsaved competency feedback");
    await expect(rating).toHaveText("Competent");
    await expect(feedback).toBeEnabled();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Release all drafts (1)", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Release all assignment drafts", exact: true })
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
