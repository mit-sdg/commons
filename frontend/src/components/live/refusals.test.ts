import { describe, expect, test } from "bun:test";
import { declinedSentence } from "./refusals";

describe("what a declined press of Open says", () => {
  test("names the round in the way", () => {
    expect(declinedSentence({ declined: "ROUND_OPEN", round: 2 })).toBe(
      "Close round 2 first.",
    );
    expect(declinedSentence({ declined: "ROUND_DONE", round: 1 })).toBe(
      "Round 1 already ran.",
    );
  });

  test("names the round it takes from", () => {
    expect(declinedSentence({ declined: "SOURCE_OPEN", source: 1 })).toBe(
      "Close round 1 first. This one takes from it.",
    );
    expect(declinedSentence({ declined: "SOURCE_UNRUN", source: 1 })).toBe(
      "Run round 1 first. This one takes from it.",
    );
  });

  test("says each word without facts in its own sentence", () => {
    expect(declinedSentence({ declined: "CLOSED" })).toBe("The run is closed.");
    expect(declinedSentence({ declined: "NOTHING_PICKED" })).toBe(
      "Pick at least one pile.",
    );
    expect(declinedSentence({ declined: "PILE_GONE" })).toBe(
      "That pile is gone.",
    );
    expect(declinedSentence({ declined: "LEG_NOT_FOUND" })).toBe(
      "That round is gone.",
    );
  });
});
