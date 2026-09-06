import { describe, expect, test } from "bun:test";
import { holding } from "./pick-control";

const wall = [
  { pile: "Cost", count: 3 },
  { pile: "Time", count: 0 },
  { pile: "Trust", count: 1 },
];

describe("the piles All picks and counts", () => {
  test("leaves out a standing pile holding nothing", () => {
    expect(holding(wall).map((pile) => pile.pile)).toEqual(["Cost", "Trust"]);
  });

  test("counts nine of ten when one stands empty", () => {
    const ten = Array.from({ length: 10 }, (_, index) => ({
      pile: `p${index}`,
      count: index === 4 ? 0 : index + 1,
    }));
    expect(holding(ten)).toHaveLength(9);
  });

  test("counts one when one pile holds a card", () => {
    expect(holding([{ pile: "Cost", count: 1 }])).toHaveLength(1);
  });

  test("counts none on a wall whose piles all stand empty", () => {
    expect(holding([{ pile: "Cost", count: 0 }])).toHaveLength(0);
    expect(holding([])).toHaveLength(0);
  });

  test("keeps the order the wall opened the piles in", () => {
    expect(holding(wall)).toEqual([
      { pile: "Cost", count: 3 },
      { pile: "Trust", count: 1 },
    ]);
  });
});
