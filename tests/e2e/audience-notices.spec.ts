import { expect, type Page, test } from "@playwright/test";
import type { CommonsBrowserWire } from "../../src/client.ts";

async function signIn(page: Page, username: string) {
  // Compile routes before interaction so Next dev does not reload away a click.
  for (const route of ["/login", "/", "/new", "/admin", "/notifications", "/t/warmup"])
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

async function post<P extends keyof CommonsBrowserWire>(
  page: Page,
  path: P,
  input: Record<string, unknown> = {},
): Promise<CommonsBrowserWire[P]["output"]> {
  return (await page.evaluate(
    async ({ path, input }) => {
      const response = await fetch(`/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return response.json();
    },
    { path, input },
  )) as CommonsBrowserWire[P]["output"];
}

const BODY = "The second bench is broken; use bench three on Thursday.";

test("staff notify a discussion audience once, with the post itself", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await signIn(page, "mara");
  await post(page, "/roster/import", {
    rows: [
      { email: "noah@example.edu", kind: "STUDENT" },
      { email: "priya@example.edu", kind: "STUDENT" },
    ],
  });

  await page.goto("/new");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Thursday lab bench change");
  await page.locator("textarea").fill(BODY);
  await page.getByRole("button", { name: "Post discussion", exact: true }).click();
  await page.waitForURL(/\/t\//);
  const discussion = page.url();
  const before = await post(page, "/mail/list");

  const notify = page.getByRole("button", { name: "Notify audience", exact: true });
  await expect(notify).toBeVisible();
  await notify.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("2 people");
  await expect(dialog).toContainText("The author is not notified");
  await page.screenshot({ path: testInfo.outputPath("notify-audience-dialog.png") });
  await dialog.getByRole("button", { name: "Notify 2 people", exact: true }).click();

  // A notified post says so, and offers no second send.
  await expect(page.getByText("Audience notified", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Notify audience", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Audience notified", { exact: true })).toBeVisible();

  // The email carries the post, not a bare event line.
  await expect
    .poll(
      async () =>
        (await post(page, "/mail/list")).messages.filter(
          (message: { recipient: string }) =>
            message.recipient === "noah@example.edu" || message.recipient === "priya@example.edu",
        ).length,
    )
    .toBe(before.messages.length + 2);
  await page.goto("/admin");
  await page.getByRole("tab", { name: /^Email/ }).click();
  await page
    .getByRole("searchbox", { name: "Search subject or recipient" })
    .fill("noah@example.edu");
  await page
    .getByRole("button", {
      name: "Read email: Staff shared a post with the discussion audience: Thursday lab bench change",
      exact: true,
    })
    .click();
  await expect(page.getByText(BODY, { exact: false })).toBeVisible();
  await expect(page.getByText("From: Mara", { exact: false })).toBeVisible();

  // The recipient sees it in the inbox, with the post and a direct link.
  await signOut(page);
  await signIn(page, "noah");
  await page.goto("/notifications");
  await expect(
    page.getByText("Staff shared this post with the discussion audience", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(BODY, { exact: false })).toBeVisible();

  // A reader who is not staff is offered no send and learns no notice state.
  await page.goto(discussion);
  await expect(page.getByRole("button", { name: "Notify audience", exact: true })).toHaveCount(0);
  await expect(page.getByText("Audience notified", { exact: true })).toHaveCount(0);
});

test("post and notify confirms on the reply it just created", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, "mara");
  await post(page, "/roster/import", {
    rows: [
      { email: "noah@example.edu", kind: "STUDENT" },
      { email: "priya@example.edu", kind: "STUDENT" },
    ],
  });

  await page.goto("/new");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Office hours move");
  await page.locator("textarea").fill("Where should we meet?");
  await page.getByRole("button", { name: "Post discussion", exact: true }).click();
  await page.waitForURL(/\/t\//);

  const reply = "We are in room 2-105 for the rest of term.";
  await page.getByPlaceholder("Write your reply… Markdown supported.").fill(reply);
  await page.getByRole("button", { name: "More ways to post", exact: true }).click();
  await page.getByRole("menuitem", { name: "Post and notify", exact: true }).click();

  // The confirmation is about the reply that was just posted, not a guess.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("2 people");
  await dialog.getByRole("button", { name: "Notify 2 people", exact: true }).click();
  await expect(page.getByText(reply, { exact: false })).toBeVisible();
  await expect(page.getByText("Audience notified", { exact: true })).toHaveCount(1);
  // The opening post was not notified, so it still offers the send.
  await expect(page.getByRole("button", { name: "Notify audience", exact: true })).toHaveCount(1);
});
