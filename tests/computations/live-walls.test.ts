import { describe, expect, test } from "vite-plus/test";
import { cardId } from "../../src/computations/live-rounds.ts";
import type { RunSnapshot } from "../../src/computations/live-snapshots.ts";
import {
  lidLines,
  lidPassage,
  participantAnswers,
  participantPassage,
  placingLines,
  placingPassage,
  placingReading,
  placingReason,
  placingRepairPassage,
} from "../../src/computations/live-walls.ts";
import { scriptedWallReply } from "../../src/reasoning/scripted-walls.ts";

const presentation: RunSnapshot = {
  title: "What would help",
  form: "survey",
  disclosure: "score",
  questions: [
    {
      item: "q1",
      prompt: "What would help you most right now?",
      choices: [],
      expected: "",
      explanation: "",
      parts: ["First", "Second"],
      cap: 0,
      position: 1,
    },
  ],
};

const values = [
  { response: "r1", participant: "p1", item: "q1#1", value: "more worked examples" },
  { response: "r1", participant: "p1", item: "q1#2", value: "slower on proofs" },
  { response: "r2", participant: "model:d2", item: "q1#1", value: "an unsortable scribble" },
];

const card = (index: number) =>
  cardId({ response: values[index]!.response, item: values[index]!.item });

const categories = [
  {
    category: "pile-1",
    name: "Examples",
    description: "",
    items: [card(0)],
  },
];

const mind = (passage: string) => scriptedWallReply(passage) ?? "";

describe("the placing passage", () => {
  test("carries the piles as they stand and only the cards still in the tray", () => {
    const passage = placingPassage({ value: presentation, categories, values });
    expect(passage).toContain("- Examples (1 cards)");
    expect(passage).toContain("c2. slower on proofs");
    expect(passage).toContain("c3. an unsortable scribble");
    expect(passage).not.toContain("c1. more worked examples");
  });

  test("the repair passage carries the reply and the account of what was wrong", () => {
    const passage = placingRepairPassage({
      value: presentation,
      categories,
      values,
      offering: "{}",
      account: "The reply named no recognizable kind.",
    });
    expect(passage).toContain("came back unusable");
    expect(passage).toContain("The reply named no recognizable kind.");
  });
});

describe("reading a placing reply", () => {
  test("a placement into a standing pile is a place line", () => {
    const reply = JSON.stringify({
      kind: "placed",
      placements: [{ card: "c2", pile: "Examples" }],
    });
    expect(placingReading({ reply, categories, values })).toBe("placed");
    expect(placingLines({ reply, categories, values })).toEqual([
      { kind: "place", target: card(1), value: "pile-1" },
    ]);
    expect(placingReason({ reply, categories, values })).toBe("");
  });

  test("a pile that is not on the list opens a new one, flag or no flag", () => {
    for (const placement of [
      { card: "c3", pile: "Pace", new: true },
      { card: "c3", pile: "Pace", new: false },
      { card: "c3", pile: "Pace" },
    ]) {
      const reply = JSON.stringify({ kind: "placed", placements: [placement] });
      expect(placingReading({ reply, categories, values })).toBe("placed");
      expect(placingLines({ reply, categories, values })).toEqual([
        { kind: "open", target: card(2), value: "Pace" },
      ]);
    }
  });

  test("a pile already on the list is reached even when the reply calls it new", () => {
    const reply = JSON.stringify({
      kind: "placed",
      placements: [{ card: "c2", pile: "Examples", new: true }],
    });
    expect(placingLines({ reply, categories, values })).toEqual([
      { kind: "place", target: card(1), value: "pile-1" },
    ]);
  });

  test("a card already in a pile is not one the reply may place", () => {
    const reply = JSON.stringify({ kind: "placed", placements: [{ card: "c1", pile: "Pace" }] });
    expect(placingReading({ reply, categories, values })).toBe("neither");
    expect(placingReason({ reply, categories, values })).toContain("waiting in the tray");
  });

  test("a nameless pile, a label off the wall, an empty placement, and unreadable text are all unusable", () => {
    for (const reply of [
      JSON.stringify({ kind: "placed", placements: [{ card: "c2", pile: "  " }] }),
      JSON.stringify({ kind: "placed", placements: [{ card: "c9", pile: "Examples" }] }),
      JSON.stringify({ kind: "placed", placements: [] }),
      JSON.stringify({ kind: "shrug" }),
      "not json at all",
      "[1,2,3]",
    ]) {
      expect(placingReading({ reply, categories, values })).toBe("neither");
      expect(placingReason({ reply, categories, values })).not.toBe("");
    }
  });
});

describe("the lid", () => {
  test("the passage names the pile and its cards", () => {
    const passage = lidPassage({ pile: "pile-1", categories, values });
    expect(passage).toContain("The pile id: pile-1");
    expect(passage).toContain("The pile's name: Examples");
    expect(passage).toContain("- more worked examples");
  });

  test("a readable summary reads as one lid line", () => {
    const reply = JSON.stringify({
      kind: "lid",
      pile: "pile-1",
      sentence: "These answers ask for worked examples.",
    });
    expect(placingReading({ reply, categories, values })).toBe("lid");
    expect(lidLines({ reply, categories })).toEqual([
      { kind: "lid", target: "pile-1", value: "These answers ask for worked examples." },
    ]);
  });

  test("a summary naming no pile on this wall is unusable", () => {
    const reply = JSON.stringify({ kind: "lid", pile: "pile-9", sentence: "Anything." });
    expect(placingReading({ reply, categories, values })).toBe("neither");
    expect(lidLines({ reply, categories })).toEqual([]);
  });
});

describe("the model participant", () => {
  test("the passage names one box per part and seeds by the participant", () => {
    const passage = participantPassage({ value: presentation, participant: "model:d2" });
    expect(passage).toContain("You are participant model:d2, the student");
    expect(passage).toContain("q1#1 — First");
    expect(passage).toContain("q1#2 — Second");
  });

  test("a reply reads into one answer per box, and an unreadable one into none", () => {
    const reply = JSON.stringify({
      kind: "answers",
      answers: [
        { item: "q1#1", value: "more practice" },
        { item: "q1#2", value: "slower please" },
        { item: "q9", value: "not part of this round" },
      ],
    });
    expect(participantAnswers({ reply, value: presentation })).toEqual([
      { item: "q1#1", value: "more practice" },
      { item: "q1#2", value: "slower please" },
    ]);
    expect(participantAnswers({ reply: "{}", value: presentation })).toEqual([]);
    expect(participantAnswers({ reply: "nonsense", value: presentation })).toEqual([]);
  });

  test("a box named with a word in front, or in another case, is still that box", () => {
    const reply = JSON.stringify({
      kind: "answers",
      answers: [
        { item: "box q1#1", value: "more practice" },
        { item: "Item Q1#2", value: "slower please" },
      ],
    });
    expect(participantAnswers({ reply, value: presentation })).toEqual([
      { item: "q1#1", value: "more practice" },
      { item: "q1#2", value: "slower please" },
    ]);
  });
});

describe("the scripted mind", () => {
  test("it leaves passages that are not the wall's alone", () => {
    expect(scriptedWallReply("You compose quizzes and surveys for a live classroom tool.")).toBe(
      undefined,
    );
  });

  test("an unsortable card is placed badly once and well on the retry", () => {
    const passage = placingPassage({ value: presentation, categories, values });
    const bad = mind(passage);
    expect(placingReading({ reply: bad, categories, values })).toBe("neither");

    const repair = placingRepairPassage({
      value: presentation,
      categories,
      values,
      offering: bad,
      account: placingReason({ reply: bad, categories, values }),
    });
    const good = mind(repair);
    expect(placingReading({ reply: good, categories, values })).toBe("placed");
    expect(placingLines({ reply: good, categories, values }).length).toBe(2);
  });

  test("a wall with nothing unsortable is placed well the first time", () => {
    const plain = values.slice(0, 2);
    const passage = placingPassage({ value: presentation, categories, values: plain });
    const reply = mind(passage);
    expect(placingReading({ reply, categories, values: plain })).toBe("placed");
  });

  test("it summarizes the pile it was given", () => {
    const reply = mind(lidPassage({ pile: "pile-1", categories, values }));
    expect(lidLines({ reply, categories })).toEqual([
      { kind: "lid", target: "pile-1", value: "These answers all say something about examples." },
    ]);
  });

  test("it answers every box, and two participants do not say the same thing", () => {
    const first = mind(participantPassage({ value: presentation, participant: "model:one" }));
    const second = mind(participantPassage({ value: presentation, participant: "model:two" }));
    expect(participantAnswers({ reply: first, value: presentation }).length).toBe(2);
    expect(participantAnswers({ reply: second, value: presentation }).length).toBe(2);
    expect(first).not.toBe(second);
  });
});
