import { describe, expect, test } from "bun:test";
import { noteEdit, sweepWord } from "./sorting-panel";

describe("what a blurred note asks to be written", () => {
  test("writes the body a hand typed", () => {
    expect(noteEdit("Watch for the three verbs.", "")).toBe(
      "Watch for the three verbs.",
    );
  });

  test("writes nothing when the note stands as it was", () => {
    expect(noteEdit("Watch for it.", "Watch for it.")).toBeNull();
    expect(noteEdit("  Watch for it.\n", "Watch for it.")).toBeNull();
  });

  test("asks for an empty body when a hand cleared the note", () => {
    expect(noteEdit("   ", "Watch for it.")).toBe("");
  });

  test("writes nothing when a blank note is left blank", () => {
    expect(noteEdit("", "")).toBeNull();
  });
});

describe("what the sweep button says", () => {
  test("follows the switch", () => {
    expect(sweepWord(false)).toBe("Move all responses to tray");
    expect(sweepWord(true)).toBe("Resort");
  });
});
