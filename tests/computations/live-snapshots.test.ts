import { describe, expect, test } from "vite-plus/test";
import {
  answerReceipt,
  boardQuestions,
  explanationReceipt,
  participantQuestions,
  snapshotForm,
  snapshotHasQuestion,
  snapshotIsWhole,
  snapshotTitle,
  type RunSnapshot,
} from "../../src/computations/live-snapshots.ts";

const presentation: RunSnapshot = {
  title: "Plant check",
  form: "quiz",
  disclosure: "explanations",
  questions: [
    {
      item: "choice",
      prompt: "Pick one",
      choices: ["Yes", "No"],
      expected: "Yes",
      explanation: "The reason",
      position: 1,
    },
    {
      item: "written",
      prompt: "Explain",
      choices: [],
      expected: "A reference",
      explanation: "Read more",
      position: 2,
    },
    {
      item: "pace",
      prompt: "How was the pace?",
      choices: ["Fast", "Slow"],
      expected: "",
      explanation: "",
      position: 3,
    },
  ],
};
const value = { presentation };

describe("live run snapshot projections", () => {
  test("participant projection conceals standards and explanations", () => {
    expect(snapshotTitle({ value })).toBe("Plant check");
    expect(snapshotForm({ value })).toBe("quiz");
    expect(participantQuestions({ value })).toEqual([
      {
        question: "choice",
        prompt: "Pick one",
        choices: ["Yes", "No"],
        parts: [],
        cap: 0,
        context: [],
        position: 1,
      },
      {
        question: "written",
        prompt: "Explain",
        choices: [],
        parts: [],
        cap: 0,
        context: [],
        position: 2,
      },
      {
        question: "pace",
        prompt: "How was the pace?",
        choices: ["Fast", "Slow"],
        parts: [],
        cap: 0,
        context: [],
        position: 3,
      },
    ]);
  });

  test("participation membership and completeness use captured identities", () => {
    expect(snapshotHasQuestion({ value: presentation, question: "written" })).toBe(true);
    expect(snapshotHasQuestion({ value: presentation, question: "later-edit" })).toBe(false);
    expect(
      snapshotIsWhole({
        value: presentation,
        answers: presentation.questions.map(({ item }) => ({ item, value: "answer" })),
      }),
    ).toBe(true);
    expect(
      snapshotIsWhole({ value: presentation, answers: [{ item: "choice", value: "Yes" }] }),
    ).toBe(false);
  });

  test("board projection enriches captured questions with submitted values", () => {
    const questions = boardQuestions({
      value,
      values: [
        { response: "r1", participant: "p1", item: "choice", value: "Yes" },
        { response: "r2", participant: "p2", item: "choice", value: "No" },
      ],
    });
    expect(questions[0]?.values).toEqual([
      { response: "r1", participant: "p1", part: "", value: "Yes" },
      { response: "r2", participant: "p2", part: "", value: "No" },
    ]);
    expect(questions[1]?.values).toEqual([]);
  });

  test("receipt projection follows snapshot order and feedback kinds", () => {
    const answers = [
      { item: "pace", value: "Fast" },
      { item: "written", value: "My explanation" },
      { item: "choice", value: "Yes" },
    ];
    expect(answerReceipt({ value, answers })).toEqual([
      { item: "choice", prompt: "Pick one", value: "Yes", kind: "graded", standard: "Yes" },
      {
        item: "written",
        prompt: "Explain",
        value: "My explanation",
        kind: "reference",
        standard: "A reference",
      },
      {
        item: "pace",
        prompt: "How was the pace?",
        value: "Fast",
        kind: "ungraded",
        standard: "",
      },
    ]);
    expect(explanationReceipt({ value, answers })[0]).toMatchObject({
      item: "choice",
      explanation: "The reason",
    });
  });
});
