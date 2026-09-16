import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * The staff screens on the answer-age line. The dashboard says "No
 * connection." ten seconds after its last answer and clears it only on an
 * answer that came within ten seconds of the one before; the projector,
 * whose room can act on nothing, says nothing at all and keeps the wall it
 * last read. Every assertion carries its own timeout, since the rule's ten
 * seconds sits close to the config's fifteen.
 */

/** The line's rule: the age a last answer reaches before the screen says so. */
const STALE_MS = 10_000;
/** The window the line may appear in, measured from the last answer. */
const LINE_AT_LEAST_MS = 9_500;
const LINE_AT_MOST_MS = 14_000;
/** How long a hold runs on the projector before the silence has been proved. */
const SILENCE_MS = 14_000;

async function topOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box, "the element has a box").not.toBeNull();
  return (box as { y: number }).y;
}

async function call<T>(page: Page, path: string, data: unknown): Promise<T> {
  const cookie = (await page.context().cookies())
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  const response = await page.request.post(`/api${path}`, { data, headers: { Cookie: cookie } });
  const result = await response.json();
  expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBe(true);
  expect(result.error, path).toBeUndefined();
  return result as T;
}

/** A one-shot gate the test opens; a held route waits on it. */
function gate(): { opened: Promise<void>; open: () => void } {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

/** Every word the page is currently saying in a live region. */
async function statusWords(page: Page): Promise<string[]> {
  const said = await page.locator('[role="status"]').allTextContents();
  return said.map((text) => text.trim()).filter((text) => text.length > 0);
}

async function waitUntil(page: Page, at: number): Promise<void> {
  await page.waitForTimeout(Math.max(0, at - Date.now()));
}

for (const form of ["relay", "questionnaire"] as const) {
  for (const surface of ["dashboard", "projector"] as const) {
    test(`${form} ${surface} keeps its view through a miss, ${
      surface === "dashboard" ? "names ten seconds of silence" : "says nothing ever"
    }, recovers, and clears on refusal`, async ({ page }) => {
      test.setTimeout(150_000);
      await page.goto("/login");
      await page.getByRole("textbox", { name: "Username" }).fill("mara");
      await page.getByRole("textbox", { name: "Password" }).fill("password123");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL("**/");

      const title = `Recovery ${form} ${surface}`;
      let run: string;
      if (form === "relay") {
        const { relay } = await call<{ relay: string }>(page, "/live/relays/plan", { title });
        await call(page, "/live/relays/add-round", {
          relay,
          title: "Ideas",
          prompt: "Suggest an improvement",
          parts: [],
          choices: [],
          cap: 0,
        });
        ({ run } = await call<{ run: string }>(page, "/live/relays/launch", { relay }));
      } else {
        const { questionnaire } = await call<{ questionnaire: string }>(
          page,
          "/live/quizzes/create",
          {
            title,
            form: "quiz",
            disclosure: "answers",
          },
        );
        await call(page, "/live/quizzes/add-question", {
          questionnaire,
          prompt: "What could improve?",
          choices: ["An improvement", "Nothing"],
          expected: "An improvement",
          explanation: "Any useful idea",
        });
        ({ run } = await call<{ run: string }>(page, "/live/runs/launch", { questionnaire }));
      }

      const path = form === "relay" ? "/api/live/relays/run" : "/api/live/runs/results";
      const held = gate();
      const second = gate();
      try {
        await page.goto(`/staff/live/run/${run}${surface === "projector" ? "/project" : ""}`);
        const heading = page.getByRole("heading", { name: title, exact: true });
        await expect(heading).toBeVisible({ timeout: 15_000 });
        const fault =
          surface === "projector" && form === "relay"
            ? "TIMED_OUT"
            : surface === "dashboard" && form === "questionnaire"
              ? "TRANSPORT_ERROR"
              : "NETWORK_ERROR";
        // One line per screen, and it only ever says this. It stands out of
        // the flow, so the wall (here, its seat) is where it was before the
        // line came, and on the dashboard level with the panel beside it that
        // holds the Open button.
        const stale = page.getByText("No connection.", { exact: true });
        const seat =
          form !== "relay"
            ? null
            : surface === "dashboard"
              ? page.getByText("No round has opened yet.", { exact: true })
              : heading;
        const beside =
          form === "relay" && surface === "dashboard"
            ? page
                .getByRole("button", { name: /^Open\b/ })
                .locator("xpath=ancestor::div[contains(@class, 'rounded-xl')][1]")
            : null;
        const seatTop = seat === null ? null : await topOf(seat);
        if (seat !== null && beside !== null) {
          expect(await topOf(beside)).toBe(seatTop);
        }
        const stillSeated = async () => {
          if (seat !== null) expect(await topOf(seat)).toBe(seatTop);
        };

        /**
         * `pass` answers; `failOnce` misses once and answers after; `hold`
         * parks every poll and never answers (the client gives up at its own
         * ten-second deadline, which is a miss, not an answer); `recover`
         * answers once, then again only when the test opens the second gate;
         * `deny` refuses outright, which is an answer.
         */
        let mode: "pass" | "failOnce" | "hold" | "recover" | "deny" = "pass";
        let polls = 0;
        let failures = 0;
        let delivered = 0;
        let pollsAtHold = 0;
        const refusal =
          form === "relay" ? (surface === "dashboard" ? "UNAUTHORIZED" : "FORBIDDEN") : "NOT_FOUND";
        await page.route(`**${path}`, async (route) => {
          const at = mode;
          polls += 1;
          try {
            if (at === "deny") {
              await route.fulfill({ json: { error: refusal } });
              return;
            }
            if (at === "failOnce") {
              mode = "pass";
              failures += 1;
              // Cover both a real failed transport and resolved client fault envelopes.
              if (fault === "NETWORK_ERROR") await route.abort("failed");
              else await route.fulfill({ json: { error: fault } });
              return;
            }
            if (at === "hold") {
              await held.opened;
              // The hold is over: these requests are the ones the screen has
              // already given up on, so they end as the misses they are and
              // the screen asks again at once.
              failures += 1;
              await route.abort("failed");
              return;
            }
            if (at === "recover") {
              if (delivered >= 1) await second.opened;
              delivered += 1;
            }
            await route.continue();
          } catch {
            // A request the browser has already dropped cannot be answered.
          }
        });
        /** An answer: a response the screen can read, not a fault envelope. */
        const answered = async () => {
          const response = await page.waitForResponse(
            async (candidate) => {
              if (!candidate.url().endsWith(path) || !candidate.ok()) return false;
              try {
                const body: unknown = await candidate.json();
                return !(typeof body === "object" && body !== null && "error" in body);
              } catch {
                return false;
              }
            },
            { timeout: 20_000 },
          );
          expect(response.ok()).toBe(true);
          return Date.now();
        };

        try {
          await test.step("one failure says nothing for the four seconds after it", async () => {
            mode = "failOnce";
            await expect
              .poll(() => failures, { message: "the miss happened", timeout: 15_000 })
              .toBe(1);
            await page.waitForTimeout(4_000);
            await expect(stale).toHaveCount(0, { timeout: 2_000 });
            if (surface === "projector") {
              expect(await statusWords(page), "nothing is said for one miss").toEqual([]);
            }
            await expect(heading).toBeVisible({ timeout: 2_000 });
            await stillSeated();
          });

          const lastAnswerAt = await test.step("the last answer before the silence", async () => {
            const at = await answered();
            mode = "hold";
            pollsAtHold = polls;
            return at;
          });

          if (surface === "dashboard") {
            await test.step("ten seconds without an answer shows the line", async () => {
              await waitUntil(page, lastAnswerAt + 8_000);
              await expect(stale, "nothing said eight seconds in").toHaveCount(0, {
                timeout: 1_000,
              });
              await expect(stale).toBeVisible({
                timeout: Math.max(1_000, lastAnswerAt + LINE_AT_MOST_MS - Date.now()),
              });
              const shownAt = Date.now();
              const after = shownAt - lastAnswerAt;
              console.log(`${form} ${surface}: the line came ${after} ms after the last answer`);
              expect(
                after,
                `the line came ${after} ms after the last answer`,
              ).toBeGreaterThanOrEqual(LINE_AT_LEAST_MS);
              expect(after, `the line came ${after} ms after the last answer`).toBeLessThanOrEqual(
                LINE_AT_MOST_MS,
              );
              await expect(heading).toBeVisible({ timeout: 2_000 });
              await stillSeated();
            });
          } else {
            await test.step("the same silence shows nothing on the projector", async () => {
              while (Date.now() < lastAnswerAt + SILENCE_MS) {
                await expect(stale, "the projector never says it").toHaveCount(0, {
                  timeout: 1_000,
                });
                expect(await statusWords(page), "the projector says no status word").toEqual([]);
                await page.waitForTimeout(700);
              }
              await expect(heading).toBeVisible({ timeout: 2_000 });
              await stillSeated();
            });
          }

          await test.step("polling continues under the silence", async () => {
            expect(
              polls - pollsAtHold,
              "the screen kept asking while it was not being answered",
            ).toBeGreaterThanOrEqual(1);
          });

          await test.step("two answers a cadence apart clear it", async () => {
            mode = "recover";
            const firstAnswer = answered();
            held.open();
            const firstAt = await firstAnswer;
            if (surface === "dashboard") {
              await expect(stale, "one answer alone does not clear the line").toBeVisible({
                timeout: 1_000,
              });
              await waitUntil(page, firstAt + 2_000);
              await expect(stale, "the line still stands two seconds later").toBeVisible({
                timeout: 1_000,
              });
            }
            const secondAnswer = answered();
            second.open();
            const secondAt = await secondAnswer;
            console.log(`${form} ${surface}: the two answers were ${secondAt - firstAt} ms apart`);
            expect(
              secondAt - firstAt,
              `the two answers were ${secondAt - firstAt} ms apart`,
            ).toBeLessThan(STALE_MS);
            await expect(stale, "the second answer clears it").toHaveCount(0, { timeout: 6_000 });
            if (surface === "projector") {
              expect(await statusWords(page), "nothing is left being said").toEqual([]);
            }
            await expect(heading).toBeVisible({ timeout: 2_000 });
            await stillSeated();
            // A subsequent poll proves the recovery left the polling alive.
            const before = polls;
            await expect
              .poll(() => polls, { message: "polling continues after recovery", timeout: 15_000 })
              .toBeGreaterThan(before);
          });

          await test.step("the refusal clears the view", async () => {
            mode = "deny";
            const message =
              refusal === "UNAUTHORIZED"
                ? "Sign in and try again."
                : refusal === "FORBIDDEN"
                  ? "You do not have permission to do that."
                  : "That item is not available.";
            await expect(page.getByText(message, { exact: true })).toBeVisible({ timeout: 15_000 });
            await expect(heading).toHaveCount(0, { timeout: 5_000 });
            if (surface === "projector") {
              // The room can act on nothing, so its refusal is quiet: the
              // page's own state, with no way out offered on the wall.
              await expect(
                page.getByRole("button", { name: /retry|try again/i }),
                "the projector offers no Retry",
              ).toHaveCount(0, { timeout: 2_000 });
              await expect(stale).toHaveCount(0, { timeout: 2_000 });
            }
          });
        } finally {
          held.open();
          second.open();
          mode = "pass";
          await page.unrouteAll({ behavior: "ignoreErrors" });
        }
      } finally {
        held.open();
        second.open();
        await call(page, form === "relay" ? "/live/relays/close" : "/live/runs/close", { run });
      }
    });
  }
}
