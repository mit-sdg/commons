import { describe, expect, test } from "bun:test";
import {
  ARRIVAL_GAP_MS,
  adopt,
  apply,
  diff,
  dropped,
  LANDING_GAP_MS,
  MAX_LAG_MS,
  type Move,
  merged,
  OPEN_AHEAD_MS,
  placed,
  schedule,
} from "./wall-motion";

const wall = (cards: [string, string | null][], piles: string[]) => ({
  cards: cards.map(([card, pile]) => ({ card, pile, value: card })),
  piles: piles.map((pile) => ({ pile, name: pile, count: 0 })),
});

describe("the moves between two walls", () => {
  test("opens before it places, arrivals land where they are, and a merge closes", () => {
    const shown = wall(
      [
        ["a", null],
        ["b", "p1"],
        ["c", "p2"],
      ],
      ["p1", "p2"],
    );
    const target = wall(
      [
        ["a", "p3"],
        ["b", "p1"],
        ["c", "p1"],
        ["d", "p3"],
      ],
      ["p1", "p3"],
    );
    expect(diff(shown, target)).toEqual<Move[]>([
      { kind: "open", pile: "p3" },
      { kind: "arrive", card: "d" },
      { kind: "place", card: "a", pile: "p3" },
      { kind: "place", card: "c", pile: "p1" },
      { kind: "close", pile: "p2" },
    ]);
  });

  test("playing every move reaches the target, with counts following the cards", () => {
    const shown = wall(
      [
        ["a", null],
        ["b", "p1"],
      ],
      ["p1"],
    );
    const target = wall(
      [
        ["a", "p2"],
        ["b", "p1"],
        ["c", "p1"],
      ],
      ["p1", "p2"],
    );
    let stage = shown;
    for (const move of diff(shown, target)) stage = apply(stage, target, move);
    expect(diff(stage, target)).toEqual([]);
    expect(stage.piles.map((pile) => pile.count)).toEqual([2, 1]);
  });

  test("a card seen on the wall before its pile opens waits for the pile", () => {
    const shown = wall([["a", null]], []);
    const target = wall([["a", "p1"]], ["p1"]);
    const [first, second] = diff(shown, target);
    expect(first).toEqual({ kind: "open", pile: "p1" });
    expect(second).toEqual({ kind: "place", card: "a", pile: "p1" });
    const opened = apply(shown, target, first as Move);
    expect(opened.piles[0]?.count).toBe(0);
    expect(opened.cards[0]?.pile).toBeNull();
  });
});

describe("the wall after a hand edit", () => {
  test("a card moves, and the counts follow it", () => {
    const shown = wall(
      [
        ["a", null],
        ["b", "p1"],
      ],
      ["p1"],
    );
    const moved = placed("a", "p1")(shown);
    expect(moved.cards.map((card) => card.pile)).toEqual(["p1", "p1"]);
    expect(moved.piles[0]?.count).toBe(2);
    expect(placed("a", null)(moved).piles[0]?.count).toBe(1);
  });

  test("opening a pile takes the card off the wall, since the pile is the server's to mint", () => {
    const shown = wall(
      [
        ["a", null],
        ["b", "p1"],
      ],
      ["p1"],
    );
    expect(dropped("a")(shown).cards.map((card) => card.card)).toEqual(["b"]);
  });

  test("a merged pile closes and its cards move with it", () => {
    const shown = wall(
      [
        ["a", "p1"],
        ["b", "p2"],
        ["c", "p2"],
      ],
      ["p1", "p2"],
    );
    const folded = merged("p2", "p1")(shown);
    expect(folded.piles.map((pile) => pile.pile)).toEqual(["p1"]);
    expect(folded.piles[0]?.count).toBe(3);
  });

  test("a hand edit leaves the snapshot that follows nothing to play", () => {
    const shown = wall([["a", null]], ["p1"]);
    const target = wall([["a", "p1"]], ["p1"]);
    expect(diff(placed("a", "p1")(shown), target)).toEqual([]);
  });
});

describe("the wall when nothing is left to move", () => {
  test("a pile's new name and its lid arrive though no card moved", () => {
    const shown = wall([["a", "p1"]], ["p1"]);
    const target = {
      cards: [{ card: "a", pile: "p1", value: "a" }],
      piles: [{ pile: "p1", name: "add", count: 1 }],
    };
    expect(adopt(shown, target).piles[0]?.name).toBe("add");
    expect(adopt(shown, target).cards[0]?.pile).toBe("p1");
  });
});

describe("when a snapshot's moves play", () => {
  const moves: Move[] = [
    { kind: "open", pile: "p3" },
    { kind: "arrive", card: "d" },
    { kind: "place", card: "a", pile: "p3" },
    { kind: "return", card: "c" },
    { kind: "leave", card: "e" },
    { kind: "close", pile: "p2" },
  ];

  test("landings go one at a time, a pile opens a beat before its first card, and leaving and closing wait for the last landing", () => {
    expect(schedule(moves)).toEqual([
      {
        move: { kind: "open", pile: "p3" },
        at: Math.max(0, ARRIVAL_GAP_MS - OPEN_AHEAD_MS),
      },
      { move: { kind: "arrive", card: "d" }, at: 0 },
      { move: { kind: "place", card: "a", pile: "p3" }, at: ARRIVAL_GAP_MS },
      {
        move: { kind: "return", card: "c" },
        at: ARRIVAL_GAP_MS + LANDING_GAP_MS,
      },
      {
        move: { kind: "leave", card: "e" },
        at: ARRIVAL_GAP_MS + LANDING_GAP_MS,
      },
      {
        move: { kind: "close", pile: "p2" },
        at: ARRIVAL_GAP_MS + LANDING_GAP_MS,
      },
    ]);
  });

  test("a pile no card lands in opens at once", () => {
    expect(schedule([{ kind: "open", pile: "p9" }])).toEqual([
      { move: { kind: "open", pile: "p9" }, at: 0 },
    ]);
  });

  test("the cards leaving the tray go newest first, the way the shelf shows them", () => {
    const timed = schedule([
      { kind: "place", card: "old", pile: "p1" },
      { kind: "place", card: "new", pile: "p2" },
    ]);
    expect(timed.filter((entry) => entry.move.kind === "place")).toEqual([
      { move: { kind: "place", card: "new", pile: "p2" }, at: 0 },
      { move: { kind: "place", card: "old", pile: "p1" }, at: LANDING_GAP_MS },
    ]);
  });

  test("a room's worth of cards keeps the pace until the pace would trail too far, then squeezes to the lag", () => {
    const twenty: Move[] = Array.from({ length: 20 }, (_, index) => ({
      kind: "place",
      card: `c${index}`,
      pile: "p1",
    }));
    expect(schedule(twenty).map((entry) => entry.at)).toEqual(
      twenty.map((_, index) => index * LANDING_GAP_MS),
    );
    const sixty: Move[] = Array.from({ length: 60 }, (_, index) => ({
      kind: "place",
      card: `c${index}`,
      pile: "p1",
    }));
    const times = schedule(sixty).map((entry) => entry.at);
    expect(Math.max(...times)).toBe(MAX_LAG_MS);
    expect(new Set(times).size).toBe(60);
    for (let index = 1; index < times.length; index += 1) {
      expect(times[index] - times[index - 1]).toBeGreaterThanOrEqual(
        Math.floor(MAX_LAG_MS / 59),
      );
    }
  });

  test("a few cards keep the full gap, and one card lands at once", () => {
    const three = schedule([
      { kind: "place", card: "a", pile: "p1" },
      { kind: "place", card: "b", pile: "p1" },
      { kind: "place", card: "c", pile: "p1" },
    ]);
    expect(three.map((entry) => entry.at)).toEqual([
      0,
      LANDING_GAP_MS,
      2 * LANDING_GAP_MS,
    ]);
    expect(schedule([{ kind: "place", card: "a", pile: "p1" }])).toEqual([
      { move: { kind: "place", card: "a", pile: "p1" }, at: 0 },
    ]);
    expect(schedule([])).toEqual([]);
  });
});
