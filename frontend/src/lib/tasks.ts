import { api, unwrap } from "@/lib/api";
import type { AssignedTask, TaskList, TaskListPage } from "@/lib/models";

/** A `datetime-local` value for a moment, in the reader's own zone. */
export function toLocalInput(value: unknown): string {
  const date = value == null ? new Date() : new Date(value as string);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

/** The moment a `datetime-local` value names, as the wire spells it. */
export function fromLocalInput(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** The default window a new task is offered: now, ending an hour later. */
export function defaultWindow(): { startsAt: string; endsAt: string } {
  const now = new Date();
  const end = new Date(now.getTime() + 60 * 60_000);
  return { startsAt: toLocalInput(now), endsAt: toLocalInput(end) };
}

export function windowLabel(startsAt: unknown, endsAt: unknown): string {
  const start = new Date(startsAt as string);
  const end = new Date(endsAt as string);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const sameDay = start.toDateString() === end.toDateString();
  const day = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const from = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const to = end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return `${day}, ${from} – ${to}`;
  const endDay = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${day}, ${from} → ${endDay}, ${to}`;
}

export const STATE_LABELS: Record<string, string> = {
  OPEN: "Open",
  DONE: "Done",
  CANCELED: "Canceled",
};

/** The list a set of profiles shares, created only when none exists yet. */
export async function openTaskList(
  members: string[],
  title = "",
): Promise<string> {
  const { list } = unwrap(await api.tasklists.open({ members, title }));
  return String(list);
}

export async function loadMyLists(): Promise<TaskList[]> {
  const { lists } = unwrap(await api.tasklists.mine({}));
  return lists;
}

export async function loadMyTasks(): Promise<AssignedTask[]> {
  const { tasks } = unwrap(await api.tasks.mine({}));
  return tasks;
}

export async function loadTaskListPage(list: string): Promise<TaskListPage> {
  const answer = unwrap(await api.tasklists.get({ list }));
  return { list: answer.list, tasks: answer.tasks };
}
