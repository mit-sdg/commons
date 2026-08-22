import { api, publicErrorMessage, unwrap } from "@/lib/api";
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

/**
 * The refusals a task action can answer, said plainly. A refusal the tasks
 * endpoints do not name falls through to the shared public sentence.
 */
/**
 * What a refused task action means to a reader.
 *
 * The HTTP boundary projects every domain refusal onto one of five public
 * categories (see `commonsPublicErrors`), so a concept's own code — say
 * `TASK_NOT_SETTLED` — never reaches the browser; `CONFLICT` does. Every task
 * refusal that is not a permission or shape problem therefore arrives as the
 * same `CONFLICT`, and only the caller knows which action produced it. So the
 * action supplies the sentence, and the category decides whether it is used.
 *
 * Each of these says the same thing: the card is showing a state the server no
 * longer agrees with, and a reload settles it.
 */
export const TASK_CONFLICT_MESSAGES = {
  complete:
    "That task cannot be completed now. Reload to see its current state.",
  reopen:
    "Only a completed task can be reopened. Reload to see its current state.",
  uncancel: "That task is no longer canceled. Reload to see its current state.",
  cancel: "That task is no longer open. Reload to see its current state.",
  assign:
    "That task cannot be reassigned now. Reload to see its current state.",
  remove:
    "Only a finished or canceled task can be deleted. Reload to see its current state.",
} as const;

export type TaskAction = keyof typeof TASK_CONFLICT_MESSAGES;

/**
 * The message for a refused task action. `CONFLICT` gets the action's own
 * sentence, because the category alone cannot say what went wrong; everything
 * else already has a public sentence of its own.
 */
export function taskErrorMessage(error: string, action: TaskAction): string {
  if (error === "CONFLICT") return TASK_CONFLICT_MESSAGES[action];
  return publicErrorMessage(error);
}

export interface TaskStateActions {
  complete: boolean;
  reopen: boolean;
  uncancel: boolean;
  cancel: boolean;
  /** Edit, retime, assign, and release: everything cancellation freezes. */
  revise: boolean;
  /** Permanent removal, which only a settled task allows. */
  remove: boolean;
}

/**
 * What a task's state alone allows. Membership, an assignee, and a known
 * roster narrow these further; nothing narrows them back open.
 */
export function taskStateActions(state: string): TaskStateActions {
  const done = state === "DONE";
  const canceled = state === "CANCELED";
  return {
    complete: !done && !canceled,
    reopen: done,
    uncancel: canceled,
    cancel: !done && !canceled,
    revise: !canceled,
    remove: done || canceled,
  };
}

/** Create a new collaborative task list with an optional title and optional initial members. */
export async function createTaskList(
  title?: string,
  initialMembers?: string[],
): Promise<string> {
  const cleanTitle = title?.trim();
  const { list } = unwrap(
    await api.tasklists.create(cleanTitle ? { title: cleanTitle } : {}),
  );
  const listId = String(list);
  if (initialMembers && initialMembers.length > 0) {
    for (const candidate of initialMembers) {
      unwrap(await api.tasklists["add-member"]({ list: listId, candidate }));
    }
  }
  return listId;
}

/** Rename an existing task list. */
export async function renameTaskList(
  list: string,
  title: string,
): Promise<void> {
  unwrap(await api.tasklists.rename({ list, title: title.trim() }));
}

/** Add a member to an existing task list. */
export async function addListMember(
  list: string,
  candidate: string,
): Promise<void> {
  unwrap(await api.tasklists["add-member"]({ list, candidate }));
}

/** Remove a member from an existing task list. */
export async function removeListMember(
  list: string,
  target: string,
): Promise<void> {
  unwrap(await api.tasklists["remove-member"]({ list, target }));
}

/** Leave a task list. */
export async function leaveTaskList(list: string): Promise<void> {
  unwrap(await api.tasklists.leave({ list }));
}

/** Load all task lists belonging to the current user. */
export async function loadMyLists(): Promise<TaskList[]> {
  const { lists } = unwrap(await api.tasklists.mine({}));
  return lists;
}

/** Load all open and historical tasks assigned to the current user across lists. */
export async function loadMyTasks(): Promise<AssignedTask[]> {
  const { tasks } = unwrap(await api.tasks.mine({}));
  return tasks;
}

/** Load a task list page (detail and its tasks). */
export async function loadTaskListPage(list: string): Promise<TaskListPage> {
  const answer = unwrap(await api.tasklists.get({ list }));
  return { list: answer.list, tasks: answer.tasks };
}

/** Create a new task within a task list. */
export async function createTask(input: {
  list: string;
  title: string;
  details?: string;
  startsAt: string;
  endsAt: string;
}): Promise<string> {
  const { task } = unwrap(await api.tasks.create(input));
  return String(task);
}

/** Edit a task's title and markdown details. */
export async function describeTask(input: {
  task: string;
  title: string;
  details?: string;
}): Promise<void> {
  unwrap(await api.tasks.describe(input));
}

/** Retime a task's start and end timestamps. */
export async function retimeTask(input: {
  task: string;
  startsAt: string;
  endsAt: string;
}): Promise<void> {
  unwrap(await api.tasks.retime(input));
}

/** Assign a task to a list member. */
export async function assignTask(
  task: string,
  assignee: string,
): Promise<void> {
  unwrap(await api.tasks.assign({ task, assignee }));
}

/** Release a task's current assignee. */
export async function releaseTask(task: string): Promise<void> {
  unwrap(await api.tasks.release({ task }));
}

/** Mark an open task as completed. */
export async function completeTask(task: string): Promise<void> {
  unwrap(await api.tasks.complete({ task }));
}

/** Reopen a completed task. */
export async function reopenTask(task: string): Promise<void> {
  unwrap(await api.tasks.reopen({ task }));
}

/** Cancel an open task. */
export async function cancelTask(task: string): Promise<void> {
  unwrap(await api.tasks.cancel({ task }));
}
