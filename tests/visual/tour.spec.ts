import { expect, type Page, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The relay tour: one relay copied from the deck and run through its room,
 * with every staff, projector, and phone screen photographed at the widths
 * the design mockups were drawn for. The shots are named after the
 * mockups they are read beside.
 */

const OUT = process.env.TOUR_OUT ?? resolve(import.meta.dirname, "../../test-results/tour-shots");
const HOST = { username: "mara", password: "password123" };
const STAFF = [1440, 768, 390] as const;
const WALL = [1920, 768] as const;
const PHONES = 24;
const WORDS = ["add", "save", "keep", "see", "open", "visit", "delete", "remove", "forget"];

async function signIn(page: Page, account = HOST) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill(account.username);
  await page.getByRole("textbox", { name: "Password" }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
}

async function call<Value>(page: Page, path: string, data: unknown): Promise<Value> {
  const cookies = await page.context().cookies();
  const cookie = cookies.map((entry) => `${entry.name}=${entry.value}`).join("; ");
  const response = await page.request.post(`/api${path}`, {
    data,
    headers: cookie === "" ? {} : { Cookie: cookie },
  });
  return (await response.json()) as Value;
}

async function until<Value>(
  read: () => Promise<Value>,
  done: (value: Value) => boolean,
  tries = 90,
): Promise<Value> {
  let value = await read();
  for (let attempt = 0; attempt < tries && !done(value); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    value = await read();
  }
  return value;
}

const heights: Record<number, number> = { 1920: 1080, 1440: 900, 768: 1024, 390: 844 };

/**
 * One screen at each width. Staff and phone pages are photographed whole by
 * growing the viewport to the page, so sticky headers stay put; the wall is
 * one screen.
 */
async function snap(page: Page, name: string, widths: readonly number[], whole = true) {
  for (const width of widths) {
    const base = heights[width] ?? 900;
    await page.setViewportSize({ width, height: base });
    await page.waitForTimeout(500);
    if (whole) {
      const tall = (await page.evaluate("document.documentElement.scrollHeight")) as number;
      await page.setViewportSize({ width, height: Math.min(Math.max(base, tall), 5000) });
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: `${OUT}/${name}@${width}.png` });
  }
}

interface Face {
  relay: {
    openRound: string | null;
    questions: { question: string; choices: string[]; parts: string[] }[];
  } | null;
}

interface WallRead {
  wall: {
    cards: { value: string; pile: string | null; model: boolean }[];
    piles: { pile: string; name: string; count: number; picked: string | null }[];
  } | null;
}

test("the tour", async ({ browser, page }) => {
  mkdirSync(OUT, { recursive: true });
  await signIn(page);

  // Live: the list and the deck; Describe dropped down; a draft proposed.
  await page.goto("/staff/live");
  await expect(page.getByRole("button", { name: "Copy" }).first()).toBeVisible();
  await snap(page, "LiveList", STAFF);
  await page.getByRole("button", { name: "Describe" }).click();
  await page
    .locator("textarea")
    .first()
    .fill("Three verbs, then a stranger, for a reading of the login concept.");
  await snap(page, "LiveListDescribe", STAFF);
  await page.getByRole("button", { name: "Draft", exact: true }).click();
  await page.waitForURL(/\/staff\/live\/relay\/[0-9a-f-]{36}/, { timeout: 20_000 });
  await page.waitForTimeout(6000);
  await snap(page, "DescribeDrafted", STAFF);

  // The relay: setup, drafting dropped down, the proposed edits.
  await page.goto("/staff/live");
  await page.getByRole("button", { name: "Copy" }).first().click();
  await page.waitForURL(/\/staff\/live\/relay\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await expect(page.getByRole("textbox", { name: "Title" }).nth(2)).toHaveValue("The stranger");
  await snap(page, "RelaySetup", STAFF);
  await page.getByRole("button", { name: "Draft", exact: true }).click();
  await page
    .locator("textarea")
    .first()
    .fill("Three verbs, then a stranger: keep both rounds, tighten the prompts.");
  await snap(page, "RelaySetupDraft", STAFF);
  await page.getByRole("button", { name: "Draft", exact: true }).last().click();
  await page.waitForTimeout(5000);
  await snap(page, "Edits", STAFF);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Title" }).nth(2)).toHaveValue("The stranger");

  // Launch: the run before any round opens; the projector with the join code.
  await page.getByRole("button", { name: "Launch" }).click();
  await page.waitForURL(/\/staff\/live\/run\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  const run = page.url().split("/").pop() as string;
  const standing = await call<{ run: { token: string; code: string } }>(page, "/live/relays/run", {
    run,
  });
  const { token } = standing.run;
  await snap(page, "StaffDashboardBefore", STAFF);

  const projector = await browser.newPage();
  await projector.context().addCookies(await page.context().cookies());
  await projector.goto(`/staff/live/run/${run}/project`);
  await projector.waitForTimeout(2500);
  await snap(projector, "ProjectorBefore", WALL, false);

  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await phoneContext.newPage();
  await phone.goto(`/q/${token}`);
  await phone.waitForTimeout(2500);
  await snap(phone, "PhoneBeforeOpen", [390]);

  // Round one opens: the empty tray, the phone's parts.
  await page.getByRole("button", { name: /^Open.*Three verbs/ }).click();
  const face = await until(
    () => call<Face>(page, "/live/p/arrive", { token }),
    (value) => value.relay?.openRound !== null && (value.relay?.questions.length ?? 0) > 0,
  );
  const roundOne = face.relay?.openRound as string;
  const question = face.relay?.questions[0]?.question as string;
  await page.waitForTimeout(3500);
  await snap(page, "StaffDashboardOpens", STAFF);
  await projector.waitForTimeout(3500);
  await snap(projector, "ProjectorOpens", WALL, false);
  await phone.waitForTimeout(3500);
  await snap(phone, "PhoneBefore", [390]);

  // Phones stream in: most hand in, a few are still writing.
  const writing: string[] = [];
  for (let seat = 0; seat < PHONES; seat += 1) {
    const begun = await call<{ response: string }>(page, "/live/p/begin", {
      token,
      device: `phone-${seat}`,
    });
    if (seat >= PHONES - 3) {
      writing.push(begun.response);
      continue;
    }
    for (let part = 1; part <= 3; part += 1) {
      const value =
        seat === 0 && part === 1
          ? "an unsortable scribble"
          : (WORDS[(seat * 3 + part) % WORDS.length] as string);
      await call(page, "/live/p/answer", {
        response: begun.response,
        question: `${question}#${part}`,
        value,
      });
    }
    await call(page, "/live/p/submit", { response: begun.response });
  }

  // The tour's own phone fills its parts and hands in; the tray on every screen.
  await phone.getByRole("textbox", { name: "one" }).fill("bookmark");
  await phone.getByRole("textbox", { name: "two" }).fill("revisit");
  await snap(phone, "PhoneFilling", [390]);
  await phone.getByRole("textbox", { name: "three" }).fill("forget");
  await phone.getByRole("button", { name: "Hand in" }).click();
  await phone.waitForTimeout(4000);
  await snap(phone, "PhoneAfterTray", [390]);
  await page.waitForTimeout(3500);
  await snap(page, "Tray", STAFF);
  await projector.waitForTimeout(3500);
  await snap(projector, "ProjectorStreaming", WALL, false);

  // One model participant, then the model sorts.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("textbox", { name: "Model participants" }).fill("1");
  await page.getByRole("button", { name: "Invite" }).click();
  await until(
    () => call<WallRead>(page, "/live/walls/read", { round: roundOne }),
    (value) => (value.wall?.cards.filter((card) => card.model).length ?? 0) === 3,
  );
  await page.getByRole("switch", { name: "Model sorts" }).click();
  await until(
    () => call<WallRead>(page, "/live/walls/read", { round: roundOne }),
    (value) =>
      (value.wall?.cards.length ?? 0) > 0 &&
      (value.wall?.cards.every((card) => card.pile !== null) ?? false),
    120,
  );
  await page.waitForTimeout(3500);
  await snap(page, "StaffDashboard", STAFF);
  await projector.waitForTimeout(3500);
  await snap(projector, "Projector", WALL, false);
  await phone.waitForTimeout(3500);
  await snap(phone, "PhoneAfter", [390]);

  // Drafting the next round mid-run.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("link", { name: "Draft a round" }).click();
  await page.waitForURL(/\/staff\/live\/relay\/[0-9a-f-]{36}\?draft=1$/, { timeout: 20_000 });
  await page.waitForTimeout(2000);
  await page.locator("textarea").first().fill("A vote: which verb names the stranger best?");
  await snap(page, "MidRunDraft", STAFF);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Draft", exact: true }).last().click();
  await page.waitForTimeout(5000);
  await snap(page, "MidRunDrafted", STAFF);
  await page.goto(`/staff/live/run/${run}`);
  await page.waitForTimeout(3000);

  // Close round one; the phone waits; three piles are picked for round two.
  for (const response of writing) await call(page, "/live/p/submit", { response });
  await page.getByRole("button", { name: /^Close.*Three verbs/ }).click();
  await expect(page.getByRole("button", { name: /^Open.*The stranger.*0 piles/ })).toBeVisible({
    timeout: 20_000,
  });
  await phone.waitForTimeout(4000);
  await snap(phone, "PhoneWaiting", [390]);
  await snap(page, "StaffDashboardClosedRound", STAFF);
  await page.setViewportSize({ width: 1440, height: 900 });
  let picked = 0;
  for (const name of ["Pace", "Examples", "Questions"]) {
    await page.getByRole("button", { name: new RegExp(`^${name}\\b`) }).click();
    picked += 1;
    await expect(
      page.getByRole("button", { name: new RegExp(`^Open.*The stranger.*${picked} pile`) }),
    ).toBeVisible({ timeout: 20_000 });
  }
  await page.waitForTimeout(1500);
  await snap(page, "StaffDashboardPicked", STAFF);
  await projector.waitForTimeout(3500);
  await snap(projector, "ProjectorPicked", WALL, false);

  // Round two opens with the picked piles as choices; a vote lands.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: /^Open.*The stranger/ }).click();
  const roundTwo = await until(
    () => call<Face>(page, "/live/p/arrive", { token }),
    (value) => value.relay?.openRound !== null && value.relay?.openRound !== roundOne,
  );
  const vote = roundTwo.relay?.questions[0]?.question as string;
  await phone.waitForTimeout(4000);
  await snap(phone, "PhoneRoundTwo", [390]);
  await projector.waitForTimeout(3500);
  await snap(projector, "ProjectorNextOpens", WALL, false);
  for (let seat = 0; seat < PHONES; seat += 1) {
    const begun = await call<{ response: string }>(page, "/live/p/begin", {
      token,
      device: `phone-${seat}`,
    });
    await call(page, "/live/p/answer", {
      response: begun.response,
      question: `${vote}#1`,
      value: ["Pace", "Examples", "Questions"][seat % 3],
    });
    await call(page, "/live/p/submit", { response: begun.response });
  }
  await phone.getByText("Pace", { exact: true }).first().click();
  await phone.getByRole("button", { name: "Hand in" }).click();
  await phone.waitForTimeout(4000);
  await snap(phone, "PhoneAfterVote", [390]);
  await page.waitForTimeout(3500);
  await snap(page, "StaffDashboardVote", STAFF);
  await projector.waitForTimeout(3500);
  await snap(projector, "ProjectorVote", WALL, false);

  // Show round one again while round two is open.
  await page.setViewportSize({ width: 1440, height: 900 });
  const showAgain = page.getByRole("button", { name: /Show.*again/ }).first();
  if (await showAgain.isVisible().catch(() => false)) {
    await showAgain.click();
    await page.waitForTimeout(2000);
    await snap(page, "StaffDashboardShowAgain", STAFF);
  }

  // Close the run: the wall kept, the phone closed, the list after.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Close run", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close run", exact: true })
    .first()
    .click();
  await until(
    () => call<Face>(page, "/live/p/arrive", { token }),
    (value) => value.relay?.openRound === null,
  );
  await page.waitForTimeout(3500);
  await snap(page, "StaffDashboardClosed", STAFF);
  await projector.waitForTimeout(3500);
  await snap(projector, "ProjectorClosed", WALL, false);
  await phone.waitForTimeout(4000);
  await snap(phone, "PhoneClosed", [390]);
  await page.goto("/staff/live");
  await page.waitForTimeout(2500);
  await snap(page, "LiveListAfter", STAFF);

  await projector.close();
  await phoneContext.close();
});
