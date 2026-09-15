import { readFile } from "node:fs/promises";
import { type BrowserContext, expect, test } from "@playwright/test";
import { invitationCredential } from "../../src/concepts/inviting/credential.ts";

test("staff delegate persistent grading work and export a fresh scoped CSV", async ({
	browser,
}, testInfo) => {
	test.setTimeout(180_000);
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
		const staffIdentity = await call<{ user: string }>(
			staff,
			staffCookie,
			"/auth/me",
			{},
		);
		await call(staff, staffCookie, "/roster/import", {
			rows: [
				{ email: "noah@example.edu", kind: "STUDENT" },
				{ email: "priya@example.edu", kind: "STUDENT" },
			],
		});
		const noahCookie = await login(noah, "noah");
		const priyaCookie = await login(priya, "priya");
		const noahIdentity = await call<{ user: string }>(
			noah,
			noahCookie,
			"/auth/me",
			{},
		);
		const priyaIdentity = await call<{ user: string }>(
			priya,
			priyaCookie,
			"/auth/me",
			{},
		);

		const taEmail = "taylor.grader@example.edu";
		const issued = await call<{ invitation: string }>(
			staff,
			staffCookie,
			"/invitations/invite",
			{ email: taEmail },
		);
		const credential = invitationCredential(issued.invitation);
		const ta = await call<{ user: string }>(
			staff,
			staffCookie,
			"/auth/accept-invitation",
			{
				invitation: issued.invitation,
				temporaryPassword: credential,
				username: "taylor_grader",
				password: "password123",
				displayName: "Taylor Grader",
			},
		);
		const defined = await call<{ role: string }>(
			staff,
			staffCookie,
			"/roles/define",
			{ name: "Delegation reviewer", capabilities: ["grade"] },
		);
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

		const assignmentInput = {
			title: "Problem Set 1: Concept Design",
			instructions: "Submit a concise review.",
			kind: "EXERCISE",
			availableAt: "2026-09-01T12:00:00Z",
			dueAt: "2026-09-14T12:00:00Z",
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
		await call(staff, staffCookie, "/assignments/publish", {
			assignment: created.assignment,
		});
		await call(noah, noahCookie, "/late-days/apply", {
			assignment: created.assignment,
			days: 1,
		});
		await call(noah, noahCookie, "/assignments/submit", {
			assignment: created.assignment,
			content: "Noah's first attempt",
		});
		await call(priya, priyaCookie, "/assignments/submit", {
			assignment: created.assignment,
			content: "Priya's submission",
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
		await expect(
			page.getByText("Showing 2 of 2 learners", { exact: true }),
		).toBeVisible();

		const priyaGrader = page.getByRole("combobox", {
			name: "Grader for Priya Sharma",
		});
		await priyaGrader.click();
		await page.getByRole("option", { name: "Mara Chen (@mara)" }).click();
		const manualFeedback = page.getByText("Priya Sharma assigned to Mara Chen");
		await expect(manualFeedback).toBeVisible();

		const filter = page.getByRole("combobox", { name: "Grader scope" });
		await filter.click();
		await page.getByRole("option", { name: "Unassigned", exact: true }).click();
		await expect(
			page.getByText("Showing 1 of 2 learners", { exact: true }),
		).toBeVisible();
		await expect(page.getByText("Assigned to", { exact: true })).toHaveCount(0);
		await expect(page.getByText("Noah Patel", { exact: true })).toBeVisible();
		await expect(page.getByText("Priya Sharma", { exact: true })).toHaveCount(
			0,
		);
		await expect(manualFeedback).toBeHidden({ timeout: 10_000 });

		await page.getByRole("button", { name: "Assign in bulk…" }).click();
		const dialog = page.getByRole("dialog", { name: "Assign graders in bulk" });
		await dialog.getByText("All learners (2)", { exact: true }).click();
		await expect(
			dialog.getByText("existing ownership will be preserved", {
				exact: false,
			}),
		).toBeVisible();
		await page.screenshot({
			path: "test-results/grading-delegation-bulk-dialog-desktop.png",
			fullPage: true,
		});
		await dialog.getByRole("button", { name: "Assign unassigned" }).click();
		const bulkFeedback = page.getByText(
			"1 learner assigned; 1 kept their current grader",
		);
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
			]),
		);

		await filter.click();
		await page
			.getByRole("option", { name: "Assigned to me", exact: true })
			.click();
		await expect(
			page.getByText("Showing 1 of 2 learners", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("Assigned to you", { exact: true }),
		).toBeVisible();
		await expect(page.getByText("Priya Sharma", { exact: true })).toBeVisible();
		await expect(page.getByText("Noah Patel", { exact: true })).toHaveCount(0);

		await filter.click();
		await page
			.getByRole("option", { name: "Taylor Grader (@taylor_grader)" })
			.click();
		await expect(
			page.getByText("Assigned to Taylor Grader", { exact: true }),
		).toBeVisible();
		await expect(page.getByText("Noah Patel", { exact: true })).toBeVisible();
		await expect(page.getByText("Priya Sharma", { exact: true })).toHaveCount(
			0,
		);

		const second = await call<{ submission: string }>(
			noah,
			noahCookie,
			"/assignments/submit",
			{
				assignment: created.assignment,
				content: "Noah's fresh resubmission",
			},
		);
		const revisedDue = "2026-09-16T12:00:00Z";
		await call(staff, staffCookie, "/assignments/revise", {
			assignment: created.assignment,
			...assignmentInput,
			title: "Problem Set 1: Concept Design — revised",
			dueAt: revisedDue,
		});
		await page.getByRole("button", { name: "Refresh", exact: true }).click();
		await expect(page.getByText("2 attempts", { exact: true })).toBeVisible();
		await expect(page.getByText("1 late day", { exact: true })).toBeVisible();
		await expect(bulkFeedback).toBeHidden({ timeout: 10_000 });

		await page.screenshot({
			path: "test-results/grading-delegation-desktop.png",
			fullPage: true,
		});
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
		expect(csv).toContain("2026-09-16T12:00:00.000Z");
		expect(csv).toContain("Taylor Grader");
		expect(csv).not.toContain("priya@example.edu");
		const exportFeedback = page.getByText("1 learner exported");
		await expect(exportFeedback).toBeVisible();
		await expect(exportFeedback).toBeHidden({ timeout: 10_000 });

		await page.setViewportSize({ width: 390, height: 844 });
		await page.screenshot({
			path: "test-results/grading-delegation-mobile.png",
			fullPage: true,
		});
		await expect(
			page.getByRole("button", { name: "Export current view" }),
		).toBeVisible();
	} finally {
		await Promise.all([staff.close(), noah.close(), priya.close()]);
	}
});
