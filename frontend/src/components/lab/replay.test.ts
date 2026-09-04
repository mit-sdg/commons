import { describe, expect, test } from "bun:test";
import { frameAt, polled, snapAt, trickled } from "./replay";

const wall = (cards: [string, string | null][], piles: string[]) => ({
  cards: cards.map(([card, pile]) => ({ card, pile, value: card })),
  piles: piles.map((pile) => ({ pile, name: pile, count: 0 })),
});

const snaps = [
  { t: 40, wall: wall([], []) },
  { t: 3_300, wall: wall([["a", null]], []) },
  {
    t: 4_200,
    wall: wall(
      [
        ["a", null],
        ["b", null],
      ],
      [],
    ),
  },
  {
    t: 13_600,
    wall: wall(
      [
        ["a", "p1"],
        ["b", "p1"],
      ],
      ["p1"],
    ),
  },
];

describe("what the server held", () => {
  test("the last snapshot at or before a time, none before the first", () => {
    expect(snapAt(snaps, 0)).toBeNull();
    expect(snapAt(snaps, 40)).toBe(snaps[0]);
    expect(snapAt(snaps, 3_299)).toBe(snaps[0]);
    expect(snapAt(snaps, 5_000)).toBe(snaps[2]);
    expect(snapAt(snaps, 99_000)).toBe(snaps[3]);
  });
});

describe("what a polling screen receives", () => {
  test("the first snapshot at once, then each poll's wall when it changed", () => {
    const frames = polled(snaps, 3_000);
    expect(frames.map((frame) => frame.t)).toEqual([0, 6_000, 15_000]);
    expect(frames[1]?.wall).toBe(snaps[2].wall);
    expect(frames[2]?.wall).toBe(snaps[3].wall);
  });

  test("nothing from no trace", () => {
    expect(polled([], 3_000)).toEqual([]);
  });
});

describe("the run sorted by a hand", () => {
  test("every move is its own wall, a gap apart", () => {
    const frames = trickled(snaps, 1_000);
    expect(frames.map((frame) => frame.t)).toEqual([
      0, 1_000, 2_000, 3_000, 4_000, 5_000,
    ]);
    expect(frames[2]?.wall.cards.map((card) => card.card)).toEqual(["a", "b"]);
    expect(frames[3]?.wall.piles.map((pile) => pile.pile)).toEqual(["p1"]);
    expect(frames[4]?.wall.cards.map((card) => card.pile)).toEqual([
      "p1",
      null,
    ]);
    expect(frames[5]?.wall.cards.map((card) => card.pile)).toEqual([
      "p1",
      "p1",
    ]);
    expect(frames[5]?.wall.piles[0]?.count).toBe(2);
  });
});

describe("the frame a screen shows", () => {
  test("the last delivered by that time, none before the first", () => {
    const frames = polled(snaps, 3_000);
    expect(frameAt(frames, -1)).toBe(-1);
    expect(frameAt(frames, 0)).toBe(0);
    expect(frameAt(frames, 6_000)).toBe(1);
    expect(frameAt(frames, 14_999)).toBe(1);
    expect(frameAt(frames, 15_000)).toBe(2);
  });
});
