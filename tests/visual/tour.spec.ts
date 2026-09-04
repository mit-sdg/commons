import { expect, type Page, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The relay tour: one three-round relay written through the same requests the
 * editor sends, then walked through every staff, projector, and phone screen
 * it has — the shelf, the editor, the drafting panel, the overview, the run,
 * and the wall — photographed at the widths the design mockups were drawn for.
 * Reduced motion is emulated everywhere, so the wall paints its snapshot at
 * once and every shot is of a settled screen. The tour runs twice, in light
 * and in dark; the dark shots carry a `-dark` suffix.
 */

const OUT = process.env.TOUR_OUT ?? resolve(import.meta.dirname, "../../test-results/tour-shots");
const HOST = { username: "mara", password: "password123" };
const STAFF = [1440, 768, 390] as const;
const WALL = [1920, 768] as const;
const PHONE = [390] as const;
const PHONES = 24;
const WORDS = ["add", "save", "keep", "see", "open", "visit", "delete", "remove", "forget"];
const TITLE = "Three verbs, then a stranger";
const THEMES = ["light", "dark"] as const;

/** The suffix the running theme puts on every shot's name. */
let stamp = "";

/** Chooses dark before the page's first paint, the way the toggle remembers it. */
const darken = () => {
  try {
    const storing = globalThis as {
      localStorage?: { setItem(key: string, value: string): void };
    };
    storing.localStorage?.setItem("theme", "dark");
  } catch {
    // A browser that refuses storage stays light.
  }
};

async function signIn(page: Page, account = HOST) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill(account.username);
  await page.getByRole("textbox", { name: "Password" }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
}

/** Calls the edge as the page's signed-in host; the cookie is passed by hand. */
async function call<Value>(page: Page, path: string, data: unknown): Promise<Value> {
  const cookies = await page.context().cookies();
  const cookie = cookies.map((entry) => `${entry.name}=${entry.value}`).join("; ");
  const response = await page.request.post(`/api${path}`, {
    data,
    headers: cookie === "" ? {} : { Cookie: cookie },
  });
  return (await response.json()) as Value;
}

/** Poll a read until it settles into the expected shape. */
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
 * growing the viewport to the page, so sticky headers stay put; the wall and
 * anything standing over the page are one screen.
 */
async function snap(page: Page, name: string, widths: readonly number[], whole = true) {
  for (const width of widths) {
    const base = heights[width] ?? 900;
    await page.setViewportSize({ width, height: base });
    await page.waitForTimeout(400);
    if (whole) {
      const tall = (await page.evaluate("document.documentElement.scrollHeight")) as number;
      await page.setViewportSize({ width, height: Math.min(Math.max(base, tall), 5000) });
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: `${OUT}/${name}${stamp}@${width}.png` });
  }
}

/** Back to the widest desk, which every interaction is made at. */
async function desk(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
}

interface Face {
  relay: {
    openRound: string | null;
    questions: {
      question: string;
      choices: string[];
      parts: string[];
      context: { name: string }[];
    }[];
  } | null;
}

interface WallRead {
  wall: {
    cards: { value: string; pile: string | null; model: boolean }[];
    piles: { pile: string; name: string; count: number; picked: string | null }[];
  } | null;
}

for (const theme of THEMES) {
  test(`the tour, ${theme}`, async ({ browser, page }) => {
    test.setTimeout(880_000);
    mkdirSync(OUT, { recursive: true });
    stamp = theme === "dark" ? "-dark" : "";
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (theme === "dark") await page.addInitScript(darken);
    await signIn(page);

    // The relay is written through the same requests the editor sends: a list
    // round, a write round taking its groups as context, and a vote round
    // taking the same groups as its choices.
    const planned = await call<{ relay: string }>(page, "/live/relays/plan", { title: TITLE });
    const first = await call<{ leg: string }>(page, "/live/relays/add-round", {
      relay: planned.relay,
      title: "Three verbs",
      prompt: "Three verbs a bookmark needs.",
      parts: ["one", "two", "three"],
      cap: 0,
      choices: [],
    });
    const second = await call<{ leg: string }>(page, "/live/relays/add-round", {
      relay: planned.relay,
      title: "The stranger",
      prompt: "Only these verbs. What is it?",
      parts: ["answer"],
      cap: 0,
      choices: [],
    });
    const third = await call<{ leg: string }>(page, "/live/relays/add-round", {
      relay: planned.relay,
      title: "The best verb",
      prompt: "Which group names the stranger best?",
      parts: [],
      cap: 0,
      choices: [],
    });
    await call(page, "/live/relays/set-takes", {
      leg: second.leg,
      source: first.leg,
      use: "context",
    });
    await call(page, "/live/relays/set-takes", {
      leg: third.leg,
      source: first.leg,
      use: "choices",
    });

    // The shelf, and what New offers.
    await page.goto("/staff/live");
    await expect(page.getByRole("link", { name: TITLE }).first()).toBeVisible();
    await snap(page, "Shelf", STAFF);
    await desk(page);
    await page.getByRole("button", { name: "New" }).click();
    await expect(page.getByRole("menuitem", { name: "Relay" })).toBeVisible();
    await snap(page, "ShelfNew", [1440], false);
    await page.getByRole("menuitem", { name: "Relay" }).click();
    await page.waitForURL(/\/staff\/live\/new\?kind=relay$/, { timeout: 60_000 });
    await page.getByRole("textbox", { name: "Title" }).fill("A relay of your own");
    await snap(page, "NewRelay", STAFF);
    await desk(page);
    await page.getByRole("link", { name: "Cancel" }).click();
    await page.waitForURL(/\/staff\/live$/, { timeout: 20_000 });

    // The editor: the kind selector, the takes line, and one round previewed as
    // the phone will meet it.
    await desk(page);
    await page.goto(`/staff/live/relay/${planned.relay}/edit`);
    await expect(page.getByRole("textbox", { name: "Title" }).nth(2)).toHaveValue("The stranger");
    await page.getByRole("button", { name: "Preview" }).nth(1).click();
    await expect(page.getByText(/^① \w+ · \d+$/).first()).toBeVisible();
    await snap(page, "RelayEditor", STAFF);

    // Drafting a relay with the model: the brief, and the lines it offers back.
    await desk(page);
    await page.goto("/staff/live/draft?kind=relay");
    await page
      .getByLabel("Your description")
      .fill("Three verbs for a concept, then a stranger guesses it from the verbs alone.");
    await snap(page, "DraftRelay", STAFF);
    await desk(page);
    await page.getByRole("button", { name: "Draft", exact: true }).click();
    await page.waitForURL(/\/staff\/live\/relay\/[0-9a-f-]{36}\/edit\?(draft|ask)=/, { timeout: 20_000 });
    await expect(page.getByText("add round").first()).toBeVisible({ timeout: 60_000 });
    await snap(page, "DraftRelayPanel", STAFF);
    await desk(page);

    // The overview, read-only, and the launch that opens the run.
    await page.goto(`/staff/live/relay/${planned.relay}`);
    await expect(page.getByRole("heading", { name: "The best verb" })).toBeVisible();
    await snap(page, "RelayOverview", STAFF);
    await desk(page);
    await page.getByRole("button", { name: "Launch" }).click();
    await page.waitForURL(/\/staff\/live\/run\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    const run = page.url().split("/").pop() as string;
    const standing = await call<{ run: { token: string; code: string } }>(
      page,
      "/live/relays/run",
      {
        run,
      },
    );
    const token = standing.run.token;

    // The run before any round opens, on all three screens.
    await snap(page, "RunBefore", STAFF);

    const projector = await browser.newPage();
    await projector.emulateMedia({ reducedMotion: "reduce" });
    if (theme === "dark") await projector.addInitScript(darken);
    await projector.context().addCookies(await page.context().cookies());
    await projector.goto(`/staff/live/run/${run}/project`);
    await projector.waitForTimeout(2500);
    await snap(projector, "ProjectorBefore", WALL, false);

    const phoneContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const phone = await phoneContext.newPage();
    if (theme === "dark") await phone.addInitScript(darken);
    await phone.goto(`/q/${token}`);
    await phone.waitForTimeout(2500);
    await snap(phone, "PhoneBefore", PHONE);

    // Round one opens: the empty tray, and the phone's three boxes.
    await desk(page);
    await page.getByRole("button", { name: /^Open.*Three verbs/ }).click();
    const face = await until(
      () => call<Face>(page, "/live/p/arrive", { token }),
      (value) => value.relay?.openRound !== null && (value.relay?.questions.length ?? 0) > 0,
    );
    const roundOne = face.relay?.openRound as string;
    const question = face.relay?.questions[0]?.question as string;
    await phone.waitForTimeout(4000);
    await snap(phone, "PhoneRoundOne", PHONE);

    // The room streams in: most hand in, three are still writing.
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

    // The tour's own phone writes its three verbs and hands them in.
    await phone.getByRole("textbox", { name: "one" }).fill("bookmark");
    await phone.getByRole("textbox", { name: "two" }).fill("revisit");
    await snap(phone, "PhoneWriting", PHONE);
    await phone.getByRole("textbox", { name: "three" }).fill("forget");
    await phone.getByRole("button", { name: "Hand in" }).click();
    await phone.waitForTimeout(4000);
    await snap(phone, "PhoneHandedIn", PHONE);
    await page.waitForTimeout(3500);
    await snap(page, "RunRoundOne", STAFF);
    await projector.waitForTimeout(3500);
    await snap(projector, "ProjectorRoundOne", WALL, false);

    // One model participant takes a seat, then the model sorts the wall.
    await desk(page);
    await page.getByRole("textbox", { name: "Seats" }).fill("1");
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
    await snap(page, "RunSorted", STAFF);
    await projector.waitForTimeout(3500);
    await snap(projector, "ProjectorSorted", WALL, false);

    // Round one closes and the pick control carries its fullest piles onward.
    for (const response of writing) await call(page, "/live/p/submit", { response });
    await desk(page);
    await page.getByRole("button", { name: /^Close.*Three verbs/ }).click();
    await expect(page.getByRole("button", { name: /^Open.*The stranger.*3 piles/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(1500);
    await snap(page, "RunPicked", STAFF);
    await projector.waitForTimeout(3500);
    await snap(projector, "ProjectorPicked", WALL, false);

    // Round two opens with those groups above its prompt on the phone.
    await desk(page);
    await page.getByRole("button", { name: /^Open.*The stranger/ }).click();
    const roundTwo = await until(
      () => call<Face>(page, "/live/p/arrive", { token }),
      (value) => value.relay?.openRound !== null && value.relay?.openRound !== roundOne,
    );
    const stranger = roundTwo.relay?.questions[0]?.question as string;
    await phone.waitForTimeout(4000);
    await snap(phone, "PhoneContext", PHONE);
    await page.waitForTimeout(3500);
    await snap(page, "RunRoundTwo", STAFF);
    await projector.waitForTimeout(3500);
    await snap(projector, "ProjectorRoundTwo", WALL, false);

    // The strip turns the dashboard back to the closed round's wall, and a pile
    // spreads out to every card in it.
    await desk(page);
    await page
      .getByRole("main")
      .getByRole("button", { name: /Three verbs/ })
      .first()
      .click();
    await expect(page.getByRole("main").getByText("Three verbs a bookmark needs.")).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(1500);
    await snap(page, "RunEarlierWall", STAFF);
    await desk(page);
    await page.getByRole("button", { name: "Spread Pace", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(800);
    await snap(page, "Spread", STAFF, false);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    // The room answers round two, and it closes.
    for (let seat = 0; seat < PHONES; seat += 1) {
      const begun = await call<{ response: string }>(page, "/live/p/begin", {
        token,
        device: `phone-${seat}`,
      });
      await call(page, "/live/p/answer", {
        response: begun.response,
        question: `${stranger}#1`,
        value: seat % 2 === 0 ? "a bookmark" : "a reading list",
      });
      await call(page, "/live/p/submit", { response: begun.response });
    }
    await phone.getByRole("textbox", { name: "answer" }).fill("a bookmark");
    await phone.getByRole("button", { name: "Hand in" }).click();
    await phone.waitForTimeout(3000);
    await desk(page);
    await page.getByRole("button", { name: /^Close.*The stranger/ }).click();
    await expect(page.getByRole("button", { name: /^Open.*The best verb/ })).toBeEnabled({
      timeout: 20_000,
    });

    // Round three is a vote on those same groups: the bars, and the phone that
    // cast one of them.
    await page.getByRole("button", { name: /^Open.*The best verb/ }).click();
    const roundThree = await until(
      () => call<Face>(page, "/live/p/arrive", { token }),
      (value) =>
        value.relay?.openRound !== null &&
        value.relay?.openRound !== roundTwo.relay?.openRound &&
        (value.relay?.questions[0]?.choices.length ?? 0) > 0,
    );
    const vote = roundThree.relay?.questions[0]?.question as string;
    const choices = roundThree.relay?.questions[0]?.choices ?? [];
    for (let seat = 0; seat < 5; seat += 1) {
      const begun = await call<{ response: string }>(page, "/live/p/begin", {
        token,
        device: `phone-${seat}`,
      });
      // A vote round carries no parts, so its one item is the question itself.
      await call(page, "/live/p/answer", {
        response: begun.response,
        question: vote,
        value: choices[seat % choices.length] as string,
      });
      await call(page, "/live/p/submit", { response: begun.response });
    }
    await phone.waitForTimeout(4000);
    await phone.getByRole("button", { name: choices[0] as string }).click();
    await phone.getByRole("button", { name: "Hand in" }).click();
    await phone.waitForTimeout(4000);
    await snap(phone, "PhoneVoted", PHONE);
    await page.waitForTimeout(3500);
    await snap(page, "RunVote", STAFF);
    await projector.waitForTimeout(3500);
    await snap(projector, "ProjectorVote", WALL, false);

    // The run closes: the wall is kept, and the phone is told.
    await desk(page);
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
    await snap(page, "RunClosed", STAFF);
    await projector.waitForTimeout(3500);
    await snap(projector, "ProjectorClosed", WALL, false);
    await phone.waitForTimeout(4000);
    await snap(phone, "PhoneClosed", PHONE);

    // The relay is retired from its overview, and the shelf folds it away.
    await desk(page);
    await page.goto(`/staff/live/relay/${planned.relay}`);
    await page.getByRole("button", { name: "Retire" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Retire", exact: true }).click();
    await expect(page.getByText("Retired", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.goto("/staff/live");
    await page.getByRole("button", { name: /^Show retired/ }).click();
    await expect(page.getByRole("link", { name: TITLE }).first()).toBeVisible();
    await page.waitForTimeout(1000);
    await snap(page, "ShelfRetired", STAFF);

    await projector.close();
    await phoneContext.close();
  });
}
