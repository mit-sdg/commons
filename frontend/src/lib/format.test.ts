import { describe, expect, test } from "bun:test";
import {
  dateTime,
  dueTime,
  rangeTime,
  ranSentence,
  shortDate,
} from "./format.ts";

describe("the short date", () => {
  test("a day reads as its month and number", () => {
    expect(shortDate("2026-09-04T18:10:00.000Z")).toBe("Sep 4");
  });

  test("a day in another year carries the year", () => {
    expect(shortDate("2025-12-23T19:00:00.000Z")).toBe("Dec 23, 2025");
  });

  test("nothing to date reads as nothing", () => {
    expect(shortDate(null)).toBe("");
    expect(shortDate("not a date")).toBe("");
  });
});

describe("what a relay's runs come to", () => {
  test("no run at all says nothing", () => {
    expect(ranSentence([])).toBe("");
  });

  test("an open run alone says nothing", () => {
    expect(ranSentence([{ closedAt: null }])).toBe("");
  });

  test("one closed run ran once", () => {
    expect(ranSentence([{ closedAt: "2026-09-04T18:10:00.000Z" }])).toBe(
      "Ran once, last on Sep 4",
    );
  });

  test("three closed runs count, and the last one dates the line", () => {
    expect(
      ranSentence([
        { closedAt: "2026-08-21T18:10:00.000Z" },
        { closedAt: "2026-09-04T18:10:00.000Z" },
        { closedAt: "2026-08-28T18:10:00.000Z" },
      ]),
    ).toBe("Ran 3 times, last on Sep 4");
  });

  test("a run still open is not counted and does not date the line", () => {
    expect(
      ranSentence([
        { closedAt: "2026-09-04T18:10:00.000Z" },
        { closedAt: null },
      ]),
    ).toBe("Ran once, last on Sep 4");
  });
});

describe("an absolute moment", () => {
  const thisYear = new Date().getUTCFullYear();

  test("a moment this year reads without its year or zone", () => {
    expect(dateTime(`${thisYear}-09-05T13:16:00.000Z`)).toBe("Sep 5, 1:16 PM");
  });

  test("a moment in another year names the year", () => {
    expect(dateTime("2019-09-05T13:16:00.000Z")).toBe("Sep 5, 2019, 1:16 PM");
  });

  test("a due moment names the zone, and a due day names only the day", () => {
    expect(dueTime(`${thisYear}-09-10T13:16:00.000Z`)).toBe(
      "Sep 10, 1:16 PM UTC",
    );
    expect(dueTime(`${thisYear}-09-10T13:16:00.000Z`, "day")).toBe("Sep 10");
  });

  test("nothing to date reads as nothing", () => {
    expect(dateTime(null)).toBe("");
    expect(dueTime("not a date")).toBe("");
  });
});

describe("a range", () => {
  const thisYear = new Date().getUTCFullYear();

  test("ends on the same day repeat only the clock", () => {
    expect(
      rangeTime(
        `${thisYear}-09-05T12:24:00.000Z`,
        `${thisYear}-09-05T14:10:00.000Z`,
      ),
    ).toBe("Sep 5, 12:24 PM – 2:10 PM");
  });

  test("ends on different days say both", () => {
    expect(
      rangeTime(
        `${thisYear}-09-05T12:24:00.000Z`,
        `${thisYear}-09-06T09:00:00.000Z`,
      ),
    ).toBe("Sep 5, 12:24 PM – Sep 6, 9:00 AM");
  });

  test("a range still running reads since its start", () => {
    expect(rangeTime(`${thisYear}-09-05T12:24:00.000Z`, null)).toBe(
      "since Sep 5, 12:24 PM",
    );
  });

  test("no start is no range", () => {
    expect(rangeTime(null, `${thisYear}-09-05T12:24:00.000Z`)).toBe("");
  });
});
