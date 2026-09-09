import { expect, type Page } from "@playwright/test";
import { authenticate, call, logIn, scrollToEdge, test, withinViewport } from "./support/browser";

async function discussion(page: Page, cookie: string, user: string) {
  return call<{ post: string; conversation: string }>(page, cookie, "/threads/create", {
    content: "# Workshop discussion\n\nWhat should we cover in the next workshop?",
    holders: [`account:${user}`],
  });
}

for (const theme of ["light", "dark"]) {
  test(`long tag pickers scroll without moving the page (${theme})`, async ({ page }, testInfo) => {
    await page.addInitScript(`localStorage.setItem("theme", "${theme}")`);
    await page.setViewportSize({ width: 390, height: 700 });
    const { cookie, user } = await authenticate(page);
    const { conversation } = await discussion(page, cookie, user);
    const prefix = `workshop-${crypto.randomUUID().slice(0, 6)}`;
    for (let index = 0; index < 18; index++) {
      await call(page, cookie, "/tags/create", { name: `${prefix}-${index + 1}` });
    }
    await page.goto(`/t/${conversation}`);
    await page.getByRole("button", { name: "Tag", exact: true }).click();
    const picker = page.locator('[data-slot="popover-content"]');
    const area = picker.locator('[data-slot="scroll-area"]');
    const viewport = area.locator('[data-slot="scroll-area-viewport"]');
    await expect(picker.getByRole("button", { name: `#${prefix}-1`, exact: true })).toBeVisible();
    await withinViewport(page, picker);
    expect((await viewport.boundingBox())!.height).toBeLessThanOrEqual(160);
    expect(await viewport.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    const pageTop = await page.evaluate("window.scrollY");
    await page.screenshot({
      path: testInfo.outputPath(`tags-${theme}.png`),
      animations: "disabled",
    });
    await scrollToEdge(page, viewport, 1);
    expect(await page.evaluate("window.scrollY")).toBe(pageTop);
    const last = area.getByRole("button").last();
    await expect(last).toBeInViewport({ ratio: 1 });
    await expect(picker.getByPlaceholder("tag name")).toBeInViewport({ ratio: 1 });
    const name = (await last.innerText()).trim().replace(/^#/, "");
    await last.click();
    await expect(
      page.getByRole("button", { name: `Remove tag ${name}`, exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
  });
}

test("edit history stays reachable on phones and desktop", async ({ page }, testInfo) => {
  const { cookie, user } = await authenticate(page);
  const { post, conversation } = await discussion(page, cookie, user);
  for (let index = 0; index < 12; index++) {
    await call(page, cookie, "/posts/edit", {
      post,
      content: `# Workshop discussion\n\nRevision ${index + 1}\n\n${"Discuss a concrete example and compare possible designs.\n\n".repeat(30)}`,
    });
  }
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto(`/t/${conversation}`);
  await page.getByRole("button", { name: "Edited", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit history", exact: true });
  await expect(dialog.locator("pre")).toContainText("Revision 12");
  await withinViewport(page, dialog);
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeInViewport({
    ratio: 1,
  });
  const pageTop = await page.evaluate("window.scrollY");
  const versions = dialog.locator('[data-slot="scroll-area-viewport"]');
  await scrollToEdge(page, versions, 1);
  const firstVersion = versions.getByRole("button", { name: /^Version 1\b/ });
  await expect(firstVersion).toBeInViewport({ ratio: 1 });
  await firstVersion.click();
  await expect(dialog.locator("pre")).toContainText("What should we cover");
  await scrollToEdge(page, versions, -1);
  await versions.getByRole("button", { name: /^Version 13\b/ }).click();
  await expect(dialog.locator("pre")).toContainText("Revision 12");
  await page.screenshot({
    path: testInfo.outputPath("history-mobile-top.png"),
    animations: "disabled",
  });
  await scrollToEdge(page, dialog, 1);
  await expect(dialog.getByText(/^Last edited/)).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate("window.scrollY")).toBe(pageTop);
  await page.screenshot({
    path: testInfo.outputPath("history-mobile-bottom.png"),
    animations: "disabled",
  });
  await scrollToEdge(page, dialog, -1);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Edited", exact: true }).click();
  await expect(dialog.locator("pre")).toContainText("Revision 12");
  await withinViewport(page, dialog);
  await page.screenshot({
    path: testInfo.outputPath("history-desktop.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("task dialogs scroll in landscape and keep every control reachable", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 667, height: 320 });
  await authenticate(page);
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New task", exact: true });
  await dialog.getByRole("textbox", { name: "Title", exact: true }).fill("Workshop outline");
  await withinViewport(page, dialog);
  expect(await dialog.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  const pageTop = await page.evaluate("window.scrollY");
  await scrollToEdge(page, dialog, 1);
  await expect(dialog.getByRole("button", { name: "Add task", exact: true })).toBeInViewport({
    ratio: 1,
  });
  expect(await page.evaluate("window.scrollY")).toBe(pageTop);
  await page.screenshot({
    path: testInfo.outputPath("task-dialog-landscape.png"),
    animations: "disabled",
  });
  await scrollToEdge(page, dialog, -1);
  await expect(dialog.getByRole("heading", { name: "New task", exact: true })).toBeInViewport({
    ratio: 1,
  });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "New task", exact: true })).toBeFocused();
});

test("notification lists shrink to the available space while their footer stays visible", async ({
  page,
}, testInfo) => {
  const { cookie, user } = await authenticate(page);
  const other = await logIn(page, "noah");
  const { list } = await call<{ list: string }>(page, cookie, "/tasklists/create", {
    title: "Workshop preparation",
  });
  await call(page, cookie, "/tasklists/add-member", { list, candidate: other.user });
  for (let index = 0; index < 7; index++) {
    const { task } = await call<{ task: string }>(page, cookie, "/tasks/create", {
      list,
      title: `Workshop preparation ${index + 1}: review the examples and prepare discussion notes`,
      details: "",
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await call(page, other.cookie, "/tasks/assign", { task, assignee: user });
  }
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/tasks");
  await page.getByRole("button", { name: /^Notifications/ }).click();
  const popup = page.locator('[data-slot="popover-content"]');
  const viewport = popup.locator('[data-slot="scroll-area-viewport"]');
  await expect(viewport).toBeVisible();
  const pageTop = await page.evaluate("window.scrollY");
  for (const size of [
    { width: 390, height: 700 },
    { width: 844, height: 390 },
    { width: 667, height: 320 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await expect
      .poll(async () => (await popup.boundingBox())!.y + (await popup.boundingBox())!.height)
      .toBeLessThanOrEqual(size.height);
    await withinViewport(page, popup);
    expect(await viewport.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await expect(popup.getByRole("link", { name: "See all notifications" })).toBeInViewport({
      ratio: 1,
    });
    await scrollToEdge(page, viewport, -1);
    await scrollToEdge(page, viewport, 1);
    expect(await page.evaluate("window.scrollY")).toBe(pageTop);
    await expect(popup.getByText(/^Workshop preparation \d+:/).last()).toBeVisible();
    await expect(popup.getByRole("button", { name: "Mark all read" })).toBeInViewport({ ratio: 1 });
    await expect(popup.getByRole("link", { name: "See all notifications" })).toBeInViewport({
      ratio: 1,
    });
    await page.screenshot({
      path: testInfo.outputPath(`notifications-${size.width}x${size.height}.png`),
      animations: "disabled",
    });
  }
  await popup.getByRole("link", { name: "See all notifications" }).click();
  await page.waitForURL("**/notifications");
  await expect(popup).toBeHidden();
});

test("participant actions are opaque on mobile and the join projector remains full-screen", async ({
  page,
}, testInfo) => {
  const { cookie } = await authenticate(page);
  const { relay } = await call<{ relay: string }>(page, cookie, "/live/relays/plan", {
    title: "Workshop questions",
  });
  const { leg } = await call<{ leg: string }>(page, cookie, "/live/relays/add-round", {
    relay,
    title: "Starting points",
    prompt: "What would you like to explore?",
    parts: [],
    choices: [],
    cap: 0,
  });
  const { run } = await call<{ run: string }>(page, cookie, "/live/relays/launch", { relay });
  await call(page, cookie, "/live/relays/open-round", { run, leg });
  const standing = await call<{ run: { token: string } }>(page, cookie, "/live/relays/run", {
    run,
  });
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto(`/q/${standing.run.token}`);
  const handIn = page.getByRole("button", { name: "Hand in", exact: true });
  await expect(handIn).toBeInViewport({ ratio: 1 });
  const bar = page.locator(".fixed").filter({ has: handIn });
  await expect(bar).toHaveCSS("backdrop-filter", "none");
  await withinViewport(page, bar);
  await page.screenshot({
    path: testInfo.outputPath("participant-mobile.png"),
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(bar).not.toHaveCSS("backdrop-filter", "none");
  await page.goto(`/staff/live/run/${run}/project`);
  await page.getByRole("button", { name: "Expand join code", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Workshop questions", exact: true });
  await withinViewport(page, dialog);
  expect((await dialog.boundingBox())!.height).toBe(900);
  await expect(dialog.getByRole("button", { name: "Back to round" })).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: testInfo.outputPath("projector-fullscreen.png"),
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Back to round" }).click();
  await expect(dialog).toBeHidden();
});
