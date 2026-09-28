import { expect, type Page, test } from "@playwright/test";

const ARRIVE = "**/api/live/p/arrive";
const BEGIN = "**/api/live/p/begin";
const WAITING = "You’re joined. Waiting for the next round.";

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
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill("mara");
  await page.getByRole("textbox", { name: "Password" }).fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/");
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
    await expect(phone.getByRole("textbox").first()).toBeVisible({ timeout: 12_000 });
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
  test.setTimeout(90_000);
  const { run, token, legs } = await stage(page);
  const context = await browser.newContext();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const phone = await context.newPage();
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
    await expect.poll(() => begins).toBe(1);
    await expect(phone.getByRole("textbox").first()).toBeVisible({ timeout: 25_000 });
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
  test.setTimeout(100_000);
  const { run, token, legs } = await stage(page);
  const context = await browser.newContext();
  try {
    const phone = await context.newPage();
    await call(page, "/live/relays/open-round", { run, leg: legs[0] });
    await phone.goto(`/q/${token}`);
    await phone.getByRole("textbox").first().fill("Keep me informed");
    await phone.getByRole("button", { name: "Hand in", exact: true }).click();
    await expect(
      phone.getByRole("heading", { name: "Response received", exact: true }),
    ).toBeVisible();
    await phone.route(ARRIVE, (route) => route.abort("failed"));
    await expect(phone.getByText("No connection.", { exact: true })).toBeVisible({
      timeout: 50_000,
    });
    await phone.unroute(ARRIVE);
    await expect(phone.getByText("No connection.", { exact: true })).toBeHidden({
      timeout: 15_000,
    });
  } finally {
    await context.close();
    await call(page, "/live/relays/close", { run });
  }
});

test("two dashboards and twelve independent phones converge across round changes and a reconnect", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const { run, token, legs } = await stage(page);
  const secondDashboard = await page.context().newPage();
  const projector = await page.context().newPage();
  await secondDashboard.goto(`/staff/live/run/${run}`);
  await projector.goto(`/staff/live/run/${run}/project`);
  const contexts = await Promise.all(
    Array.from({ length: 12 }, () => browser.newContext({ viewport: { width: 390, height: 844 } })),
  );
  try {
    const phones = await Promise.all(
      contexts.map(async (context) => {
        const phone = await context.newPage();
        await phone.goto(`/q/${token}`);
        await expect(phone.getByText(WAITING, { exact: true })).toBeVisible();
        return phone;
      }),
    );
    for (const [index, leg] of legs.entries()) {
      // Keep one device off the network across the transition, then recover it.
      await contexts[0]!.setOffline(true);
      const host = index === 0 ? page : secondDashboard;
      const opened = host.waitForResponse((response) =>
        response.url().endsWith("/api/live/relays/open-round"),
      );
      await host
        .getByRole("button", { name: index === 0 ? /^Open.*First idea/ : /^Open.*Second idea/ })
        .click();
      const openedResponse = await opened;
      expect(openedResponse.ok()).toBe(true);
      const openedBody = await openedResponse.json();
      expect(openedBody.error).toBeUndefined();
      const { run: standing } = await call<{ run: { openRound: string } }>(
        page,
        "/live/relays/run",
        { run },
      );
      expect(standing.openRound).toBe(openedBody.round);
      await contexts[0]!.setOffline(false);
      await Promise.all(
        phones.map(async (phone, seat) => {
          await expect(
            phone.getByRole("textbox").first(),
            `phone ${seat} can answer leg ${leg}`,
          ).toBeVisible({ timeout: 15_000 });
          await phone
            .getByRole("textbox")
            .first()
            .fill(`Round ${index + 1}, phone ${seat}`);
          await phone.getByRole("button", { name: "Hand in", exact: true }).click();
          await expect(
            phone.getByRole("heading", { name: "Response received", exact: true }),
          ).toBeVisible();
        }),
      );
      await expect
        .poll(async () => {
          const { wall } = await call<{ wall: { cards: unknown[] } }>(page, "/live/walls/read", {
            round: standing.openRound,
          });
          return wall.cards.length;
        })
        .toBe(phones.length);
      await call(host, "/live/relays/close-round", { round: standing.openRound });
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await secondDashboard.close();
    await projector.close();
    await call(page, "/live/relays/close", { run });
  }
});
