import { expect } from "@playwright/test";
import { authenticate, call, test } from "./support/browser.ts";

// Cadence, deadlines, backoff and answer-age boundaries are covered by
// frontend/src/lib/poll.test.ts. This journey checks the actual staff surfaces.
test("a relay dashboard retains its wall through silence, recovers, and clears on refusal", async ({
  page,
}) => {
  const { cookie } = await authenticate(page);
  const { relay } = await call<{ relay: string }>(page, cookie, "/live/relays/plan", {
    title: "Recovery journey",
  });
  await call(page, cookie, "/live/relays/add-round", {
    relay,
    title: "Ideas",
    prompt: "Suggest an improvement",
    parts: [],
    choices: [],
    cap: 0,
  });
  const { run } = await call<{ run: string }>(page, cookie, "/live/relays/launch", { relay });
  await page.clock.install();
  await page.goto(`/staff/live/run/${run}`);
  const heading = page.getByRole("heading", { name: "Recovery journey", exact: true });
  const seat = page.getByText("No round has opened yet.", { exact: true });
  const stale = page.getByText("No connection.", { exact: true });
  await expect(heading).toBeVisible();
  await expect(seat).toBeVisible();
  const top = (await seat.boundingBox())!.y;
  let mode: "fail" | "pass" | "deny" = "fail";
  let polls = 0;
  await page.route("**/api/live/relays/run", async (route) => {
    polls += 1;
    if (mode === "fail") await route.abort("failed");
    else if (mode === "deny") await route.fulfill({ json: { error: "FORBIDDEN" } });
    else await route.fallback();
  });
  try {
    await page.clock.runFor(5_000);
    await expect.poll(() => polls).toBeGreaterThan(0);
    await expect(stale).toHaveCount(0);
    await page.clock.runFor(8_000);
    await expect(stale).toBeVisible();
    await expect(heading).toBeVisible();
    expect((await seat.boundingBox())!.y).toBe(top);

    mode = "pass";
    await expect
      .poll(
        async () => {
          await page.clock.runFor(3_000);
          return stale.count();
        },
        { intervals: [50] },
      )
      .toBe(0);
    await expect(seat).toBeVisible();
    mode = "deny";
    await page.clock.runFor(3_000);
    await expect(
      page.getByText("You do not have permission to do that.", { exact: true }),
    ).toBeVisible();
    await expect(heading).toHaveCount(0);
  } finally {
    await page.unroute("**/api/live/relays/run");
    await call(page, cookie, "/live/relays/close", { run });
  }
});
