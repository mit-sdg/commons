import { expect, type Page, test } from "@playwright/test";

/**
 * A phone tells the run's room it has a round only once that round is on its
 * screen: after its join is answered, never while the join is still out, and
 * never on the state the round before left behind.
 */
async function call<T>(page: Page, path: string, data: unknown): Promise<T> {
  const cookie = (await page.context().cookies())
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  const response = await page.request.post(`/api${path}`, {
    data,
    headers: { Cookie: cookie },
  });
  const result = await response.json();
  expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBe(true);
  expect(result.error, path).toBeUndefined();
  return result as T;
}

const HELD_MS = 5_000;

test("a phone checks into the next round only once its join is answered", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill("mara");
  await page.getByRole("textbox", { name: "Password" }).fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/");

  const { relay } = await call<{ relay: string }>(page, "/live/relays/plan", {
    title: "Room check-in",
  });
  const add = (title: string, prompt: string) =>
    call<{ leg: string }>(page, "/live/relays/add-round", {
      relay,
      title,
      prompt,
      parts: [],
      choices: [],
      cap: 0,
    });
  const first = await add("First", "One verb a bookmark needs.");
  const second = await add("Second", "One more verb, then.");
  const { run, token } = await call<{ run: string; token: string }>(page, "/live/relays/launch", {
    relay,
  });

  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await phoneContext.newPage();
  const checkIns: { holding: string; at: number }[] = [];
  let holdJoins = false;
  let joinAnsweredAt: number | null = null;
  phone.on("request", (request) => {
    if (!request.url().endsWith("/api/live/p/attend")) return;
    const { holding } = request.postDataJSON() as { holding: string };
    checkIns.push({ holding, at: Date.now() });
  });
  // The next round's join is held, so a phone that counted itself on the
  // round before its join was answered would check in inside the hold.
  await phone.route("**/api/live/p/begin", async (route) => {
    if (!holdJoins) return route.continue();
    await new Promise((done) => setTimeout(done, HELD_MS));
    const response = await route.fetch();
    joinAnsweredAt = Date.now();
    return route.fulfill({ response });
  });

  try {
    await phone.goto(`/q/${token}`);
    await expect(phone.getByText("Waiting for the next round")).toBeVisible();

    const opened = await call<{ round: string }>(page, "/live/relays/open-round", {
      run,
      leg: first.leg,
    });
    await expect(phone.getByText("One verb a bookmark needs.")).toBeVisible();
    await expect
      .poll(() => checkIns.some((checkIn) => checkIn.holding === opened.round), {
        timeout: 10_000,
      })
      .toBe(true);
    await phone.getByRole("textbox").first().fill("keep");
    await phone.getByRole("button", { name: "Hand in" }).click();
    await expect(phone.getByText("Response received")).toBeVisible();
    await call(page, "/live/relays/close-round", { round: opened.round });
    await expect(phone.getByText("Waiting for the next round")).toBeVisible();

    holdJoins = true;
    const next = await call<{ round: string }>(page, "/live/relays/open-round", {
      run,
      leg: second.leg,
    });
    await expect(phone.getByText("One more verb, then.")).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(() => checkIns.find((checkIn) => checkIn.holding === next.round), {
        timeout: 10_000,
      })
      .toBeTruthy();
    const onNext = checkIns.find((checkIn) => checkIn.holding === next.round);
    expect(joinAnsweredAt).not.toBeNull();
    expect(onNext?.at ?? 0).toBeGreaterThanOrEqual(joinAnsweredAt ?? Number.POSITIVE_INFINITY);
  } finally {
    await phoneContext.close();
  }
});
