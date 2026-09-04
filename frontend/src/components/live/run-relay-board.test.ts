import { describe, expect, test } from "bun:test";
import type { Relay, RelayRun } from "@/components/live/rounds";
import { modelSilent, refusalFor, tokenName } from "./run-relay-board";

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

const RUN = {
  open: true,
  rounds: [
    {
      leg: "l1",
      number: 1,
      title: "Three verbs",
      round: "r1",
      figure: { open: false },
    },
    { leg: "l2", number: 2, title: "The stranger", round: null, figure: {} },
  ],
} as unknown as RelayRun;

const RELAY = {
  rounds: [
    { leg: "l1", takes: [] },
    { leg: "l2", takes: [{ source: "l1", use: "context" }] },
  ],
} as unknown as Relay;

const why = (piles: number | null, picks: number | null) =>
  refusalFor({ run: RUN, relay: RELAY, leg: "l2", piles, picks })?.word ?? null;

describe("why a round that takes from an earlier one does not open", () => {
  test("says to sort when the wall it takes from holds no pile", () => {
    expect(why(0, 0)).toBe("NO_PILES");
  });

  test("says to pick once piles stand and none is picked", () => {
    expect(why(3, 0)).toBe("NOTHING_PICKED");
  });

  test("says nothing once a pile is picked", () => {
    expect(why(3, 2)).toBeNull();
  });

  test("says nothing while the wall has not been read", () => {
    expect(why(null, null)).toBeNull();
  });
});
