import { describe, expect, test } from "bun:test";
import { kindOf } from "./rounds";

const round = (
  rest: Partial<{
    kind: string;
    choices: string[];
    parts: string[];
    takes: { use: string }[];
  }> = {},
) => ({ kind: "", choices: [], parts: [], takes: [], ...rest });

describe("the kind a round is", () => {
  test("is the word the leg holds, whatever the round was written with", () => {
    expect(kindOf(round({ kind: "vote", parts: ["a noun"] }))).toBe("vote");
    expect(kindOf(round({ kind: "write", choices: ["Warm"] }))).toBe("write");
    expect(kindOf(round({ kind: "list" }))).toBe("list");
  });

  test("is read off the round when the leg holds no word", () => {
    expect(kindOf(round({ choices: ["Warm", "Cool"] }))).toBe("vote");
    expect(kindOf(round({ parts: ["a noun", "a verb"] }))).toBe("list");
    expect(kindOf(round())).toBe("write");
  });

  test("is read off what the round takes when the leg holds no word", () => {
    expect(kindOf(round({ takes: [{ use: "choices" }] }))).toBe("vote");
    expect(kindOf(round({ takes: [{ use: "parts" }] }))).toBe("list");
    expect(kindOf(round({ takes: [{ use: "context" }] }))).toBe("write");
  });

  test("is read off the round when the leg holds a word that names no kind", () => {
    expect(kindOf(round({ kind: "poll", choices: ["Warm"] }))).toBe("vote");
  });
});
