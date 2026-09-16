import { readFile } from "node:fs/promises";
import { expect, type Browser, type Page } from "@playwright/test";
import type { Output } from "../../frontend/src/lib/api.ts";
import { authenticate, call, test } from "./support/browser.ts";

async function fixture(
  page: Page,
  browser: Browser,
  baseURL: string,
  method: "POINTS" | "COMPETENCY" = "POINTS",
) {
  const staff = await authenticate(page);
  await call(page, staff.cookie, "/roster/import", {
    rows: [{ email: "noah@example.edu", kind: "STUDENT" }],
  });
  const { assignment } = await call<Output<"/assignments/create-draft">>(
    page,
    staff.cookie,
    "/assignments/create-draft",
    {
      title: `Grading workspace ${method} ${crypto.randomUUID()}`,
      instructions: "Review the learner's evidence.",
      kind: "EXERCISE",
      availableAt: "2020-01-01T00:00:00Z",
      dueAt: "2090-01-01T00:00:00Z",
      acceptsSubmissions: true,
      audience: "EVERYONE",
      targets: [],
    },
  );
  const standard =
    method === "COMPETENCY"
      ? await call<Output<"/grades/define-standard">>(
          page,
          staff.cookie,
          "/grades/define-standard",
          {
            name: "Reasoning",
            description: "",
            deficient: "",
            emergent: "",
            competent: "",
            expert: "",
            referenceUrl: "",
          },
        )
      : null;
  const setup = await call<Output<"/grades/configure-setup">>(
    page,
    staff.cookie,
    "/grades/configure-setup",
    {
      item: assignment,
      method,
      revision: 0,
      criteria: standard
        ? [{ kind: "COMPETENCY", basis: standard.edition, position: 0 }]
        : [{ kind: "POINTS", name: "Overall", maxPoints: 10, position: 0 }],
    },
  );
  await call(page, staff.cookie, "/assignments/publish", { assignment });
  const student = await browser.newContext();
  const work = await (async () => {
    try {
      const login = await student.request.post(`${baseURL}/api/auth/login`, {
        data: { username: "noah", password: "password123" },
      });
      expect(login.ok()).toBe(true);
      const learner = ((await login.json()) as Output<"/auth/login">).user;
      const cookie = login.headers()["set-cookie"]!.split(";")[0]!;
      const response = await student.request.post(`${baseURL}/api/assignments/submit`, {
        headers: { Cookie: cookie },
        data: { assignment, content: "Evidence for workspace regression" },
      });
      expect(response.ok()).toBe(true);
      const { submission } = (await response.json()) as Output<"/assignments/submit">;
      return { learner, submission };
    } finally {
      await student.close();
    }
  })();
  const grade = await call<Output<"/grades/record">>(page, staff.cookie, "/grades/record", {
    learner: work.learner,
    item: assignment,
    evidence: work.submission,
    revision: setup.revision,
  });
  const feedback = page.locator(`#feedback-${grade.grade}`);
  const score = page.getByRole("spinbutton", { name: "Score / 10" });
  const rating = page.getByRole("combobox", { name: "Assessment", exact: true });
  async function openDraft() {
    await page.goto(`/staff/assignments/${assignment}#attempt-${work.submission}`);
    await page.getByRole("button", { name: "Assess this attempt", exact: true }).click();
    await expect(feedback).toBeEnabled();
    await feedback.fill("Retain this unsaved feedback");
    if (method === "POINTS") await score.fill("6.25");
    else {
      await rating.click();
      await page.getByRole("option", { name: "Competent", exact: true }).click();
    }
  }
  async function expectDraft() {
    await expect(feedback).toBeVisible();
    await expect(feedback).toHaveValue("Retain this unsaved feedback");
    if (method === "POINTS") await expect(score).toHaveValue("6.25");
    else await expect(rating).toHaveText("Competent");
  }
  async function filterBy(label: string) {
    await page.getByRole("combobox", { name: "Show learners" }).click();
    await page.getByRole("option", { name: label, exact: true }).click();
  }
  return {
    ...staff,
    ...work,
    assignment,
    setup,
    grade,
    feedback,
    openDraft,
    expectDraft,
    filterBy,
  };
}

for (const method of ["POINTS", "COMPETENCY"] as const) {
  test(`${method} draft survives an empty grader filter and reassignment out of scope`, async ({
    page,
    browser,
    baseURL,
  }) => {
    const f = await fixture(page, browser, baseURL!, method);
    await f.openDraft();
    await f.filterBy("Assigned to me");
    await expect(page.getByText("No learners match this grader scope.")).toBeVisible();
    await expect(f.feedback).toBeHidden();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await f.filterBy("All learners");
    await f.expectDraft();

    await f.filterBy("Unassigned");
    await page.getByRole("combobox", { name: "Grader for Noah Patel" }).click();
    await page.getByRole("option", { name: "Mara Chen (@mara)", exact: true }).click();
    // Other tests may have enrolled more learners; only this learner leaves the scope.
    await expect(page.getByRole("combobox", { name: "Grader for Noah Patel" })).toHaveCount(0);
    await expect(f.feedback).toBeHidden();
    await f.filterBy("Assigned to me");
    await f.expectDraft();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
    const saved = await call<Output<"/grades/detail">>(page, f.cookie, "/grades/detail", {
      grade: f.grade.grade,
    });
    expect(saved.assessments[0]).toMatchObject({ feedback: "Retain this unsaved feedback" });
    expect(saved.assessments[0]!.judgments[0]).toMatchObject(
      method === "POINTS" ? { score: 6.25 } : { rating: "COMPETENT" },
    );
  });

  test(`${method} draft survives failed submissions and delegation refreshes`, async ({
    page,
    browser,
    baseURL,
  }) => {
    const f = await fixture(page, browser, baseURL!, method);
    await f.openDraft();
    await page.route(
      "**/api/submissions/for-assignment",
      (route) => route.abort("connectionfailed"),
      { times: 1 },
    );
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(
      page.getByText("Learner work could not be refreshed.", { exact: false }),
    ).toBeVisible();
    await f.expectDraft();
    await expect(f.feedback).toBeDisabled();
    await page.getByRole("button", { name: "Retry learner work", exact: true }).click();
    await expect(f.feedback).toBeEnabled();
    await f.expectDraft();

    await call(page, f.cookie, "/delegation/set", {
      item: f.assignment,
      learner: f.learner,
      grader: f.user,
    });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await f.filterBy("Assigned to me");
    await f.expectDraft();
    await page.route("**/api/delegation/for-item", (route) => route.abort("connectionfailed"), {
      times: 1,
    });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
    await f.expectDraft();
    await expect(page.getByText("No learners match this grader scope.")).toHaveCount(0);
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);
    await f.expectDraft();
  });
}

for (const refusedPath of ["/submissions/for-assignment", "/grades/for-item"]) {
  test(`a ${refusedPath} refusal clears even a filtered-out grading editor`, async ({
    page,
    browser,
    baseURL,
  }) => {
    const f = await fixture(page, browser, baseURL!);
    await f.openDraft();
    await f.filterBy("Assigned to me");
    await expect(f.feedback).toBeHidden();
    await expect(f.feedback).toHaveValue("Retain this unsaved feedback");
    await page.route(`**/api${refusedPath}`, (route) =>
      route.fulfill({ status: 403, json: { error: "FORBIDDEN" } }),
    );
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByText("Not yours to open", { exact: true })).toBeVisible();
    await expect(f.feedback).toHaveCount(0);
    await expect(page.getByText("Evidence for workspace regression", { exact: true })).toHaveCount(
      0,
    );
  });
}

test("withdrawn-only work uses the same saved attempt assessment and excusal scope in the page and CSV", async ({
  page,
  browser,
  baseURL,
}) => {
  const f = await fixture(page, browser, baseURL!);
  const saved = await call<Output<"/grades/save">>(page, f.cookie, "/grades/save", {
    grade: f.grade.grade,
    version: f.grade.version,
    judgments: [{ kind: "POINTS", criterion: f.setup.criteria[0]!.criterion, score: 8 }],
    feedback: "Marked attempt",
  });
  const released = await call<Output<"/grades/release">>(page, f.cookie, "/grades/release", saved);
  const excusal = await call<Output<"/grades/record">>(page, f.cookie, "/grades/record", {
    learner: f.learner,
    item: f.assignment,
    evidence: "",
    revision: f.setup.revision,
  });
  await call(page, f.cookie, "/grades/excuse", {
    grade: excusal.grade,
    version: excusal.version,
    feedback: "Assignment excusal",
  });
  await call(page, f.cookie, "/grades/configure-setup", {
    item: f.assignment,
    revision: f.setup.revision,
    method: "POINTS",
    criteria: [{ kind: "POINTS", name: "Overall", maxPoints: 100, position: 0 }],
  });
  // WITHDRAWN is a supported stored state without a browser-facing withdrawal
  // action. Both page and exporter receive the same fixture; grade reads are real.
  await page.route("**/api/submissions/for-assignment", async (route) => {
    const response = await route.fetch({
      headers: { ...route.request().headers(), cookie: f.cookie },
    });
    const result = (await response.json()) as Output<"/submissions/for-assignment">;
    await route.fulfill({
      response,
      json: {
        ...result,
        submissions: result.submissions.map((row) => ({ ...row, status: "WITHDRAWN" })),
      },
    });
  });
  await page.goto(`/staff/assignments/${f.assignment}`);
  await page.getByRole("tab", { name: "Submissions", exact: true }).click();
  await expect(page.getByText("8 / 10", { exact: true })).toBeVisible();
  await expect(page.getByText("Assignment excused", { exact: true })).toHaveCount(0);
  await expect(page.getByText("New attempt needs review", { exact: true })).toHaveCount(0);
  async function exportCsv() {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export current view", exact: true }).click();
    return readFile((await (await download).path())!, "utf8");
  }
  const csv = await exportCsv();
  expect(csv).toContain(`Withdrawn,${f.submission},1`);
  expect(csv).toContain(`Attempt 1,RELEASED,${f.grade.grade}`);
  expect(csv).toContain(",8,10,http://");
  expect(csv).not.toContain(`Assignment excusal,EXCUSED,${excusal.grade}`);

  const retracted = await call<Output<"/grades/retract">>(
    page,
    f.cookie,
    "/grades/retract",
    released,
  );
  await call(page, f.cookie, "/grades/excuse", { ...retracted, feedback: "Attempt excusal" });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("Attempt excused", { exact: true })).toBeVisible();
  await expect(page.getByText("Assignment excused", { exact: true })).toHaveCount(0);
  const excusedCsv = await exportCsv();
  expect(excusedCsv).toContain(`Attempt 1,EXCUSED,${f.grade.grade}`);
  expect(excusedCsv).toContain(",,10,http://");
});
