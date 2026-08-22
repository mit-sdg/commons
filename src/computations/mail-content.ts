import { configuredPublicOrigin } from "../deployment.ts";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function invitationLink(invitation: string): string {
  return `${configuredPublicOrigin()}/register?invitation=${encodeURIComponent(invitation)}`;
}

export function invitationMailText({
  invitation,
  credential,
}: {
  invitation: string;
  credential: string;
}): string {
  return `You have been invited to Commons.\n\nRegister: ${invitationLink(invitation)}\nTemporary password: ${credential}\n\nThis invitation does not expire.`;
}

export function invitationMailHtml({
  invitation,
  credential,
}: {
  invitation: string;
  credential: string;
}): string {
  const link = invitationLink(invitation);
  return `<p>You have been invited to Commons.</p><p><a href="${escapeHtml(link)}">Register your account</a></p><p>Temporary password: <strong>${escapeHtml(credential)}</strong></p><p>This invitation does not expire.</p>`;
}

export function notificationMailText(_input: { notification: string }): string {
  return `You have a new Commons notification. Sign in to view it.\n\n${configuredPublicOrigin()}/notifications`;
}

export function notificationMailHtml(_input: { notification: string }): string {
  const link = `${configuredPublicOrigin()}/notifications`;
  return `<p>You have a new Commons notification. Sign in to view it.</p><p><a href="${escapeHtml(link)}">View notifications</a></p>`;
}

const taskListKindPhrase: Record<string, string> = {
  "task-list-added": "You were added to the task list",
  "task-list-removed": "You were removed from the task list",
};

const taskKindPhrase: Record<string, string> = {
  "task-assigned": "A task was assigned to you",
  "task-retimed": "A task assigned to you was rescheduled",
  "task-canceled": "A task assigned to you was canceled",
  "task-uncanceled": "A task assigned to you was uncanceled",
  "task-reopened": "A task assigned to you was reopened",
  "task-completed": "A task assigned to you was completed",
};

const membershipPhrase = (kind: string): string =>
  taskListKindPhrase[kind] ?? "Your membership of the task list changed";

const taskPhrase = (kind: string): string =>
  taskKindPhrase[kind] ?? "A task assigned to you changed";

function taskListsLink(): string {
  return `${configuredPublicOrigin()}/tasks`;
}

export function taskListMailSubject({
  kind,
  listTitle,
}: {
  kind: string;
  listTitle: string;
}): string {
  return `${membershipPhrase(kind)}: ${listTitle}`;
}

export function taskListMailText({ kind, listTitle }: { kind: string; listTitle: string }): string {
  return `${membershipPhrase(kind)} "${listTitle}".\n\n${taskListsLink()}`;
}

export function taskListMailHtml({ kind, listTitle }: { kind: string; listTitle: string }): string {
  const link = taskListsLink();
  return `<p>${escapeHtml(membershipPhrase(kind))} &quot;${escapeHtml(listTitle)}&quot;.</p><p><a href="${escapeHtml(link)}">Open your task lists</a></p>`;
}

export function taskMailSubject({
  kind,
  taskTitle,
  listTitle,
}: {
  kind: string;
  taskTitle: string;
  listTitle: string;
}): string {
  return `${taskPhrase(kind)}: ${taskTitle} (${listTitle})`;
}

export function taskMailText({
  kind,
  taskTitle,
  listTitle,
  deadline,
}: {
  kind: string;
  taskTitle: string;
  listTitle: string;
  deadline: string;
}): string {
  return `${taskPhrase(kind)}.\n\nTask: ${taskTitle}\nList: ${listTitle}\nDue: ${deadline}\n\n${taskListsLink()}`;
}

export function taskMailHtml({
  kind,
  taskTitle,
  listTitle,
  deadline,
}: {
  kind: string;
  taskTitle: string;
  listTitle: string;
  deadline: string;
}): string {
  const link = taskListsLink();
  return `<p>${escapeHtml(taskPhrase(kind))}.</p><ul><li>Task: ${escapeHtml(taskTitle)}</li><li>List: ${escapeHtml(listTitle)}</li><li>Due: ${escapeHtml(deadline)}</li></ul><p><a href="${escapeHtml(link)}">Open your task lists</a></p>`;
}
