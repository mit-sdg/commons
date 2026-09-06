import { describe, expect, test } from "vite-plus/test";
import { pileCards, roundKind, useFit, voteStanding } from "../../src/computations/live-carries.ts";
import { cardId, kindCap, kindChoices, kindParts } from "../../src/computations/live-rounds.ts";

const CHOICES = ["a", "b"];
const PARTS = ["one", "two"];

/** Both what a round holds and what it holds nothing of, so a word's answer is read off the word alone. */
const holdings = [
  { choices: [], parts: [] },
  { choices: CHOICES, parts: PARTS },
  { choices: CHOICES, parts: [] },
  { choices: [], parts: PARTS },
];

describe("the uses a round's kind is open to", () => {
  test("a vote carries choices and context, and never parts", () => {
    for (const held of holdings) {
      expect(useFit({ use: "choices", kind: "vote", ...held })).toBe("open");
      expect(useFit({ use: "context", kind: "vote", ...held })).toBe("open");
      expect(useFit({ use: "parts", kind: "vote", ...held })).toBe("closed");
    }
  });

  test("a list carries parts and context, and never choices", () => {
    for (const held of holdings) {
      expect(useFit({ use: "parts", kind: "list", ...held })).toBe("open");
      expect(useFit({ use: "context", kind: "list", ...held })).toBe("open");
      expect(useFit({ use: "choices", kind: "list", ...held })).toBe("closed");
    }
  });

  test("a write carries context alone", () => {
    for (const held of holdings) {
      expect(useFit({ use: "context", kind: "write", ...held })).toBe("open");
      expect(useFit({ use: "choices", kind: "write", ...held })).toBe("closed");
      expect(useFit({ use: "parts", kind: "write", ...held })).toBe("closed");
    }
  });

  test("a leg with no word holding nothing is open to every use, since the take makes it a kind", () => {
    const empty = { kind: "", choices: [], parts: [] };
    expect(useFit({ use: "context", ...empty })).toBe("open");
    expect(useFit({ use: "choices", ...empty })).toBe("open");
    expect(useFit({ use: "parts", ...empty })).toBe("open");
  });

  test("a leg with no word is read as the kind its content makes it", () => {
    const offering = { kind: "", choices: CHOICES, parts: [] };
    expect(useFit({ use: "choices", ...offering })).toBe("open");
    expect(useFit({ use: "parts", ...offering })).toBe("closed");
    expect(useFit({ use: "context", ...offering })).toBe("open");

    const boxed = { kind: "", choices: [], parts: PARTS };
    expect(useFit({ use: "parts", ...boxed })).toBe("open");
    expect(useFit({ use: "choices", ...boxed })).toBe("closed");
    expect(useFit({ use: "context", ...boxed })).toBe("open");
  });

  test("a word this composition fills no use for is unknown, whatever the kind", () => {
    for (const kind of ["", "write", "list", "vote"]) {
      expect(useFit({ use: "picked", kind, choices: CHOICES, parts: PARTS })).toBe("unknown");
    }
  });
});

describe("what a round's kind puts before the room", () => {
  test("a write is one box: no choices, no parts, no cap", () => {
    expect(kindChoices({ kind: "write", choices: CHOICES })).toEqual([]);
    expect(kindParts({ kind: "write", parts: PARTS })).toEqual([]);
    expect(kindCap({ kind: "write", cap: 3 })).toBe(0);
  });

  test("a list opens with its parts and their cap, and no choices", () => {
    expect(kindChoices({ kind: "list", choices: CHOICES })).toEqual([]);
    expect(kindParts({ kind: "list", parts: PARTS })).toEqual(PARTS);
    expect(kindCap({ kind: "list", cap: 3 })).toBe(3);
  });

  test("a vote opens with its choices, and no parts", () => {
    expect(kindChoices({ kind: "vote", choices: CHOICES })).toEqual(CHOICES);
    expect(kindParts({ kind: "vote", parts: PARTS })).toEqual([]);
    expect(kindCap({ kind: "vote", cap: 3 })).toBe(0);
  });

  test("a leg with no word opens with everything its question holds", () => {
    expect(kindChoices({ kind: "", choices: CHOICES })).toEqual(CHOICES);
    expect(kindParts({ kind: "", parts: PARTS })).toEqual(PARTS);
    expect(kindCap({ kind: "", cap: 3 })).toBe(3);
  });
});

describe("the standing of a vote and the kind a round reads as", () => {
  test("a vote offering no choice of its own is bare, and every other word is filled", () => {
    expect(voteStanding({ kind: "vote", choices: [] })).toBe("bare");
    expect(voteStanding({ kind: "vote", choices: CHOICES })).toBe("filled");
    for (const kind of ["", "write", "list"]) {
      expect(voteStanding({ kind, choices: [] })).toBe("filled");
    }
  });

  test("the kind a round reads as comes from what it offers and what it takes", () => {
    expect(roundKind({ choices: CHOICES, parts: [], use: "" })).toBe("vote");
    expect(roundKind({ choices: [], parts: PARTS, use: "" })).toBe("list");
    expect(roundKind({ choices: [], parts: [], use: "" })).toBe("write");
    expect(roundKind({ choices: [], parts: [], use: "choices" })).toBe("vote");
    expect(roundKind({ choices: [], parts: [], use: "parts" })).toBe("list");
    expect(roundKind({ choices: [], parts: [], use: "context" })).toBe("write");
    // Choices outrank parts, so a question holding both reads as a vote.
    expect(roundKind({ choices: CHOICES, parts: PARTS, use: "" })).toBe("vote");
  });
});

describe("the examples carried by a selected pile", () => {
  const categories = [
    {
      category: "pile",
      name: "Renamed and merged",
      items: ["r1", "r2", "r3"].map((response) => cardId({ response, item: "q" })),
    },
  ];
  const values = [
    { response: "r1", item: "q", value: "A" },
    { response: "r2", item: "q", value: "A" },
    { response: "r3", item: "q", value: "B" },
  ];
  const sources = [
    { name: "A", cards: ["A concrete failure", "Shared example"] },
    { name: "B", cards: ["Another failure", "Shared example"] },
    { name: "Unselected", cards: ["Do not leak this"] },
  ];

  test("renamed and merged ballots carry distinct original examples, in hand-in order", () => {
    expect(
      pileCards({
        pile: "pile",
        categories,
        values,
        value: {
          questions: [{ item: "q", choices: ["A", "B"], choiceSources: sources }],
        },
      }),
    ).toEqual(["A concrete failure", "Shared example", "Another failure"]);
  });

  test("static and legacy votes never infer provenance from display context", () => {
    expect(
      pileCards({
        pile: "pile",
        categories,
        values,
        value: {
          questions: [{ item: "q", choices: ["A", "B"], context: sources }],
        },
      }),
    ).toEqual([]);
  });

  test("written answers remain literal and repeated, even when a pile has the same name", () => {
    expect(
      pileCards({
        pile: "pile",
        categories: [{ ...categories[0], name: "A" }],
        values,
        value: { questions: [{ item: "q", choices: [], context: sources }] },
      }),
    ).toEqual(["A", "A", "B"]);
  });

  test("a different question's choices do not turn written answers into ballots", () => {
    expect(
      pileCards({
        pile: "pile",
        categories,
        values,
        value: {
          questions: [{ item: "other", choices: ["A", "B"], choiceSources: sources }],
        },
      }),
    ).toEqual(["A", "A", "B"]);
  });

  test("empty vote piles claim no original choice from a mutable name", () => {
    expect(
      pileCards({
        pile: "pile",
        categories: [{ ...categories[0], name: "A", items: [] }],
        values,
        value: { questions: [{ item: "q", choices: ["A", "B"], choiceSources: sources }] },
      }),
    ).toEqual([]);
  });
});
