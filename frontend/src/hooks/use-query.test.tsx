import { describe, expect, test } from "bun:test";
import {
  answeredQuery,
  failedQuery,
  RETAINING_CODES,
  startingQuery,
} from "./use-query.ts";

/** The one answer everything below is measured from. */
const ANSWERED_AT = 1_000;

const held = answeredQuery(
  ["session-1", "round-1"],
  { wall: "shown" },
  ANSWERED_AT,
);

describe("what a query keeps", () => {
  test("an identity change discards what was held", () => {
    const next = startingQuery(held, ["session-1", "round-2"], true);
    expect(next.data).toBeNull();
    expect(next.loading).toBe(true);
    expect(next.answeredAt).toBeNull();
  });

  test("a nulled session is an identity change too", () => {
    expect(startingQuery(held, [null, "round-1"], true).data).toBeNull();
  });

  test("a refresh trigger keeps what was held while the answer is on its way", () => {
    const next = startingQuery(held, ["session-1", "round-1"], true);
    expect(next.data).toEqual({ wall: "shown" });
    expect(next.loading).toBe(true);
    // A pending refetch says nothing about when the server was last heard.
    expect(next.answeredAt).toBe(ANSWERED_AT);
  });

  test("retention governs failures only: a refresh keeps its data either way", () => {
    const next = startingQuery(held, ["session-1", "round-1"], false);
    expect(next.data).toEqual({ wall: "shown" });
    expect(next.answeredAt).toBe(ANSWERED_AT);
    expect(
      failedQuery(held, held.scope, false, "TIMED_OUT", "late", 5_000).data,
    ).toBeNull();
  });

  for (const code of RETAINING_CODES) {
    test(`a ${code} result keeps the data and the last answer's time`, () => {
      const failed = failedQuery(
        held,
        held.scope,
        true,
        code,
        "nothing came back",
        5_000,
      );
      expect(failed.data).toEqual({ wall: "shown" });
      expect(failed.error).toBe("nothing came back");
      expect(failed.refused).toBe(code);
      expect(failed.answeredAt).toBe(ANSWERED_AT);
      const again = failedQuery(
        failed,
        held.scope,
        true,
        code,
        "still nothing",
        9_000,
      );
      expect(again.data).toEqual({ wall: "shown" });
      expect(again.answeredAt).toBe(ANSWERED_AT);
    });
  }

  test("a refusal clears the data and is an answer", () => {
    for (const code of [
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "BAD_STATUS",
    ]) {
      const refused = failedQuery(
        held,
        held.scope,
        true,
        code,
        "refused",
        7_000,
      );
      expect(refused.data).toBeNull();
      expect(refused.refused).toBe(code);
      expect(refused.answeredAt).toBe(7_000);
    }
  });

  test("an unknown failure clears the data and is an answer", () => {
    const broken = failedQuery(held, held.scope, true, null, "broke", 7_000);
    expect(broken.data).toBeNull();
    expect(broken.answeredAt).toBe(7_000);
  });

  test("a retaining fault under another identity keeps nothing", () => {
    const failed = failedQuery(
      held,
      ["session-1", "round-2"],
      true,
      "TIMED_OUT",
      "late",
      5_000,
    );
    expect(failed.data).toBeNull();
    expect(failed.answeredAt).toBeNull();
  });

  test("an answer clears the error and is the moment the server was heard", () => {
    const missed = failedQuery(
      held,
      held.scope,
      true,
      "NETWORK_ERROR",
      "gone",
      5_000,
    );
    const answered = answeredQuery(missed.scope, { wall: "fresh" }, 9_000);
    expect(answered).toEqual({
      scope: held.scope,
      data: { wall: "fresh" },
      error: null,
      refused: null,
      loading: false,
      answeredAt: 9_000,
    });
    // The refetch the screen makes next holds the answer's time under it.
    expect(startingQuery(answered, answered.scope, true).answeredAt).toBe(
      9_000,
    );
    expect(startingQuery(missed, missed.scope, true).answeredAt).toBe(
      ANSWERED_AT,
    );
  });
});
