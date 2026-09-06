import { describe, expect, test } from "vite-plus/test";
import type { RunSnapshot } from "../../src/computations/live-snapshots.ts";
import {
  participantPassage,
  seatOrdinal,
  stanceOf,
  STANCES,
} from "../../src/computations/live-walls.ts";

const seat = (ordinal: number) => `seat-${ordinal}-3f0c1d9e-0000-4000-8000-000000000001`;

const presentation: RunSnapshot = {
  title: "What would help",
  form: "survey",
  disclosure: "score",
  questions: [
    {
      item: "q1",
      prompt: "Which verb saves a page for later?",
      choices: ["Bookmark", "Delete"],
      expected: "",
      explanation: "",
      parts: [],
      cap: 0,
      position: 1,
    },
  ],
};

describe("the seat's ordinal", () => {
  test("a seat carries its place in the order the dashboard took its seats", () => {
    expect(seatOrdinal(seat(1))).toBe(1);
    expect(seatOrdinal(seat(7))).toBe(7);
    expect(seatOrdinal(seat(13))).toBe(13);
  });

  test("an identity that names no seat has no ordinal", () => {
    expect(seatOrdinal("seat-0-x")).toBeNull();
    expect(seatOrdinal("seat-x-y")).toBeNull();
    expect(seatOrdinal("device:d2")).toBeNull();
    expect(seatOrdinal("3f0c1d9e-0000-4000-8000-000000000001")).toBeNull();
  });
});

describe("the stance a participant is dealt", () => {
  test("the first twelve seats hold twelve stances", () => {
    const dealt = Array.from({ length: 12 }, (_one, index) => stanceOf(seat(index + 1)));
    expect(new Set(dealt).size).toBe(12);
    for (const stance of STANCES) {
      expect(dealt.filter((one) => one.startsWith(`${stance}, `))).toHaveLength(1);
    }
  });

  test("the thirteenth seat takes the first stance again under another angle", () => {
    expect(stanceOf(seat(13)).startsWith(`${STANCES[0]}, `)).toBe(true);
    expect(stanceOf(seat(13))).not.toBe(stanceOf(seat(1)));
  });

  test("no pair repeats before the eighty-fifth seat", () => {
    const dealt = Array.from({ length: 84 }, (_one, index) => stanceOf(seat(index + 1)));
    expect(new Set(dealt).size).toBe(84);
    expect(stanceOf(seat(85))).toBe(stanceOf(seat(1)));
  });

  test("an identity with no ordinal is dealt by its hash and answers the same every time", () => {
    for (const participant of [
      "3f0c1d9e-0000-4000-8000-000000000001",
      "device:d2",
      "seat-0-x",
      "seat-x-y",
    ]) {
      const dealt = stanceOf(participant);
      expect(dealt).toBe(stanceOf(participant));
      expect(STANCES.some((stance) => dealt.startsWith(`${stance}, `))).toBe(true);
    }
  });
});

describe("the participant's passage", () => {
  test("a question offering choices asks for the one this participant would pick", () => {
    const passage = participantPassage({ value: presentation, participant: seat(3) });
    expect(passage).toContain(
      "answer with the one this participant would pick from the stance below",
    );
    expect(passage).toContain(`You are participant ${seat(3)}, ${stanceOf(seat(3))}.`);
  });
});
