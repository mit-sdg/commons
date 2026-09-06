import { describe, expect, test } from "vite-plus/test";
import {
  SAMPLING_OPENING,
  sampleStanding,
  sampledAnswers,
  sampledGroups,
  sampledPiles,
  samplingPassage,
  samplingPassageTaking,
  unsampledNames,
} from "../../src/computations/live-sampling.ts";
import { scriptedWallReply } from "../../src/reasoning/scripted-walls.ts";

/** Two piles standing on the round before the room answers, each with its sentence. */
const piles = [
  { category: "pile-1", name: "Pace", description: "It was too slow to use." },
  { category: "pile-2", name: "Crashes", description: "It stopped working outright." },
];

const notes = "Group by what went wrong, not by which app.";

const written = {
  prompt: "What went wrong the last time an app failed you?",
  choices: [],
  parts: [],
  cap: 0,
  piles,
  notes,
};

const sampled = (answers: { value: string; pile: string }[]) =>
  JSON.stringify({ kind: "sampled", answers });

describe("the sampling passage", () => {
  test("carries the piles with their sentences, the note, and the twelve participants", () => {
    const passage = samplingPassage(written);
    expect(passage.startsWith(SAMPLING_OPENING)).toBe(true);
    expect(passage).toContain("The question:\nWhat went wrong the last time an app failed you?");
    expect(passage).toContain("The piles as they stand:\n- Pace: It was too slow to use.");
    expect(passage).toContain("- Crashes: It stopped working outright.");
    expect(passage).toContain("The author's notes:\nGroup by what went wrong, not by which app.");
    expect(passage).toContain(
      "1. the participant who answers from a concrete example they saw this week",
    );
    expect(passage).toContain(
      "12. the participant who thinks about two people using the same thing",
    );
    expect(passage).not.toContain("13. ");
  });

  test("says so when no pile stands, and leaves out a note nobody wrote", () => {
    const bare = samplingPassage({ ...written, piles: [], notes: "  " });
    expect(bare).toContain("The piles as they stand:\nNo piles yet.");
    expect(bare).not.toContain("The author's notes:");
  });
});

describe("the sampling passage of a round that takes from an earlier one", () => {
  const carried = ["Pace", "Crashes", "Examples"].map((name) => ({ name, cards: [] }));
  const taking = { ...written, use: "choices", carried };

  test("carried names stand as the choices, and no boxes stand with them", () => {
    const passage = samplingPassageTaking(taking);
    expect(passage).toContain("Choose from: Pace | Crashes | Examples");
    expect(passage).not.toContain("The boxes to answer:");
  });

  test("carried names stand as the boxes when the round takes them as parts", () => {
    const passage = samplingPassageTaking({ ...taking, use: "parts" });
    expect(passage).toContain("The boxes to answer:\n- Pace\n- Crashes\n- Examples");
    expect(passage).not.toContain("Choose from: ");
  });

  test("carried names stand above the question as context, and the round's own question stands", () => {
    const passage = samplingPassageTaking({
      ...taking,
      use: "context",
      choices: ["Yes", "No"],
      parts: ["First", "Second"],
    });
    expect(passage).toContain(
      "Synthetic example groups from an earlier round (not real class responses):\n- Pace\n- Crashes\n- Examples",
    );
    expect(passage).toContain("Choose from: Yes | No");
    expect(passage).toContain("The boxes to answer:\n- First\n- Second");
  });
});

describe("a source with no sample, and whether a sample still stands", () => {
  test("an unsampled source names nothing at all, whatever the take", () => {
    expect(unsampledNames({ use: "choices" })).toEqual([]);
    expect(unsampledNames({ use: "context" })).toEqual([]);
  });

  test("a sample is fresh only against the very passage it was asked with", () => {
    const passage = samplingPassage(written);
    expect(sampleStanding({ asked: passage, passage })).toBe("fresh");
    expect(sampleStanding({ asked: passage, passage: `${passage} ` })).toBe("stale");
    expect(
      sampleStanding({ asked: passage, passage: samplingPassage({ ...written, notes: "" }) }),
    ).toBe("stale");
  });
});

describe("reading a sampled reply", () => {
  test("a good reply reads into its answers, and its piles come out once each in order", () => {
    const reply = sampled([
      { value: "it froze", pile: "Crashes" },
      { value: "took forever to load", pile: "Pace" },
      { value: "it quit on me", pile: "Crashes" },
    ]);
    expect(sampledAnswers({ reply })).toEqual([
      { value: "it froze", pile: "Crashes" },
      { value: "took forever to load", pile: "Pace" },
      { value: "it quit on me", pile: "Crashes" },
    ]);
    expect(sampledPiles({ reply })).toEqual(["Crashes", "Pace"]);
  });

  test("an answer with no value or no pile is dropped, and the rest lose their extra space", () => {
    const reply = sampled([
      { value: "  it   froze\n again ", pile: " Crashes  " },
      { value: "   ", pile: "Pace" },
      { value: "it quit on me", pile: "" },
    ]);
    expect(sampledAnswers({ reply })).toEqual([{ value: "it froze again", pile: "Crashes" }]);
    expect(sampledPiles({ reply })).toEqual(["Crashes"]);
  });

  test("a reply the reading cannot make out is a sample of no answers", () => {
    expect(sampledAnswers({ reply: "not json" })).toEqual([]);
    expect(sampledAnswers({ reply: '["one","two"]' })).toEqual([]);
    expect(sampledAnswers({ reply: '{"kind":"placed","answers":[]}' })).toEqual([]);
    expect(sampledAnswers({ reply: '{"kind":"sampled"}' })).toEqual([]);
    expect(sampledPiles({ reply: "not json" })).toEqual([]);
  });
});

describe("the scripted mind on a sampling passage", () => {
  test("it writes one answer per participant and reaches for every standing pile", () => {
    const reply = scriptedWallReply(samplingPassage(written)) ?? "";
    const answers = sampledAnswers({ reply });
    expect(answers.length).toBe(12);
    const named = sampledPiles({ reply });
    expect(named).toContain("Pace");
    expect(named).toContain("Crashes");
    expect(answers.every((answer) => answer.value !== "")).toBe(true);
  });

  test("when choices are offered every answer is one of them, and its own pile", () => {
    const carried = ["Pace", "Crashes", "Examples"].map((name) => ({ name, cards: [] }));
    const reply =
      scriptedWallReply(samplingPassageTaking({ ...written, use: "choices", carried })) ?? "";
    const answers = sampledAnswers({ reply });
    expect(answers.length).toBe(12);
    expect(answers.every((answer) => answer.value === answer.pile)).toBe(true);
    expect(answers.every((answer) => carried.some((group) => group.name === answer.value))).toBe(
      true,
    );
    expect(sampledPiles({ reply })).toEqual(carried.map((group) => group.name));
  });
});

describe("supporting examples in a carried sample", () => {
  const reply = sampled([
    {
      value: "The editor erased my grant draft and I spent forty minutes retyping.",
      pile: "Lost work",
    },
    {
      value: "Checkout charged my card twice and left me short for groceries.",
      pile: "Paid twice",
    },
    { value: "A reload erased my application before its deadline.", pile: "Lost work" },
  ]);

  test("grouping keeps the actual source text and first-seen pile order", () => {
    expect(sampledGroups({ reply, kind: "write", choices: [], use: "" })).toEqual([
      {
        name: "Lost work",
        cards: [
          "The editor erased my grant draft and I spent forty minutes retyping.",
          "A reload erased my application before its deadline.",
        ],
      },
      {
        name: "Paid twice",
        cards: ["Checkout charged my card twice and left me short for groceries."],
      },
    ]);
  });

  test.each(["context", "parts", "choices"])(
    "%s carries source cards and changes freshness when their text changes",
    (use) => {
      const carried = sampledGroups({ reply, kind: "write", choices: [], use: "" });
      const args = { ...written, use, carried };
      const asked = samplingPassageTaking(args);
      expect(asked).toContain(
        "Synthetic example groups from an earlier round (not real class responses)",
      );
      expect(asked).toContain(
        "The editor erased my grant draft and I spent forty minutes retyping.",
      );
      expect(asked).toContain("Checkout charged my card twice and left me short for groceries.");
      const changed = carried.map((group) => ({
        ...group,
        cards: ["A different concrete situation."],
      }));
      expect(
        sampleStanding({ asked, passage: samplingPassageTaking({ ...args, carried: changed }) }),
      ).toBe("stale");
    },
  );

  test("ballot labels never masquerade as supporting narrative cards", () => {
    const votes = sampled([
      { value: "Lost work", pile: "Lost work" },
      { value: "Lost work", pile: "Lost work" },
      { value: "Paid twice", pile: "Paid twice" },
    ]);
    expect(sampledGroups({ reply: votes, kind: "vote", choices: [], use: "" })).toEqual([
      { name: "Lost work", cards: [] },
      { name: "Paid twice", cards: [] },
    ]);
  });
});

describe("source samples from legacy rounds with an inferred kind", () => {
  const reply = sampled([{ value: "Want to learn", pile: "Want to learn" }]);
  test.each([
    { choices: [], use: "choices" },
    { choices: ["Can help with", "Want to learn"], use: "context" },
  ])("inferred votes exclude ballot labels from narrative cards: %j", (source) => {
    expect(sampledGroups({ reply, kind: "", ...source })).toEqual([
      { name: "Want to learn", cards: [] },
    ]);
  });
  test("an inferred written round keeps even a short answer that equals its pile name", () => {
    expect(sampledGroups({ reply, kind: "", choices: [], use: "context" })).toEqual([
      { name: "Want to learn", cards: ["Want to learn"] },
    ]);
  });
  test("an explicit written kind ignores dormant saved choices", () => {
    expect(
      sampledGroups({ reply, kind: "write", choices: ["Want to learn"], use: "context" }),
    ).toEqual([{ name: "Want to learn", cards: ["Want to learn"] }]);
  });
});
