import { configuredPublicOrigin } from "../deployment.ts";
import { bodyAfterTitle, excerpt, titleFromContent } from "../presentation/post-text.ts";

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
  const written = text.replace(/\r\n?/g, "\n").trim();
  return written === ""
    ? ""
    : written
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

export function notificationAuthorLabel({
  username,
  displayName,
}: {
  username: string;
  displayName: unknown;
}): string {
  const publicName = typeof displayName === "string" ? displayName.trim() : "";
  return publicName === "" ? `@${username}` : `${publicName} (@${username})`;
}

/**
 * An opening post already gave the discussion its title, so repeating that line under
 * "Discussion:" would say the same thing twice; a reply owns every line it wrote.
 */
export function forumNotificationMailBody({
  content,
  post,
  opening,
}: {
  content: string;
  post: string;
  opening: unknown;
}): string {
  return post === opening ? bodyAfterTitle(content) : content;
}

export function forumNotificationMailText({
  kind,
  title,
  url,
  author,
  content,
}: {
  kind: string;
  title: string;
  url: string;
  author: string;
  content: string;
}): string {
  const written = content.trim();
  const message = written === "" ? "" : `\n${written}\n`;
  return `${eventPhrase(kind)}.\n\nDiscussion: ${title}\nFrom: ${author}\n${message}\nOpen discussion:\n${url}`;
}

export function forumNotificationMailHtml({
  kind,
  title,
  url,
  author,
  content,
}: {
  kind: string;
  title: string;
  url: string;
  author: string;
  content: string;
}): string {
  return `<p>${escapeHtml(eventPhrase(kind))}.</p><p>Discussion: <strong>${escapeHtml(title)}</strong></p><p>From: <strong>${escapeHtml(author)}</strong></p>${paragraphs(content)}<p><a href="${escapeHtml(url)}">Open discussion</a></p>`;
}

/**
 * An assignment's due instant is stored as one moment; a course reads it in the wall time
 * it keeps. An unconfigured or unusable zone still deserves an unambiguous label, so the
 * fallback names UTC rather than the server's accidental locale.
 */
export function assignmentDueLabel({ dueAt, detail }: { dueAt: unknown; detail: unknown }): string {
  const due =
    dueAt instanceof Date ? dueAt : typeof dueAt === "string" ? new Date(dueAt) : new Date(NaN);
  if (Number.isNaN(due.getTime())) return "";
  const named =
    typeof detail === "object" && detail !== null && "timezone" in detail
      ? (detail as { timezone: unknown }).timezone
      : undefined;
  const format = (timeZone: string) =>
    new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone,
    }).format(due);
  try {
    return format(typeof named === "string" && named !== "" ? named : "UTC");
  } catch {
    return format("UTC");
  }
}

/**
 * A release names who published the assignment and when it is due, which is what the
 * recipient triages on. The instructions stay out: they are the working material rather
 * than the event, they carry links and attachments that only resolve inside Commons, and
 * a problem set's full text does not belong in every assignee's mailbox.
 */
export function assignmentNotificationMailText({
  kind,
  title,
  url,
  author,
  due,
}: {
  kind: string;
  title: string;
  url: string;
  author: string;
  due: string;
}): string {
  const when = due === "" ? "" : `\nDue: ${due}`;
  return `${eventPhrase(kind)}.\n\nAssignment: ${title}\nFrom: ${author}${when}\n\nOpen assignment:\n${url}`;
}

export function assignmentNotificationMailHtml({
  kind,
  title,
  url,
  author,
  due,
}: {
  kind: string;
  title: string;
  url: string;
  author: string;
  due: string;
}): string {
  const when = due === "" ? "" : `<p>Due: <strong>${escapeHtml(due)}</strong></p>`;
  return `<p>${escapeHtml(eventPhrase(kind))}.</p><p>Assignment: <strong>${escapeHtml(title)}</strong></p><p>From: <strong>${escapeHtml(author)}</strong></p>${when}<p><a href="${escapeHtml(url)}">Open assignment</a></p>`;
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

/** A task's own words are what the recipient has to act on, so mail carries them whole. */
export function taskMailText({
  kind,
  taskTitle,
  listTitle,
  deadline,
  details,
}: {
  kind: string;
  taskTitle: string;
  listTitle: string;
  deadline: string;
  details: unknown;
}): string {
  const written = typeof details === "string" ? details.trim() : "";
  const described = written === "" ? "" : `\n${written}\n`;
  return `${taskPhrase(kind)}.\n\nTask: ${taskTitle}\nGroup: ${listTitle}\nDue: ${deadline}\n${described}\n${taskListsLink()}`;
}

export function taskMailHtml({
  kind,
  taskTitle,
  listTitle,
  deadline,
  details,
}: {
  kind: string;
  taskTitle: string;
  listTitle: string;
  deadline: string;
  details: unknown;
}): string {
  const link = taskListsLink();
  const described = typeof details === "string" ? paragraphs(details) : "";
  return `<p>${escapeHtml(taskPhrase(kind))}.</p><ul><li>Task: ${escapeHtml(taskTitle)}</li><li>Group: ${escapeHtml(listTitle)}</li><li>Due: ${escapeHtml(deadline)}</li></ul>${described}<p><a href="${escapeHtml(link)}">Open tasks</a></p>`;
}
