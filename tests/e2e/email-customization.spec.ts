import { expect, type Page, test } from "@playwright/test";
import type { CommonsBrowserWire } from "../../src/client.ts";

async function signIn(page: Page, username = "mara") {
  for (const route of ["/login", "/", "/admin", "/notifications"]) await page.request.get(route);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill(username);
  await page.getByRole("textbox", { name: "Password" }).fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/");
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

test("an administrator previews/saves invitation copy and reads a redacted outbox on mobile", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await signIn(page);
  await page.goto("/admin");
  await page.getByRole("tab", { name: /^Email/ }).click();
  const subject = "Welcome to the email UI test";
  const body =
    "Hello class,\nBring your questions.\n\n<script>window.__emailScript = true</script>";
  await page.getByRole("textbox", { name: "Subject", exact: true }).fill(subject);
  await page.getByRole("textbox", { name: "Body", exact: true }).fill(body);
  // The preview follows the draft on its own; there is no button to press.
  const before = await post(page, "/mail/list");
  const preview = page.getByRole("region", { name: "Invitation preview" });
  await expect(preview).toContainText("EXAMPLE-PASSWORD");
  await expect(preview).toContainText(body);
  expect(await page.evaluate(() => Reflect.get(globalThis, "__emailScript"))).toBeUndefined();
  expect((await post(page, "/mail/list")).messages).toHaveLength(before.messages.length);
  await page.getByRole("button", { name: "Save wording", exact: true }).click();
  await expect(page.getByText("Invitation wording saved.", { exact: true })).toBeVisible();
  expect((await post(page, "/mail/template")).template).toEqual({ subject, body });

  await post(page, "/roster/import", {
    rows: [{ email: "email-ui-test@example.edu", kind: "STUDENT" }],
  });
  await expect
    .poll(async () =>
      (await post(page, "/mail/list")).messages.some(
        (m: { subject: string }) => m.subject === subject,
      ),
    )
    .toBe(true);
  let detailReads = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/mail/read")) detailReads += 1;
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search subject or recipient" })
    .fill("email-ui-test@example.edu");
  const open = page.getByRole("button", { name: `Read email: ${subject}`, exact: true });
  await expect(open).toBeVisible();
  expect(detailReads).toBe(0);
  await open.click();
  await expect(page.getByText("Temporary password: [hidden]", { exact: false })).toBeVisible();
  // React Strict Mode can repeat the mount read in development; neither read precedes opening.
  expect(detailReads).toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator("html").evaluate((el) => el.scrollWidth <= 391)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("email-outbox-mobile.png"), fullPage: true });

  await page.getByRole("button", { name: /Use Commons. wording/ }).click();
  await page.getByRole("button", { name: "Restore wording", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Subject", exact: true })).toHaveValue(
    "Your Commons invitation",
  );
  // The reset changes future invitations, not this queued message's snapshot.
  const retained = (await post(page, "/mail/list")).messages.find(
    (m: { recipient: string }) => m.recipient === "email-ui-test@example.edu",
  );
  expect(retained?.subject).toBe(subject);
});

test("a real forum reply shows discussion context and navigates directly; email carries its author and message", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  await signIn(page);
  const title = "Useful email discussion context";
  await post(page, "/roster/import", { rows: [{ email: "noah@example.edu", kind: "STUDENT" }] });
  const thread = await post(page, "/threads/create", {
    content: `# ${title}\n\nPRIVATE OPENING BODY`,
    holders: ["standing:everyone"],
  });
  const otherContext = await browser.newContext();
  const noah = await otherContext.newPage();
  await noah.goto(new URL("/login", page.url()).href);
  await noah.getByRole("textbox", { name: "Username" }).fill("noah");
  await noah.getByRole("textbox", { name: "Password" }).fill("password123");
  await noah.getByRole("button", { name: "Sign in", exact: true }).click();
  await noah.waitForURL("**/");
  const reply = await post(noah, "/threads/reply", {
    parent: thread.node,
    content: "PRIVATE REPLY BODY",
  });
  await otherContext.close();

  let placementReads = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/threads/forItem")) placementReads += 1;
  });
  await page.goto("/notifications");
  const notification = page.getByRole("link").filter({ hasText: title }).last();
  await expect(notification).toContainText("Noah Patel");
  await expect(notification).toContainText("replied to your post");
  expect(placementReads).toBe(0);
  await page.screenshot({
    path: testInfo.outputPath("discussion-notification.png"),
    fullPage: true,
  });
  await notification.click();
  await page.waitForURL(`**/t/${thread.conversation}#post-${reply.post}`);
  const mail = (await post(page, "/mail/list")).messages.find(
    (m: { subject: string }) => m.subject === `New reply to your post: ${title}`,
  );
  expect(mail).toBeTruthy();
  if (!mail) throw new Error("No email was queued for the reply");
  const detail = await post(page, "/mail/read", { message: mail.message });
  expect(detail.text).toContain(`Discussion: ${title}`);
  expect(detail.text).toContain("From: Noah Patel (@noah)");
  expect(detail.text).toContain("PRIVATE REPLY BODY");
  // The notified post is the reply, so the opening's body is not this message.
  expect(detail.text).not.toContain("PRIVATE OPENING BODY");
  expect(detail.text.endsWith(`/t/${thread.conversation}#post-${reply.post}`)).toBe(true);
});
