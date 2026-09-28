import { describe, expect, test } from "vite-plus/test";
import { pickStanding, roundPresentation } from "../../src/computations/live-round-opening.ts";

const wall = [{ category: "kept" }, { category: "sent" }];

describe("the picks a request opens on", () => {
  test("stand when every picked pile is on the wall, in any order", () => {
    expect(pickStanding({ picked: ["sent", "kept"], categories: wall })).toBe("ready");
  });

  test("are none when the request picks nothing", () => {
    expect(pickStanding({ picked: [], categories: wall })).toBe("none");
  });

  test("are gone when one picked pile is no longer on the wall", () => {
    expect(pickStanding({ picked: ["kept", "merged"], categories: wall })).toBe("gone");
  });
});

describe("a round's presentation", () => {
  const content = {
    title: "Next",
    form: "survey",
    disclosure: "score",
    questions: [
      {
        item: "q",
        prompt: "Why?",
        choices: ["Own choice"],
        parts: [],
        cap: 0,
        expected: "",
        explanation: "",
        position: 1,
      },
    ],
  };
  const groups = [
    { name: "Kept", cards: ["save"] },
    { name: "Sent", cards: ["share"] },
  ];

  test("takes the picked names as its parts and keeps them as context", () => {
    const [question] = roundPresentation({
      content,
      kind: "list",
      use: "parts",
      groups,
      sourceValue: { title: "Verbs" },
      sourceNumber: 1,
    }).questions;
    expect(question).toMatchObject({
      choices: [],
      parts: ["Kept", "Sent"],
      context: groups,
      contextUse: "parts",
      contextSource: { number: 1, title: "Verbs" },
    });
  });

  test("is the question as authored under its kind when it takes nothing", () => {
    const [question] = roundPresentation({
      content,
      kind: "write",
      use: null,
      groups: null,
      sourceValue: null,
      sourceNumber: null,
    }).questions;
    expect(question).toMatchObject({ prompt: "Why?", choices: [], parts: [], cap: 0 });
    expect(question).not.toHaveProperty("context");
    expect(question).not.toHaveProperty("contextSource");
  });
});
