import { describe, expect, test } from "bun:test";
import { pinnedFirst } from "./discussion-marks";

describe("pinnedFirst", () => {
  test("raises pinned discussions in pin order and keeps the rest in list order", () => {
    expect(pinnedFirst(["a", "b", "c", "d"], ["c", "a"])).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });

  test("ignores pins that the current list filtered out", () => {
    expect(pinnedFirst(["a", "b"], ["z", "b"])).toEqual(["b", "a"]);
  });

  test("leaves the list alone with no pins", () => {
    expect(pinnedFirst(["a", "b"], [])).toEqual(["a", "b"]);
  });
});
