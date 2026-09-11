import { expect, test } from "@playwright/test";

test("deleting a private topic with replies explains the refusal without losing posts", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const staffLogin = await request.post("/api/auth/login", {
    data: { username: "mara", password: "password123" },
  });
  expect(staffLogin.ok()).toBe(true);
  const staffHeaders = { Cookie: staffLogin.headers()["set-cookie"]!.split(";")[0]! };
  const enrolled = await request.post("/api/roster/import", {
    headers: staffHeaders,
    data: { rows: [{ email: "noah@example.edu", kind: "STUDENT" }] },
  });
  expect(enrolled.ok()).toBe(true);
  const staff = await (
    await request.post("/api/auth/me", { headers: staffHeaders, data: {} })
  ).json();
  const authorLogin = await page.request.post("/api/auth/login", {
    data: { username: "noah", password: "password123" },
  });
  expect(authorLogin.ok()).toBe(true);
  const authorHeaders = { Cookie: authorLogin.headers()["set-cookie"]!.split(";")[0]! };
  const author = await (
    await page.request.post("/api/auth/me", { headers: authorHeaders, data: {} })
  ).json();
  const created = await page.request.post("/api/threads/create", {
    headers: authorHeaders,
    data: {
      content: "# Private deletion regression\n\nKeep this opening post.",
      holders: [`account:${author.user}`, `account:${staff.user}`],
    },
  });
  expect(created.ok()).toBe(true);
  const root = await created.json();
  const replied = await request.post("/api/threads/reply", {
    headers: staffHeaders,
    data: { parent: root.node, content: "Keep this other person's reply." },
  });
  expect(replied.ok()).toBe(true);
  const reply = await replied.json();
  const nested = await page.request.post("/api/threads/reply", {
    headers: authorHeaders,
    data: { parent: reply.node, content: "My deletable leaf reply." },
  });
  expect(nested.ok()).toBe(true);
  const leaf = await nested.json();

  await page.goto(`/t/${root.conversation}`);
  await expect(page.getByRole("heading", { name: "Private deletion regression" })).toBeVisible();
  await page.locator(`#post-${root.post}`).getByRole("button", { name: "Post actions" }).click();
  await expect(page.getByRole("menuitem", { name: /trash/i })).toHaveCount(0);
  const refused = page.waitForResponse((response) => response.url().endsWith("/api/posts/delete"));
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const refusal = await refused;
  expect(refusal.status()).toBe(409);
  expect(await refusal.json()).toEqual({ error: "CONFLICT" });
  await expect(
    page.getByText("This post has replies and cannot be deleted.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(`#post-${root.post}`)).toContainText("Keep this opening post.");
  await expect(page.locator(`#post-${reply.post}`)).toContainText(
    "Keep this other person's reply.",
  );
  await expect(page.locator(`#post-${leaf.post}`)).toContainText("My deletable leaf reply.");

  // The same menu still permits deleting an author's own post without replies.
  await page.locator(`#post-${leaf.post}`).getByRole("button", { name: "Post actions" }).click();
  const deleted = page.waitForResponse((response) => response.url().endsWith("/api/posts/delete"));
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const deletion = await deleted;
  expect(deletion.status()).toBe(200);
  expect(await deletion.json()).toEqual({ post: leaf.post });
  await expect(page.getByText("Post deleted", { exact: true })).toBeVisible();
  await expect(page.locator(`#post-${leaf.post}`)).toHaveCount(0);
  await expect(page.locator(`#post-${root.post}`)).toContainText("Keep this opening post.");
  await expect(page.locator(`#post-${reply.post}`)).toContainText(
    "Keep this other person's reply.",
  );

  const emptyResponse = await page.request.post("/api/threads/create", {
    headers: authorHeaders,
    data: { content: "# Empty deletion regression", holders: [`account:${author.user}`] },
  });
  expect(emptyResponse.ok()).toBe(true);
  const empty = await emptyResponse.json();
  await page.goto(`/t/${empty.conversation}`);
  await expect(
    page.getByRole("heading", { name: "Empty deletion regression", exact: true }),
  ).toBeVisible();
  await page.locator(`#post-${empty.post}`).getByRole("button", { name: "Post actions" }).click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await page.waitForURL("**/");
  await expect(page.getByText("Thread deleted", { exact: true })).toBeVisible();
  await expect(page.getByText("Opening post unavailable", { exact: true })).toHaveCount(0);
});
