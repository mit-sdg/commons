import { describe, expect, test } from "bun:test";
import {
  defaultWindow,
  fromLocalInput,
  STATE_LABELS,
  toLocalInput,
  windowLabel,
} from "./tasks.ts";

describe("task helper utilities", () => {
  test("toLocalInput formats valid dates to ISO slice and handles null/invalid gracefully", () => {
    expect(toLocalInput("invalid-date")).toBe("");
    expect(toLocalInput(null)).not.toBe("");
    const formatted = toLocalInput("2026-08-22T10:00:00.000Z");
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  test("fromLocalInput parses datetime-local strings to ISO strings", () => {
    expect(fromLocalInput("")).toBe("");
    expect(fromLocalInput("invalid")).toBe("");
    const parsed = fromLocalInput("2026-08-22T10:00");
    expect(parsed).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test("defaultWindow returns start and end spaced by 1 hour", () => {
    const { startsAt, endsAt } = defaultWindow();
    expect(startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(endsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const startMs = new Date(fromLocalInput(startsAt)).getTime();
    const endMs = new Date(fromLocalInput(endsAt)).getTime();
    expect(endMs - startMs).toBe(60 * 60_000);
  });

  test("windowLabel formats same-day and multi-day windows", () => {
    expect(windowLabel("invalid", "invalid")).toBe("");
    const sameDay = windowLabel(
      "2026-08-22T10:00:00.000Z",
      "2026-08-22T12:00:00.000Z",
    );
    expect(sameDay).toContain("–");

    const multiDay = windowLabel(
      "2026-08-22T10:00:00.000Z",
      "2026-08-24T12:00:00.000Z",
    );
    expect(multiDay).toContain("→");
  });

  test("STATE_LABELS includes standard lifecycle states", () => {
    expect(STATE_LABELS.OPEN).toBe("Open");
    expect(STATE_LABELS.DONE).toBe("Done");
    expect(STATE_LABELS.CANCELED).toBe("Canceled");
  });
});
