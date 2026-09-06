import { describe, expect, test } from "bun:test";
import {
  choiceQuestions,
  modelCounts,
  modelNote,
  roomFigure,
  scoredOn,
  splitScores,
  splitValues,
} from "./run-board";

const VALUES = [
  { response: "r1", value: "Blue" },
  { response: "m1", value: "Green" },
  { response: "r2", value: "Blue" },
];

const SEATED = [
  { response: "m1", submitted: true },
  { response: "m2", submitted: false },
];

describe("whose answers a question holds", () => {
  test("keeps a value begun under a seat apart from the room's", () => {
    const { room, model } = splitValues(VALUES, SEATED);
    expect(room.map((entry) => entry.value)).toEqual(["Blue", "Blue"]);
    expect(model.map((entry) => entry.value)).toEqual(["Green"]);
  });

  test("reads every value as the room's when no seat was taken", () => {
    const { room, model } = splitValues(VALUES, []);
    expect(room).toHaveLength(3);
    expect(model).toEqual([]);
  });

  test("keeps the order each side was handed in", () => {
    const { room } = splitValues(VALUES, SEATED);
    expect(room.map((entry) => entry.response)).toEqual(["r1", "r2"]);
  });
});

describe("the line beneath a figure of the room", () => {
  test("adds how many the model's seats made", () => {
    expect(modelNote(3)).toBe("+3 by the model");
    expect(modelNote(1)).toBe("+1 by the model");
  });

  test("says nothing when the model has none", () => {
    expect(modelNote(0)).toBeNull();
  });
});

describe("the figure of the room alone", () => {
  test("takes the model's seats out of the whole", () => {
    expect(roomFigure(42, 2)).toBe(40);
  });

  test("is the whole when no seat was taken", () => {
    expect(roomFigure(42, 0)).toBe(42);
  });

  test("never falls below nothing", () => {
    expect(roomFigure(1, 2)).toBe(0);
  });
});

describe("what a keyed run counts", () => {
  const QUESTIONS = [
    { choices: ["Blue", "Green"], expected: "Blue" },
    { choices: [], expected: "A reference, never graded" },
    { choices: ["Yes", "No"], expected: "No" },
    { choices: [], expected: "" },
    { choices: ["Often", "Rarely"], expected: "" },
  ];

  test("counts the choice questions with a marked answer, which are the graded ones", () => {
    expect(choiceQuestions(QUESTIONS)).toBe(2);
    expect(choiceQuestions([{ choices: [], expected: "" }])).toBe(0);
    expect(choiceQuestions([])).toBe(0);
  });

  test("names how many questions the score is out of", () => {
    expect(scoredOn(2)).toBe("Scored on the 2 choice questions.");
    expect(scoredOn(1)).toBe("Scored on the 1 choice question.");
  });

  test("names nothing when no question is graded", () => {
    expect(scoredOn(0)).toBeNull();
  });
});

describe("how far the model's seats got", () => {
  test("counts every response begun, and the ones handed in", () => {
    expect(modelCounts(SEATED)).toEqual({ begun: 2, handedIn: 1 });
  });

  test("counts nothing when no seat was taken", () => {
    expect(modelCounts([])).toEqual({ begun: 0, handedIn: 0 });
  });
});

describe("whose results a keyed run graded", () => {
  const RESULTS = [
    { submission: "s1", model: false },
    { submission: "s2", model: true },
    { submission: "s3", model: false },
  ];

  test("keeps the model's rows apart from the room's", () => {
    const { room, model } = splitScores(RESULTS);
    expect(room.map((row) => row.submission)).toEqual(["s1", "s3"]);
    expect(model.map((row) => row.submission)).toEqual(["s2"]);
  });

  test("leaves the room empty when only a seat handed in", () => {
    const { room, model } = splitScores([{ submission: "s2", model: true }]);
    expect(room).toEqual([]);
    expect(model).toHaveLength(1);
  });
});
