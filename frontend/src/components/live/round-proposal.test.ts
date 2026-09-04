import { describe, expect, test } from "bun:test";
import {
  addedRound,
  changeWords,
  partWords,
  takesWords,
} from "./round-proposal";

const round = {
  number: 2,
  title: "The stranger",
  prompt: "Which verb best fits the stranger?",
  parts: ["answer"],
  cap: 0,
  choices: [],
  takes: [{ source: "leg-1", sourceNumber: 1, use: "context" }],
};

describe("what a proposal says it would change", () => {
  test("a title and a prompt read as what stands and what is proposed", () => {
    expect(changeWords({ kind: "title", value: "The visitor" }, round)).toEqual(
      {
        field: "Title",
        was: "The stranger",
        to: "The visitor",
      },
    );
    expect(
      changeWords({ kind: "prompt", value: "Who is the visitor?" }, round),
    ).toEqual({
      field: "Prompt",
      was: "Which verb best fits the stranger?",
      to: "Who is the visitor?",
    });
  });

  test("parts, choices, and takes read in the words the card uses", () => {
    expect(
      changeWords(
        { kind: "parts", value: JSON.stringify({ parts: ["verb"], cap: 3 }) },
        round,
      ),
    ).toEqual({ field: "Parts", was: "answer", to: "verb, up to 3" });
    expect(
      changeWords(
        { kind: "choices", value: JSON.stringify(["yes", "no"]) },
        round,
      ),
    ).toEqual({ field: "Choices", was: "", to: "yes · no" });
    expect(
      changeWords(
        { kind: "takes", value: JSON.stringify({ from: 1, use: "parts" }) },
        round,
      ),
    ).toEqual({ field: "Takes from", was: "1 as context", to: "1 as parts" });
    expect(
      changeWords(
        { kind: "takes", value: JSON.stringify({ from: 0, use: "" }) },
        round,
      ),
    ).toEqual({ field: "Takes from", was: "1 as context", to: "nothing" });
  });

  test("a removal names the round it would take away, and a move its number", () => {
    expect(changeWords({ kind: "remove", value: "" }, round)).toEqual({
      field: "Remove",
      was: "The stranger",
      to: "",
    });
    expect(changeWords({ kind: "move", value: "1" }, round)).toEqual({
      field: "Move to",
      was: "2",
      to: "1",
    });
  });

  test("a line about a round the panel has lost shows only what is proposed", () => {
    expect(changeWords({ kind: "title", value: "The visitor" }, null)).toEqual({
      field: "Title",
      was: "",
      to: "The visitor",
    });
  });
});

describe("the round an add line carries", () => {
  test("the whole round is read, with what it takes and where it lands", () => {
    expect(
      addedRound(
        JSON.stringify({
          kind: "vote",
          title: "The winner",
          prompt: "Which one wins?",
          parts: [],
          cap: 0,
          choices: [],
          takes: { from: 2, use: "choices" },
          position: 3,
        }),
      ),
    ).toEqual({
      kind: "vote",
      title: "The winner",
      prompt: "Which one wins?",
      parts: [],
      cap: 0,
      choices: [],
      from: 2,
      use: "choices",
      position: 3,
    });
  });

  test("an unreadable value reads as an empty round", () => {
    expect(addedRound("not json").title).toBe("");
    expect(addedRound("not json").position).toBe(0);
  });
});

describe("the words boxes and takes go by", () => {
  test("one label repeated reads as a cap, and several as a row", () => {
    expect(partWords(["verb"], 3)).toBe("verb, up to 3");
    expect(partWords(["one", "two"], 0)).toBe("one · two");
    expect(partWords([], 0)).toBe("");
  });

  test("a round that takes nothing says so", () => {
    expect(takesWords(0, "context")).toBe("nothing");
    expect(takesWords(1, "")).toBe("nothing");
    expect(takesWords(1, "parts")).toBe("1 as parts");
  });
});
