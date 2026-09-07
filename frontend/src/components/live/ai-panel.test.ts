import { describe, expect, test } from "bun:test";
import { landedNote, refusalWords } from "./ai-panel";

describe("suggestion outcome feedback", () => {
  test("taken is acceptance, not evidence of application", () => {
    expect(
      landedNote({
        offering: "o",
        offeredAt: "2026-09-06T00:00:00Z",
        lines: [
          {
            suggestion: "s",
            kind: "title",
            target: "",
            value: "Title",
            position: 1,
            standing: "taken",
          },
        ],
      }),
    ).toBe("1 change accepted.");
  });
  test("a domain conflict does not claim an open run or unchanged work", () => {
    expect(refusalWords("CONFLICT")).toBe(
      "This suggestion could not be completed. Review the current rounds before asking for a new suggestion.",
    );
    expect(refusalWords("NOT_APPLIED")).toBe(refusalWords("CONFLICT"));
  });
});
