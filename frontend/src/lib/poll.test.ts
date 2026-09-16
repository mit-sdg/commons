import { describe, expect, test } from "bun:test";
import {
  adrift,
  nextWait,
  outOfReach,
  POLL_CAP_MS,
  startPolling,
  type Timers,
  type WakeEvent,
} from "./poll.ts";

/**
 * A clock the test moves by hand: `every` keeps the poller's tick to fire,
 * `after` keeps a list of one-shots the test reaches, `listen` keeps the wake
 * handlers the test raises, and `shown` is what the page's visibility says.
 */
function handClock(): Timers & {
  at: number;
  fire: () => void;
  stopped: number;
  /** When the grid was last registered; a re-phased grid ticks from here. */
  everyAt: number;
  shown: boolean;
  raise: (event: WakeEvent) => void;
  reach: (at: number) => void;
  waiting: () => number;
} {
  const waits = new Map<object, { at: number; run: () => void }>();
  const heard = new Map<WakeEvent, Set<() => void>>();
  const clock = {
    at: 0,
    tick: undefined as (() => void) | undefined,
    stopped: 0,
    everyAt: 0,
    shown: true,
    now: () => clock.at,
    every: (run: () => void) => {
      clock.tick = run;
      clock.everyAt = clock.at;
      return "handle";
    },
    stop: () => {
      clock.stopped += 1;
    },
    after: (run: () => void, ms: number) => {
      const handle = {};
      waits.set(handle, { at: clock.at + ms, run });
      return handle;
    },
    cancel: (handle: unknown) => {
      waits.delete(handle as object);
    },
    listen: (event: WakeEvent, handler: () => void) => {
      const handlers = heard.get(event) ?? new Set<() => void>();
      handlers.add(handler);
      heard.set(event, handlers);
      return () => {
        handlers.delete(handler);
      };
    },
    visible: () => clock.shown,
    fire: () => clock.tick?.(),
    /** The world says something, at whoever is still hearing it. */
    raise: (event: WakeEvent) => {
      for (const handler of [...(heard.get(event) ?? [])]) handler();
    },
    /** Move to `at`, running every one-shot due by then at its own due time. */
    reach: (at: number) => {
      const due = [...waits]
        .filter(([, wait]) => wait.at <= at)
        .sort(([, one], [, two]) => one.at - two.at);
      for (const [handle, wait] of due) {
        waits.delete(handle);
        clock.at = wait.at;
        wait.run();
      }
      clock.at = at;
    },
    /** One-shots still to come. */
    waiting: () => waits.size,
  };
  return clock;
}

const settle = () => new Promise<void>((done) => setTimeout(done, 0));

/** A wake's delay, fixed so the test can say when the ask lands. */
const inASecond = () => 1_000;

describe("the wait", () => {
  test("goes back to the cadence on an answer and doubles up to the cap on a miss", () => {
    expect(nextWait(3_000, 3_000, true)).toBe(3_000);
    expect(nextWait(3_000, 3_000, false)).toBe(6_000);
    expect(nextWait(6_000, 3_000, false)).toBe(12_000);
    expect(nextWait(24_000, 3_000, false)).toBe(POLL_CAP_MS);
    expect(nextWait(POLL_CAP_MS, 3_000, false)).toBe(POLL_CAP_MS);
    expect(nextWait(POLL_CAP_MS, 3_000, true)).toBe(3_000);
  });
});

describe("what is out of reach", () => {
  test("transport faults and an unavailable server are; refusals and answers are not", () => {
    for (const error of [
      "NETWORK_ERROR",
      "TIMED_OUT",
      "ABORTED",
      "BAD_JSON",
      "UNAVAILABLE",
    ])
      expect(outOfReach({ error })).toBe(true);
    for (const error of ["CONFLICT", "NOT_FOUND", "UNAUTHORIZED", "CLOSED"])
      expect(outOfReach({ error })).toBe(false);
    expect(outOfReach({ wall: null })).toBe(false);
    expect(outOfReach(null)).toBe(false);
  });
});

describe("one poller", () => {
  test("asks once at a time: a tick during a pending request is skipped", async () => {
    const clock = handClock();
    let asked = 0;
    let answer!: (answered: boolean) => void;
    const stop = startPolling(
      () =>
        new Promise<boolean>((done) => {
          asked += 1;
          answer = done;
        }),
      { everyMs: 3_000, timers: clock },
    );
    expect(asked).toBe(1);
    clock.at = 3_000;
    clock.fire();
    clock.at = 6_000;
    clock.fire();
    expect(asked).toBe(1);
    answer(true);
    await settle();
    clock.at = 9_000;
    clock.fire();
    expect(asked).toBe(2);
    stop();
    expect(clock.stopped).toBe(1);
  });

  test("waits longer after each miss and returns to the cadence on an answer", async () => {
    const clock = handClock();
    const askedAt: number[] = [];
    let answered = false;
    const stop = startPolling(
      async () => {
        askedAt.push(clock.at);
        return answered;
      },
      { everyMs: 3_000, timers: clock },
    );
    await settle();
    // A miss at 0 puts the next ask at 6 s: the tick at 3 s is skipped.
    for (const at of [3_000, 6_000]) {
      clock.at = at;
      clock.fire();
      await settle();
    }
    expect(askedAt).toEqual([0, 6_000]);
    // Another miss doubles again: 12 s after, so 18 s.
    for (const at of [9_000, 12_000, 15_000, 18_000]) {
      clock.at = at;
      clock.fire();
      await settle();
    }
    expect(askedAt).toEqual([0, 6_000, 18_000]);
    // An answer at the next ask puts the poller back on its cadence.
    answered = true;
    for (const at of [
      21_000, 24_000, 27_000, 30_000, 33_000, 36_000, 39_000, 42_000,
    ]) {
      clock.at = at;
      clock.fire();
      await settle();
    }
    expect(askedAt).toEqual([0, 6_000, 18_000, 42_000]);
    clock.at = 45_000;
    clock.fire();
    await settle();
    expect(askedAt).toEqual([0, 6_000, 18_000, 42_000, 45_000]);
    stop();
  });

  test("an answer that took a moment keeps the poller on its cadence", async () => {
    const clock = handClock();
    const askedAt: number[] = [];
    const stop = startPolling(
      async () => {
        askedAt.push(clock.at);
        // The answer lands 40 ms after the ask; the next grid tick is still due.
        clock.at += 40;
        return true;
      },
      { everyMs: 3_000, timers: clock },
    );
    await settle();
    for (const at of [3_000, 6_000, 9_000]) {
      clock.at = at;
      clock.fire();
      await settle();
    }
    expect(askedAt).toEqual([0, 3_000, 6_000, 9_000]);
    stop();
  });

  test("a tick that throws is a miss, and the wait never passes the cap", async () => {
    const clock = handClock();
    const askedAt: number[] = [];
    const stop = startPolling(
      async () => {
        askedAt.push(clock.at);
        throw new Error("gone");
      },
      { everyMs: 3_000, capMs: 9_000, timers: clock },
    );
    await settle();
    for (let at = 3_000; at <= 60_000; at += 3_000) {
      clock.at = at;
      clock.fire();
      await settle();
    }
    expect(askedAt).toEqual([
      0, 6_000, 15_000, 24_000, 33_000, 42_000, 51_000, 60_000,
    ]);
    stop();
  });

  test("a stopped poller asks nothing more, even for an answer still in flight", async () => {
    const clock = handClock();
    let asked = 0;
    let answer!: (answered: boolean) => void;
    const stop = startPolling(
      () =>
        new Promise<boolean>((done) => {
          asked += 1;
          answer = done;
        }),
      { everyMs: 3_000, atOnce: false, timers: clock },
    );
    expect(asked).toBe(0);
    clock.at = 3_000;
    clock.fire();
    expect(asked).toBe(1);
    stop();
    answer(true);
    await settle();
    clock.at = 6_000;
    clock.fire();
    expect(asked).toBe(1);
  });

  test("counts the cadence from a wake's ask: the grid tick comes one cadence after it", async () => {
    const clock = handClock();
    const askedAt: number[] = [];
    const stop = startPolling(
      async () => {
        askedAt.push(clock.at);
        return true;
      },
      { everyMs: 3_000, wakeOn: true, timers: clock, scatter: inASecond },
    );
    await settle();
    clock.reach(3_000);
    clock.fire();
    await settle();
    expect(askedAt).toEqual([0, 3_000]);
    // The network comes back at 3.2 s; the wake asks at 4.2 s.
    clock.reach(3_200);
    clock.raise("online");
    clock.reach(4_200);
    await settle();
    expect(askedAt).toEqual([0, 3_000, 4_200]);
    // The old grid, which would have ticked at 6 s, is stopped at the wake's
    // ask and a new one registered there, so the next tick is at 7.2 s.
    expect(clock.stopped).toBe(1);
    expect(clock.everyAt).toBe(4_200);
    clock.reach(7_200);
    clock.fire();
    await settle();
    expect(askedAt).toEqual([0, 3_000, 4_200, 7_200]);
    stop();
  });

  test("reads the cap again at every tick, so a shortened cap brings the next ask forward", async () => {
    const clock = handClock();
    const askedAt: number[] = [];
    let cap = POLL_CAP_MS;
    const stop = startPolling(
      async () => {
        askedAt.push(clock.at);
        return false;
      },
      { everyMs: 3_000, capMs: () => cap, timers: clock },
    );
    await settle();
    // Misses at 0, 6 s and 18 s grow the wait to 24 s: the next ask is at 42 s.
    for (let at = 3_000; at <= 18_000; at += 3_000) {
      clock.at = at;
      clock.fire();
      await settle();
    }
    expect(askedAt).toEqual([0, 6_000, 18_000]);
    // The screen shortens the cap to two cadences while its line stands: the
    // wait already grown to 24 s comes due 6 s after the miss instead.
    cap = 6_000;
    clock.at = 21_000;
    clock.fire();
    await settle();
    expect(askedAt).toEqual([0, 6_000, 18_000]);
    clock.at = 24_000;
    clock.fire();
    await settle();
    expect(askedAt).toEqual([0, 6_000, 18_000, 24_000]);
    stop();
  });
});

describe("a poller that hears the world come back", () => {
  test("asks after the wake's delay, within a cadence", async () => {
    const clock = handClock();
    const askedAt: number[] = [];
    const stop = startPolling(
      async () => {
        askedAt.push(clock.at);
        return false;
      },
      {
        everyMs: 3_000,
        timers: clock,
        wakeOn: true,
        scatter: inASecond,
      },
    );
    await settle();
    expect(askedAt).toEqual([0]);
    clock.at = 1_000;
    clock.raise("online");
    // The ask is scattered, not immediate: nothing goes out in the same instant.
    expect(askedAt).toEqual([0]);
    clock.reach(1_999);
    await settle();
    expect(askedAt).toEqual([0]);
    clock.reach(2_000);
    await settle();
    expect(askedAt).toEqual([0, 2_000]);
    stop();
  });

  test("two wakes in one cadence ask once", async () => {
    const clock = handClock();
    const askedAt: number[] = [];
    const stop = startPolling(
      async () => {
        askedAt.push(clock.at);
        return false;
      },
      { everyMs: 3_000, timers: clock, wakeOn: true, scatter: inASecond },
    );
    await settle();
    clock.at = 1_000;
    clock.raise("online");
    clock.at = 1_100;
    // The page comes back a breath after the network: still one ask.
    clock.raise("pageshow");
    clock.reach(2_100);
    await settle();
    expect(askedAt).toEqual([0, 2_000]);
    clock.at = 2_500;
    clock.raise("online");
    clock.reach(4_000);
    await settle();
    expect(askedAt).toEqual([0, 2_000]);
    // A cadence after the wake's ask, the world saying so again is news.
    clock.at = 5_100;
    clock.raise("online");
    clock.reach(6_100);
    await settle();
    expect(askedAt).toEqual([0, 2_000, 6_100]);
    stop();
  });

  test("a wake during a pending request asks when it settles", async () => {
    const clock = handClock();
    let asked = 0;
    let answer!: (answered: boolean) => void;
    const stop = startPolling(
      () =>
        new Promise<boolean>((done) => {
          asked += 1;
          answer = done;
        }),
      { everyMs: 3_000, timers: clock, wakeOn: true, scatter: inASecond },
    );
    expect(asked).toBe(1);
    clock.at = 1_000;
    clock.raise("online");
    clock.reach(2_000);
    // The request is still out: the wake waits for it rather than doubling it up.
    expect(asked).toBe(1);
    answer(false);
    await settle();
    expect(asked).toBe(1);
    clock.reach(3_000);
    await settle();
    expect(asked).toBe(2);
    stop();
  });

  test("the wait resets to the cadence only on an answer: a wake's miss keeps it growing", async () => {
    const clock = handClock();
    const askedAt: number[] = [];
    let answered = false;
    const stop = startPolling(
      async () => {
        askedAt.push(clock.at);
        return answered;
      },
      { everyMs: 3_000, timers: clock, wakeOn: true, scatter: inASecond },
    );
    await settle();
    clock.at = 6_000;
    clock.fire();
    await settle();
    expect(askedAt).toEqual([0, 6_000]);
    // A flapping access point: the wake's ask misses too, so the wait goes on
    // growing (12 s to 24 s) rather than pinning the poller at the cadence.
    clock.at = 7_000;
    clock.raise("online");
    clock.reach(8_000);
    await settle();
    expect(askedAt).toEqual([0, 6_000, 8_000]);
    for (let at = 9_000; at <= 30_000; at += 3_000) {
      clock.at = at;
      clock.fire();
      await settle();
    }
    expect(askedAt).toEqual([0, 6_000, 8_000]);
    clock.at = 33_000;
    clock.fire();
    await settle();
    expect(askedAt).toEqual([0, 6_000, 8_000, 33_000]);
    // The network is really back: the wake's ask is answered, and that is what
    // puts the poller on its cadence again.
    answered = true;
    clock.at = 34_000;
    clock.raise("online");
    clock.reach(35_000);
    await settle();
    expect(askedAt).toEqual([0, 6_000, 8_000, 33_000, 35_000]);
    clock.at = 38_000;
    clock.fire();
    await settle();
    expect(askedAt).toEqual([0, 6_000, 8_000, 33_000, 35_000, 38_000]);
    stop();
  });

  test("a hidden poller asks nothing, and asks within a cadence of being shown", async () => {
    const clock = handClock();
    const askedAt: number[] = [];
    clock.shown = false;
    const stop = startPolling(
      async () => {
        askedAt.push(clock.at);
        return true;
      },
      {
        everyMs: 3_000,
        timers: clock,
        pauseWhileHidden: true,
        scatter: inASecond,
      },
    );
    await settle();
    for (const at of [3_000, 6_000]) {
      clock.at = at;
      clock.fire();
      await settle();
    }
    expect(askedAt).toEqual([]);
    // The phone is unlocked: the screen's event, then the scattered delay.
    clock.shown = true;
    clock.at = 7_000;
    clock.raise("visibilitychange");
    clock.reach(8_000);
    await settle();
    expect(askedAt).toEqual([8_000]);
    stop();
  });

  test("a stopped poller ignores every event and fires nothing", async () => {
    const clock = handClock();
    let asked = 0;
    const stop = startPolling(
      async () => {
        asked += 1;
        return true;
      },
      {
        everyMs: 3_000,
        timers: clock,
        wakeOn: true,
        pauseWhileHidden: true,
        scatter: inASecond,
      },
    );
    await settle();
    expect(asked).toBe(1);
    clock.at = 1_000;
    clock.raise("online");
    stop();
    // The wake it was holding goes with it.
    expect(clock.waiting()).toBe(0);
    for (const event of [
      "online",
      "pageshow",
      "visibilitychange",
      "resume",
    ] as WakeEvent[])
      clock.raise(event);
    clock.reach(9_000);
    clock.fire();
    await settle();
    expect(asked).toBe(1);
  });
});

describe("whether a screen has stopped hearing", () => {
  const stale = 10_000;

  test("says nothing before the first answer", () => {
    expect(adrift(null, null, 50_000, stale)).toBe(false);
    expect(adrift(null, 40_000, 50_000, stale)).toBe(false);
  });

  test("stands once the latest answer is as old as the bound", () => {
    expect(adrift(40_000, null, 49_999, stale)).toBe(false);
    expect(adrift(40_000, null, 50_000, stale)).toBe(true);
  });

  test("keeps standing on a lone answer after a gap as long as the bound", () => {
    // A server answering every eleven seconds: the line stays up, steadily.
    expect(adrift(51_000, 40_000, 51_000, stale)).toBe(true);
    expect(adrift(62_000, 51_000, 62_000, stale)).toBe(true);
  });

  test("clears on an answer that came within the bound of the one before", () => {
    expect(adrift(49_000, 40_000, 49_000, stale)).toBe(false);
  });

  test("never keeps standing on the first answer alone", () => {
    expect(adrift(40_000, null, 40_000, stale)).toBe(false);
  });
});
