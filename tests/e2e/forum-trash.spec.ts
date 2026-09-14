import { expect, test } from "@playwright/test";

for (const entryPoint of ["post menu", "flag queue"]) {
  test(`${entryPoint} trashes selected replies independently and preserves every removed slot`, async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const login = await page.request.post("/api/auth/login", {
      data: { username: "mara", password: "password123" },
    });
    expect(login.ok()).toBe(true);
    const cookie = login.headers()["set-cookie"]!.split(";")[0]!;
    const call = async (path: string, data: unknown) => {
      const response = await page.request.post(`/api${path}`, {
        headers: { Cookie: cookie },
        data,
      });
      const body = await response.json();
      expect(response.ok(), `${path}: ${JSON.stringify(body)}`).toBe(true);
      return body;
    };
    const me = await call("/auth/me", {});
    const root = await call("/threads/create", {
      holders: [`account:${me.user}`],
      content: `# Batch trash from ${entryPoint}`,
    });
    const middle = await call("/threads/reply", {
      parent: root.node,
      content: `Batch middle from ${entryPoint}`,
    });
    const leaf = await call("/threads/reply", {
      parent: middle.node,
      content: `Batch leaf from ${entryPoint}`,
    });
    if (entryPoint === "post menu") {
      await page.goto(`/t/${root.conversation}`);
      await page
        .locator(".thread-branch-content")
        .filter({ has: page.locator(`#post-${middle.post}`) })
        .getByRole("button", { name: "Hide 1 reply", exact: true })
        .click();
      await expect(page.locator(`#post-${leaf.post}`)).toBeHidden();
      await page
        .locator(`#post-${middle.post}`)
        .getByRole("button", { name: "Post actions" })
        .click();
      await page.getByRole("menuitem", { name: "Move to trash", exact: true }).click();
    } else {
      await call("/flags/raise", { target: middle.post, reason: "Review this branch" });
      await page.goto("/moderation");
      const card = page.locator("article").filter({ hasText: `Batch middle from ${entryPoint}` });
      await card.getByRole("button", { name: "Move to trash", exact: true }).click();
    }
    const confirmation = page.getByRole("dialog", { name: "Move this reply to trash?" });
    await expect(confirmation.getByRole("checkbox")).not.toBeChecked();
    await expect(confirmation).toContainText("Also move 1 reply beneath it to trash");
    await confirmation.getByRole("checkbox").check();
    await confirmation.getByRole("button", { name: "Move 2 posts to trash" }).click();
    await expect(page.getByText("Reply and 1 reply moved to trash", { exact: true })).toBeVisible();
    const bin = await call("/trash/list", {});
    for (const item of [middle.post, leaf.post])
      expect(bin.trashed).toContainEqual(expect.objectContaining({ item, thread: false }));

    await page.goto(`/t/${root.conversation}`);
    for (const item of [middle.post, leaf.post]) {
      const notice = page.locator(`#post-${item}`);
      await expect(notice).toContainText("This reply was removed by a moderator.");
      await expect(notice.getByRole("button", { name: "Restore", exact: true })).toBeVisible();
    }
    await page
      .locator(`#post-${leaf.post}`)
      .getByRole("button", { name: "Restore", exact: true })
      .click();
    await expect(page.locator(`#post-${leaf.post}`)).toContainText(`Batch leaf from ${entryPoint}`);
    await expect(page.locator(`#post-${middle.post}`)).toContainText("removed by a moderator");
    await page
      .locator(".thread-branch-content")
      .filter({ has: page.locator(`#post-${middle.post}`) })
      .getByRole("button", { name: "Hide 1 reply", exact: true })
      .click();
    await expect(page.locator(`#post-${leaf.post}`)).toBeHidden();
    await page.evaluate(`window.location.hash = ${JSON.stringify(`#post-${leaf.post}`)}`);
    await expect(page.locator(`#post-${leaf.post}`)).toBeVisible();
    await call("/trash/purge", { item: middle.post });
    await call("/trash/trash", { item: leaf.post });
    await call("/trash/purge", { item: leaf.post });
    await page.reload();
    for (const item of [middle.post, leaf.post]) {
      const notice = page.locator(`#post-${item}`);
      await expect(notice).toContainText("This reply was removed by a moderator.");
      await expect(notice.getByRole("button", { name: "Restore", exact: true })).toHaveCount(0);
    }

    // The flag queue's opening action selects a whole thread, never the opening alone.
    await call("/flags/raise", { target: root.post, reason: "Review whole discussion" });
    await page.goto("/moderation");
    await page
      .locator("article")
      .filter({ hasText: `Batch trash from ${entryPoint}` })
      .getByRole("button", { name: "Move to trash", exact: true })
      .click();
    const whole = page.getByRole("dialog", { name: "Move this thread to trash?" });
    await expect(whole.getByRole("checkbox")).toHaveCount(0);
    await whole.getByRole("button", { name: "Move thread to trash", exact: true }).click();
    await expect(page.getByText("Thread moved to trash", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Trash", exact: true }).click();
    const entry = page.locator("article").filter({ hasText: `Batch trash from ${entryPoint}` });
    await entry.getByRole("button", { name: "Review thread" }).click();
    const review = page.getByRole("dialog", { name: `Batch trash from ${entryPoint}` });
    await expect(review.locator(`#review-post-${leaf.post}`)).toContainText("permanently deleted");
    await review.getByRole("button", { name: "Close", exact: true }).click();

    // Bin controls survive a missing opening preview (e.g. a failed, retriable purge).
    await page.route("**/api/moderation/posts/get", async (route) => {
      if (route.request().postDataJSON().item === root.post)
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "NOT_FOUND" }),
        });
      else await route.continue();
    });
    await page.reload();
    await page.getByRole("tab", { name: "Trash", exact: true }).click();
    const fallback = page.locator("article").filter({ hasText: "opening text unavailable" });
    await expect(
      fallback.getByRole("button", { name: "Delete permanently", exact: true }),
    ).toBeVisible();
    await expect(fallback.getByRole("button", { name: "Restore", exact: true })).toBeVisible();
    await page.unroute("**/api/moderation/posts/get");
    await call("/trash/purge", { item: root.conversation });
  });
}
