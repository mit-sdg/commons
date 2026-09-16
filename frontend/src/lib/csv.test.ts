import { describe, expect, test } from "bun:test";
import { fileSlug, toCsv } from "./csv.ts";

describe("CSV serialization", () => {
  test("writes records and multiline fields with CRLF endings", () => {
    expect(
      toCsv([
        ["Name", "Notes"],
        ["Raman, Priya", "first\nsecond"],
      ]),
    ).toBe('Name,Notes\r\n"Raman, Priya","first\r\nsecond"\r\n');
  });

  test("doubles quotes and keeps empty and numeric columns", () => {
    expect(toCsv([['She said "no"', null, undefined, 0, -2.5]])).toBe(
      '"She said ""no""",,,0,-2.5\r\n',
    );
  });

  test("neutralizes spreadsheet formulas even after leading whitespace", () => {
    expect(
      toCsv([
        ["=2+2", "+cmd", "-4+5", "@SUM(A1:A2)"],
        ['  =HYPERLINK("bad")', "ordinary", -4],
      ]),
    ).toBe(
      "'=2+2,'+cmd,'-4+5,'@SUM(A1:A2)\r\n" +
        '"\'  =HYPERLINK(""bad"")",ordinary,-4\r\n',
    );
  });

  test("an empty table is an empty document", () => {
    expect(toCsv([])).toBe("");
  });
});

describe("CSV filenames", () => {
  test("normalizes accents and punctuation", () => {
    expect(fileSlug("  Café études: week 3!  ")).toBe("cafe-etudes-week-3");
  });

  test("uses the requested fallback when no filename characters remain", () => {
    expect(fileSlug("???", "submissions")).toBe("submissions");
  });
});
