import { describe, expect, test } from "bun:test";
import type { InboxNotification, TaskInboxNotification } from "./models.ts";
import {
  applyUnreadCounts,
  dueLabel,
  filterNotifications,
  groupNotifications,
  hasTaskPresentation,
  isMembershipKind,
  loadMergedInbox,
  markAllReadBoth,
  mergeInboxes,
  NOTIFICATION_FILTERS,
  readUnreadCounts,
  TASK_ACTION_TEXT,
  TASK_NOTIFICATION_KINDS,
  taskActionText,
  taskRowDetail,
  taskRowHref,
  taskRowListId,
  unreadBadge,
  unreadBySource,
  withheldTaskNote,
} from "./task-notifications.ts";

/** A forum inbox row, shaped as the forum endpoint answers one. */
function forumRow(
  over: Partial<Record<string, unknown>> = {},
): InboxNotification {
  return {
    notification: "forum-1",
    kind: "reply",
    link: "post-1",
    createdAt: "2026-08-22T12:00:00.000Z",
    read: false,
    post: { author: null, content: null, createdAt: null, editedAt: null },
    actor: { user: null, username: null, displayName: null, avatar: null },
    ...over,
  } as unknown as InboxNotification;
}

/** A task inbox row whose presentation was spliced in. */
function enrichedTaskRow(
  over: Partial<Record<string, unknown>> = {},
): TaskInboxNotification {
  return {
    notification: "task-1",
    kind: "task-assigned",
    subject: "task-abc",
    link: "task-abc",
    createdAt: "2026-08-22T13:00:00.000Z",
    read: false,
    list: "list-xyz",
    listTitle: "Kitchen crew",
    task: {
      title: "Wash the pans",
      details: "Before close",
      startsAt: "2026-08-23T10:00:00.000Z",
      endsAt: "2026-08-23T11:00:00.000Z",
      state: "OPEN",
      assignee: "user-1",
    },
    ...over,
  } as unknown as TaskInboxNotification;
}

/**
 * A row whose presentation was withheld. The optional splice fills leaves with
 * null rather than dropping the fragment, so `task` is present and empty.
 */
function withheldTaskRow(
  over: Partial<Record<string, unknown>> = {},
): TaskInboxNotification {
  return enrichedTaskRow({
    list: null,
    listTitle: null,
    task: {
      title: null,
      details: null,
      startsAt: null,
      endsAt: null,
      state: null,
      assignee: null,
    },
    ...over,
  });
}

describe("task notification wording", () => {
  test("every minted kind has wording of its own", () => {
    const said = TASK_NOTIFICATION_KINDS.map((kind) => TASK_ACTION_TEXT[kind]);
    expect(said).toHaveLength(8);
    expect(new Set(said).size).toBe(8);
    for (const sentence of said) expect(sentence.length).toBeGreaterThan(0);
  });

  test("an unrecognized kind shows itself rather than a guess", () => {
    expect(taskActionText("task-teleported")).toBe("task-teleported");
  });

  test("membership kinds are the two the list events mint", () => {
    expect(isMembershipKind("task-list-added")).toBe(true);
    expect(isMembershipKind("task-list-removed")).toBe(true);
    expect(isMembershipKind("task-assigned")).toBe(false);
    expect(isMembershipKind("task-completed")).toBe(false);
  });

  test("a withheld row says what it knows and names nothing it does not", () => {
    const taskNote = withheldTaskNote("task-completed");
    expect(taskNote).toContain("no longer");
    expect(withheldTaskNote("task-list-added")).not.toBe(taskNote);
  });
});

describe("task notification presentation", () => {
  test("a spliced row has presentation", () => {
    expect(hasTaskPresentation(enrichedTaskRow())).toBe(true);
    expect(
      hasTaskPresentation(
        enrichedTaskRow({
          kind: "task-list-added",
          list: null,
          listTitle: "Kitchen crew",
        }),
      ),
    ).toBe(true);
  });

  test("a leaf decides presence, not the fragment", () => {
    const row = withheldTaskRow();
    expect(row.task).not.toBeNull();
    expect(hasTaskPresentation(row)).toBe(false);
  });

  test("a membership row without its list title is withheld", () => {
    expect(
      hasTaskPresentation(
        withheldTaskRow({ kind: "task-list-added", link: "list-xyz" }),
      ),
    ).toBe(false);
  });

  test("a task row links to the list identity it carries", () => {
    expect(taskRowListId(enrichedTaskRow())).toBe("list-xyz");
    expect(taskRowHref(enrichedTaskRow())).toBe("/tasks/list-xyz");
  });

  test("a membership row links to the list it is about", () => {
    const row = enrichedTaskRow({
      kind: "task-list-removed",
      subject: "list-gone",
      link: "list-gone",
      list: null,
      listTitle: "Old crew",
    });
    expect(taskRowHref(row)).toBe("/tasks/list-gone");
  });

  test("a withheld task row links nowhere rather than to its task id", () => {
    const row = withheldTaskRow();
    expect(taskRowListId(row)).toBeNull();
    expect(taskRowHref(row)).toBeNull();
  });

  test("a membership row about a list the reader left keeps its link", () => {
    const row = withheldTaskRow({ kind: "task-list-added", link: "list-xyz" });
    expect(taskRowHref(row)).toBe("/tasks/list-xyz");
  });
});

describe("merging the two inboxes", () => {
  test("rows from both instances come back newest first", () => {
    const merged = mergeInboxes(
      [
        forumRow({
          notification: "f-old",
          createdAt: "2026-08-20T00:00:00.000Z",
        }),
        forumRow({
          notification: "f-new",
          createdAt: "2026-08-24T00:00:00.000Z",
        }),
      ],
      [
        enrichedTaskRow({
          notification: "t-mid",
          createdAt: "2026-08-22T00:00:00.000Z",
        }),
        enrichedTaskRow({
          notification: "t-newest",
          createdAt: "2026-08-25T00:00:00.000Z",
        }),
      ],
    );
    expect(merged.map((entry) => entry.id)).toEqual([
      "t-newest",
      "f-new",
      "t-mid",
      "f-old",
    ]);
    expect(merged.map((entry) => entry.source)).toEqual([
      "task",
      "forum",
      "task",
      "forum",
    ]);
  });

  test("an empty pair merges to an empty list", () => {
    expect(mergeInboxes([], [])).toEqual([]);
  });

  test("each merged row keeps the instance that owns it", () => {
    const merged = mergeInboxes([forumRow()], [enrichedTaskRow()]);
    const task = merged.find((entry) => entry.source === "task");
    expect(task?.id).toBe("task-1");
    expect(task?.read).toBe(false);
  });

  test("unread rows are counted per instance", () => {
    const merged = mergeInboxes(
      [
        forumRow({ notification: "f-1", read: false }),
        forumRow({ notification: "f-2", read: true }),
      ],
      [
        enrichedTaskRow({ notification: "t-1", read: false }),
        enrichedTaskRow({ notification: "t-2", read: false }),
        enrichedTaskRow({ notification: "t-3", read: true }),
      ],
    );
    expect(unreadBySource(merged)).toEqual({ forum: 1, task: 2 });
  });
});

describe("reading both inboxes", () => {
  const ok =
    <T>(value: T) =>
    () =>
      Promise.resolve(value);

  test("both answers merge into one list", async () => {
    const result = await loadMergedInbox(
      ok({ notifications: [forumRow()] }),
      ok({ notifications: [enrichedTaskRow()] }),
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.notifications).toHaveLength(2);
  });

  test("a refusal from either instance is the page's refusal", async () => {
    const forumRefused = await loadMergedInbox(
      ok({ error: "UNAUTHORIZED" }),
      ok({ notifications: [enrichedTaskRow()] }),
    );
    expect(forumRefused).toEqual({ error: "UNAUTHORIZED" });

    const taskRefused = await loadMergedInbox(
      ok({ notifications: [forumRow()] }),
      ok({ error: "INVALID_REQUEST" }),
    );
    expect(taskRefused).toEqual({ error: "INVALID_REQUEST" });
  });

  test("a transport fault rejects rather than showing half an inbox", async () => {
    await expect(
      loadMergedInbox(ok({ notifications: [forumRow()] }), () =>
        Promise.reject(new Error("offline")),
      ),
    ).rejects.toThrow("offline");
  });
});

describe("marking everything read across two instances", () => {
  test("both halves applying is reported as success", async () => {
    const outcome = await markAllReadBoth(
      () => Promise.resolve({ recipient: "user-1" }),
      () => Promise.resolve({ recipient: "user-1" }),
    );
    expect(outcome).toEqual({ forumError: null, taskError: null });
  });

  test("one half failing leaves the other applied", async () => {
    const reached: string[] = [];
    const outcome = await markAllReadBoth(
      () => {
        reached.push("forum");
        return Promise.resolve({ error: "INTERNAL_ERROR" });
      },
      () => {
        reached.push("task");
        return Promise.resolve({ recipient: "user-1" });
      },
    );
    expect(reached).toEqual(["forum", "task"]);
    expect(outcome).toEqual({ forumError: "INTERNAL_ERROR", taskError: null });
  });

  test("a transport fault on one half is reported, not swallowed", async () => {
    const outcome = await markAllReadBoth(
      () => Promise.resolve({ recipient: "user-1" }),
      () => Promise.reject(new Error("offline")),
    );
    expect(outcome).toEqual({ forumError: null, taskError: "INTERNAL_ERROR" });
  });
});

describe("the badge over two instances", () => {
  test("the badge is the sum of the two counts", () => {
    expect(unreadBadge({ forum: 3, task: 4 })).toBe(7);
    expect(unreadBadge({ forum: 0, task: 0 })).toBe(0);
  });

  test("both counts answering replaces both halves", async () => {
    const update = await readUnreadCounts(
      () => Promise.resolve({ count: 2 }),
      () => Promise.resolve({ count: 5 }),
    );
    expect(update).toEqual({ forum: 2, task: 5 });
    expect(applyUnreadCounts({ forum: 9, task: 9 }, update)).toEqual({
      forum: 2,
      task: 5,
    });
  });

  test("a refused half keeps its old figure rather than guessing", async () => {
    const update = await readUnreadCounts(
      () => Promise.resolve({ error: "INTERNAL_ERROR" }),
      () => Promise.resolve({ count: 1 }),
    );
    expect(update).toEqual({ forum: null, task: 1 });
    const counts = applyUnreadCounts({ forum: 4, task: 7 }, update);
    expect(counts).toEqual({ forum: 4, task: 1 });
    expect(unreadBadge(counts)).toBe(5);
  });

  test("a faulted half leaves the badge stale instead of wrong", async () => {
    const update = await readUnreadCounts(
      () => Promise.resolve({ count: 3 }),
      () => Promise.reject(new Error("offline")),
    );
    expect(update).toEqual({ forum: 3, task: null });
    expect(applyUnreadCounts({ forum: 1, task: 6 }, update)).toEqual({
      forum: 3,
      task: 6,
    });
  });

  test("a zero from an instance is applied, not mistaken for a failure", async () => {
    const update = await readUnreadCounts(
      () => Promise.resolve({ count: 0 }),
      () => Promise.resolve({ count: 0 }),
    );
    expect(applyUnreadCounts({ forum: 5, task: 5 }, update)).toEqual({
      forum: 0,
      task: 0,
    });
  });
});

describe("the one dim line under a row", () => {
  test("a task row names the task, its list, and its deadline", () => {
    const detail = taskRowDetail(enrichedTaskRow());
    expect(detail).toContain("Wash the pans");
    expect(detail).toContain("Kitchen crew");
    expect(detail).toContain("due");
    expect(detail?.split(" \u00b7 ")).toHaveLength(3);
  });

  test("a membership row names only its list", () => {
    const detail = taskRowDetail(
      enrichedTaskRow({
        kind: "task-list-added",
        list: null,
        listTitle: "Kitchen crew",
        task: {
          title: null,
          details: null,
          startsAt: null,
          endsAt: null,
          state: null,
          assignee: null,
        },
      }),
    );
    expect(detail).toBe("Kitchen crew");
  });

  test("a withheld row has no line, so the row can say so itself", () => {
    expect(taskRowDetail(withheldTaskRow())).toBeNull();
  });

  test("the lifecycle state is not part of the line", () => {
    const detail = taskRowDetail(enrichedTaskRow({ kind: "task-canceled" }));
    expect(detail).not.toContain("Open");
    expect(detail).not.toContain("OPEN");
  });

  test("a deadline that will not parse is left out rather than guessed", () => {
    expect(dueLabel("not a date")).toBe("");
    expect(dueLabel(null)).toBe("");
    expect(dueLabel("2026-08-26T12:00:00.000Z").startsWith("due ")).toBe(true);
  });
});

describe("filtering the merged list", () => {
  const merged = mergeInboxes(
    [
      forumRow({ notification: "f-unread", read: false }),
      forumRow({ notification: "f-read", read: true }),
    ],
    [
      enrichedTaskRow({ notification: "t-unread", read: false }),
      enrichedTaskRow({ notification: "t-read", read: true }),
    ],
  );

  test("every filter is offered and each narrows what it says it does", () => {
    expect(NOTIFICATION_FILTERS).toEqual(["all", "unread", "forum", "task"]);
    expect(filterNotifications(merged, "all")).toHaveLength(4);
    expect(
      filterNotifications(merged, "unread").every((entry) => !entry.read),
    ).toBe(true);
    expect(filterNotifications(merged, "unread")).toHaveLength(2);
    expect(
      filterNotifications(merged, "forum").every(
        (entry) => entry.source === "forum",
      ),
    ).toBe(true);
    expect(
      filterNotifications(merged, "task").every(
        (entry) => entry.source === "task",
      ),
    ).toBe(true);
  });

  test("filtering does not disturb the list it was given", () => {
    filterNotifications(merged, "unread");
    expect(merged).toHaveLength(4);
  });
});

describe("grouping repeated events on one subject", () => {
  function taskEvent(
    id: string,
    subject: string,
    kind: string,
    read = false,
  ): TaskInboxNotification {
    return enrichedTaskRow({ notification: id, subject, kind, read });
  }

  test("consecutive rows about one task collapse into one entry", () => {
    const groups = groupNotifications(
      mergeInboxes(
        [],
        [
          taskEvent("t-5", "task-a", "task-completed"),
          taskEvent("t-4", "task-a", "task-reopened"),
          taskEvent("t-3", "task-a", "task-retimed"),
        ],
      ),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(3);
    expect(groups[0].lead.id).toBe("t-5");
  });

  test("a collapsed group still says how many of its rows are unread", () => {
    const groups = groupNotifications(
      mergeInboxes(
        [],
        [
          taskEvent("t-2", "task-a", "task-completed", true),
          taskEvent("t-1", "task-a", "task-retimed", false),
        ],
      ),
    );
    expect(groups[0].unread).toBe(1);
    expect(groups[0].lead.read).toBe(true);
  });

  test("a different subject in between ends the run", () => {
    const groups = groupNotifications(
      mergeInboxes(
        [],
        [
          taskEvent("t-3", "task-a", "task-completed"),
          taskEvent("t-2", "task-b", "task-assigned"),
          taskEvent("t-1", "task-a", "task-retimed"),
        ],
      ),
    );
    expect(groups).toHaveLength(3);
    expect(groups.every((group) => group.entries.length === 1)).toBe(true);
  });

  test("forum rows keep their own presentation and never fold together", () => {
    const groups = groupNotifications(
      mergeInboxes(
        [
          forumRow({ notification: "f-2", link: "post-1" }),
          forumRow({ notification: "f-1", link: "post-1" }),
        ],
        [],
      ),
    );
    expect(groups).toHaveLength(2);
  });

  test("every grouped row is still reachable individually", () => {
    const groups = groupNotifications(
      mergeInboxes(
        [],
        [
          taskEvent("t-2", "task-a", "task-completed"),
          taskEvent("t-1", "task-a", "task-retimed"),
        ],
      ),
    );
    expect(groups[0].entries.map((entry) => entry.id)).toEqual(["t-2", "t-1"]);
  });

  test("an empty list groups to nothing", () => {
    expect(groupNotifications([])).toEqual([]);
  });
});
