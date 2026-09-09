import { expect, type Page } from "@playwright/test";
import { authenticate, scrollToEdge, test } from "./support/browser";

async function signInAsStaff(page: Page) {
  await authenticate(page);
  await page.goto("/staff/class");
  await expect(page.getByRole("heading", { name: "Class settings", exact: true })).toBeVisible();
}

for (const viewport of [
  { width: 390, height: 700 },
  { width: 360, height: 568 },
  { width: 844, height: 390 },
]) {
  test(`expanded staff navigation scrolls natively at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await signInAsStaff(page);
    const header = page.getByRole("banner");
    const menu = page.getByRole("navigation", { name: "Mobile", exact: true });
    const background = await page
      .locator("body")
      .evaluate((el) => el.ownerDocument.defaultView!.getComputedStyle(el).backgroundColor);
    await expect(header).toHaveCSS("backdrop-filter", "none");
    await expect(header).toHaveCSS("background-color", background);

    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    const close = page.getByRole("button", { name: "Close menu", exact: true });
    await expect(close).toHaveAttribute("aria-expanded", "true");
    await expect(menu).toBeVisible();
    await expect(header).toHaveCSS("backdrop-filter", "none");
    await expect(menu).toHaveCSS("overflow-y", "auto");
    await expect(menu).toHaveCSS("overscroll-behavior-y", "contain");
    const bounds = (await header.boundingBox())!;
    expect(bounds.y).toBe(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    expect(await menu.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

    await page.screenshot({ path: testInfo.outputPath("menu-open.png"), animations: "disabled" });
    await scrollToEdge(page, menu, 1);
    await expect(menu.getByRole("link", { name: "Settings", exact: true })).toBeInViewport({
      ratio: 1,
    });
    await expect(close).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate("window.scrollY")).toBe(0);

    await scrollToEdge(page, menu, -1);
    expect(await page.evaluate("window.scrollY")).toBe(0);
    await menu.getByRole("link", { name: "Discussions", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "Open menu", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await scrollToEdge(page, menu, 1);
    const settings = menu.getByRole("link", { name: "Settings", exact: true });
    await expect(settings).toBeInViewport({ ratio: 1 });
    await settings.click();
    await page.waitForURL("**/settings");
    await expect(menu).toBeHidden();
  });
}

test("a short mobile menu keeps its natural height and toggles closed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  const menu = page.getByRole("navigation", { name: "Mobile", exact: true });
  await expect(menu.getByRole("link", { name: "Sign in", exact: true })).toBeInViewport({
    ratio: 1,
  });
  expect(await menu.evaluate((el) => el.scrollHeight === el.clientHeight)).toBe(true);
  expect((await page.getByRole("banner").boundingBox())!.height).toBeLessThan(844);
  await page.getByRole("button", { name: "Close menu", exact: true }).click();
  await expect(menu).toBeHidden();
});

test("desktop primary and course navigation retain the translucent header", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signInAsStaff(page);
  await expect(page.getByRole("navigation", { name: "Primary", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Course", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open menu", exact: true })).toBeHidden();
  await expect(page.getByRole("banner")).not.toHaveCSS("backdrop-filter", "none");
});
