import { describe, expect, test } from "bun:test";
import {
  carriedGroups,
  previewQuestion,
  shownRound,
  sourceOf,
  UNNAMED_PILES,
} from "./round-preview";
import type { RelayRound } from "./rounds";

const round = (
  number: number,
  leg: string,
  title: string,
  prompt: string,
  rest: Partial<RelayRound> = {},
): RelayRound => ({
  leg,
  number,
  title,
  prompt,
  question: `${leg}-question`,
  questionnaire: `${leg}-questionnaire`,
  parts: [],
  cap: 0,
  choices: [],
  takes: [],
  ...rest,
});

const takes = (source: RelayRound, use: string) => ({
  takes: [{ source: source.leg, sourceNumber: source.number, use }],
});

/** A write round: what it leaves behind is sorted in class, so nothing is known. */
const write = round(1, "one", "Three verbs", "Three verbs a bookmark needs.");

/** A vote round: its choices are written, so a later round can name them. */
const vote = round(2, "two", "Which pace", "Which pace fits?", {
  choices: ["Warm", "Cool"],
});

/** A list round: its parts are written too. */
const list = round(3, "three", "Two parts", "Name the pair.", {
  parts: ["a noun", "a verb"],
  cap: 0,
});

describe("what a round carries in", () => {
  test("names a vote's choices and a list's parts", () => {
    expect(carriedGroups(vote)).toEqual(["Warm", "Cool"]);
    expect(carriedGroups(list)).toEqual(["a noun", "a verb"]);
  });

  test("stands unnamed where the piles are only sorted in class", () => {
    expect(carriedGroups(write)).toEqual(UNNAMED_PILES);
    expect(carriedGroups(null)).toEqual(UNNAMED_PILES);
  });

  test("reads the source off the leg the round takes from", () => {
    const rounds = [write, vote];
    const taker = round(3, "x", "Sort", "Sort them.", takes(write, "context"));
    expect(sourceOf(taker, [...rounds, taker])?.leg).toBe("one");
    expect(sourceOf(write, rounds)).toBeNull();
  });
});

describe("the question a phone would meet", () => {
  test("shows a round's own material when it takes nothing", () => {
    const question = previewQuestion(list, [list]);
    expect(question.parts).toEqual(["a noun", "a verb"]);
    expect(question.choices).toEqual([]);
    expect(question.context).toEqual([]);
  });

  test("takes choices from the vote it names, and unnamed piles otherwise", () => {
    const named = round(4, "a", "Pick", "Pick one.", takes(vote, "choices"));
    const unnamed = round(4, "b", "Pick", "Pick one.", takes(write, "choices"));
    expect(previewQuestion(named, [vote, named]).choices).toEqual([
      "Warm",
      "Cool",
    ]);
    expect(previewQuestion(unnamed, [write, unnamed]).choices).toEqual(
      UNNAMED_PILES,
    );
  });

  test("takes parts from the list it names, and unnamed piles otherwise", () => {
    const named = round(4, "a", "Say", "Say one of each.", {
      cap: 5,
      ...takes(list, "parts"),
    });
    const unnamed = round(4, "b", "Say", "Say one of each.", {
      cap: 5,
      ...takes(write, "parts"),
    });
    const question = previewQuestion(named, [list, named]);
    expect(question.parts).toEqual(["a noun", "a verb"]);
    expect(question.choices).toEqual([]);
    expect(question.cap).toBe(0);
    expect(previewQuestion(unnamed, [write, unnamed]).parts).toEqual(
      UNNAMED_PILES,
    );
  });

  test("shows what it takes as context with no cards under it", () => {
    const named = round(
      4,
      "a",
      "Write",
      "Write one more.",
      takes(vote, "context"),
    );
    const unnamed = round(4, "b", "Write", "Write one more.", {
      ...takes(write, "context"),
    });
    expect(previewQuestion(named, [vote, named]).context).toEqual([
      { name: "Warm", cards: [] },
      { name: "Cool", cards: [] },
    ]);
    expect(previewQuestion(unnamed, [write, unnamed]).context).toEqual(
      UNNAMED_PILES.map((name) => ({ name, cards: [] })),
    );
  });
});

describe("the round the column shows", () => {
  const rounds = [write, vote, list];

  test("is the first round when none is selected", () => {
    expect(shownRound(rounds, null)?.leg).toBe("one");
    expect(shownRound(rounds, "gone")?.leg).toBe("one");
  });

  test("is the one selected, and nothing at all on a relay with no rounds", () => {
    expect(shownRound(rounds, "three")?.leg).toBe("three");
    expect(shownRound([], null)).toBeNull();
  });
});
