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
  editTitle,
  editUse,
  legMaterials,
  relayDraftPassage,
  relayDraftReading,
  relayDraftReason,
  relayDraftRepairPassage,
  relayEditLines,
  mintedRelayTitle,
} from "../../src/computations/live-edits.ts";

const round = (overrides: Record<string, unknown> = {}) => ({
  title: "Three verbs",
  prompt: "Name three verbs from the passage.",
  parts: ["one", "two", "three"],
  cap: 0,
  choices: [],
  takes: { from: 0, use: "" },
  ...overrides,
});

const relay = (rounds: unknown[], title?: string) =>
  JSON.stringify(
    title === undefined ? { kind: "relay", rounds } : { kind: "relay", title, rounds },
  );

/** The name the standing relay goes by, chosen by hand rather than minted. */
const stands = "Verbs and strangers";

/** The plan and materials of a two-round relay whose second round takes the first's picks. */
const legs = [
  { leg: "leg-1", material: "q-1", position: 1, draws: [] },
  { leg: "leg-2", material: "q-2", position: 2, draws: [{ source: "leg-1", use: "context" }] },
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

/** The passage a reply is read against: a relay standing under a name of its own. */
const asked = (request: string, title = stands) =>
  relayDraftPassage({ request, title, legs, materials });

const passage = asked("Add a warm-up round.");

describe("the relay-drafting reply boundary", () => {
  test("reads a whole relay and rejects what a round may not be", () => {
    expect(relayDraftReading({ reply: relay([round()]), passage })).toBe("relay");
    expect(relayDraftReason({ reply: relay([round()]) })).toBe("");

    const unusable = [
      "not JSON at all",
      JSON.stringify(["relay"]),
      JSON.stringify({ kind: "draft", rounds: [round()] }),
      relay(Array.from({ length: 21 }, () => round())),
      relay([round({ title: "" })]),
      relay([round({ prompt: "" })]),
      relay([round({ parts: [], cap: 0, choices: ["Yes", "yes"] })]),
      relay([round({ parts: ["one"], cap: 1 })]),
      relay([round({ parts: ["one"], choices: ["Yes"] })]),
      relay([round({ takes: { from: 1, use: "guessed" } })]),
      relay([round({ kind: "write", takes: { from: 1, use: "parts" } })]),
      relay([round({ parts: [], choices: ["ran", "waited"], takes: { from: 1, use: "choices" } })]),
      relay([round({ kind: "vote", parts: [], choices: [] })]),
      relay([round({ kind: "sing" })]),
      relay([round({ takes: { from: -1, use: "context" } })]),
    ];
    for (const reply of unusable) {
      expect(relayDraftReading({ reply, passage })).toBe("neither");
      expect(relayDraftReason({ reply })).not.toBe("");
    }
    // A relay cleared of every round is a relay the brief asked for.
    expect(relayDraftReading({ reply: relay([]), passage })).toBe("relay");
  });

  test("a round's kind is read off its boxes and its take when it claims none", () => {
    const usable = [
      relay([round({ kind: "list" })]),
      relay([round({ parts: [], takes: { from: 1, use: "context" } })]),
      relay([round({ kind: "vote", parts: [], choices: [], takes: { from: 1, use: "choices" } })]),
      relay([round({ kind: "list", parts: [], takes: { from: 1, use: "parts" } })]),
    ];
    for (const reply of usable) expect(relayDraftReading({ reply, passage })).toBe("relay");
  });

  test("a round takes nothing when its number or its use is empty", () => {
    const lines = relayEditLines({
      reply: relay([
        round({ takes: { from: 0, use: "context" } }),
        round({ title: "The stranger", parts: ["answer"], takes: { from: 1, use: "" } }),
      ]),
      title: stands,
      legs: [],
      materials: [],
    });
    for (const line of lines) {
      expect(line.kind).toBe("add");
      expect(JSON.parse(line.value)).toHaveProperty("takes", { from: 0, use: "" });
    }
  });

  test("the passages carry the relay as it stands and the brief the author wrote", () => {
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

  test("a name for the relay is read, and a name past the limit is not", () => {
    expect(relayDraftReading({ reply: relay([round()], "Verbs and strangers"), passage })).toBe(
      "relay",
    );
    expect(relayDraftReading({ reply: relay([round()], "x".repeat(201)), passage })).toBe(
      "neither",
    );
  });

  test("a relay standing under the name its brief minted takes the model's without asking", () => {
    const minted = asked(
      "Add a warm-up round.",
      mintedRelayTitle({ request: "Add a warm-up round." }),
    );
    expect(mintedRelayTitle({ request: "Add a warm-up round." })).toBe("Add a warm-up round");
    expect(
      relayDraftReading({ reply: relay([round()], "Verbs and strangers"), passage: minted }),
    ).toBe("named");
    // A relay named by hand is asked about like anything else, and a reply that
    // gives no name of its own names nothing.
    expect(relayDraftReading({ reply: relay([round()], "Verbs and strangers"), passage })).toBe(
      "relay",
    );
    expect(relayDraftReading({ reply: relay([round()]), passage: minted })).toBe("relay");
  });

  test("the materials of a plan's legs are answered in order", () => {
    expect(legMaterials({ legs })).toEqual(["q-1", "q-2"]);
    expect(legMaterials({ legs: undefined })).toEqual([]);
  });
});

describe("the lines that turn the standing relay into the drafted one", () => {
  test("a relay drafted as it already stands offers one keep line", () => {
    const reply = relay([
      round(),
      round({
        title: "The stranger",
        prompt: "Which verb best fits the stranger?",
        parts: ["answer"],
        takes: { from: 1, use: "context" },
      }),
    ]);
    expect(relayEditLines({ reply, title: stands, legs, materials })).toEqual([
      { kind: "keep", target: "", value: "" },
    ]);
  });

  test("rounds delivered with their numbers keep their identity: a swap is one move", () => {
    const reply = relay([
      round({
        number: 2,
        title: "The stranger",
        prompt: "Which verb best fits the stranger?",
        parts: ["answer"],
      }),
      round({ number: 1 }),
    ]);
    expect(relayEditLines({ reply, title: stands, legs, materials })).toEqual([
      { kind: "takes", target: "leg-2", value: JSON.stringify({ from: 0, use: "" }) },
      { kind: "move", target: "leg-2", value: "1" },
    ]);
  });

  test("a numbered reply removes the standing round it no longer names and adds where a new one lands", () => {
    const reply = relay([
      round({ number: 0, title: "Warm-up", prompt: "How is the pace?", parts: [] }),
      round({
        number: 2,
        title: "The stranger",
        prompt: "Which verb best fits the stranger?",
        parts: ["answer"],
        takes: { from: 1, use: "context" },
      }),
    ]);
    expect(relayEditLines({ reply, title: stands, legs, materials })).toEqual([
      { kind: "takes", target: "leg-2", value: JSON.stringify({ from: 0, use: "" }) },
      { kind: "remove", target: "leg-1", value: "" },
      {
        kind: "add",
        target: "",
        value: JSON.stringify({
          kind: "write",
          title: "Warm-up",
          prompt: "How is the pace?",
          parts: [],
          cap: 0,
          choices: [],
          takes: { from: 0, use: "" },
          position: 1,
        }),
      },
      { kind: "takes", target: "leg-2", value: JSON.stringify({ from: 1, use: "context" }) },
    ]);
  });

  test("a round within both reaches gives one line per changed field", () => {
    const reply = relay([
      round({ title: "Three doing words", parts: ["one", "two"], cap: 0 }),
      round({
        title: "The stranger",
        prompt: "Which verb best fits the stranger?",
        parts: [],
        choices: ["ran", "waited"],
        takes: { from: 1, use: "context" },
      }),
    ]);
    expect(relayEditLines({ reply, title: stands, legs, materials })).toEqual([
      { kind: "title", target: "leg-1", value: "Three doing words" },
      { kind: "parts", target: "leg-1", value: JSON.stringify({ parts: ["one", "two"], cap: 0 }) },
      { kind: "parts", target: "leg-2", value: JSON.stringify({ parts: [], cap: 0 }) },
      { kind: "choices", target: "leg-2", value: JSON.stringify(["ran", "waited"]) },
    ]);
  });

  test("a drafted round past the relay's reach is added, carrying its takes and where it lands", () => {
    const reply = relay([
      round(),
      round({
        title: "The stranger",
        prompt: "Which verb best fits the stranger?",
        parts: ["answer"],
        takes: { from: 1, use: "context" },
      }),
      round({
        title: "Why",
        prompt: "Why that one?",
        parts: [],
        takes: { from: 2, use: "context" },
      }),
    ]);
    expect(relayEditLines({ reply, title: stands, legs, materials })).toEqual([
      {
        kind: "add",
        target: "",
        value: JSON.stringify({
          kind: "write",
          title: "Why",
          prompt: "Why that one?",
          parts: [],
          cap: 0,
          choices: [],
          takes: { from: 2, use: "context" },
          position: 3,
        }),
      },
    ]);
  });

  test("a standing round past the draft's reach is removed", () => {
    const reply = relay([round()]);
    expect(relayEditLines({ reply, title: stands, legs, materials })).toEqual([
      { kind: "remove", target: "leg-2", value: "" },
    ]);
  });

  test("a name the reply gives comes first, and a name it repeats gives no line", () => {
    const reply = relay(
      [
        round(),
        round({
          title: "The stranger",
          prompt: "Which verb best fits the stranger?",
          parts: ["answer"],
          takes: { from: 1, use: "context" },
        }),
      ],
      "Reading the stranger",
    );
    expect(relayEditLines({ reply, title: stands, legs, materials })).toEqual([
      { kind: "title", target: "", value: "Reading the stranger" },
    ]);
    expect(relayEditLines({ reply, title: "Reading the stranger", legs, materials })).toEqual([
      { kind: "keep", target: "", value: "" },
    ]);
  });

  test("an unusable reply proposes nothing", () => {
    expect(relayEditLines({ reply: "not JSON at all", title: stands, legs, materials })).toEqual(
      [],
    );
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
    expect(parsed).toMatchObject({
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
    expect(editRoundJson({ value: "nonsense" })).toMatchObject({
      title: "",
      prompt: "",
      parts: [],
      cap: 0,
      choices: [],
    });
  });

  test("parts, choices, position, and use lines read their own values", () => {
    const parts = JSON.stringify({ parts: ["one", "two"], cap: 0 });
    expect(editParts({ value: parts })).toEqual(["one", "two"]);
    expect(editCap({ value: parts })).toBe(0);
    expect(editChoices({ value: JSON.stringify(["ran", "waited"]) })).toEqual(["ran", "waited"]);
    expect(editPosition({ value: "2" })).toBe(2);

    const takes = JSON.stringify({ from: 1, use: "context" });
    expect(editPosition({ value: takes })).toBe(1);
    expect(editUse({ value: takes })).toBe("context");

    const nothing = JSON.stringify({ from: 0, use: "" });
    expect(editPosition({ value: nothing })).toBe(0);
    expect(editUse({ value: nothing })).toBe("");
    expect(editUse({ value: JSON.stringify({ from: 1, use: "guessed" }) })).toBe("");
    expect(editUse({ value: "nonsense" })).toBe("");
  });
});
