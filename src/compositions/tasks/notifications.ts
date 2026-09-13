import { activeUser } from "../access/session.ts";
import {
  each,
  form,
  former,
  now,
  reaction,
  when,
  where,
  whether,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  removedSomebodyElse,
  theActorPresentation,
  theListTitleBehind,
  theMailFor,
  theTaskBehind,
} from "./notification-policy.ts";
import { concepts } from "../../concepts.ts";

const { Authenticating, Grouping, Mailing, TaskNotifying } = concepts;

export const MembershipGainNotifies = reaction(({ list, member, candidate, at }) =>
  when(Grouping.addMember({ member, candidate, at }).responds({ group: list })).then(
    TaskNotifying.notify({
      recipient: candidate,
      kind: "task-list-added",
      subject: list,
      link: list,
      actor: member,
      at,
    }),
  ),
);

export const MembershipLossNotifies = reaction(({ list, member, target, at }) =>
  when(Grouping.removeMember({ member, target, at }).responds({ group: list }))
    .where(removedSomebodyElse({ member, list }))
    .then(
      TaskNotifying.notify({
        recipient: target,
        kind: "task-list-removed",
        subject: list,
        link: list,
        actor: member,
        at,
      }),
    ),
);

export const NotificationQueuesEmail = reaction(
  ({
    notification,
    recipient,
    kind,
    subject,
    actor,
    at,
    email,
    mailSubject,
    text,
    html,
    message,
  }) =>
    when(TaskNotifying.notify({ recipient, kind, subject, actor, at }).responds({ notification }))
      .where(
        Authenticating._getById({ user: recipient }).is({ email }),
        theMailFor({ kind, subject, actor, recipient, at }).is({ mailSubject, text, html }),
      )
      .then(
        Mailing.enqueue({
          key: notification,
          recipient: email,
          subject: mailSubject,
          text,
          html,
          at,
        }).responds({ message }),
      ),
);

/** What current task and list presentation may this reader see behind this entry? */
export const theTaskNotificationPresentationOf = former(
  "the task notification presentation of (subject) of kind (kind) for (reader) at (at)",
  (
    { subject, kind, reader, at },
    { listTitle, list, title, details, startsAt, endsAt, state, assignee },
  ) =>
    where(
      whether(theListTitleBehind({ subject, kind, reader, at }).is({ title: listTitle })),
      whether(
        theTaskBehind({ subject, reader, at }).is({
          list,
          title,
          details,
          startsAt,
          endsAt,
          state,
          assignee,
        }),
      ),
    ).form({
      listTitle,
      list,
      task: form({ title, details, startsAt, endsAt, state, assignee }),
    }),
);

/**
 * What is this recipient's task inbox? An entry carries the same actor label its email
 * names, so the inbox and the mail about one event never disagree about who caused it.
 */
export const theTaskInboxOf = former(
  "the task inbox of (user) at (at)",
  ({ user, at }, { notification, kind, subject, link, actor, createdAt, read }) =>
    each(
      TaskNotifying._getInbox({ recipient: user }).is({
        notification,
        kind,
        subject,
        link,
        actor,
        createdAt,
        read,
      }),
    )
      .form({ notification, kind, subject, link, actor, createdAt, read })
      .splicing(whether(theTaskNotificationPresentationOf({ subject, kind, reader: user, at })))
      .splicing(whether(theActorPresentation({ actor }))),
);

export const ReadInbox = endpoint("/tasknotifications/inbox", ({ session, user, at }) =>
  receive({ session })
    .where(now(at), activeUser({ session }).is({ user }))
    .then(respond({ notifications: theTaskInboxOf({ user, at }) })),
);

export const UnreadCount = endpoint("/tasknotifications/unreadCount", ({ session, user, count }) =>
  receive({ session })
    .where(
      activeUser({ session }).is({ user }),
      TaskNotifying._getUnreadCount({ recipient: user }).is({ count }),
    )
    .then(respond({ count })),
);

export const MarkRead = endpoint(
  "/tasknotifications/markRead",
  ({ session, notification, user, marked }) =>
    receive({ session, notification })
      .where(activeUser({ session }).is({ user }))
      .then(
        TaskNotifying.markRead({ notification, recipient: user }).responds({
          notification: marked,
        }),
      )
      .then(respond({ notification: marked })),
);

export const MarkAllRead = endpoint(
  "/tasknotifications/markAllRead",
  ({ session, user, recipient }) =>
    receive({ session })
      .where(activeUser({ session }).is({ user }))
      .then(TaskNotifying.markAllRead({ recipient: user }).responds({ recipient }))
      .then(respond({ recipient })),
);

export const Dismiss = endpoint(
  "/tasknotifications/dismiss",
  ({ session, notification, user, dismissed }) =>
    receive({ session, notification })
      .where(activeUser({ session }).is({ user }))
      .then(
        TaskNotifying.dismiss({ notification, recipient: user }).responds({
          notification: dismissed,
        }),
      )
      .then(respond({ notification: dismissed })),
);
