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
  sorterNotes,
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

/** Nothing removed: the wall as the room handed it in. */
const removed: string[] = [];

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
    const passage = placingPassage({ value: presentation, categories, values, removed, notes: "" });
    expect(passage).toContain("- Examples (1 cards)");
    expect(passage).toContain("c2. slower on proofs");
    expect(passage).toContain("c3. an unsortable scribble");
    expect(passage).not.toContain("c1. more worked examples");
  });

  test("a removed card is on no list, and the other labels hold still", () => {
    const passage = placingPassage({
      value: presentation,
      categories,
      values,
      removed: [card(1)],
      notes: "",
    });
    expect(passage).not.toContain("slower on proofs");
    expect(passage).toContain("c3. an unsortable scribble");
    expect(passage).not.toContain("c2.");
    const lid = lidPassage({ pile: "pile-1", categories, values, removed: [card(0)] });
    expect(lid).not.toContain("more worked examples");
    expect(lid).toContain("No cards.");
  });

  test("the repair passage carries the reply and the account of what was wrong", () => {
    const passage = placingRepairPassage({
      value: presentation,
      categories,
      values,
      removed,
      notes: "Group by what went wrong.",
      offering: "{}",
      account: "The reply named no recognizable kind.",
    });
    expect(passage).toContain("came back unusable");
    expect(passage).toContain("The reply named no recognizable kind.");
    expect(passage).toContain("The author's notes:\nGroup by what went wrong.");
  });

  test("the author's note stands after the question, and a blank note leaves no section", () => {
    const noted = placingPassage({
      value: presentation,
      categories,
      values,
      removed,
      notes: "  Group by what went wrong, not by which app.  ",
    });
    expect(noted).toContain(
      "The question:\nWhat would help you most right now?\n\nThe author's notes:\nGroup by what went wrong, not by which app.\n\nThe piles as they stand:",
    );
    const bare = placingPassage({ value: presentation, categories, values, removed, notes: " " });
    expect(bare).not.toContain("The author's notes:\n");
  });

  test("the relay's note and the run's note read as one text, the relay's first, and the contract lets the later win", () => {
    expect(sorterNotes({ relay: " Group by the verb. ", run: "Tense is a verb too.\n" })).toBe(
      "Group by the verb.\n\nTense is a verb too.",
    );
    expect(sorterNotes({ relay: "Group by the verb.", run: "" })).toBe("Group by the verb.");
    expect(sorterNotes({ relay: "  ", run: "Tense is a verb too." })).toBe("Tense is a verb too.");
    expect(sorterNotes({ relay: "", run: " " })).toBe("");
    const passage = placingPassage({
      value: presentation,
      categories,
      values,
      removed,
      notes: sorterNotes({ relay: "Group by the verb.", run: "Tense is a verb too." }),
    });
    expect(passage).toContain(
      "The author's notes:\nGroup by the verb.\n\nTense is a verb too.\n\n",
    );
    expect(passage).toContain("the later note wins");
  });
});

describe("reading a placing reply", () => {
  test("a placement into a standing pile is a place line", () => {
    const reply = JSON.stringify({
      kind: "placed",
      placements: [{ card: "c2", pile: "Examples" }],
    });
    expect(placingReading({ reply, categories, values, removed })).toBe("placed");
    expect(placingLines({ reply, categories, values, removed })).toEqual([
      { kind: "place", target: card(1), value: "pile-1" },
    ]);
    expect(placingReason({ reply, categories, values, removed })).toBe("");
  });

  test("a pile that is not on the list opens a new one, flag or no flag", () => {
    for (const placement of [
      { card: "c3", pile: "Pace", new: true },
      { card: "c3", pile: "Pace", new: false },
      { card: "c3", pile: "Pace" },
    ]) {
      const reply = JSON.stringify({ kind: "placed", placements: [placement] });
      expect(placingReading({ reply, categories, values, removed })).toBe("placed");
      expect(placingLines({ reply, categories, values, removed })).toEqual([
        { kind: "open", target: card(2), value: "Pace" },
      ]);
    }
  });

  test("a pile already on the list is reached even when the reply calls it new", () => {
    const reply = JSON.stringify({
      kind: "placed",
      placements: [{ card: "c2", pile: "Examples", new: true }],
    });
    expect(placingLines({ reply, categories, values, removed })).toEqual([
      { kind: "place", target: card(1), value: "pile-1" },
    ]);
  });

  test("a card the wall already holds is a line with nothing left to do", () => {
    for (const pile of ["Examples", "Pace"]) {
      const reply = JSON.stringify({ kind: "placed", placements: [{ card: "c1", pile }] });
      // A reply made only of such lines is usable and offers nothing.
      expect(placingReading({ reply, categories, values, removed })).toBe("nothing");
      expect(placingLines({ reply, categories, values, removed })).toEqual([]);
      expect(placingReason({ reply, categories, values, removed })).toBe("");
    }
  });

  test("an empty tray answered with no placements is nothing to place, not a reply to stand upon", () => {
    const reply = JSON.stringify({ kind: "placed", placements: [] });
    const held = categories.map((pile) => ({ ...pile, items: [...pile.items] }));
    held[0]!.items.push(card(1), card(2));
    expect(placingReading({ reply, categories: held, values, removed })).toBe("nothing");
    expect(placingReading({ reply, categories, values, removed })).toBe("neither");
  });

  test("the waiting cards of a reply that also names a placed one are still placed", () => {
    const reply = JSON.stringify({
      kind: "placed",
      placements: [
        { card: "c1", pile: "Examples" },
        { card: "c2", pile: "Examples" },
      ],
    });
    expect(placingReading({ reply, categories, values, removed })).toBe("placed");
    expect(placingLines({ reply, categories, values, removed })).toEqual([
      { kind: "place", target: card(1), value: "pile-1" },
    ]);
  });

  test("a label naming no card of the wall at all is still unusable", () => {
    const reply = JSON.stringify({
      kind: "placed",
      placements: [{ card: "c9", pile: "Examples" }],
    });
    expect(placingReading({ reply, categories, values, removed })).toBe("neither");
    expect(placingReason({ reply, categories, values, removed })).toContain("waiting in the tray");
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
      expect(placingReading({ reply, categories, values, removed })).toBe("neither");
      expect(placingReason({ reply, categories, values, removed })).not.toBe("");
    }
  });
});

describe("a placing reply over a wall that moved", () => {
  test("a line naming a card removed while the ask was out is dropped, and the rest are taken", () => {
    const reply = JSON.stringify({
      kind: "placed",
      placements: [
        { card: "c2", pile: "Examples" },
        { card: "c3", pile: "Pace" },
      ],
    });
    const gone = [card(1)];
    expect(placingReading({ reply, categories, values, removed: gone })).toBe("placed");
    expect(placingLines({ reply, categories, values, removed: gone })).toEqual([
      { kind: "open", target: card(2), value: "Pace" },
    ]);
  });

  test("a label that never named a card is still a reply to stand upon", () => {
    const reply = JSON.stringify({ kind: "placed", placements: [{ card: "c9", pile: "Pace" }] });
    expect(placingReading({ reply, categories, values, removed })).toBe("neither");
    expect(placingReason({ reply, categories, values, removed })).toBe(
      '"c9" names no card waiting in the tray.',
    );
  });
});

describe("the lid", () => {
  test("the passage names the pile and its cards", () => {
    const passage = lidPassage({ pile: "pile-1", categories, values, removed });
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
    expect(placingReading({ reply, categories, values, removed })).toBe("lid");
    expect(lidLines({ reply, categories })).toEqual([
      { kind: "lid", target: "pile-1", value: "These answers ask for worked examples." },
    ]);
  });

  test("a summary naming no pile on this wall is unusable", () => {
    const reply = JSON.stringify({ kind: "lid", pile: "pile-9", sentence: "Anything." });
    expect(placingReading({ reply, categories, values, removed })).toBe("neither");
    expect(lidLines({ reply, categories })).toEqual([]);
  });
});

/** A questionnaire run's presentation: a choice question and a written one. */
const quiz: RunSnapshot = {
  title: "Photosynthesis check",
  form: "quiz",
  disclosure: "score",
  questions: [
    {
      item: "q1",
      prompt: "Which gas do plants take in?",
      choices: ["Oxygen", "Carbon dioxide", "Nitrogen"],
      expected: "Carbon dioxide",
      explanation: "",
      parts: [],
      cap: 0,
      position: 1,
    },
    {
      item: "q2",
      prompt: "Name the pigment that captures light.",
      choices: [],
      expected: "Chlorophyll",
      explanation: "",
      parts: [],
      cap: 0,
      position: 2,
    },
  ],
};

describe("the model participant", () => {
  test("a round that takes context puts the carried groups before the seat", () => {
    const carried: RunSnapshot = {
      ...presentation,
      questions: [
        {
          ...presentation.questions[0]!,
          prompt: "Only these verbs. What is it?",
          context: [
            { name: "one pile", cards: ["hoard", "purge"] },
            { name: "another pile", cards: ["revisit", "save"] },
          ],
        },
      ],
    };
    const passage = participantPassage({ value: carried, participant: "model:d2" });
    expect(passage).toContain("Shown above the question, from an earlier round:");
    expect(passage).toContain("- one pile: hoard, purge");
    expect(passage.indexOf("Only these verbs")).toBeLessThan(passage.indexOf("- one pile"));
    expect(participantPassage({ value: presentation, participant: "model:d2" })).not.toContain(
      "Shown above the question",
    );
  });

  test("the passage names one box per part and seeds by the participant", () => {
    const passage = participantPassage({ value: presentation, participant: "model:d2" });
    expect(passage).toContain("You are participant model:d2, the participant");
    expect(
      passage.split("The questions, each followed by its boxes to answer, one line each:")[1],
    ).toBe("\n\n1. What would help you most right now?\nq1#1 — First\nq1#2 — Second");
  });

  test("the passage prints every question of a run, each with its choices and its boxes", () => {
    const passage = participantPassage({ value: quiz, participant: "model:d2" });
    expect(
      passage.split("The questions, each followed by its boxes to answer, one line each:")[1],
    ).toBe(
      "\n\n1. Which gas do plants take in?\nChoose from: Oxygen | Carbon dioxide | Nitrogen\nq1 — your answer\n\n2. Name the pigment that captures light.\nq2 — your answer",
    );
    expect(passage).not.toContain("Chlorophyll");
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
    const passage = placingPassage({ value: presentation, categories, values, removed, notes: "" });
    const bad = mind(passage);
    expect(placingReading({ reply: bad, categories, values, removed })).toBe("neither");

    const repair = placingRepairPassage({
      value: presentation,
      categories,
      values,
      removed,
      notes: "",
      offering: bad,
      account: placingReason({ reply: bad, categories, values, removed }),
    });
    const good = mind(repair);
    expect(placingReading({ reply: good, categories, values, removed })).toBe("placed");
    expect(placingLines({ reply: good, categories, values, removed }).length).toBe(2);
  });

  test("a wall with nothing unsortable is placed well the first time", () => {
    const plain = values.slice(0, 2);
    const passage = placingPassage({
      value: presentation,
      categories,
      values: plain,
      removed,
      notes: "",
    });
    const reply = mind(passage);
    expect(placingReading({ reply, categories, values: plain, removed })).toBe("placed");
  });

  test("it summarizes the pile it was given", () => {
    const reply = mind(lidPassage({ pile: "pile-1", categories, values, removed }));
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

  test("it answers every question of a run, a choice where one is offered", () => {
    const answers = participantAnswers({
      reply: mind(participantPassage({ value: quiz, participant: "model:one" })),
      value: quiz,
    });
    expect(answers.map((answer) => answer.item)).toEqual(["q1", "q2"]);
    expect(quiz.questions[0]!.choices).toContain(answers[0]!.value);
    expect(answers[1]!.value).not.toBe("");
  });
});
