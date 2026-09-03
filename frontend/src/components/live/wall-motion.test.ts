import { describe, expect, test } from "bun:test";
import {
  adopt,
  apply,
  diff,
  dropped,
  type Move,
  merged,
  movesPerStep,
  placed,
  STEPS_TO_SETTLE,
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

describe("how many moves a step plays", () => {
  test("a quota fixed at arrival settles a burst in six steps, one read afresh does not", () => {
    const burst = 93;
    const quota = movesPerStep(burst);
    let fixedSteps = 0;
    for (let left = burst; left > 0; left -= quota) fixedSteps += 1;
    expect(fixedSteps).toBeLessThanOrEqual(STEPS_TO_SETTLE);
    let afreshSteps = 0;
    for (let left = burst; left > 0; left -= movesPerStep(left))
      afreshSteps += 1;
    expect(afreshSteps).toBeGreaterThan(STEPS_TO_SETTLE * 3);
  });

  test("a few moves play one at a time, and a room's worth settle within six steps", () => {
    expect(movesPerStep(0)).toBe(1);
    expect(movesPerStep(3)).toBe(1);
    expect(movesPerStep(6)).toBe(1);
    expect(movesPerStep(7)).toBe(2);
    expect(movesPerStep(366)).toBe(61);
    expect(Math.ceil(366 / movesPerStep(366))).toBeLessThanOrEqual(6);
  });
});
