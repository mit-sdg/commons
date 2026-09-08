import { expect, type Page, test } from "@playwright/test";

async function signIn(page: Page, username: string) {
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
  await page.getByRole("link", { name: "Ask Staff privately" }).click();
  const audience = page.getByRole("list", { name: "Audience", exact: true });
  await expect(audience).toContainText("Staff");
  await expect(audience).toContainText("noah");
  await expect(audience).not.toContainText("Everyone");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("A private Staff question");
  await page.locator("textarea").fill("Only my final audience should see this opening.");
  await page.getByRole("button", { name: "Post discussion" }).click();
  await page.waitForURL(/\/t\//);
  const privateUrl = page.url();
  await expect(page.getByRole("heading", { name: "A private Staff question" })).toBeVisible();
  await page.getByRole("link", { name: "Continue with other people" }).click();
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("");
  await expect(page.locator("textarea")).toHaveValue("");
  await expect(audience).toContainText("Everyone");

  await signOut(page);
  await signIn(page, "mara");
  await page.getByRole("button", { name: "Staff questions", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "A private Staff question", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Addressed to", { exact: true }).selectOption("standing:staff");
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
  await expect(page.getByLabel("Addressed to", { exact: true })).toHaveValue("");
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

test("opening trash, restore and purge preserve nested replies, feed and following", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const accounts = await Promise.all(
    ["mara", "noah", "priya"].map(async (username) => {
      const context = await browser.newContext({ baseURL: "http://127.0.0.1:3755" });
      const login = await context.request.post("/api/auth/login", {
        data: { username, password: "password123" },
      });
      const cookie = login.headers()["set-cookie"]!.split(";")[0]!;
      const call = async (path: string, data: unknown) => {
        const response = await context.request.post(`/api${path}`, {
          headers: { Cookie: cookie },
          data,
        });
        const result = await response.json();
        expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBe(true);
        return result;
      };
      return { context, call, identity: await call("/auth/me", {}), page: await context.newPage() };
    }),
  );
  const [mara, noah, priya] = accounts;
  try {
    await mara.call("/roster/import", {
      rows: [
        { email: "noah@example.edu", kind: "STUDENT" },
        { email: "priya@example.edu", kind: "STUDENT" },
      ],
    });
    const root = await noah.call("/threads/create", {
      content: "# Survivor discussion\n\nSECRET opening text",
      holders: [`account:${noah.identity.user}`, `account:${mara.identity.user}`],
    });
    const middle = await mara.call("/threads/reply", {
      parent: root.node,
      content: "SECRET intermediate text",
    });
    const leaf = await noah.call("/threads/reply", {
      parent: middle.node,
      content: "A surviving nested reply",
    });
    const url = `/t/${root.conversation}#post-${leaf.post}`;
    await noah.page.goto(url);
    await expect(noah.page.getByText("A surviving nested reply", { exact: true })).toBeVisible();
    await expect(noah.page.getByRole("button", { name: "Following", exact: true })).toBeVisible();
    await noah.page.route("**/api/threads/reply", (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "FORBIDDEN" }),
      }),
    );
    const mainDraft = noah.page.getByPlaceholder("Write your reply… Markdown supported.");
    await mainDraft.fill("Keep this main reply after refusal");
    await noah.page.getByRole("button", { name: "Post reply", exact: true }).click();
    await expect(
      noah.page.getByText("You do not have permission to do that.", { exact: true }),
    ).toBeVisible();
    await expect(mainDraft).toHaveValue("Keep this main reply after refusal");
    await noah.page
      .locator(`#post-${leaf.post}`)
      .getByRole("button", { name: "Reply", exact: true })
      .click();
    const nestedDraft = noah.page.getByPlaceholder("Write a reply…");
    await nestedDraft.fill("Keep this nested reply after refusal");
    const refused = noah.page.waitForResponse((response) =>
      response.url().endsWith("/api/threads/reply"),
    );
    const nestedSubmit = noah.page
      .locator(`#post-${leaf.post}`)
      .getByRole("button", { name: "Post reply", exact: true });
    await nestedSubmit.click();
    await refused;
    await expect(nestedSubmit).toBeEnabled();
    await expect(nestedDraft).toHaveValue("Keep this nested reply after refusal");
    await noah.page.unroute("**/api/threads/reply");
    await mara.call("/trash/trash", { item: root.post });
    await mara.call("/trash/trash", { item: middle.post });
    for (const purged of [false, true]) {
      if (purged) {
        await mara.call("/trash/restore", { item: root.post });
        await noah.page.goto(url);
        await noah.page.reload();
        await expect(
          noah.page.getByRole("heading", { name: "Survivor discussion", exact: true }),
        ).toBeVisible();
        await mara.call("/trash/trash", { item: root.post });
        await mara.call("/trash/purge", { item: root.post });
        await mara.call("/trash/purge", { item: middle.post });
      }
      await noah.page.goto(url);
      await noah.page.reload();
      await expect(
        noah.page.getByRole("heading", { name: "Opening post unavailable", exact: true }),
      ).toBeVisible();
      await expect(noah.page.getByText("SECRET opening text", { exact: true })).toHaveCount(0);
      await expect(noah.page.getByText("SECRET intermediate text", { exact: true })).toHaveCount(0);
      await expect(noah.page.locator(`#post-${middle.post}`)).toHaveText("Post unavailable");
      const middleBranch = noah.page.locator(`#post-${middle.post}`).locator("../..");
      await expect(
        middleBranch.getByText("A surviving nested reply", { exact: true }),
      ).toBeVisible();
      for (const path of ["/", "/subscriptions"]) {
        await noah.page.goto(path);
        await expect(noah.page.locator(`a[href="/t/${root.conversation}"]`)).toHaveText(
          "Opening post unavailable",
        );
      }
      await priya.page.goto(url);
      await expect(
        priya.page.getByText("That item is not available.", { exact: true }),
      ).toBeVisible();
      await expect(priya.page.getByText("A surviving nested reply", { exact: true })).toHaveCount(
        0,
      );
    }
  } finally {
    for (const account of accounts) await account.context.close();
  }
});
