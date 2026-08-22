import { describe, expect, test } from "bun:test";
import { publicErrorMessage } from "./api.ts";
import {
  defaultWindow,
  fromLocalInput,
  STATE_LABELS,
  TASK_CONFLICT_MESSAGES,
  type TaskAction,
  taskErrorMessage,
  taskStateActions,
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

describe("what a task's state allows", () => {
  test("an open task keeps the actions it already had, and cannot be deleted", () => {
    expect(taskStateActions("OPEN")).toEqual({
      complete: true,
      reopen: false,
      uncancel: false,
      cancel: true,
      revise: true,
      remove: false,
    });
  });

  test("a done task adds removal to what it already had", () => {
    expect(taskStateActions("DONE")).toEqual({
      complete: false,
      reopen: true,
      uncancel: false,
      cancel: false,
      revise: true,
      remove: true,
    });
  });

  test("a canceled task offers uncancel and removal, and nothing else", () => {
    expect(taskStateActions("CANCELED")).toEqual({
      complete: false,
      reopen: false,
      uncancel: true,
      cancel: false,
      revise: false,
      remove: true,
    });
  });
});

describe("task refusal messages", () => {
  // The HTTP boundary projects every domain refusal onto one of five public
  // categories, so TASK_NOT_SETTLED and friends never reach the browser.
  // CONFLICT does, and only the caller knows which action produced it.
  test("CONFLICT is explained by the action that produced it", () => {
    const uncancel = taskErrorMessage("CONFLICT", "uncancel");
    const remove = taskErrorMessage("CONFLICT", "remove");
    const reopen = taskErrorMessage("CONFLICT", "reopen");
    expect(uncancel).toContain("no longer canceled");
    expect(remove).toContain("Only a finished or canceled task can be deleted");
    expect(reopen).toContain("Only a completed task can be reopened");
    expect(new Set([uncancel, remove, reopen]).size).toBe(3);
  });

  test("every action has a conflict sentence that points at a reload", () => {
    for (const [action, message] of Object.entries(TASK_CONFLICT_MESSAGES)) {
      expect(message.length).toBeGreaterThan(0);
      expect(taskErrorMessage("CONFLICT", action as TaskAction)).toBe(message);
    }
  });

  test("a repeated delete falls back to the shared permission sentence", () => {
    // The task is looked up before its list is, so a second delete answers
    // FORBIDDEN exactly as a non-member does. There is nothing kinder to say.
    expect(taskErrorMessage("FORBIDDEN", "remove")).toBe(
      publicErrorMessage("FORBIDDEN"),
    );
    expect(taskErrorMessage("SOMETHING_NEW", "remove")).toBe(
      publicErrorMessage("SOMETHING_NEW"),
    );
  });
});
