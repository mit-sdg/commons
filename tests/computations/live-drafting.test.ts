import { describe, expect, test } from "vite-plus/test";
import { parseKind, parsedMaterial, parsedReason } from "../../src/computations/live-drafting.ts";

const draft = (form: string, material: unknown[]) =>
  JSON.stringify({ kind: "draft", form, material });

const quizItem = (overrides: Record<string, unknown> = {}) => ({
  prompt: "Question?",
  choices: ["Yes", "No"],
  expected: "Yes",
  explanation: "Because.",
  ...overrides,
});

describe("the live-drafting reply boundary", () => {
  test("accepts and normalizes a valid generated quiz", () => {
    const reply = draft("quiz", [
      quizItem({
        prompt: "  Question?  ",
        choices: ["  Yes  ", " No "],
        expected: " Yes ",
        explanation: "  Because.  ",
      }),
    ]);
    expect(parseKind({ reply })).toBe("draft");
    expect(parsedMaterial({ reply })).toEqual([
      {
        prompt: "Question?",
        choices: ["Yes", "No"],
        expected: "Yes",
        explanation: "Because.",
      },
    ]);
  });

  test("rejects duplicate and non-string choices before they reach Questioning", () => {
    for (const reply of [
      draft("quiz", [quizItem({ choices: [" Yes ", "yes"] })]),
      draft("quiz", [quizItem({ choices: ["Yes", 7] })]),
    ]) {
      expect(parseKind({ reply })).toBe("neither");
      expect(parsedReason({ reply })).not.toBe("");
    }
  });

  test("rejects a choice answer that is not an exact member", () => {
    const reply = draft("quiz", [quizItem({ choices: ["Yes", "No"], expected: "yes" })]);
    expect(parseKind({ reply })).toBe("neither");
  });

  test("rejects answer or explanation leakage from a survey", () => {
    for (const item of [
      quizItem({ expected: "Yes", explanation: "" }),
      quizItem({ expected: "", explanation: "Because." }),
    ]) {
      expect(parseKind({ reply: draft("survey", [item]) })).toBe("neither");
    }
  });

  test("requires every generated quiz item to carry an expected answer", () => {
    const reply = draft("quiz", [quizItem({ choices: [], expected: "" })]);
    expect(parseKind({ reply })).toBe("neither");
  });

  test("accepts the exact material boundaries", () => {
    const longChoice = "c".repeat(500);
    const boundary = quizItem({
      prompt: "p".repeat(10_000),
      choices: [longChoice, ...Array.from({ length: 49 }, (_, index) => `choice-${index}`)],
      expected: longChoice,
      explanation: "e".repeat(2_000),
    });
    expect(parseKind({ reply: draft("quiz", [boundary]) })).toBe("draft");

    const written = quizItem({
      choices: [],
      expected: "r".repeat(2_000),
      explanation: "e".repeat(2_000),
    });
    expect(
      parseKind({
        reply: draft(
          "quiz",
          Array.from({ length: 100 }, () => written),
        ),
      }),
    ).toBe("draft");
  });

  test("rejects each material value immediately beyond its boundary", () => {
    const overlongChoice = "c".repeat(501);
    const overlongReference = "r".repeat(2_001);
    const replies = [
      draft(
        "quiz",
        Array.from({ length: 101 }, () => quizItem()),
      ),
      draft("quiz", [quizItem({ prompt: "p".repeat(10_001) })]),
      draft("quiz", [
        quizItem({
          choices: Array.from({ length: 51 }, (_, index) => `choice-${index}`),
          expected: "choice-0",
        }),
      ]),
      draft("quiz", [quizItem({ choices: [overlongChoice], expected: overlongChoice })]),
      draft("quiz", [quizItem({ choices: [], expected: overlongReference })]),
      draft("quiz", [quizItem({ explanation: "e".repeat(2_001) })]),
    ];
    for (const reply of replies) expect(parseKind({ reply })).toBe("neither");
  });
});
