import { logIn } from "./support/browser.ts";
import { expect, type Page, test } from "@playwright/test";

const ARRIVE = "**/api/live/p/arrive";
const BEGIN = "**/api/live/p/begin";
const WAITING = "You’re joined. Waiting for the next round.";
// The phone silence bound in frontend/src/lib/poll.ts.
const PHONE_STALE_MS = 42_000;

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

async function stage(page: Page) {
  await logIn(page);
  const { relay } = await call<{ relay: string }>(page, "/live/relays/plan", {
    title: "Classroom liveness",
  });
  const legs: string[] = [];
  for (const title of ["First idea", "Second idea"]) {
    const { leg } = await call<{ leg: string }>(page, "/live/relays/add-round", {
      relay,
      title,
      prompt: title,
      parts: [],
      choices: [],
      cap: 0,
    });
    legs.push(leg);
  }
  const launched = await call<{ run: string; token: string }>(page, "/live/relays/launch", {
    relay,
  });
  // Compile staff routes before any phone is observed under the dev server.
  await page.goto(`/staff/live/run/${launched.run}`);
  await expect(
    page.getByRole("heading", { name: "Classroom liveness", exact: true }),
  ).toBeVisible();
  return { ...launched, legs };
}

test("a phone waiting across two hours of sleep discovers the first round without reloading", async ({
  page,
  browser,
}) => {
  const { run, token, legs } = await stage(page);
  const context = await browser.newContext();
  try {
    const phone = await context.newPage();
    await phone.clock.install();
    await phone.goto(`/q/${token}`);
    await expect(phone.getByText(WAITING, { exact: true })).toBeVisible();
    await phone.clock.fastForward("02:00:00");
    await call(page, "/live/relays/open-round", { run, leg: legs[0] });
    await expect
      .poll(
        async () => {
          await phone.clock.fastForward(3_000);
          return phone.getByRole("textbox").first().isVisible();
        },
        { intervals: [50] },
      )
      .toBe(true);
    await phone.getByRole("textbox").first().fill("An early phone can participate");
    await phone.getByRole("button", { name: "Hand in", exact: true }).click();
    await expect(
      phone.getByRole("heading", { name: "Response received", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
    await call(page, "/live/relays/close", { run });
  }
});

test("a join whose reply never arrives recovers without refreshing the phone", async ({
  page,
  browser,
}) => {
  const { run, token, legs } = await stage(page);
  const context = await browser.newContext();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const phone = await context.newPage();
    await phone.clock.install();
    let begins = 0;
    let committedResponse: string | undefined;
    await phone.route(BEGIN, async (route) => {
      begins += 1;
      if (begins === 1) {
        // Commit the join, then lose its reply. A retry must recover the same response.
        const accepted = await route.fetch();
        committedResponse = (await accepted.json()).response;
        expect(committedResponse).toBeTruthy();
        await held;
        await route.abort().catch(() => undefined);
      } else {
        const recovered = await route.fetch();
        expect((await recovered.json()).response).toBe(committedResponse);
        await route.fulfill({ response: recovered });
      }
    });
    await phone.goto(`/q/${token}`);
    await expect(phone.getByText(WAITING, { exact: true })).toBeVisible();
    await call(page, "/live/relays/open-round", { run, leg: legs[0] });
    await phone.clock.fastForward(3_000);
    await expect.poll(() => begins).toBe(1);
    await expect.poll(() => committedResponse).toBeTruthy();
    await phone.clock.fastForward(12_000);
    await expect
      .poll(
        async () => {
          await phone.clock.fastForward(3_000);
          return phone.getByRole("textbox").first().isVisible();
        },
        { intervals: [50] },
      )
      .toBe(true);
    expect(begins).toBeGreaterThan(1);
    await phone.getByRole("textbox").first().fill("Recovered without a new identity");
    await phone.getByRole("button", { name: "Hand in", exact: true }).click();
    await expect(
      phone.getByRole("heading", { name: "Response received", exact: true }),
    ).toBeVisible();
  } finally {
    release();
    await context.close();
    await call(page, "/live/relays/close", { run });
  }
});

test("healthy wall reads cannot conceal a broken next-round poll", async ({ page, browser }) => {
  const { run, token, legs } = await stage(page);
  const context = await browser.newContext();
  try {
    const phone = await context.newPage();
    await phone.clock.install();
    await call(page, "/live/relays/open-round", { run, leg: legs[0] });
    await phone.goto(`/q/${token}`);
    await phone.getByRole("textbox").first().fill("Keep me informed");
    await phone.getByRole("button", { name: "Hand in", exact: true }).click();
    await expect(
      phone.getByRole("heading", { name: "Response received", exact: true }),
    ).toBeVisible();
    let misses = 0;
    await phone.route(ARRIVE, async (route) => {
      await route.abort("failed");
      misses += 1;
    });
    await phone.clock.runFor(3_000);
    // Let any arrival that was already in flight settle before aging its last answer.
    await expect.poll(() => misses).toBeGreaterThan(0);
    // A large fastForward is sleep to useClock. Execute every cadence instead,
    // allowing the real wall response to land before advancing again.
    for (let elapsed = 0; elapsed <= PHONE_STALE_MS; elapsed += 3_000) {
      const wallRead = phone.waitForResponse("**/api/live/p/wall");
      await phone.clock.runFor(3_000);
      const response = await wallRead;
      expect(response.ok()).toBe(true);
      expect((await response.json()).error).toBeUndefined();
    }
    await expect(phone.getByText("No connection.", { exact: true })).toBeVisible();
    await phone.unroute(ARRIVE);
    await expect
      .poll(
        async () => {
          await phone.clock.runFor(3_000);
          return phone.getByText("No connection.", { exact: true }).count();
        },
        { intervals: [50] },
      )
      .toBe(0);
    await expect(phone.getByText("No connection.", { exact: true })).toBeHidden({
      timeout: 15_000,
    });
  } finally {
    await context.close();
    await call(page, "/live/relays/close", { run });
  }
});
