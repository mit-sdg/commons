import { expect, type Locator, type Page, test as base } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  },
});

export async function logIn(page: Page, username = "mara") {
  const response = await page.request.post("/api/auth/login", {
    data: { username, password: "password123" },
  });
  expect(response.ok()).toBe(true);
  const result = (await response.json()) as { user: string };
  const cookie = response.headers()["set-cookie"]?.split(";")[0];
  expect(cookie).toBeTruthy();
  return { user: result.user, cookie: cookie! };
}

export async function authenticate(page: Page) {
  const session = await logIn(page);
  // Forward the real session over the local HTTP test origin, including in
  // browsers that require HTTPS for Secure cookies. Responses are not mocked.
  await page.route("**/api/**", async (route) => {
    const response = await route.fetch({
      maxRetries: 2,
      headers: { ...route.request().headers(), cookie: session.cookie },
    });
    await route.fulfill({ response });
  });
  return session;
}

export async function call<Value>(page: Page, cookie: string, path: string, data: unknown) {
  const response = await page.request.post(`/api${path}`, {
    data,
    headers: { Cookie: cookie },
  });
  const result = await response.json();
  expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBe(true);
  expect(result.error, path).toBeUndefined();
  return result as Value;
}

export async function scrollToEdge(page: Page, scroller: Locator, direction: 1 | -1) {
  // Real wheel input exercises scroll containment; Firefox limits the distance
  // per event, so a long list may require several events.
  await scroller.hover({ position: { x: 8, y: 8 } });
  await expect
    .poll(
      async () => {
        const reached = await scroller.evaluate(
          (el, direction) =>
            direction === 1
              ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1
              : el.scrollTop === 0,
          direction,
        );
        if (!reached) await page.mouse.wheel(0, direction * 500);
        return reached;
      },
      { intervals: [100] },
    )
    .toBe(true);
}

export async function withinViewport(page: Page, element: Locator) {
  await expect(element).toBeVisible();
  const bounds = (await element.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
}
