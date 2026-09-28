import { describe, expect, test } from "bun:test";
import {
  acrossOf,
  ceilingOf,
  LAYERS,
  layoutOf,
  MOST_LAYERS,
  pilesOf,
} from "./piles";

const papers = (...scores: number[]) =>
  scores.map((score, index) => ({ score, id: index }));
const many = (count: number, score: number) =>
  papers(...Array.from({ length: count }, () => score));

describe("the piles on a points axis", () => {
  test("each score is its own pile while the scores sit a dot apart", () => {
    const piles = pilesOf(papers(7, 10, 9.5, 10), 10, 560, 8);
    expect(piles.map((pile) => [pile.x, pile.papers.length])).toEqual([
      [0.7, 1],
      [0.95, 1],
      [1, 2],
    ]);
  });

  test("scores closer than a dot share piles a dot wide", () => {
    const piles = pilesOf(papers(28, 28.5, 29, 29.5, 30), 30, 120, 8);
    const gaps = piles
      .slice(1)
      .map((pile, index) => (pile.x - (piles[index]?.x ?? 0)) * 120);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(8 - 1e-9);
    expect(piles.flatMap((pile) => pile.papers)).toHaveLength(5);
  });

  test("a grader's row shares piles with its class row", () => {
    const class_ = papers(28, 28.5, 29, 29.5, 30);
    const own = papers(28.5, 30);
    const shared = new Set(pilesOf(class_, 30, 120, 8).map((pile) => pile.x));
    for (const pile of pilesOf(own, 30, 120, 8, class_))
      expect(shared.has(pile.x)).toBe(true);
  });

  test("piles stay one dot wide until one passes LAYERS", () => {
    const piles = pilesOf([...many(LAYERS, 10), ...papers(9)], 10, 560, 8);
    expect(acrossOf(piles, 560, 8)).toBe(1);
  });

  test("a tall pile spreads just wide enough, short of its neighbour", () => {
    const whole = pilesOf([...many(45, 10), ...papers(9, 8)], 10, 560, 8);
    expect(acrossOf(whole, 560, 8)).toBe(4);
    const halves = pilesOf([...many(45, 10), ...papers(9.5)], 10, 560, 8);
    expect(acrossOf(halves, 560, 8)).toBe(3);
    const inside = pilesOf([...many(45, 5), ...papers(4.5)], 10, 560, 8);
    expect(acrossOf(inside, 560, 8)).toBe(3);
  });

  test("a pile under the ceiling stacks one wide; a pile at it spreads", () => {
    const piles = pilesOf([...many(45, 10), ...many(3, 9.5)], 10, 560, 8);
    const across = acrossOf(piles, 560, 8);
    const ceiling = ceilingOf(piles, across);
    expect(ceiling).toBe(15);
    expect(layoutOf(many(3, 9.5), ceiling, across).wide).toBe(1);
    expect(layoutOf(many(45, 10), ceiling, across).wide).toBe(3);
  });

  test("a pile folds only past MOST_LAYERS, keeping its count's layer free", () => {
    const fits = many(MOST_LAYERS * 3, 10);
    expect(layoutOf(fits, MOST_LAYERS, 3).folded).toHaveLength(0);
    const { shown, folded, wide } = layoutOf(
      many(MOST_LAYERS * 3 + 1, 10),
      MOST_LAYERS,
      3,
    );
    expect(shown).toHaveLength((MOST_LAYERS - 1) * 3);
    expect(folded).toHaveLength(4);
    expect(wide).toBe(3);
  });
});
