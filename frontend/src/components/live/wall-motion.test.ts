import { describe, expect, test } from "bun:test";
import {
  ARRIVAL_GAP_MS,
  adopt,
  apply,
  BIRTH_GAP_MS,
  diff,
  dropped,
  gapAfter,
  LANDING_GAP_MS,
  MAX_LAG_MS,
  type Move,
  merged,
  ordered,
  placed,
  timeline,
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

describe("the order a snapshot's moves join the belt", () => {
  const moves: Move[] = [
    { kind: "open", pile: "p3" },
    { kind: "open", pile: "p9" },
    { kind: "arrive", card: "d" },
    { kind: "place", card: "a", pile: "p3" },
    { kind: "place", card: "b", pile: "p1" },
    { kind: "place", card: "c", pile: "p3" },
    { kind: "return", card: "r" },
    { kind: "leave", card: "e" },
    { kind: "close", pile: "p2" },
  ];

  test("arrivals first, then the tray's cards newest first, each pile opening just before its first card, and leaving and closing last", () => {
    expect(ordered(moves)).toEqual<Move[]>([
      { kind: "open", pile: "p9" },
      { kind: "arrive", card: "d" },
      { kind: "open", pile: "p3" },
      { kind: "place", card: "c", pile: "p3" },
      { kind: "place", card: "b", pile: "p1" },
      { kind: "place", card: "a", pile: "p3" },
      { kind: "return", card: "r" },
      { kind: "leave", card: "e" },
      { kind: "close", pile: "p2" },
    ]);
  });

  test("nothing from nothing", () => {
    expect(ordered([])).toEqual([]);
  });
});

describe("the belt's pace", () => {
  const places = (count: number): Move[] =>
    Array.from({ length: count }, (_, index) => ({
      kind: "place",
      card: `c${index}`,
      pile: "p1",
    }));

  test("each kind of move waits its own gap, and a pile stands empty for a beat", () => {
    expect(gapAfter([{ kind: "arrive", card: "d" }, ...places(1)])).toBe(
      ARRIVAL_GAP_MS,
    );
    expect(gapAfter(places(2))).toBe(LANDING_GAP_MS);
    expect(gapAfter([{ kind: "open", pile: "p1" }, ...places(1)])).toBe(
      BIRTH_GAP_MS,
    );
    expect(gapAfter([{ kind: "leave", card: "e" }])).toBe(0);
    expect(gapAfter([])).toBe(0);
  });

  test("a room's worth of cards keeps the pace until the belt would trail too far, then every gap shrinks by the same share", () => {
    expect(timeline(places(20)).map((entry) => entry.at)).toEqual(
      places(20).map((_, index) => index * LANDING_GAP_MS),
    );
    const sixty = places(60);
    expect(gapAfter(sixty)).toBe(
      Math.round(LANDING_GAP_MS * (MAX_LAG_MS / (60 * LANDING_GAP_MS))),
    );
    const times = timeline(sixty).map((entry) => entry.at);
    expect(new Set(times).size).toBe(60);
    for (let index = 1; index < times.length; index += 1) {
      const gap = times[index] - times[index - 1];
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThanOrEqual(LANDING_GAP_MS);
    }
  });

  test("the gap grows back as the belt drains", () => {
    const sixty = places(60);
    expect(gapAfter(sixty)).toBeLessThan(gapAfter(sixty.slice(40)));
    expect(gapAfter(sixty.slice(40))).toBe(LANDING_GAP_MS);
  });

  test("one card lands at once", () => {
    expect(timeline(places(1))).toEqual([
      { move: { kind: "place", card: "c0", pile: "p1" }, at: 0 },
    ]);
    expect(timeline([])).toEqual([]);
  });
});
