import { describe, expect, test } from "bun:test";
import { fillerPiles } from "./round-preview";

describe("fillerPiles", () => {
  test("names each pile with the source round's disc and a count", () => {
    expect(fillerPiles(1)).toEqual([
      "① Pace · 12",
      "① Questions · 9",
      "① Examples · 5",
    ]);
  });

  test("falls back to the number past the discs it has", () => {
    expect(fillerPiles(21)[0]).toBe("21 Pace · 12");
  });
});
