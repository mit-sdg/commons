import { configuredPublicOrigin } from "../deployment.ts";
import { excerpt, titleFromContent } from "../presentation/post-text.ts";

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

const INVITATION_SUBJECT_LIMIT = 200;
const INVITATION_BODY_LIMIT = 20_000;

/**
 * Commons' own words stand wherever an administrator has worded nothing, so
 * they belong to Commons rather than being seeded into Wording. Bounding the
 * result here also lets a preview render an unsaved draft without the copy
 * rules being enforced twice: what a preview shows is at most what may be
 * saved, and a blank draft previews the words it would fall back to.
 */
export function invitationTemplateSubject({ subject }: { subject: string | null }): string {
  const worded =
    typeof subject === "string" ? subject.replace(/[\p{Cc}\u2028\u2029]/gu, " ").trim() : "";
  return worded === ""
    ? "Your Commons invitation"
    : worded.slice(0, INVITATION_SUBJECT_LIMIT).trim();
}

export function invitationTemplateBody({ body }: { body: string | null }): string {
  const worded =
    typeof body === "string" ? body.replaceAll("\0", "").replace(/\r\n?/g, "\n").trim() : "";
  return worded === ""
    ? "You have been invited to Commons."
    : worded.slice(0, INVITATION_BODY_LIMIT).trim();
}

function paragraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${escapeHtml(p).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

export function invitationMailText({
  invitation,
  credential,
  body,
}: {
  invitation: string;
  credential: string;
  body: string;
}): string {
  return `${body}\n\nRegister: ${invitationLink(invitation)}\nTemporary password: ${credential}\n\nThis invitation does not expire.`;
}

export function invitationMailHtml({
  invitation,
  credential,
  body,
}: {
  invitation: string;
  credential: string;
  body: string;
}): string {
  const link = invitationLink(invitation);
  return `${paragraphs(body)}<p><a href="${escapeHtml(link)}">Register your account</a></p><p>Temporary password: <strong>${escapeHtml(credential)}</strong></p><p>This invitation does not expire.</p>`;
}

const notificationPhrase: Record<string, string> = {
  reply: "New reply to your post",
  followed_reply: "New reply in a discussion you follow",
  mention: "You were mentioned in a discussion",
  accepted: "Your answer was accepted",
  addressed: "A discussion was started with you",
  staff_message: "New private discussion for staff",
  assignment_released: "A new assignment is available",
};

const eventPhrase = (kind: string) =>
  Object.hasOwn(notificationPhrase, kind) ? notificationPhrase[kind] : "New Commons notification";

/** The same first-line title used by the forum, never a post-body excerpt. */
export function notificationDiscussionTitle({ content }: { content: unknown }): string {
  return typeof content === "string"
    ? excerpt(titleFromContent(content).replace(/\p{Cc}/gu, " "), 159) || "Discussion"
    : "Discussion";
}

export function forumNotificationUrl({
  conversation,
  post,
}: {
  conversation: string;
  post: string;
}): string {
  return `${configuredPublicOrigin()}/t/${encodeURIComponent(conversation)}#post-${encodeURIComponent(post)}`;
}

export function assignmentNotificationUrl({ assignment }: { assignment: string }): string {
  return `${configuredPublicOrigin()}/assignments/${encodeURIComponent(assignment)}`;
}

export function notificationMailSubject({ kind, title }: { kind: string; title: string }): string {
  return `${eventPhrase(kind)}: ${title.replace(/\s+/g, " ").trim().slice(0, 160)}`;
}

interface NotificationMail {
  kind: string;
  title: string;
  url: string;
  content: unknown;
  authorName: unknown;
}

export function notificationMailAuthor({
  username,
  displayName,
}: {
  username: string;
  displayName: unknown;
}): string {
  const name = typeof displayName === "string" ? displayName.trim() : "";
  return name ? `${name} (@${username})` : `@${username}`;
}

export function notificationMailText(input: NotificationMail): string {
  const { kind, title, url, content } = input;
  const author = typeof input.authorName === "string" ? input.authorName : "";
  const message = typeof content === "string" ? `\n\n${content}` : "";
  return `${eventPhrase(kind)}.${author ? `\nAuthor: ${author}` : ""}\n\n${kind === "assignment_released" ? "Assignment" : "Discussion"}: ${title}${message}\n\nView in Commons:\n${url}`;
}

export function notificationMailHtml(input: NotificationMail): string {
  const { kind, title, url, content } = input;
  const author = typeof input.authorName === "string" ? input.authorName : "";
  const message =
    typeof content === "string" ? `<blockquote>${paragraphs(content)}</blockquote>` : "";
  return `<p>${escapeHtml(eventPhrase(kind))}.</p>${author ? `<p>Author: <strong>${escapeHtml(author)}</strong></p>` : ""}<p>${kind === "assignment_released" ? "Assignment" : "Discussion"}: <strong>${escapeHtml(title)}</strong></p>${message}<p><a href="${escapeHtml(url)}">View in Commons</a></p>`;
}

/** null means non-forum mail; malformed forum keys must not admit a preview. */
export function notificationMailSource({ key }: { key: string }): string | null {
  if (!key.startsWith("forum:")) return null;
  try {
    const context = JSON.parse(key.slice(6));
    return typeof context?.post === "string" ? context.post : "";
  } catch {
    return "";
  }
}

/** Outbox inspection must not expose invitation passwords or reset codes. */
export function mailPreviewText({ text }: { text: string }): string {
  return text
    .replace(/^(Temporary password|Reset code):[^\r\n]*/gm, "$1: [hidden]")
    .replace(/([?&](?:invitation|voucher)=)[^\s&#]+/g, "$1[hidden]");
}

const taskListKindPhrase: Record<string, string> = {
  "task-list-added": "You were added to the group",
  "task-list-removed": "You were removed from the group",
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
  Object.hasOwn(taskListKindPhrase, kind)
    ? taskListKindPhrase[kind]
    : "Your membership of the group changed";

const taskPhrase = (kind: string): string =>
  Object.hasOwn(taskKindPhrase, kind) ? taskKindPhrase[kind] : "A task assigned to you changed";

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
  return `${membershipPhrase(kind)} "${listTitle}".\n\n${configuredPublicOrigin()}/groups`;
}

export function taskListMailHtml({ kind, listTitle }: { kind: string; listTitle: string }): string {
  const link = `${configuredPublicOrigin()}/groups`;
  return `<p>${escapeHtml(membershipPhrase(kind))} &quot;${escapeHtml(listTitle)}&quot;.</p><p><a href="${escapeHtml(link)}">Open groups</a></p>`;
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
  return `${taskPhrase(kind)}.\n\nTask: ${taskTitle}\nGroup: ${listTitle}\nDue: ${deadline}\n\n${taskListsLink()}`;
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
  return `<p>${escapeHtml(taskPhrase(kind))}.</p><ul><li>Task: ${escapeHtml(taskTitle)}</li><li>Group: ${escapeHtml(listTitle)}</li><li>Due: ${escapeHtml(deadline)}</li></ul><p><a href="${escapeHtml(link)}">Open tasks</a></p>`;
}
