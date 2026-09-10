import type { InboxNotification } from "@/lib/models";

const ACTOR_EVENTS: Record<string, string> = {
  staff_message: "sent a private message to staff",
  addressed: "started a discussion with you",
  reply: "replied to your post",
  followed_reply: "replied in a discussion you follow",
  mention: "mentioned you",
};

/** Accepted rows carry the answer's author, not the person accepting it. */
export function forumActionText(kind: string): string {
  if (kind === "accepted") return "Your answer was accepted";
  if (kind === "assignment_released") return "A new assignment is available";
  return Object.hasOwn(ACTOR_EVENTS, kind)
    ? ACTOR_EVENTS[kind]
    : "You have a discussion update";
}

export function forumPresentation(row: InboxNotification) {
  const actorEvent = Object.hasOwn(ACTOR_EVENTS, row.kind);
  const actor =
    actorEvent &&
    row.actor.user &&
    (row.actor.displayName || row.actor.username)
      ? row.actor
      : null;
  return {
    title: row.discussionTitle || "Discussion update",
    actor,
    event:
      actorEvent && !actor
        ? `Someone ${forumActionText(row.kind)}`
        : forumActionText(row.kind),
    excerpt: row.post.content,
  };
}

/** A null conversation is withheld context, not an invitation to probe for it. */
export function forumRowHref(row: InboxNotification): string | null {
  if (!row.link) return null;
  const link = encodeURIComponent(String(row.link));
  if (row.kind === "assignment_released") return `/assignments/${link}`;
  return row.conversation
    ? `/t/${encodeURIComponent(String(row.conversation))}#post-${link}`
    : null;
}
