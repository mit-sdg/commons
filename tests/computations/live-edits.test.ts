import { describe, expect, test } from "vite-plus/test";
import {
  editCap,
  editChoices,
  editParts,
  editPosition,
  editRoundCap,
  editRoundChoices,
  editRoundJson,
  editRoundParts,
  editPrompt,
  editShape,
  editTitle,
  legMaterials,
  relayDraftPassage,
  relayDraftReading,
  relayDraftReason,
  relayDraftRepairPassage,
  relayEditLines,
} from "../../src/computations/live-edits.ts";

const round = (overrides: Record<string, unknown> = {}) => ({
  title: "Three verbs",
  prompt: "Name three verbs from the passage.",
  parts: ["one", "two", "three"],
  cap: 0,
  choices: [],
  takes: { from: 0, shape: "" },
  ...overrides,
});

const relay = (rounds: unknown[]) => JSON.stringify({ kind: "relay", rounds });

/** The plan and materials of a two-round relay whose second round takes the first's picks. */
const legs = [
  { leg: "leg-1", material: "q-1", position: 1, draws: [] },
  { leg: "leg-2", material: "q-2", position: 2, draws: [{ source: "leg-1", shape: "picked" }] },
];

const materials = [
  {
    questionnaire: "q-1",
    title: "Three verbs",
    questions: [
      {
        prompt: "Name three verbs from the passage.",
        choices: [],
        expected: "",
        explanation: "",
        parts: ["one", "two", "three"],
        cap: 0,
      },
    ],
  },
  {
    questionnaire: "q-2",
    title: "The stranger",
    questions: [
      {
        prompt: "Which verb best fits the stranger?",
        choices: [],
        expected: "",
        explanation: "",
        parts: ["answer"],
        cap: 0,
      },
    ],
  },
];

describe("the relay-drafting reply boundary", () => {
  test("reads a whole relay and rejects what a round may not be", () => {
    expect(relayDraftReading({ reply: relay([round()]) })).toBe("relay");
    expect(relayDraftReason({ reply: relay([round()]) })).toBe("");

    const unusable = [
      "not JSON at all",
      JSON.stringify(["relay"]),
      JSON.stringify({ kind: "draft", rounds: [round()] }),
      relay([]),
      relay(Array.from({ length: 21 }, () => round())),
      relay([round({ title: "" })]),
      relay([round({ prompt: "" })]),
      relay([round({ parts: [], cap: 0, choices: ["Yes", "yes"] })]),
      relay([round({ parts: ["one"], cap: 1 })]),
      relay([round({ parts: ["one"], choices: ["Yes"] })]),
      relay([round({ takes: { from: 1, shape: "guessed" } })]),
      relay([round({ takes: { from: -1, shape: "picked" } })]),
    ];
    for (const reply of unusable) {
      expect(relayDraftReading({ reply })).toBe("neither");
      expect(relayDraftReason({ reply })).not.toBe("");
    }
  });

  test("a round takes nothing when its number or its shape is empty", () => {
    const lines = relayEditLines({
      reply: relay([
        round({ takes: { from: 0, shape: "picked" } }),
        round({ title: "The stranger", parts: ["answer"], takes: { from: 1, shape: "" } }),
      ]),
      legs: [],
      materials: [],
    });
    for (const line of lines) {
      expect(line.kind).toBe("add");
      expect(JSON.parse(line.value)).not.toHaveProperty("takes");
    }
  });

  test("the passages carry the relay as it stands and the brief the author wrote", () => {
    const passage = relayDraftPassage({ request: "Add a warm-up round.", legs, materials });
    expect(passage).toContain('"kind":"relay"');
    expect(passage).toContain("The brief:\nAdd a warm-up round.");
    expect(passage).toContain('"number":2');
    expect(passage).toContain('"from":1');
    expect(passage).not.toContain("leg-1");

    const repaired = relayDraftRepairPassage({
      passage,
      offering: "nonsense",
      account: "The reply was not readable JSON.",
    });
    expect(repaired).toContain(passage);
    expect(repaired).toContain("Your previous reply came back unusable");
    expect(repaired).toContain("The account of the problem:\nThe reply was not readable JSON.");
  });

  test("the materials of a plan's legs are answered in order", () => {
    expect(legMaterials({ legs })).toEqual(["q-1", "q-2"]);
    expect(legMaterials({ legs: undefined })).toEqual([]);
  });
});

describe("the lines that turn the standing relay into the drafted one", () => {
  test("a relay drafted as it already stands changes nothing", () => {
    const reply = relay([
      round(),
      round({
        title: "The stranger",
        prompt: "Which verb best fits the stranger?",
        parts: ["answer"],
        takes: { from: 1, shape: "picked" },
      }),
    ]);
    expect(relayEditLines({ reply, legs, materials })).toEqual([]);
  });

  test("a round within both reaches gives one line per changed field", () => {
    const reply = relay([
      round({ title: "Three doing words", parts: ["one", "two"], cap: 0 }),
      round({
        title: "The stranger",
        prompt: "Which verb best fits the stranger?",
        parts: [],
        choices: ["ran", "waited"],
        takes: { from: 1, shape: "every" },
      }),
    ]);
    expect(relayEditLines({ reply, legs, materials })).toEqual([
      { kind: "title", target: "leg-1", value: "Three doing words" },
      { kind: "parts", target: "leg-1", value: JSON.stringify({ parts: ["one", "two"], cap: 0 }) },
      { kind: "parts", target: "leg-2", value: JSON.stringify({ parts: [], cap: 0 }) },
      { kind: "choices", target: "leg-2", value: JSON.stringify(["ran", "waited"]) },
      { kind: "takes", target: "leg-2", value: JSON.stringify({ from: 1, shape: "every" }) },
    ]);
  });

  test("a drafted round past the relay's reach is added, without a takes line", () => {
    const reply = relay([
      round(),
      round({
        title: "The stranger",
        prompt: "Which verb best fits the stranger?",
        parts: ["answer"],
        takes: { from: 1, shape: "picked" },
      }),
      round({ title: "Why", prompt: "Why that one?", parts: [], takes: { from: 2, shape: "top" } }),
    ]);
    expect(relayEditLines({ reply, legs, materials })).toEqual([
      {
        kind: "add",
        target: "",
        value: JSON.stringify({
          title: "Why",
          prompt: "Why that one?",
          parts: [],
          cap: 0,
          choices: [],
        }),
      },
    ]);
  });

  test("a standing round past the draft's reach is removed", () => {
    const reply = relay([round()]);
    expect(relayEditLines({ reply, legs, materials })).toEqual([
      { kind: "remove", target: "leg-2", value: "" },
    ]);
  });

  test("an unusable reply proposes nothing", () => {
    expect(relayEditLines({ reply: "not JSON at all", legs, materials })).toEqual([]);
  });
});

describe("reading one line back into what a concept takes", () => {
  test("an add line carries the whole round", () => {
    const value = JSON.stringify({
      title: "  Why  ",
      prompt: " Why that one? ",
      parts: [" one "],
      cap: 3,
      choices: [],
    });
    const parsed = editRoundJson({ value });
    expect(parsed).toEqual({
      title: "Why",
      prompt: "Why that one?",
      parts: ["one"],
      cap: 3,
      choices: [],
    });
    expect(editTitle({ round: parsed })).toBe("Why");
    expect(editPrompt({ round: parsed })).toBe("Why that one?");
    expect(editRoundParts({ round: parsed })).toEqual(["one"]);
    expect(editRoundCap({ round: parsed })).toBe(3);
    expect(editRoundChoices({ round: parsed })).toEqual([]);
  });

  test("an unreadable add line reads as an empty round, which Questioning refuses", () => {
    expect(editRoundJson({ value: "nonsense" })).toEqual({
      title: "",
      prompt: "",
      parts: [],
      cap: 0,
      choices: [],
    });
  });

  test("parts, choices, position, and shape lines read their own values", () => {
    const parts = JSON.stringify({ parts: ["one", "two"], cap: 0 });
    expect(editParts({ value: parts })).toEqual(["one", "two"]);
    expect(editCap({ value: parts })).toBe(0);
    expect(editChoices({ value: JSON.stringify(["ran", "waited"]) })).toEqual(["ran", "waited"]);
    expect(editPosition({ value: "2" })).toBe(2);

    const takes = JSON.stringify({ from: 1, shape: "picked" });
    expect(editPosition({ value: takes })).toBe(1);
    expect(editShape({ value: takes })).toBe("picked");

    const nothing = JSON.stringify({ from: 0, shape: "" });
    expect(editPosition({ value: nothing })).toBe(0);
    expect(editShape({ value: nothing })).toBe("");
    expect(editShape({ value: JSON.stringify({ from: 1, shape: "guessed" }) })).toBe("");
    expect(editShape({ value: "nonsense" })).toBe("");
  });
});
