import { describe, expect, test } from "bun:test";
import { type RelayRun, roundStanding } from "@/components/live/rounds";
import {
  modelSilent,
  offeredRound,
  openReadiness,
  printedRefusal,
  READING_WALL,
  seatIdentity,
  shownPicks,
  sortingWord,
  standingAfterClose,
  standingAfterRace,
  stillSorting,
  tokenName,
  wallPlace,
} from "./run-relay-board";

const at = (failedAt: string | null, failure: string | null = "gemini") => ({
  failure,
  failedAt,
});

describe("the word beside the model sorts switch", () => {
  const now = Date.parse("2026-09-03T12:00:00.000Z");

  test("says nothing when no ask about the round has failed", () => {
    expect(modelSilent(null, now)).toBe(false);
    expect(modelSilent(at(null, null), now)).toBe(false);
  });

  test("stands while the room would still be waiting on the ask", () => {
    expect(modelSilent(at("2026-09-03T11:59:31.000Z"), now)).toBe(true);
  });

  test("goes once the failure is a minute old", () => {
    expect(modelSilent(at("2026-09-03T11:58:59.000Z"), now)).toBe(false);
  });
});

const say = (
  over: Partial<Parameters<typeof sortingWord>[0]> = {},
): string | null =>
  sortingWord({
    open: true,
    asksOut: 0,
    sortPending: false,
    modelSorts: true,
    sorting: false,
    silent: false,
    notAsked: false,
    ...over,
  });

describe("what the model is doing about the shown round", () => {
  test("sorts while the round is open and an ask is out", () => {
    expect(say({ asksOut: 1 })).toBe("sorting…");
    expect(say({ sorting: true })).toBe("sorting…");
  });

  test("settles while the round is closed and an ask is out", () => {
    expect(say({ open: false, asksOut: 1 })).toBe("settling…");
  });

  test("keeps settling after the provider answers while placements finish", () => {
    expect(say({ open: false, sortPending: true })).toBe("settling…");
  });

  test("explains an in-flight sort with automatic sorting off", () => {
    for (const open of [true, false]) {
      expect(say({ open, modelSorts: false, sortPending: true })).toBe(
        "Finishing current sort; automatic sorting is off.",
      );
      expect(say({ open, modelSorts: false, asksOut: 1 })).toBe(
        "Finishing current sort; automatic sorting is off.",
      );
    }
    expect(say({ modelSorts: false, asksOut: 1, silent: true })).toBe(
      "Finishing current sort; automatic sorting is off.",
    );
    expect(say({ modelSorts: false })).toBeNull();
    expect(say({ open: false, modelSorts: false })).toBe("Settled");
  });

  test("is settled once the closed round has no ask out", () => {
    expect(say({ open: false })).toBe("Settled");
  });

  test("says the model is not answering over anything else", () => {
    expect(say({ silent: true, asksOut: 2 })).toBe(
      "The model is not answering.",
    );
  });

  test("says nothing about the model once the host sorts by hand", () => {
    // The switch off means the host has taken the wall, and the word would
    // only say what they already know.
    expect(say({ silent: true, modelSorts: false })).toBeNull();
    expect(say({ silent: true, modelSorts: false, open: false })).toBe(
      "Settled",
    );
    expect(say({ silent: true, modelSorts: false, notAsked: true })).toBe(
      "Nothing to sort.",
    );
  });

  test("says nothing on an open round with nothing out", () => {
    expect(say()).toBeNull();
    expect(say({ notAsked: true })).toBe("Nothing to sort.");
  });
});

describe("the name a minted seat takes", () => {
  test("carries its place in the order the seats were taken", () => {
    expect(seatIdentity(3)).toMatch(/^seat-3-/);
    expect(seatIdentity(12)).toMatch(/^seat-\d+-/);
  });

  test("names no two seats alike", () => {
    expect(seatIdentity(1)).not.toBe(seatIdentity(1));
  });
});

describe("what a round in the strip is called", () => {
  test("names the round, its title, and how it stands", () => {
    expect(tokenName({ number: 2, title: "Three verbs" }, "open")).toBe(
      "Round 2, Three verbs, open",
    );
    expect(tokenName({ number: 1, title: "Name it" }, "done")).toBe(
      "Round 1, Name it, closed",
    );
  });

  test("leaves out a title a round does not have", () => {
    expect(tokenName({ number: 3, title: "  " }, "next")).toBe("Round 3, next");
  });
});

const ready = (over: Partial<Parameters<typeof openReadiness>[0]> = {}) =>
  openReadiness({
    open: true,
    openRound: null,
    source: { number: 1, ran: true },
    piles: 3,
    picks: 2,
    ...over,
  });

describe("why Open is out before it is pressed", () => {
  test("says the run is closed over anything else", () => {
    expect(ready({ open: false, openRound: 2 })?.word).toBe("CLOSED");
  });

  test("names the round open to the room", () => {
    expect(ready({ openRound: 2 })).toEqual({
      word: "ROUND_OPEN",
      about: { round: 2 },
    });
  });

  test("names the round it takes from when that one has not run", () => {
    expect(ready({ source: { number: 1, ran: false } })).toEqual({
      word: "SOURCE_UNRUN",
      about: { source: 1 },
    });
  });

  test("says to sort when the wall it takes from holds no pile", () => {
    expect(ready({ piles: 0, picks: 0 })?.word).toBe("NO_PILES");
  });

  test("says to pick once piles stand and none is picked", () => {
    expect(ready({ picks: 0 })?.word).toBe("NOTHING_PICKED");
  });

  test("says nothing once a pile is picked", () => {
    expect(ready()).toBeNull();
  });

  test("says nothing while the wall has not been read", () => {
    expect(ready({ piles: null, picks: null })).toBeNull();
  });

  test("says nothing for a round that takes from none", () => {
    expect(ready({ source: null, piles: null, picks: null })).toBeNull();
  });
});

describe("the line for a source wall still being sorted", () => {
  test("counts the cards not on a pile while an ask is out", () => {
    expect(stillSorting({ round: 1, unplaced: 18, pending: true })).toBe(
      "Round 1 is still being sorted: 18 cards are not on a pile yet.",
    );
    expect(stillSorting({ round: 2, unplaced: 1, pending: true })).toBe(
      "Round 2 is still being sorted: 1 card is not on a pile yet.",
    );
  });

  test("says nothing once no ask is out or every card is placed", () => {
    expect(stillSorting({ round: 1, unplaced: 18, pending: false })).toBeNull();
    expect(stillSorting({ round: 1, unplaced: 0, pending: true })).toBeNull();
  });
});

describe("what the Open line says", () => {
  const sorting =
    "Round 1 is still being sorted: 22 cards are not on a pile yet.";
  const line = (
    over: Partial<Parameters<typeof openReadiness>[0]>,
    sortLine: string | null,
  ) => {
    const refusal = ready(over);
    return {
      pressable: refusal === null,
      sentences: [printedRefusal(refusal, sortLine !== null), sortLine].filter(
        (one) => one !== null,
      ),
    };
  };

  test("says only that the wall is still being sorted while nothing is picked", () => {
    expect(line({ picks: 0 }, sorting)).toEqual({
      pressable: false,
      sentences: [sorting],
    });
    expect(line({ piles: 0, picks: 0 }, sorting)).toEqual({
      pressable: false,
      sentences: [sorting],
    });
  });

  test("lets Open be pressed with the sorting line once a pile is picked", () => {
    expect(line({}, sorting)).toEqual({
      pressable: true,
      sentences: [sorting],
    });
  });

  test("says to pick or to sort once the sort has settled", () => {
    expect(line({ picks: 0 }, null)).toEqual({
      pressable: false,
      sentences: ["Pick at least one pile."],
    });
    expect(line({ piles: 0, picks: 0 }, null)).toEqual({
      pressable: false,
      sentences: ["Sort the cards into piles first."],
    });
  });

  test("leaves the open round to its Close button", () => {
    expect(line({ openRound: 2 }, null)).toEqual({
      pressable: false,
      sentences: [],
    });
  });
});

describe("the piles Open sends", () => {
  const pile = (id: string, count: number, picked: boolean) => ({
    pile: id,
    count,
    picked: picked ? id : null,
  });

  test("are the picked ones, fullest first as the closed wall shows them", () => {
    const piles = [
      pile("a", 2, true),
      pile("b", 9, false),
      pile("c", 5, true),
      pile("d", 5, true),
    ] as unknown as Parameters<typeof shownPicks>[0]["piles"];
    expect(shownPicks({ piles })).toEqual(["c", "d", "a"]);
  });

  test("are none when nothing is picked", () => {
    const piles = [pile("a", 2, false)] as unknown as Parameters<
      typeof shownPicks
    >[0]["piles"];
    expect(shownPicks({ piles })).toEqual([]);
  });
});

const RACED = {
  open: true,
  openRound: null,
  opening: null,
  rounds: [
    { leg: "l1", number: 1, round: "r1", figure: { open: false } },
    { leg: "l2", number: 2, round: null, figure: { open: null } },
    { leg: "l3", number: 3, round: null, figure: { open: null } },
  ],
} as unknown as RelayRun;

const raced = (over: Partial<RelayRun>, leg = "l2") =>
  standingAfterRace({ ...RACED, ...over }, leg);

const withRound = (leg: string, round: string, open = false) =>
  RACED.rounds.map((one) =>
    one.leg === leg ? { ...one, round, figure: { ...one.figure, open } } : one,
  );

describe("what a press that lost a race says from the run after it", () => {
  test("says nothing more when the round asked for is open or opening", () => {
    const rounds = withRound("l2", "r2");
    expect(raced({ rounds, openRound: "r2" })).toBe("as-asked");
    expect(raced({ rounds, opening: "r2" })).toBe("as-asked");
  });

  test("names another round open or opening", () => {
    const rounds = withRound("l3", "r3");
    expect(raced({ rounds, openRound: "r3" })).toEqual({
      word: "ROUND_OPEN",
      about: { round: 3 },
    });
    expect(raced({ rounds, opening: "r3" })).toEqual({
      word: "ROUND_OPEN",
      about: { round: 3 },
    });
  });

  test("says the round already ran when it has closed", () => {
    expect(raced({ rounds: withRound("l2", "r2") })).toEqual({
      word: "ROUND_DONE",
      about: { round: 2 },
    });
  });

  test("says the run closed", () => {
    expect(raced({ open: false })).toEqual({
      word: "CLOSED",
      about: {},
    });
  });

  test("leaves the category when the run shows nothing in the way", () => {
    expect(raced({})).toBeNull();
  });

  test("never says the round ran when only its figure has it open", () => {
    expect(raced({ rounds: withRound("l2", "r2", true) })).toBeNull();
  });
});

/** A run read before round 2 opens, and one torn while it opens: its figure is read after the run's open and opening rounds. */
const BEFORE = RACED;
const TORN = { ...RACED, rounds: withRound("l2", "r2", true) } as RelayRun;

const standings = (run: RelayRun) =>
  run.rounds.map((round) => roundStanding(run, round));

describe("the round Open offers", () => {
  test("is the first round not yet run", () => {
    expect(offeredRound(BEFORE, null)?.number).toBe(2);
  });

  test("is the round the strip was tapped for, while it has not run", () => {
    expect(offeredRound(BEFORE, "l3")?.number).toBe(3);
    expect(offeredRound(BEFORE, "l1")?.number).toBe(2);
  });

  test("is the round left opening", () => {
    expect(offeredRound({ ...TORN, opening: "r2" }, "l3")?.number).toBe(2);
  });

  test("moves on once the run names the round open", () => {
    expect(offeredRound({ ...TORN, openRound: "r2" }, null)?.number).toBe(3);
  });

  test("is still the round about to open when a torn read shows it open by its figure alone", () => {
    expect(offeredRound(TORN, null)?.number).toBe(2);
    expect(offeredRound(TORN, "l3")?.number).toBe(3);
  });

  test("is none once every round has run", () => {
    const rounds = withRound("l2", "r2").map((one) =>
      one.leg === "l3" ? { ...one, round: "r3", figure: { open: false } } : one,
    );
    expect(offeredRound({ ...RACED, rounds } as RelayRun, null)).toBeNull();
  });
});

describe("how the strip stands each round of a run", () => {
  test("takes the open round from the run", () => {
    expect(standings({ ...TORN, openRound: "r2" })).toEqual([
      "done",
      "open",
      "next",
    ]);
  });

  test("keeps the round left opening as the one to come", () => {
    expect(standings({ ...TORN, opening: "r2" })).toEqual([
      "done",
      "next",
      "next",
    ]);
  });

  test("shows a torn read as the run stood before the round opened", () => {
    expect(standings(TORN)).toEqual(standings(BEFORE));
    expect(standings(TORN)).toEqual(["done", "next", "next"]);
  });

  test("keeps the open round open when its figure has already closed", () => {
    const closing = {
      ...RACED,
      rounds: withRound("l2", "r2"),
      openRound: "r2",
    };
    expect(standings(closing as RelayRun)).toEqual(["done", "open", "next"]);
  });
});

/** Round 2 left opening while round 1 stands closed. */
const OPENING = { ...TORN, opening: "r2" } as RelayRun;

const afterClose = (error: string, run: RelayRun | null, round = "r2") =>
  standingAfterClose(error, run, round, 2);

describe("what a press of Close round that did not land says", () => {
  test("says nothing more once the round has closed as asked", () => {
    const closed = { ...RACED, rounds: withRound("l2", "r2") } as RelayRun;
    expect(afterClose("TIMED_OUT", closed)).toBe("as-asked");
    expect(afterClose("CONFLICT", closed)).toBe("as-asked");
  });

  test("leaves the failure its own sentence while the round is still opening", () => {
    expect(afterClose("TIMED_OUT", OPENING)).toBeNull();
    expect(afterClose("INTERNAL_ERROR", OPENING)).toBeNull();
    expect(afterClose("CONFLICT", OPENING)).toBeNull();
  });

  test("leaves the failure its own sentence while the round is still open", () => {
    expect(afterClose("TIMED_OUT", { ...TORN, openRound: "r2" })).toBeNull();
  });

  test("says the round is closed only for the refusal to close it again", () => {
    expect(afterClose("CONFLICT", null)).toEqual({
      word: "ROUND_CLOSED",
      about: { round: 2 },
    });
    expect(afterClose("TIMED_OUT", null)).toBeNull();
  });

  test("says the run closed", () => {
    expect(afterClose("TIMED_OUT", { ...OPENING, open: false })).toEqual({
      word: "CLOSED",
      about: {},
    });
  });
});

describe("what stands in the wall's place with no wall to show", () => {
  test("says no round has opened while none is asked for", () => {
    expect(wallPlace({ shown: null, none: false, opening: false })).toBe(
      "No round has opened yet.",
    );
  });

  test("leaves a round opening to the Open line", () => {
    expect(wallPlace({ shown: null, none: false, opening: true })).toBeNull();
  });

  test("names a closed round that closed before it opened", () => {
    expect(
      wallPlace({
        shown: { number: 1, closed: true },
        none: true,
        opening: false,
      }),
    ).toBe("Round 1 closed before it opened.");
  });

  test("is the wall being read until its read answers", () => {
    expect(
      wallPlace({
        shown: { number: 1, closed: true },
        none: false,
        opening: false,
      }),
    ).toBe(READING_WALL);
    expect(
      wallPlace({
        shown: { number: 2, closed: false },
        none: true,
        opening: false,
      }),
    ).toBe(READING_WALL);
  });
});
