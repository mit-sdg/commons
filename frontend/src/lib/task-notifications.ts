/**
 * One inbox, two instances.
 *
 * The forum inbox at `/notifications/*` and the task inbox at
 * `/tasknotifications/*` are separate endpoint groups over separate stores. The
 * reader sees one list and one badge, so this module owns the merging, the task
 * domain's wording, and the two-call arithmetic behind the badge.
 *
 * Nothing here calls an endpoint itself: every function that needs one takes it
 * as an argument, so the page and the badge provider stay the only places that
 * name `api`, and the rules below can be read without a server.
 */

import type { ApiError } from "@/lib/api";
import { isApiError } from "@/lib/api";
import { toDate } from "@/lib/format";
import type { InboxNotification, TaskInboxNotification } from "@/lib/models";

/**
 * The eight kinds this change mints. A kind says what happened; it never says
 * what a row's subject is, so nothing below parses one to route a link.
 */
export const TASK_NOTIFICATION_KINDS = [
  "task-list-added",
  "task-list-removed",
  "task-assigned",
  "task-retimed",
  "task-canceled",
  "task-uncanceled",
  "task-reopened",
  "task-completed",
] as const;

export type TaskNotificationKind = (typeof TASK_NOTIFICATION_KINDS)[number];

/** The two kinds whose subject is a list rather than a task. */
const MEMBERSHIP_KINDS: readonly string[] = [
  "task-list-added",
  "task-list-removed",
];

export function isMembershipKind(kind: string): boolean {
  return MEMBERSHIP_KINDS.includes(kind);
}

/** What each task-domain kind says, in its own words. */
export const TASK_ACTION_TEXT: Record<TaskNotificationKind, string> = {
  "task-list-added": "You were added to a task list",
  "task-list-removed": "You were removed from a task list",
  "task-assigned": "A task was assigned to you",
  "task-retimed": "A task assigned to you was rescheduled",
  "task-canceled": "A task assigned to you was canceled",
  "task-uncanceled": "A task assigned to you is no longer canceled",
  "task-reopened": "A task assigned to you was reopened",
  "task-completed": "A task assigned to you was completed",
};

/** A kind's sentence. An unrecognized kind shows itself rather than a guess. */
export function taskActionText(kind: string): string {
  return TASK_ACTION_TEXT[kind as TaskNotificationKind] ?? kind;
}

/**
 * Whether the row carries the presentation its kind would name.
 *
 * The inbox splices presentation only where the reader is entitled to it now,
 * and an unspliced row arrives with its leaves filled with `null` rather than
 * with the fragment dropped — so a leaf decides this, never the fragment.
 */
export function hasTaskPresentation(row: TaskInboxNotification): boolean {
  return isMembershipKind(String(row.kind))
    ? row.listTitle != null
    : row.task.title != null;
}

/**
 * What a withheld row can honestly say. Two cases reach it — a list the reader
 * has left, and a task that has been deleted — and the row cannot tell which,
 * so it says only what it knows.
 */
export function withheldTaskNote(kind: string): string {
  return isMembershipKind(kind)
    ? "This list is no longer shown to you."
    : "This task is no longer shown to you: it may have been deleted, or you may no longer be a member of its list.";
}

/**
 * The list a row points at, or null when the row carries no list identity.
 *
 * A membership row is about a list, so its own link is the list. A task row's
 * link is the task, and the holding list arrives beside it as `list` — spliced
 * only while the reader still belongs to that list, so a withheld task row
 * names no list and links nowhere.
 */
export function taskRowListId(row: TaskInboxNotification): string | null {
  if (isMembershipKind(String(row.kind))) {
    return row.link == null ? null : String(row.link);
  }
  return row.list == null ? null : String(row.list);
}

/** Where a task-domain row navigates, or null when it names no list. */
export function taskRowHref(row: TaskInboxNotification): string | null {
  const list = taskRowListId(row);
  return list === null ? null : `/tasks/${list}`;
}

/** A deadline said briefly, for the one dim line under a row's sentence. */
export function dueLabel(endsAt: unknown): string {
  const date = toDate(endsAt);
  if (!date) return "";
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `due ${day}`;
}

/**
 * The single dim line beneath a task row's sentence: what the row is about,
 * where it lives, and when it is due. Null where presentation was withheld —
 * the row says so in its own words instead, rather than going blank.
 */
export function taskRowDetail(row: TaskInboxNotification): string | null {
  if (!hasTaskPresentation(row)) return null;
  const listTitle = row.listTitle == null ? null : String(row.listTitle);
  if (isMembershipKind(String(row.kind))) return listTitle;
  const parts = [String(row.task.title)];
  if (listTitle) parts.push(listTitle);
  const due = dueLabel(row.task.endsAt);
  if (due) parts.push(due);
  return parts.join(" \u00b7 ");
}

/** Which inbox a merged row came from, and therefore which endpoints act on it. */
export type NotificationSource = "forum" | "task";

interface MergedRowBase {
  /** The notification's own identity, unique across both instances. */
  id: string;
  createdAt: unknown;
  read: boolean;
}

export interface MergedForumNotification extends MergedRowBase {
  source: "forum";
  row: InboxNotification;
}

export interface MergedTaskNotification extends MergedRowBase {
  source: "task";
  row: TaskInboxNotification;
}

export type MergedNotification =
  | MergedForumNotification
  | MergedTaskNotification;

function momentOf(value: unknown): number {
  return toDate(value)?.getTime() ?? 0;
}

/**
 * Both inboxes as one list, newest first. Ties keep forum rows ahead of task
 * rows, so the order is stable between reads of the same two lists.
 */
export function mergeInboxes(
  forum: readonly InboxNotification[],
  task: readonly TaskInboxNotification[],
): MergedNotification[] {
  const merged: MergedNotification[] = [
    ...forum.map(
      (row): MergedForumNotification => ({
        source: "forum",
        id: String(row.notification),
        createdAt: row.createdAt,
        read: Boolean(row.read),
        row,
      }),
    ),
    ...task.map(
      (row): MergedTaskNotification => ({
        source: "task",
        id: String(row.notification),
        createdAt: row.createdAt,
        read: Boolean(row.read),
        row,
      }),
    ),
  ];
  return merged.sort((a, b) => momentOf(b.createdAt) - momentOf(a.createdAt));
}

/** Unread rows on each side of a merged list. */
export function unreadBySource(merged: readonly MergedNotification[]): {
  forum: number;
  task: number;
} {
  let forum = 0;
  let task = 0;
  for (const entry of merged) {
    if (entry.read) continue;
    if (entry.source === "forum") forum += 1;
    else task += 1;
  }
  return { forum, task };
}

/** Which slice of the merged inbox a reader is looking at. */
export type NotificationFilter = "all" | "unread" | "forum" | "task";

export const NOTIFICATION_FILTERS: readonly NotificationFilter[] = [
  "all",
  "unread",
  "forum",
  "task",
];

/** The merged list narrowed to one slice, in the order it already had. */
export function filterNotifications(
  entries: readonly MergedNotification[],
  filter: NotificationFilter,
): MergedNotification[] {
  switch (filter) {
    case "unread":
      return entries.filter((entry) => !entry.read);
    case "forum":
      return entries.filter((entry) => entry.source === "forum");
    case "task":
      return entries.filter((entry) => entry.source === "task");
    default:
      return [...entries];
  }
}

/** Consecutive rows about one subject, presented as one expandable entry. */
export interface NotificationGroup {
  /** Stable across renders: the lead row's instance and identity. */
  key: string;
  /** The newest row in the run; what a collapsed group shows. */
  lead: MergedNotification;
  /** Every row in the run, newest first, the lead included. */
  entries: MergedNotification[];
  /** How many of them are unread, so collapsing never hides that. */
  unread: number;
}

/**
 * What a row may be grouped with.
 *
 * Only task rows group, and only by the subject the row carries: five
 * operations on one task in three minutes are the noise this is for. Forum rows
 * keep the presentation they have always had, so they are never folded into a
 * summary line.
 */
function groupKeyOf(entry: MergedNotification): string | null {
  if (entry.source !== "task") return null;
  return entry.row.subject == null ? null : `task:${String(entry.row.subject)}`;
}

/**
 * Runs of consecutive same-subject rows, collapsed into one entry each.
 *
 * Only neighbours join: a row about another subject between two rows about this
 * one ends the run, so a group never claims rows that are not actually adjacent
 * in time.
 */
export function groupNotifications(
  entries: readonly MergedNotification[],
): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  let openKey: string | null = null;
  for (const entry of entries) {
    const key = groupKeyOf(entry);
    const open = groups[groups.length - 1];
    if (key !== null && key === openKey && open) {
      open.entries.push(entry);
      if (!entry.read) open.unread += 1;
      continue;
    }
    openKey = key;
    groups.push({
      key: `${entry.source}:${entry.id}`,
      lead: entry,
      entries: [entry],
      unread: entry.read ? 0 : 1,
    });
  }
  return groups;
}

type Reader<T> = () => Promise<T | ApiError>;

/**
 * Both inboxes, merged.
 *
 * A refusal from either read is the whole page's refusal: half an inbox
 * presented as the whole one would be a quieter lie than an error. A transport
 * fault rejects, as it does for any other read, and the caller's query state
 * shows it.
 */
export async function loadMergedInbox(
  readForum: Reader<{ notifications: InboxNotification[] }>,
  readTask: Reader<{ notifications: TaskInboxNotification[] }>,
): Promise<{ notifications: MergedNotification[] } | ApiError> {
  const [forum, task] = await Promise.all([readForum(), readTask()]);
  if (isApiError(forum)) return forum;
  if (isApiError(task)) return task;
  return {
    notifications: mergeInboxes(forum.notifications, task.notifications),
  };
}

/** What became of each half of a two-instance mark-all-read. */
export interface MarkAllOutcome {
  /** The refusal code for that half, or null when it applied. */
  forumError: string | null;
  taskError: string | null;
}

function refusalOf(
  result: PromiseSettledResult<unknown | ApiError>,
): string | null {
  if (result.status === "rejected") return "INTERNAL_ERROR";
  return isApiError(result.value) ? result.value.error : null;
}

/**
 * Mark every notification read on both instances.
 *
 * The pair is not atomic and is not made to look atomic: each half is issued,
 * each half is reported, and one failing leaves the other applied. Both halves
 * are idempotent, so a reader who retries loses nothing.
 */
export async function markAllReadBoth(
  markForum: () => Promise<unknown | ApiError>,
  markTask: () => Promise<unknown | ApiError>,
): Promise<MarkAllOutcome> {
  const [forum, task] = await Promise.allSettled([markForum(), markTask()]);
  return { forumError: refusalOf(forum), taskError: refusalOf(task) };
}

/** The badge's two halves. */
export interface UnreadCounts {
  forum: number;
  task: number;
}

/** A poll's answer. A half that failed answers null and keeps its old value. */
export interface UnreadCountUpdate {
  forum: number | null;
  task: number | null;
}

function countOf(
  result: PromiseSettledResult<{ count: number } | ApiError>,
): number | null {
  if (result.status === "rejected") return null;
  return isApiError(result.value) ? null : result.value.count;
}

/**
 * Both unread counts.
 *
 * These are two calls, and nothing makes them one. A half that refuses or
 * faults answers null rather than zero or a guess, so the badge keeps the last
 * figure that instance actually gave and goes stale instead of wrong.
 */
export async function readUnreadCounts(
  readForum: Reader<{ count: number }>,
  readTask: Reader<{ count: number }>,
): Promise<UnreadCountUpdate> {
  const [forum, task] = await Promise.allSettled([readForum(), readTask()]);
  return { forum: countOf(forum), task: countOf(task) };
}

/** The counts after a poll, keeping each half that did not answer. */
export function applyUnreadCounts(
  previous: UnreadCounts,
  update: UnreadCountUpdate,
): UnreadCounts {
  return {
    forum: update.forum ?? previous.forum,
    task: update.task ?? previous.task,
  };
}

/** One badge from two instances. */
export function unreadBadge(counts: UnreadCounts): number {
  return counts.forum + counts.task;
}
