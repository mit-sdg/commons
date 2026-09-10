import { expect, type Page, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The email tour: the administration console's Email tab, walked through the
 * states an administrator actually meets — Commons' own wording, a draft being
 * reworded beside its live preview, wording that cannot be saved, and the
 * outbox both closed and opened on one redacted message.
 *
 * Every screen is photographed for reading beside the mockups AND compared
 * against a pixel baseline, so a layout that breaks at 390px is caught rather
 * than noticed. Times are masked: a relative time is not a layout. Reduced
 * motion is emulated, so nothing is caught mid-transition.
 *
 * Baselines are untracked, because a rendered screen is platform- and
 * font-dependent and does not belong in the repository's history. Run
 * `bun run shots` once to lay them down locally — the first run reports each
 * missing baseline and fails — then run it again around a change to see what
 * moved. Diffs land in `test-results/`.
 */

const OUT = process.env.TOUR_OUT ?? resolve(import.meta.dirname, "../../test-results/tour-shots");
const ADMIN = { username: "mara", password: "password123" };
const WIDTHS = [1440, 768, 390] as const;
const THEMES = ["light", "dark"] as const;
const HEIGHTS: Record<number, number> = { 1440: 900, 768: 1024, 390: 844 };

/** The wording this tour writes, chosen to wrap at every width photographed. */
const WORDING = {
  subject: "You are invited to 6.1040 Software Design",
  body: [
    "Hello,",
    "",
    "You have a seat in 6.1040. Commons is where the class reads, asks, and hands work in.",
    "",
    "Sign in once before the first lecture so we know your account works.",
  ].join("\n"),
};

/** The roster this tour imports, so the outbox holds the same mail every run. */
const ROSTER = [
  { email: "ada@example.edu", kind: "STUDENT" },
  { email: "grace@example.edu", kind: "STUDENT" },
  { email: "alan@example.edu", kind: "STAFF" },
];

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

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill(ADMIN.username);
  await page.getByRole("textbox", { name: "Password" }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/");
}

/** Calls the edge as the page's signed-in administrator. */
async function call<Value>(page: Page, path: string, data: unknown): Promise<Value> {
  const response = await page.evaluate(
    async ({ path, data }) => {
      const answer = await fetch(`/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return { ok: answer.ok, status: answer.status, body: await answer.json() };
    },
    { path, data },
  );
  expect(response.ok, `${path}: HTTP ${response.status}`).toBe(true);
  return response.body as Value;
}

/**
 * One screen at each width, photographed whole by growing the viewport to the
 * page so a sticky preview column stays where it sits, then compared to its
 * baseline. Relative times are masked; nothing else is.
 */
async function snap(page: Page, name: string, widths: readonly number[] = WIDTHS) {
  for (const width of widths) {
    const base = HEIGHTS[width] ?? 900;
    await page.setViewportSize({ width, height: base });
    await page.waitForTimeout(400);
    const tall = (await page.evaluate("document.documentElement.scrollHeight")) as number;
    await page.setViewportSize({ width, height: Math.min(Math.max(base, tall), 5000) });
    await page.waitForTimeout(400);
    const shot = `${name}${stamp}@${width}.png`;
    await page.screenshot({ path: `${OUT}/${shot}` });
    await expect(page).toHaveScreenshot(shot, {
      fullPage: true,
      mask: [page.locator("time")],
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    });
  }
}

/** No page is photographed while its own preview is still catching up. */
async function settled(page: Page) {
  await expect(page.getByText("Updating…")).toHaveCount(0);
}

for (const theme of THEMES) {
  test(`the email console, ${theme}`, async ({ page }) => {
    test.setTimeout(400_000);
    mkdirSync(OUT, { recursive: true });
    stamp = theme === "dark" ? "-dark" : "";
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (theme === "dark") await page.addInitScript(darken);
    await signIn(page);

    // Each theme starts from Commons' own words, whatever ran before it.
    await page.goto("/admin");
    await call(page, "/mail/reset-template", {});

    await page.goto("/admin");
    await page.getByRole("tab", { name: /^Email/ }).click();

    // Commons' own wording, previewed with the footer every invitation carries.
    const preview = page.getByRole("region", { name: "Invitation preview" });
    await expect(preview).toContainText("EXAMPLE-PASSWORD");
    await expect(page.getByText("Commons' own wording is in use.", { exact: true })).toBeVisible();
    await settled(page);
    await snap(page, "EmailDefaultWording");

    // A draft being reworded: the preview follows it with nothing to press.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("textbox", { name: "Subject", exact: true }).fill(WORDING.subject);
    await page.getByRole("textbox", { name: "Body", exact: true }).fill(WORDING.body);
    await expect(preview).toContainText("Sign in once before the first lecture");
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
    await settled(page);
    await snap(page, "EmailDraftWording");

    // Wording that cannot be saved says so inline and holds the preview back.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("textbox", { name: "Subject", exact: true }).fill("   ");
    await expect(page.getByText("Enter a subject.", { exact: true })).toBeVisible();
    await expect(page.getByText("Paused — fix the wording above.", { exact: true })).toBeVisible();
    await snap(page, "EmailInvalidWording", [1440, 390]);

    // Saved wording, and the mail it queues.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("textbox", { name: "Subject", exact: true }).fill(WORDING.subject);
    await settled(page);
    await page.getByRole("button", { name: "Save wording", exact: true }).click();
    await expect(page.getByText("Invitation wording saved.", { exact: true })).toBeVisible();

    await call(page, "/roster/import", { rows: ROSTER });
    await expect
      .poll(
        async () =>
          (await call<{ messages: { subject: string }[] }>(page, "/mail/list", {})).messages.filter(
            (message) => message.subject === WORDING.subject,
          ).length,
        { timeout: 60_000 },
      )
      .toBe(ROSTER.length);
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Queued/ })).toBeVisible();
    await settled(page);
    await snap(page, "EmailOutbox");

    // One message opened: the credentials in it are redacted server-side.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByRole("button", { name: `Read email: ${WORDING.subject}`, exact: true })
      .first()
      .click();
    await expect(page.getByText("Temporary password: [hidden]").first()).toBeVisible();
    await settled(page);
    await snap(page, "EmailOutboxOpened");

    // Withdrawing the wording brings Commons' own words back for the next send.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: /Use Commons. wording/ }).click();
    await page.getByRole("button", { name: "Restore wording", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Subject", exact: true })).toHaveValue(
      "Your Commons invitation",
    );
    // The mail already queued keeps the words it was written with.
    const queued = await call<{ messages: { subject: string }[] }>(page, "/mail/list", {});
    expect(queued.messages.some((message) => message.subject === WORDING.subject)).toBe(true);
  });
}
