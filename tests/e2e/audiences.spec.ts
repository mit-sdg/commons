import { expect, type Page, test } from "@playwright/test";

async function signIn(page: Page, username: string) {
  // Compile routes before interaction so Next dev does not reload away a click.
  if (!process.env.CI && process.env.COMMONS_E2E_STANDALONE !== "1")
    for (const route of ["/login", "/", "/new", "/t/warmup", "/groups", "/groups/warmup"])
      await page.request.get(route);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill(username);
  await page.getByRole("textbox", { name: "Password" }).fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/");
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Account menu" })).toHaveCount(0);
}

test("private Staff preview, explicit recipient filter, and account switching", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const login = await request.post("/api/auth/login", {
    data: { username: "mara", password: "password123" },
  });
  const cookie = login.headers()["set-cookie"]!.split(";")[0]!;
  const imported = await request.post("/api/roster/import", {
    headers: { Cookie: cookie },
    data: {
      rows: [
        { email: "noah@example.edu", kind: "STUDENT" },
        { email: "priya@example.edu", kind: "STUDENT" },
      ],
    },
  });
  expect(imported.ok()).toBe(true);

  await signIn(page, "noah");
  await page.getByRole("link", { name: "Ask staff privately" }).click();
  await page.waitForURL("**/new?audience=staff");
  const audience = page.getByLabel("Audience", { exact: true });
  await expect(audience).toContainText("Staff");
  await expect(audience).toContainText("You");
  await expect(audience).not.toContainText("everyone in the course");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("A private Staff question");
  await page.locator("textarea").fill("Only my final audience should see this opening.");
  await page.getByRole("button", { name: "Post discussion" }).click();
  await page.waitForURL(/\/t\//);
  const privateUrl = page.url();
  await expect(page.getByRole("heading", { name: "A private Staff question" })).toBeVisible();
  await page.getByRole("link", { name: "New discussion", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("");
  await expect(page.locator("textarea")).toHaveValue("");
  await expect(audience).toContainText("everyone in the course");

  await signOut(page);
  await signIn(page, "mara");
  await page.getByRole("button", { name: "To Staff", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "A private Staff question", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Addressed to…", exact: true }).click();
  await page.getByRole("option", { name: "Staff Course audience", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "A private Staff question", exact: true }),
  ).toBeVisible();
  await page.goto(privateUrl);
  await expect(page.getByRole("heading", { name: "A private Staff question" })).toBeVisible();

  await signOut(page);
  await expect(
    page.getByText("Only my final audience should see this opening.", { exact: true }),
  ).toHaveCount(0);
  await signIn(page, "priya");
  await expect(page.getByRole("button", { name: "Addressed to…", exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "A private Staff question", exact: true }),
  ).toHaveCount(0);
  await page.goto(privateUrl);
  await expect(page.getByText("That item is not available.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Only my final audience should see this opening.", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "A private Staff question" })).toHaveCount(0);
});
