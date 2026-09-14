import { expect, test } from "bun:test";
import { signInHref, signInReturnPath } from "./sign-in-return";

test("sign-in retains the exact local task or discussion destination", () => {
  for (const path of [
    "/groups/group?view=tasks&task=task%2Fone",
    "/t/thread#post-reply",
    "/assignments/a",
    "/groups",
  ]) {
    expect(signInReturnPath(path)).toBe(path);
    expect(
      new URL(signInHref(path), "https://commons.example.edu").searchParams.get(
        "next",
      ),
    ).toBe(path);
  }
});

test("sign-in never accepts an external, executable, or backslash-normalized destination", () => {
  for (const path of [
    null,
    "",
    "https://other.example.edu/",
    "//other.example.edu/",
    "/\\other.example.edu/",
    "/\n/other.example.edu/",
    "javascript:alert(1)",
    "relative/path",
  ]) {
    expect(signInReturnPath(path)).toBe("/");
  }
});
