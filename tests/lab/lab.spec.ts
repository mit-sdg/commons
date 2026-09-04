import { expect, type Page, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Three films of the wall lab: the projector taking the sorting wave across
 * two polls, the dashboard taking the same run one card at a time, and the
 * phone at the end of the wave. Each plays the lab's own clock from a moment
 * just before the motion starts and stops once the clock has passed it, then
 * holds while the wall finishes moving, so the recording carries the whole
 * flight and can be stepped frame by frame. Motion is left alone — the lab is
 * filmed the way a room sees it.
 */

const OUT = resolve(import.meta.dirname, "../../test-results/lab");
/** The lab's clock, read from the readout beside the scrubber. */
const READOUT = "span[data-lab-time]";
/** The dev server's own corner badge, which is not part of the wall. */
const BARE = "nextjs-portal { display: none !important; }";
/**
 * How long the film runs on after the lab's clock stops. The wall's motion
 * keeps its own time — a wave delivered at the last poll is still crossing the
 * screen when the clock is paused — so the camera waits for it to land.
 */
const SETTLE_MS = 12_000;

/** The lab clock's time in milliseconds, as the readout carries it. */
async function labTime(page: Page): Promise<number> {
  const raw = await page.locator(READOUT).getAttribute("data-lab-time");
  return Number(raw ?? 0);
}

/** Waits for the lab's clock to reach `mark`, letting it play at its own rate. */
async function played(page: Page, mark: number) {
  await expect
    .poll(() => labTime(page), { timeout: 180_000, intervals: [250] })
    .toBeGreaterThanOrEqual(mark);
}

/**
 * One film: the lab opened playing at a moment, left to run until its clock
 * passes `until`, then paused and photographed. The video is saved under the
 * given name once the page has closed, which is when the file is complete.
 */
async function film(page: Page, name: string, url: string, until: number) {
  mkdirSync(OUT, { recursive: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(url);
  await page.addStyleTag({ content: BARE });
  await expect(page.locator(READOUT)).toBeVisible();
  await played(page, until);
  await page.getByRole("button", { name: "Pause" }).click();
  await page.waitForTimeout(SETTLE_MS);
  // The clock only ever runs forward; a film that starts over is not one.
  expect(await labTime(page)).toBeGreaterThanOrEqual(until);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const video = page.video();
  await page.close();
  await video?.saveAs(`${OUT}/${name}.webm`);
}

// The sorting wave as the projector receives it: two polls carry it, and the
// clock runs on past the second so the last cards land.
test("the projector's sort wave", async ({ page }) => {
  await film(page, "projector-wave", "/lab/wall?surface=projector&t=12500&play", 32_000);
});

// The same run trickled onto the dashboard, one card a second, filmed from the
// moment the last seat has arrived and the placements begin.
test("the dashboard trickle", async ({ page }) => {
  await film(
    page,
    "dashboard-trickle",
    "/lab/wall?surface=dashboard&mode=trickle&gap=1000&t=48000&play",
    63_000,
  );
});

// The phone through the same stretch: one column, the cards arriving in it.
test("the phone at the wave", async ({ page }) => {
  await film(page, "phone-wave", "/lab/wall?surface=phone&t=12500&play", 32_500);
});

// A vote over five choices as the projector receives it: ballots arrive
// already in their piles, so the bars grow with no tray in between.
test("the projector's vote", async ({ page }) => {
  await film(
    page,
    "projector-vote",
    "/lab/wall?trace=vote-5&surface=projector&t=2500&play",
    16_000,
  );
});

// A list round with three parts through the sorting wave on the dashboard:
// each card carries its part's label into its pile.
test("the dashboard's list round", async ({ page }) => {
  await film(page, "dashboard-list", "/lab/wall?trace=list&surface=dashboard&t=12500&play", 32_000);
});
