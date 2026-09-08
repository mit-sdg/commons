import { expect, type Page, test } from "@playwright/test";
import staff from "./fixtures/relay-host-guide/staff.json" with { type: "json" };
import classroom from "./fixtures/relay-host-guide/classroom.json" with { type: "json" };
import creative from "./fixtures/relay-host-guide/creative.json" with { type: "json" };

async function call<T>(page: Page, path: string, data: unknown): Promise<T> {
  const cookie = (await page.context().cookies())
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const response = await page.request.post(`/api${path}`, { data, headers: { Cookie: cookie } });
  const result = await response.json();
  expect(response.ok(), path).toBe(true);
  expect(result.error, path).toBeUndefined();
  return result as T;
}

async function seed(page: Page, draft: typeof staff | typeof classroom | typeof creative) {
  const { relay } = await call<{ relay: string }>(page, "/live/relays/plan", {
    title: draft.title,
  });
  for (const [field, body] of Object.entries({
    description: draft.description,
    ...draft.hostGuide,
  }))
    await call(page, "/live/relays/set-guide", { relay, field, body });
  const legs: string[] = [];
  for (const round of draft.rounds) {
    const { leg } = await call<{ leg: string }>(page, "/live/relays/add-round", {
      relay,
      title: round.title,
      prompt: round.prompt,
      parts: round.parts,
      choices: round.choices,
      cap: round.cap,
    });
    legs.push(leg);
    await call(page, "/live/relays/set-kind", { leg, kind: round.kind });
    if (round.takes.from)
      await call(page, "/live/relays/set-takes", {
        leg,
        source: legs[round.takes.from - 1],
        use: round.takes.use,
      });
    for (const [field, body] of Object.entries(round.hostGuide))
      if (body) await call(page, "/live/rounds/set-guide", { leg, field, body });
    if (round.notes) await call(page, "/live/rounds/set-notes", { leg, body: round.notes });
    for (const pile of round.piles)
      await call(page, "/live/rounds/add-pile", {
        leg,
        name: pile.name,
        description: pile.sentence,
      });
  }
  return { relay, legs };
}

async function fits(page: Page) {
  expect(await page.evaluate("document.documentElement.scrollWidth <= innerWidth")).toBe(true);
}

test("generated guides accompany realistic relay authoring and hosting", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill("mara");
  await page.getByRole("textbox", { name: "Password" }).fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
  for (const [name, draft] of Object.entries({ staff, classroom, creative })) {
    const { relay, legs } = await seed(page, draft);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/staff/live/relay/${relay}`);
    await expect(page.getByRole("paragraph").filter({ hasText: draft.description })).toBeVisible();
    await fits(page);
    await page.screenshot({
      path: testInfo.outputPath(`${name}-overview-desktop.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Relay guide: Session host guide", exact: true })
      .click();
    await expect(page.getByText(draft.hostGuide.opening, { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await fits(page);
    await page.screenshot({
      path: testInfo.outputPath(`${name}-overview-mobile.png`),
      fullPage: true,
    });
    await page.goto(`/staff/live/relay/${relay}/edit`);
    await expect(page.getByRole("textbox", { name: "Round 1 title" })).toHaveValue(
      draft.rounds[0]!.title,
    );
    await expect(page.getByRole("paragraph").filter({ hasText: draft.description })).toBeVisible();
    await page.getByRole("button", { name: /^Round guide: Round 1 —/ }).click();
    await expect(page.getByText(draft.rounds[0]!.hostGuide.purpose, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "How it works", exact: true }).click();
    const walkthrough = page.getByRole("dialog", { name: "How it works", exact: true });
    await expect(walkthrough).toBeVisible();
    for (let step = 0; step < 5; step += 1)
      await walkthrough.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      walkthrough.getByRole("heading", { name: "Close the round, then choose piles", exact: true }),
    ).toBeVisible();
    await expect(
      walkthrough.getByText(/A vote does not automatically advance its winner/),
    ).toBeVisible();
    await expect(
      walkthrough.getByText(
        /If you select an option that received no votes, participants see its name in the next round, but no original responses/,
      ),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(walkthrough).toHaveCount(0);
    await fits(page);
    await page.screenshot({ path: testInfo.outputPath(`${name}-editor-mobile.png`) });
    if (name === "staff") {
      await page.setViewportSize({ width: 320, height: 740 });
      await fits(page);
      await page.screenshot({ path: testInfo.outputPath("staff-editor-small-mobile.png") });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.getByRole("textbox", { name: "Round 1 title" }).click();
    const disclosure = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: "Preview round 1" }) })
      .last();
    await expect(disclosure).not.toHaveAttribute("open");
    await disclosure.locator("summary").first().click();
    await expect(disclosure).toHaveAttribute("open");
    await expect(disclosure.locator("[data-participant-frame]")).toContainText(
      draft.rounds[0]!.prompt,
    );
    await disclosure.locator("summary").first().click();
    await expect(disclosure).not.toHaveAttribute("open");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate("scrollTo(0, 0)");
    await fits(page);
    await page.screenshot({ path: testInfo.outputPath(`${name}-editor-desktop.png`) });
    if (name === "staff") {
      const { run } = await call<{ run: string }>(page, "/live/relays/launch", { relay });
      await page.goto(`/staff/live/run/${run}`);
      await page
        .getByRole("button", { name: "Relay guide: Session host guide", exact: true })
        .click();
      await expect(page.getByText(draft.hostGuide.opening, { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Round guide: Running round 1", exact: true }).click();
      await expect(
        page.getByText(draft.rounds[0]!.hostGuide.facilitation, { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("staff-host-desktop.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await fits(page);
      await page.screenshot({ path: testInfo.outputPath("staff-host-mobile.png"), fullPage: true });
      await call(page, "/live/relays/open-round", { run, leg: legs[0] });
      await page.reload();
      await expect(page.getByRole("button", { name: /^Close / }).first()).toBeVisible();
      await call(page, "/live/relays/close", { run });
    }
  }
});
