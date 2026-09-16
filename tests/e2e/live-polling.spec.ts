import { expect, type Page, type Request, test } from "@playwright/test";

/**
 * How the live room polls when the network does not answer: one request in
 * flight per poller, a wait that doubles after each miss, a client deadline at
 * ten seconds, a phone that stops reading a closed round's wall once it has
 * settled, and a staff board that never falls back to its loading state when a
 * round closes or opens under a wall it is already showing. And what the
 * network coming back is worth: a phone off the network for three misses says
 * nothing while it is silent and reads again within a cadence of the network's
 * return, rather than waiting out the wait its misses grew.
 */

const HOST = { username: "mara", password: "password123" };
const WALL = "/api/live/p/wall";
const ARRIVE = "/api/live/p/arrive";
const PROMPT_ONE = "What would you change first?";
const PROMPT_TWO = "What would you keep?";
const ANSWER_ONE = "Keep the drafts when a session expires";
const ANSWER_TWO = "The wall, exactly as it stands";
const LOADING = "Loading the wall…";

/** The phone and the board both poll at this cadence while they are answered. */
const CADENCE_MS = 3_000;
/** How long a phone with a round on it goes unanswered before it says so. */
const PHONE_STALE_MS = 30_000;
/** The wall poller's wait after three misses: 3 → 6 → 12 → 24 seconds. */
const GROWN_WAIT_MS = 24_000;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill(HOST.username);
  await page.getByRole("textbox", { name: "Password" }).fill(HOST.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/");
}

/** Calls the edge as the page's signed-in host; the cookie is passed by hand. */
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

/** A promise a route handler waits on, opened by hand when the test lets go. */
function gate() {
  let open!: () => void;
  const held = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { held, open };
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * What one endpoint's requests did on a page: when each left, when it came
 * back and whether it came back at all, and the most that were ever out at
 * once — which is what an in-flight guard is worth.
 */
function watch(page: Page, path: string) {
  const out: { at: number; request: Request }[] = [];
  const back: { at: number; failure: string | null; request: Request }[] = [];
  const pending = new Set<Request>();
  let peak = 0;
  const mine = (request: Request) => pathOf(request.url()) === path;
  page.on("request", (request) => {
    if (!mine(request)) return;
    out.push({ at: Date.now(), request });
    pending.add(request);
    peak = Math.max(peak, pending.size);
  });
  const ended = (request: Request, failure: string | null) => {
    if (!mine(request) || !pending.has(request)) return;
    pending.delete(request);
    back.push({ at: Date.now(), failure, request });
  };
  page.on("requestfinished", (request) => ended(request, null));
  page.on("requestfailed", (request) => ended(request, request.failure()?.errorText ?? "failed"));
  return {
    out,
    back,
    get peak() {
      return peak;
    },
    /** Forget the peak so far; a request still out counts as the one it is. */
    forgetPeak() {
      peak = pending.size;
    },
    leftAt(request: Request) {
      return out.find((entry) => entry.request === request)?.at ?? null;
    },
    cameBack(request: Request) {
      return back.find((entry) => entry.request === request) ?? null;
    },
  };
}

type Mode = "pass" | "hold" | "abort";

test("the phone polls one at a time, waits longer after each miss, and lets a settled wall be", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  await signIn(page);

  const { relay } = await call<{ relay: string }>(page, "/live/relays/plan", {
    title: "Polling under held routes",
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
  const one = await add("First", PROMPT_ONE);
  const two = await add("Second", PROMPT_TWO);
  const { run, token } = await call<{ run: string; token: string }>(page, "/live/relays/launch", {
    relay,
  });

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const first = await call<{ round: string }>(page, "/live/relays/open-round", {
      run,
      leg: one.leg,
    });

    // Next's dev server compiles a route the first time it is asked for, and
    // that reload reaches every open page, so the board is opened before the
    // phone is, never in the middle of what the phone is being watched for.
    await page.goto(`/staff/live/run/${run}`);
    const loading = page.getByText(LOADING, { exact: true });
    await expect(
      page.getByRole("heading", { name: "Polling under held routes", exact: true }),
    ).toBeVisible();

    const participant = await phone.newPage();
    const walls = watch(participant, WALL);
    const arrivals = watch(participant, ARRIVE);

    let wallMode: Mode = "pass";
    let wallGate = gate();
    await participant.route(`**${WALL}`, async (route) => {
      if (wallMode === "abort") {
        await route.abort("failed");
        return;
      }
      if (wallMode === "hold") await wallGate.held;
      // The client may have given up on this one while it was held.
      await route.continue().catch(() => undefined);
    });
    let arriveMode: Mode = "pass";
    let arriveGate = gate();
    await participant.route(`**${ARRIVE}`, async (route) => {
      if (arriveMode === "abort") {
        await route.abort("failed");
        return;
      }
      if (arriveMode === "hold") await arriveGate.held;
      await route.continue().catch(() => undefined);
    });

    await participant.goto(`/q/${token}`);
    const box = participant.getByRole("textbox").first();
    await expect(box).toBeVisible();
    await box.fill(ANSWER_ONE);
    await box.blur();
    await participant.getByRole("button", { name: "Hand in", exact: true }).click();
    await expect(
      participant.getByRole("heading", { name: "Response received", exact: true }),
    ).toBeVisible();

    // The answered cadence, before anything is held.
    await expect
      .poll(() => walls.out.length, { timeout: 20_000, message: "the wall poller runs" })
      .toBeGreaterThanOrEqual(3);
    // The poller asks on its own three-second tick, counted from the ask, so
    // an answered read is followed by the next one cadence out.
    const healthy = walls.out[2]!.at - walls.out[1]!.at;
    expect(healthy, `answered wall cadence ${healthy}ms`).toBeGreaterThan(CADENCE_MS - 1_000);
    expect(healthy, `answered wall cadence ${healthy}ms`).toBeLessThan(CADENCE_MS + 1_000);

    // (a) One request in flight per poller. Both routes are held and nothing is
    // answered; a poller with no guard would stack a fresh read every cadence.
    const heldFrom = walls.out.length;
    const arrivedFrom = arrivals.out.length;
    wallMode = "hold";
    wallGate = gate();
    arriveMode = "hold";
    arriveGate = gate();
    await expect
      .poll(() => walls.out.length > heldFrom && arrivals.out.length > arrivedFrom, {
        timeout: 20_000,
        message: "both pollers have a request out",
      })
      .toBe(true);
    walls.forgetPeak();
    arrivals.forgetPeak();
    // A deliberate ten-second window: the point is what is *not* issued in it,
    // so there is no event to wait for.
    const window = Date.now();
    await participant.waitForTimeout(10_000);
    expect(walls.peak, "wall reads out at once").toBeLessThanOrEqual(1);
    expect(arrivals.peak, "arrive reads out at once").toBeLessThanOrEqual(1);
    expect(
      walls.out.filter((entry) => entry.at >= window).length,
      "wall reads issued while one was already out",
    ).toBe(0);
    expect(
      arrivals.out.filter((entry) => entry.at >= window).length,
      "arrive reads issued while one was already out",
    ).toBe(0);
    const heldWall = walls.out[heldFrom]!.request;
    arriveMode = "pass";
    arriveGate.open();

    // (b) The client's own deadline, then the wait that doubles after each miss.
    await expect
      .poll(() => walls.cameBack(heldWall) !== null, {
        timeout: 25_000,
        message: "a held wall poll gives up on its own",
      })
      .toBe(true);
    const gaveUp = walls.cameBack(heldWall)!;
    const deadline = gaveUp.at - walls.leftAt(heldWall)!;
    expect(gaveUp.failure, "a poll past its deadline is a failed request").not.toBeNull();
    expect(deadline, `client deadline ${deadline}ms`).toBeGreaterThan(8_500);
    expect(deadline, `client deadline ${deadline}ms`).toBeLessThan(12_000);

    // A miss doubles the wait, and the poller only asks on its cadence, so the
    // next read is six seconds out, not three.
    wallMode = "abort";
    wallGate.open();
    const second = await participant.waitForRequest((request) => pathOf(request.url()) === WALL, {
      timeout: 25_000,
    });
    const afterOneMiss = walls.leftAt(second)! - gaveUp.at;
    expect(afterOneMiss, `wait after one miss ${afterOneMiss}ms`).toBeGreaterThan(4_500);
    expect(afterOneMiss, `wait after one miss ${afterOneMiss}ms`).toBeLessThan(10_500);

    await expect.poll(() => walls.cameBack(second) !== null, { timeout: 15_000 }).toBe(true);
    const missedTwice = walls.cameBack(second)!;
    // The third read is answered, so the wait goes back to the cadence after it.
    wallMode = "pass";
    const third = await participant.waitForRequest((request) => pathOf(request.url()) === WALL, {
      timeout: 30_000,
    });
    const afterTwoMisses = walls.leftAt(third)! - missedTwice.at;
    expect(afterTwoMisses, `wait after two misses ${afterTwoMisses}ms`).toBeGreaterThan(10_500);
    expect(afterTwoMisses, `wait after two misses ${afterTwoMisses}ms`).toBeLessThan(16_500);
    expect(
      afterTwoMisses,
      `the wait grew: ${afterOneMiss}ms then ${afterTwoMisses}ms`,
    ).toBeGreaterThan(afterOneMiss);

    await expect.poll(() => walls.cameBack(third) !== null, { timeout: 15_000 }).toBe(true);
    const answered = walls.cameBack(third)!;
    expect(answered.failure, "the released read is answered").toBeNull();
    const fourth = await participant.waitForRequest((request) => pathOf(request.url()) === WALL, {
      timeout: 20_000,
    });
    const afterAnAnswer = walls.leftAt(fourth)! - answered.at;
    expect(afterAnAnswer, `wait after an answer ${afterAnAnswer}ms`).toBeLessThan(
      CADENCE_MS + 3_500,
    );

    // The board has been watching the same run since before the phone opened.
    const onTheBoard = page.getByText(ANSWER_ONE, { exact: true }).first();
    await expect(onTheBoard).toBeVisible();

    // (b2) The phone off the network for three misses and back on again. The
    // wall poller's wait doubles 3 → 6 → 12 → 24 seconds, so after the third
    // miss its own timer is twenty-four seconds out; the `online` event is
    // what brings the phone back inside a cadence, after a scattered delay of
    // up to one cadence so a room of phones does not ask in the same instant.
    const answeredSoFar = walls.back.filter((entry) => entry.failure === null);
    const lastAnswer = answeredSoFar[answeredSoFar.length - 1]!;
    walls.forgetPeak();
    const missesFrom = walls.back.length;
    const noConnection = participant.getByText(/^No connection/);
    let saidWhileSilent = 0;
    const missesSince = () =>
      walls.back.slice(missesFrom).filter((entry) => entry.failure !== null);
    await phone.setOffline(true);
    // Three misses is eighteen seconds of silence — inside the phone's thirty,
    // so the strip must stay away for the whole of it; the count is taken on
    // every poll of the wait, not once at the end.
    await expect
      .poll(
        async () => {
          if ((await noConnection.count()) > 0) saidWhileSilent += 1;
          return missesSince().length;
        },
        {
          timeout: 60_000,
          intervals: [250],
          message: "three wall reads miss while the phone is off the network",
        },
      )
      .toBeGreaterThanOrEqual(3);
    const missed = missesSince().slice(0, 3);
    const sinceAnswer = missed.map((entry) => entry.at - lastAnswer.at);
    const silence = sinceAnswer[2]!;
    expect(
      silence,
      `three misses at ${sinceAnswer.join("ms, ")}ms after the last answer`,
    ).toBeLessThan(PHONE_STALE_MS);
    expect(
      saidWhileSilent,
      `"No connection" seen over ${silence}ms of silence, under the phone's ${PHONE_STALE_MS}ms`,
    ).toBe(0);
    await expect(noConnection, `the strip stays away over ${silence}ms of silence`).toHaveCount(0);

    // The network comes back. The poller's own timer would not fire for another
    // twenty-four seconds; the wake is what answers for the cadence.
    const outBeforeTheWake = walls.out.length;
    await phone.setOffline(false);
    const networkBack = Date.now();
    await expect
      .poll(() => walls.out.length > outBeforeTheWake, {
        timeout: 40_000,
        intervals: [100],
        message: "the phone reads again once the network is back",
      })
      .toBe(true);
    const woke = walls.out[outBeforeTheWake]!;
    const afterTheNetwork = woke.at - networkBack;
    expect(
      afterTheNetwork,
      `the next wall read left ${afterTheNetwork}ms after the network came back, against a cadence of ${CADENCE_MS}ms and its jitter of up to ${CADENCE_MS}ms (the poller's grown wait was ${GROWN_WAIT_MS}ms)`,
    ).toBeLessThan(CADENCE_MS * 2 + 500);
    await expect
      .poll(() => walls.cameBack(woke.request) !== null, {
        timeout: 15_000,
        message: "the read the wake asked for settles",
      })
      .toBe(true);
    const wokeBack = walls.cameBack(woke.request)!;
    expect(
      wokeBack.failure,
      `the wake's read is answered, ${wokeBack.at - woke.at}ms after it left`,
    ).toBeNull();
    expect(
      walls.peak,
      `wall reads out at once across the drop and the wake: ${walls.peak}, with the next read ${afterTheNetwork}ms after the network came back`,
    ).toBe(1);

    /** How often the loading label was caught standing over a window. */
    const watchLoading = async (ms: number): Promise<number> => {
      const until = Date.now() + ms;
      let seen = 0;
      while (Date.now() < until) {
        if ((await loading.count()) > 0) seen += 1;
        await page.waitForTimeout(40);
      }
      return seen;
    };

    // (c) A closed round's wall settles, and the phone lets it be. Automatic
    // sorting is off, so the close asks nothing and the first read after it is
    // already settled.
    const reads: { open: boolean | null; sortPending: boolean | null; asksOut: number | null }[] =
      [];
    participant.on("response", (response) => {
      if (pathOf(response.url()) !== WALL) return;
      void response.json().then(
        (body: { wall: { open: boolean; sortPending: boolean; asksOut: number } | null }) =>
          reads.push({
            open: body.wall?.open ?? null,
            sortPending: body.wall?.sortPending ?? null,
            asksOut: body.wall?.asksOut ?? null,
          }),
        () => undefined,
      );
    });
    const closing = watchLoading(6_000);
    await call(page, "/live/relays/close-round", { round: first.round });
    await expect
      .poll(
        () =>
          reads.some(
            (read) => read.open === false && read.sortPending === false && read.asksOut === 0,
          ),
        { timeout: 40_000, message: `wall reads after the close: ${JSON.stringify(reads)}` },
      )
      .toBe(true);
    // The board's wall is the round shown, not the round open: closing it moves
    // nothing.
    const seenClosing = await closing;
    expect(seenClosing, "the loading label over round one's close").toBe(0);
    await expect(onTheBoard).toBeVisible();

    const quiet = walls.out.length;
    // A deliberate ten-second window again: the point is that nothing is asked.
    await participant.waitForTimeout(10_000);
    expect(
      walls.out.length - quiet,
      "wall reads a phone issues over ten seconds of a settled closed round",
    ).toBe(0);
    await expect(
      participant.getByText(ANSWER_ONE, { exact: true }).first(),
      "the settled wall stays on the phone",
    ).toBeVisible();

    // (d) The open. The board reads the round that opens for the first time, so
    // a slow read would be the moment a loading state could take the wall's
    // place; the read is held back two seconds to make that moment wide enough
    // to see.
    let slowRound: string | null = null;
    await page.route("**/api/live/walls/read", async (route) => {
      const asked = route.request().postDataJSON() as { round?: string };
      if (slowRound !== null && asked.round === slowRound) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
      await route.continue().catch(() => undefined);
    });
    const opened = await call<{ round: string }>(page, "/live/relays/open-round", {
      run,
      leg: two.leg,
    });
    slowRound = opened.round;
    const opening = watchLoading(8_000);
    // The arrive poller never stopped, so the phone meets the new round on its own.
    await expect(participant.getByText(PROMPT_TWO)).toBeVisible({ timeout: 25_000 });
    const seenOpening = await opening;
    await page.unroute("**/api/live/walls/read");
    // A round that opens is a wall the board has never read, so the identity of
    // its wall query changes and there is nothing held for it: the board stands
    // on its loading state for as long as that first read takes, and the held
    // read above makes that two seconds.
    expect(seenOpening, "the loading label over round two's open").toBeGreaterThan(0);
    // Once the round's wall has landed, nothing is loading and the wall is it.
    await expect(loading).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^Close.*Second/ }),
      "the board is on the round that opened",
    ).toBeVisible();

    // The phone answers the second round, and the board shows the card.
    const secondBox = participant.getByRole("textbox").first();
    await expect(secondBox).toBeVisible();
    await secondBox.fill(ANSWER_TWO);
    await secondBox.blur();
    await participant.getByRole("button", { name: "Hand in", exact: true }).click();
    await expect(
      participant.getByRole("heading", { name: "Response received", exact: true }),
    ).toBeVisible();
    const secondOnTheBoard = page.getByText(ANSWER_TWO, { exact: true }).first();
    await expect(secondOnTheBoard).toBeVisible({ timeout: 25_000 });

    // The close of the last round: the wall shown does not change, so neither
    // does what the board shows.
    const closingTwo = watchLoading(8_000);
    await call(page, "/live/relays/close-round", { round: opened.round });
    const seenClosingTwo = await closingTwo;
    expect(seenClosingTwo, "the loading label over round two's close").toBe(0);
    await expect(secondOnTheBoard).toBeVisible();

    wallMode = "pass";
    arriveMode = "pass";
    wallGate.open();
    arriveGate.open();
    await participant.unrouteAll({ behavior: "ignoreErrors" });
  } finally {
    await call(page, "/live/relays/close", { run }).catch(() => undefined);
    await phone.close().catch(() => undefined);
  }
});
