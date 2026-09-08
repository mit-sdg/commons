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
  await page.getByRole("link", { name: "Start a discussion with other people" }).click();
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

test("shared group management explains and changes access to earlier discussions", async ({
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const authorContext = await browser.newContext({ baseURL: "http://127.0.0.1:3755" });
  const recipientContext = await browser.newContext({ baseURL: "http://127.0.0.1:3755" });
  const author = await authorContext.newPage();
  const recipient = await recipientContext.newPage();
  try {
    const adminLogin = await authorContext.request.post("/api/auth/login", {
      data: { username: "mara", password: "password123" },
    });
    const adminCookie = adminLogin.headers()["set-cookie"]!.split(";")[0]!;
    const enrolled = await authorContext.request.post("/api/roster/import", {
      headers: { Cookie: adminCookie },
      data: {
        rows: [
          { email: "noah@example.edu", kind: "STUDENT" },
          { email: "priya@example.edu", kind: "STUDENT" },
        ],
      },
    });
    expect(enrolled.ok()).toBe(true);
    await signIn(author, "noah");
    await signIn(recipient, "priya");
    // Compile these routes before drafting: Next dev may reload other open tabs
    // when it first builds a route. Production has no such compilation reload.
    for (const route of ["/new", "/tasks", "/tasks/warmup"]) {
      await authorContext.request.get(route);
    }
    await author.goto("/new");
    await author
      .getByRole("textbox", { name: "Title", exact: true })
      .fill("Earlier group discussion");
    await author.locator("textarea").fill("This draft survives a visit to group management.");
    const popup = author.waitForEvent("popup");
    await author.getByRole("link", { name: "Create or manage groups in Tasks (new tab)" }).click();
    const management = await popup;
    await management.getByRole("button", { name: "New list", exact: true }).click();
    const create = management.getByRole("dialog");
    await expect(create).toContainText("Its members share this task list");
    await create.getByLabel("Title (optional)", { exact: true }).fill("UI shared group");
    await create.getByRole("button", { name: "Create list", exact: true }).click();
    await management.waitForURL(/\/tasks\//);
    await expect(
      management.getByText("This task list and its discussion group share the members below.", {
        exact: false,
      }),
    ).toBeVisible();
    await author.bringToFront();
    await author.getByRole("button", { name: "Refresh audiences", exact: true }).click();
    await expect(author.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(
      "Earlier group discussion",
    );
    await author.getByRole("checkbox", { name: "UI shared group Group", exact: true }).check();
    await expect(author.locator("textarea")).toHaveValue(
      "This draft survives a visit to group management.",
    );
    await expect(author.getByRole("list", { name: "Audience", exact: true })).toContainText(
      "UI shared group",
    );
    await expect(author.getByRole("list", { name: "Audience", exact: true })).not.toContainText(
      "Everyone",
    );
    await author.setViewportSize({ width: 390, height: 844 });
    await author.screenshot({
      path: testInfo.outputPath("shared-group-composer-mobile.png"),
      fullPage: true,
    });
    await author.getByRole("button", { name: "Post discussion", exact: true }).click();
    await author.waitForURL(/\/t\//);
    const discussionUrl = author.url();
    await expect(
      author.getByText("New members can read earlier posts in this discussion.", { exact: false }),
    ).toBeVisible();
    await recipient.goto(discussionUrl);
    await expect(recipient.getByText("That item is not available.", { exact: true })).toBeVisible();
    await management.bringToFront();
    await management.getByRole("button", { name: "Add member", exact: true }).click();
    const add = management.getByRole("dialog");
    await expect(add).toContainText("New members can read earlier and future discussions");
    await add.getByPlaceholder("Search by name or username").fill("priya");
    await add.getByRole("button", { name: "Find", exact: true }).click();
    await add.getByRole("button", { name: /Priya/ }).click();
    await management.screenshot({
      path: testInfo.outputPath("shared-group-add-member.png"),
      fullPage: true,
    });
    await add.getByRole("button", { name: "Add to list", exact: true }).click();
    await expect(add).toHaveCount(0);
    await recipient.reload();
    await expect(
      recipient.getByRole("heading", { name: "Earlier group discussion", exact: true }),
    ).toBeVisible();
    await management.getByRole("button", { name: /^Remove Priya/ }).click();
    const remove = management.getByRole("dialog");
    await expect(remove).toContainText(
      "another audience on a discussion may still give them access",
    );
    await remove.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(remove).toHaveCount(0);
    await recipient.reload();
    await expect(recipient.getByText("That item is not available.", { exact: true })).toBeVisible();
    await expect(
      recipient.getByText("This draft survives a visit to group management.", { exact: true }),
    ).toHaveCount(0);
  } finally {
    await authorContext.close();
    await recipientContext.close();
  }
});
