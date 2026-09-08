import { describe, expect, test } from "bun:test";
import { columnsFor, marksExpected, tallyRoom } from "./quiz-projector";

describe("when the room's screen marks the expected choice", () => {
  test("marks it at the levels that show answers", () => {
    expect(marksExpected("answers")).toBe(true);
    expect(marksExpected("explanations")).toBe(true);
  });

  test("leaves it unmarked at score", () => {
    expect(marksExpected("score")).toBe(false);
  });
});

describe("the room's answers counted against its choices", () => {
  const CHOICES = ["Blue", "Green", "Red"];

  test("counts every choice, including the ones nobody took", () => {
    const rows = tallyRoom(CHOICES, ["Blue", "Red", "Blue"], "");
    expect(rows.map((row) => [row.label, row.count])).toEqual([
      ["Blue", 2],
      ["Green", 0],
      ["Red", 1],
    ]);
  });

  test("marks the expected choice and nothing else", () => {
    const rows = tallyRoom(CHOICES, ["Blue"], "Green");
    expect(rows.filter((row) => row.expected).map((row) => row.label)).toEqual([
      "Green",
    ]);
  });

  test("marks nothing when no choice is expected", () => {
    const rows = tallyRoom(CHOICES, ["Blue"], "");
    expect(rows.some((row) => row.expected)).toBe(false);
  });

  test("gathers a value nobody was offered rather than dropping it", () => {
    const rows = tallyRoom(CHOICES, ["Blue", "Teal", "Teal"], "");
    expect(rows.at(-1)).toEqual({
      label: "Something else",
      count: 2,
      other: true,
      expected: false,
    });
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(3);
  });
});

describe("how many columns the questions stand in", () => {
  test("goes wider as the questionnaire grows", () => {
    expect(columnsFor(1)).toBe(1);
    expect(columnsFor(2)).toBe(1);
    expect(columnsFor(3)).toBe(2);
    expect(columnsFor(6)).toBe(2);
    expect(columnsFor(7)).toBe(3);
    expect(columnsFor(20)).toBe(3);
  });

  test("stands a run with nothing asked in one column", () => {
    expect(columnsFor(0)).toBe(1);
  });
});
