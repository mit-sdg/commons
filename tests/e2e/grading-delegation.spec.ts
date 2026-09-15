import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type BrowserContext, expect, test } from "@playwright/test";
import { invitationCredential } from "../../src/concepts/inviting/credential.ts";

const shots =
  process.env.DELEGATION_SCREENSHOT_DIR ?? resolve(import.meta.dirname, "../../test-results");

function csvRow(csv: string, email: string): Record<string, string> {
  const [header = "", ...lines] = csv.trimEnd().split("\r\n");
  const columns = header.split(",");
  const values = lines.find((line) => line.split(",")[2] === email)?.split(",");
  expect(values, `CSV row for ${email}`).toBeDefined();
  return Object.fromEntries(columns.map((column, index) => [column, values?.[index] ?? ""]));
}

test("staff delegate persistent grading work and export a fresh scoped CSV", async ({
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  await mkdir(shots, { recursive: true });
  const origin = String(testInfo.project.use.baseURL);
  const staff = await browser.newContext();
  const noah = await browser.newContext();
  const priya = await browser.newContext();

  async function login(context: BrowserContext, username: string) {
    const response = await context.request.post(`${origin}/api/auth/login`, {
      data: { username, password: "password123" },
    });
    expect(response.ok()).toBe(true);
    const cookie = response.headers()["set-cookie"]?.split(";")[0];
    expect(cookie).toBeTruthy();
    if (!cookie) throw new Error(`No session cookie returned for ${username}`);
    return cookie;
  }

  async function call<T>(
    context: BrowserContext,
    cookie: string,
    path: string,
    data: unknown,
  ): Promise<T> {
    const response = await context.request.post(`${origin}/api${path}`, {
      headers: { Cookie: cookie },
      data,
    });
    const result = await response.json();
    expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBe(true);
    expect(result, path).not.toHaveProperty("error");
    return result as T;
  }

  try {
    const staffCookie = await login(staff, "mara");
    const staffIdentity = await call<{ user: string }>(staff, staffCookie, "/auth/me", {});
    const aminaEmail = "amina.export@example.edu";
    const aminaInvitation = await call<{ invitation: string }>(
      staff,
      staffCookie,
      "/invitations/invite",
      { email: aminaEmail },
    );
    const amina = await call<{ user: string }>(staff, staffCookie, "/auth/accept-invitation", {
      invitation: aminaInvitation.invitation,
      temporaryPassword: invitationCredential(aminaInvitation.invitation),
      username: "amina_export",
      password: "password123",
      displayName: "Amina Okafor",
    });
    await call(staff, staffCookie, "/roster/import", {
      rows: [
        { email: "noah@example.edu", kind: "STUDENT" },
        { email: "priya@example.edu", kind: "STUDENT" },
        { email: aminaEmail, kind: "STUDENT" },
      ],
    });
    const noahCookie = await login(noah, "noah");
    const priyaCookie = await login(priya, "priya");
    const noahIdentity = await call<{ user: string }>(noah, noahCookie, "/auth/me", {});
    const priyaIdentity = await call<{ user: string }>(priya, priyaCookie, "/auth/me", {});

    const taEmail = "taylor.grader@example.edu";
    const issued = await call<{ invitation: string }>(staff, staffCookie, "/invitations/invite", {
      email: taEmail,
    });
    const credential = invitationCredential(issued.invitation);
    const ta = await call<{ user: string }>(staff, staffCookie, "/auth/accept-invitation", {
      invitation: issued.invitation,
      temporaryPassword: credential,
      username: "taylor_grader",
      password: "password123",
      displayName: "Taylor Grader",
    });
    const defined = await call<{ role: string }>(staff, staffCookie, "/roles/define", {
      name: "Delegation reviewer",
      capabilities: ["grade"],
    });
    await call(staff, staffCookie, "/roles/assign", {
      user: ta.user,
      context: "commons",
      role: defined.role,
    });
    await call(staff, staffCookie, "/late-days/configure-policy", {
      defaultDays: 2,
      maxDaysPerItem: 5,
      unitHours: 24,
    });

    const now = Date.now();
    const assignmentInput = {
      title: "Problem Set 1: Concept Design",
      instructions: "Submit a concise review.",
      kind: "EXERCISE",
      availableAt: new Date(now - 7 * 86_400_000).toISOString(),
      dueAt: new Date(now - 2 * 86_400_000).toISOString(),
      acceptsSubmissions: true,
      audience: "EVERYONE",
      targets: [],
    };
    const created = await call<{ assignment: string }>(
      staff,
      staffCookie,
      "/assignments/create-draft",
      assignmentInput,
    );
    const grading = await call<{ generation: number }>(
      staff,
      staffCookie,
      "/grades/configure-method",
      {
        item: created.assignment,
        method: "POINTS",
        maxPoints: 10,
        generation: 0,
        discard: false,
      },
    );
    await call(staff, staffCookie, "/assignments/publish", {
      assignment: created.assignment,
    });
    await call(noah, noahCookie, "/late-days/apply", {
      assignment: created.assignment,
      days: 1,
    });
    const noahFirst = await call<{ submission: string }>(noah, noahCookie, "/assignments/submit", {
      assignment: created.assignment,
      content: "Noah's first attempt",
    });
    const priyaFirst = await call<{ submission: string }>(
      priya,
      priyaCookie,
      "/assignments/submit",
      {
        assignment: created.assignment,
        content: "Priya's submission",
      },
    );
    const noahDraft = await call<{ mark: string; version: number }>(
      staff,
      staffCookie,
      "/marks/record",
      {
        learner: noahIdentity.user,
        item: created.assignment,
        evidence: noahFirst.submission,
        score: 8.5,
        feedback: "Clear reasoning.",
        generation: grading.generation,
        version: 0,
      },
    );
    await call(staff, staffCookie, "/marks/release", {
      mark: noahDraft.mark,
      version: noahDraft.version,
    });
    const priyaDraft = await call<{ mark: string }>(staff, staffCookie, "/marks/record", {
      learner: priyaIdentity.user,
      item: created.assignment,
      evidence: priyaFirst.submission,
      score: 0,
      feedback: "Draft feedback.",
      generation: grading.generation,
      version: 0,
    });
    const aminaExcusal = await call<{ mark: string }>(staff, staffCookie, "/marks/excuse", {
      learner: amina.user,
      item: created.assignment,
      evidence: "",
      feedback: "Excused from this assignment.",
      generation: grading.generation,
      mark: "",
      version: 0,
    });
    await call(staff, staffCookie, "/delegation/set", {
      item: created.assignment,
      learner: amina.user,
      grader: staffIdentity.user,
    });

    const page = await staff.newPage();
    await page.route("**/api/**", async (route) => {
      const response = await route.fetch({
        maxRetries: 2,
        headers: { ...route.request().headers(), cookie: staffCookie },
      });
      await route.fulfill({ response });
    });
    await page.goto(`${origin}/staff/assignments/${created.assignment}`);
    await page.getByRole("tab", { name: "Submissions", exact: true }).click();
    await expect(page.getByText("3 of 3 learners shown", { exact: true })).toBeVisible();

    const priyaGrader = page.getByRole("combobox", {
      name: "Grader for Priya Sharma",
    });
    await priyaGrader.click();
    await page.getByRole("option", { name: "Mara Chen (@mara)" }).click();
    const manualFeedback = page.getByText("Priya Sharma assigned to Mara Chen");
    await expect(manualFeedback).toBeVisible();

    const filter = page.getByRole("combobox", { name: "Show learners" });
    await filter.click();
    await page.getByRole("option", { name: "Unassigned", exact: true }).click();
    await expect(page.getByText("1 of 3 learners shown", { exact: true })).toBeVisible();
    await expect(page.getByText("Assigned to", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Noah Patel", { exact: true })).toBeVisible();
    await expect(page.getByText("Priya Sharma", { exact: true })).toHaveCount(0);
    await expect(manualFeedback).toBeHidden({ timeout: 10_000 });

    await page.getByRole("button", { name: "Assign graders…" }).click();
    const dialog = page.getByRole("dialog", { name: "Assign graders" });
    await dialog.getByText("All learners (3)", { exact: true }).click();
    await expect(
      dialog.getByText("Existing assignments stay unchanged", {
        exact: false,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: resolve(shots, "grading-delegation-bulk-dialog-desktop.png"),
      fullPage: false,
      animations: "disabled",
    });
    await dialog.getByRole("button", { name: "Assign unassigned" }).click();
    const bulkFeedback = page.getByText("1 learner assigned; 2 kept their current grader");
    await expect(bulkFeedback).toBeVisible();

    const delegation = await call<{
      delegations: { learner: string; grader: string }[];
    }>(staff, staffCookie, "/delegation/for-item", {
      item: created.assignment,
    });
    expect(delegation.delegations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          learner: priyaIdentity.user,
          grader: staffIdentity.user,
        }),
        expect.objectContaining({
          learner: noahIdentity.user,
          grader: ta.user,
        }),
        expect.objectContaining({
          learner: amina.user,
          grader: staffIdentity.user,
        }),
      ]),
    );

    await filter.click();
    await page.getByRole("option", { name: "All learners", exact: true }).click();
    await expect(page.getByText("3 of 3 learners shown", { exact: true })).toBeVisible();
    const initialDownloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export current view" }).click();
    const initialDownload = await initialDownloadEvent;
    const initialDownloadPath = await initialDownload.path();
    expect(initialDownloadPath).toBeTruthy();
    if (!initialDownloadPath) throw new Error("The initial CSV download has no local path");
    const initialCsv = await readFile(initialDownloadPath, "utf8");
    expect(initialCsv).not.toContain("Grading generation");
    expect(csvRow(initialCsv, "noah@example.edu")).toMatchObject({
      "Grading method": "Points",
      "Grade scope": "Attempt 1",
      "Grade status": "RELEASED",
      "Grade ID": noahDraft.mark,
      Score: "8.5",
      "Maximum points": "10",
    });
    expect(csvRow(initialCsv, "priya@example.edu")).toMatchObject({
      "Grade scope": "Attempt 1",
      "Grade status": "DRAFT",
      "Grade ID": priyaDraft.mark,
      Score: "0",
      "Maximum points": "10",
    });
    expect(csvRow(initialCsv, aminaEmail)).toMatchObject({
      "Submission status": "Missing",
      "Grade scope": "Assignment excusal",
      "Grade status": "EXCUSED",
      "Grade ID": aminaExcusal.mark,
      Score: "",
      "Maximum points": "10",
    });
    const initialExportFeedback = page.getByText("3 learners exported");
    await expect(initialExportFeedback).toBeVisible();
    await expect(initialExportFeedback).toBeHidden({ timeout: 10_000 });

    await filter.click();
    await page.getByRole("option", { name: "Assigned to me", exact: true }).click();
    await expect(page.getByText("2 of 3 learners shown", { exact: true })).toBeVisible();
    await expect(page.getByText("Assigned to you", { exact: true })).toBeVisible();
    await expect(page.getByText("Priya Sharma", { exact: true })).toBeVisible();
    await expect(page.getByText("Amina Okafor", { exact: true })).toBeVisible();
    await expect(page.getByText("Noah Patel", { exact: true })).toHaveCount(0);

    await filter.click();
    await page.getByRole("option", { name: "Taylor Grader (@taylor_grader)" }).click();
    await expect(page.getByText("Assigned to Taylor Grader", { exact: true })).toBeVisible();
    await expect(page.getByText("Noah Patel", { exact: true })).toBeVisible();
    await expect(page.getByText("Priya Sharma", { exact: true })).toHaveCount(0);
    const releaseAll = page.getByRole("button", {
      name: "Release all drafts (1)",
    });
    await releaseAll.click();
    const releaseDialog = page.getByRole("dialog", {
      name: "Release all complete point grade drafts for this assignment?",
    });
    await expect(
      releaseDialog.getByText("1 draft is outside the current scope", {
        exact: false,
      }),
    ).toBeVisible();
    await releaseDialog.getByRole("button", { name: "Cancel" }).click();

    await filter.click();
    await page.getByRole("option", { name: "All learners", exact: true }).click();
    const priyaRow = page
      .getByText("Priya Sharma", { exact: true })
      .locator(
        "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' rounded-lg ')][1]",
      );
    await priyaRow.getByRole("button", { name: "Review grades" }).click();
    const dirtyScore = priyaRow.getByRole("spinbutton", { name: "Score / 10" });
    await dirtyScore.fill("9.25");

    const second = await call<{ submission: string }>(noah, noahCookie, "/assignments/submit", {
      assignment: created.assignment,
      content: "Noah's fresh resubmission",
    });
    const revisedDue = new Date(now + 3 * 86_400_000).toISOString();
    const revisedTitle = "Problem Set 1: Concept Design — revised";
    await call(staff, staffCookie, "/assignments/revise", {
      assignment: created.assignment,
      ...assignmentInput,
      title: revisedTitle,
      dueAt: revisedDue,
    });
    await page.route(
      "**/api/assignments/staff-summary",
      (route) => route.abort("connectionfailed"),
      { times: 1 },
    );
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    const staleDetails = page.getByText("Assignment details may be out of date.", {
      exact: false,
    });
    await expect(staleDetails).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: assignmentInput.title }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: revisedTitle })).toHaveCount(0);
    await expect(dirtyScore).toHaveValue("9.25");
    await page.getByRole("button", { name: "Retry details" }).click();
    const revisedHeading = page.getByRole("heading", { level: 1, name: revisedTitle });
    await expect(revisedHeading).toBeVisible();
    await expect(
      revisedHeading.locator("xpath=../..").locator(`time[datetime="${revisedDue}"]`),
    ).toBeVisible();
    await expect(staleDetails).toHaveCount(0);
    await expect(dirtyScore).toHaveValue("9.25");
    await expect(page.getByText("2 attempts", { exact: true })).toBeVisible();
    await expect(page.getByText("1 late day", { exact: true })).toBeVisible();
    await expect(bulkFeedback).toBeHidden({ timeout: 10_000 });

    await page.reload();
    await page.getByRole("tab", { name: "Submissions", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: revisedTitle })).toBeVisible();
    await expect(page.getByText("3 of 3 learners shown", { exact: true })).toBeVisible();
    await page.screenshot({
      path: resolve(shots, "grading-delegation-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });

    await filter.click();
    await page.getByRole("option", { name: "Taylor Grader (@taylor_grader)" }).click();
    await expect(page.getByText("1 of 3 learners shown", { exact: true })).toBeVisible();
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export current view" }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(
      "problem-set-1-concept-design-revised-submissions.csv",
    );
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    if (!downloadPath) throw new Error("The CSV download has no local path");
    const csv = await readFile(downloadPath, "utf8");
    expect(csv).toContain("\r\n");
    expect(csv).toContain("noah@example.edu");
    expect(csv).toContain(second.submission);
    expect(csv).toContain(new Date(revisedDue).toISOString());
    expect(csv).toContain("Taylor Grader");
    expect(csv).not.toContain("priya@example.edu");
    expect(csvRow(csv, "noah@example.edu")).toMatchObject({
      "Grading method": "Points",
      "Submission ID": second.submission,
      "Grade scope": "",
      "Grade status": "",
      "Grade ID": "",
      Score: "",
      "Maximum points": "10",
    });
    expect(csv).not.toContain(noahDraft.mark);
    const exportFeedback = page.getByText("1 learner exported");
    await expect(exportFeedback).toBeVisible();
    await expect(exportFeedback).toBeHidden({ timeout: 10_000 });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: resolve(shots, "grading-delegation-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    await expect(page.getByRole("button", { name: "Export current view" })).toBeVisible();
  } finally {
    await Promise.all([staff.close(), noah.close(), priya.close()]);
  }
});
