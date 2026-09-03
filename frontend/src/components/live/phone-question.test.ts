import { describe, expect, test } from "bun:test";
import {
  answeredOf,
  itemCountOf,
  type RoundQuestion,
  wholeOf,
} from "./phone-question";

const question = (
  fields: Partial<RoundQuestion> & { question: string },
): RoundQuestion => ({
  prompt: "",
  choices: [],
  parts: [],
  cap: 0,
  position: 1,
  ...fields,
});

const write = question({ question: "q1" });
const list = question({ question: "q2", parts: ["one", "two", "three"] });
const repeated = question({ question: "q3", parts: ["a verb"], cap: 3 });
const vote = question({ question: "q4", choices: ["Yes", "No"] });

describe("a round the phone may hand in", () => {
  test("one box asks for that box, blanks and spaces aside", () => {
    expect(wholeOf([write], {})).toBe(false);
    expect(wholeOf([write], { q1: "   " })).toBe(false);
    expect(wholeOf([write], { q1: "a bookmark" })).toBe(true);
  });

  test("labeled parts ask for every part", () => {
    expect(wholeOf([list], { "q2#1": "keep", "q2#2": "find" })).toBe(false);
    expect(
      wholeOf([list], { "q2#1": "keep", "q2#2": "find", "q2#3": "revisit" }),
    ).toBe(true);
  });

  test("a repeated box asks for one of its own", () => {
    expect(wholeOf([repeated], {})).toBe(false);
    expect(wholeOf([repeated], { "q3#1": "keep" })).toBe(true);
  });

  test("a vote asks for the choice", () => {
    expect(wholeOf([vote], {})).toBe(false);
    expect(wholeOf([vote], { q4: "Yes" })).toBe(true);
  });

  test("every question of the round is asked for", () => {
    expect(wholeOf([write, vote], { q1: "a bookmark" })).toBe(false);
    expect(wholeOf([write, vote], { q1: "a bookmark", q4: "No" })).toBe(true);
  });
});

describe("the figure on the hand-in bar", () => {
  test("counts the boxes that hold something", () => {
    expect(answeredOf([list], { "q2#1": "keep", "q2#2": " " })).toBe(1);
    expect(answeredOf([write, vote], { q1: "", q4: "Yes" })).toBe(1);
  });

  test("counts every box the round asks after", () => {
    expect(itemCountOf([write, list, repeated, vote])).toBe(8);
  });
});
