import { describe, expect, test } from "bun:test";
import { tabTitle } from "./page-title";

describe("tabTitle", () => {
  test("runs from the page to the application", () => {
    expect(
      tabTitle(["Which markdown editor should I use?", "Discussions"]),
    ).toBe("Which markdown editor should I use? | Discussions | Commons");
  });

  test("skips the parts a loading page does not know yet", () => {
    expect(tabTitle([undefined, "", "  ", "Assignments"])).toBe(
      "Assignments | Commons",
    );
    expect(tabTitle([])).toBe("Commons");
  });

  test("cuts a long part short and folds its whitespace", () => {
    const title = tabTitle([`${"word ".repeat(30)}`, "Discussions"]);
    expect(title.endsWith("… | Discussions | Commons")).toBe(true);
    expect(title.split(" | ")[0]!.length).toBeLessThanOrEqual(61);
    expect(tabTitle(["a\n  b"])).toBe("a b | Commons");
  });
});
