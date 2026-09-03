import { describe, expect, test } from "bun:test";
import { modelSilent, tokenName } from "./run-relay-board";

const at = (failedAt: string | null, failure: string | null = "gemini") => ({
  failure,
  failedAt,
});

describe("the word beside the model sorts switch", () => {
  const now = Date.parse("2026-09-03T12:00:00.000Z");

  test("says nothing when no ask about the round has failed", () => {
    expect(modelSilent(null, now)).toBe(false);
    expect(modelSilent(at(null, null), now)).toBe(false);
  });

  test("stands while the room would still be waiting on the ask", () => {
    expect(modelSilent(at("2026-09-03T11:59:31.000Z"), now)).toBe(true);
  });

  test("goes once the failure is a minute old", () => {
    expect(modelSilent(at("2026-09-03T11:58:59.000Z"), now)).toBe(false);
  });
});

describe("what a round in the strip is called", () => {
  test("names the round, its title, and how it stands", () => {
    expect(tokenName({ number: 2, title: "Three verbs" }, "open")).toBe(
      "Round 2, Three verbs, open",
    );
    expect(tokenName({ number: 1, title: "Name it" }, "done")).toBe(
      "Round 1, Name it, closed",
    );
  });

  test("leaves out a title a round does not have", () => {
    expect(tokenName({ number: 3, title: "  " }, "next")).toBe("Round 3, next");
  });
});
