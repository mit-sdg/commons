import { postReader } from "./audience-policy.ts";
import { activeUser } from "../access/session.ts";
import {
  compute,
  no,
  now,
  each,
  form,
  former,
  reaction,
  view,
  when,
  where,
  whether,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { computations, concepts } from "../../concepts.ts";

const {
  Accessing,
  Authenticating,
  Conversing,
  Mailing,
  Notifying,
  Posting,
  Profiling,
  Resolving,
  Subscribing,
  Trashing,
} = concepts;

export const PurgeClearsNotifications = reaction(({ item }) =>
  when(Trashing.purge({}).responds({ item })).then(Notifying.clearSubject({ subject: item })),
);

export const NotificationQueuesEmail = reaction(
  ({ notification, recipient, kind, subject, email, at, text, html, message, key }) =>
    when(Notifying.notify({ recipient, kind, subject, at }).responds({ notification }))
      .where(
        postReader({ user: recipient, post: subject }),
        Authenticating._getById({ user: recipient }).is({ email }),
        compute(computations.forumMailKey, { notification, recipient, post: subject }, key),
        compute(computations.notificationMailText, { notification }, text),
        compute(computations.notificationMailHtml, { notification }, html),
      )
      .then(
        Mailing.enqueue({
          key,
          recipient: email,
          subject: "New Commons notification",
          text,
          html,
          at,
        }).responds({ message }),
      ),
);

export const isNotMentionedIn = view(
  "(user) is not mentioned in (post)",
  ({ user, post }, _outputs, { username }) =>
    where(
      Authenticating._getById({ user }).is({ username }),
      Posting._isMentioned({ post, handle: username }).is({ mentioned: false }),
    ),
).holds();
export const isNotYetNotifiedAbout = view(
  "(user) is not yet notified about (subject)",
  ({ user, subject }, _outputs, _bindings) =>
    where(Notifying._hasFor({ user, subject }).is({ notified: false })),
).holds();
export const otherUsersMentionedIn = view(
  "the other users mentioned in (post)",
  ({ post }, { user }, { handle }) =>
    where(
      Posting._getMentions({ post }).is({ handle }),
      Authenticating._getByUsername({ username: handle }).is({ user }),
      Posting._getPost({ post }).is.not({ author: user }),
      postReader({ user, post }),
    ),
).many();

export const ReplyNotifiesParentAuthor = reaction(
  ({ item, parent, parentItem, parentAuthor, at }) =>
    when(Conversing.reply({ item, parent, at }).responds({}))
      .where(
        Conversing._getItem({ node: parent }).is({ item: parentItem }),
        Posting._getPost({ post: parentItem }).is({ author: parentAuthor }),
        Posting._getPost({ post: item }).is.not({ author: parentAuthor }),
        postReader({ user: parentAuthor, post: item }),
      )
      .then(
        Notifying.notify({
          recipient: parentAuthor,
          kind: "reply",
          subject: item,
          link: item,
          at,
        }),
      ),
);

export const ReplyNotifiesWatchers = reaction(
  ({ item, parent, conversation, subscriber, parentItem, at }) =>
    when(Conversing.reply({ item, parent, at }).responds({}))
      .where(
        Conversing._getConversation({ node: parent }).is({ conversation }),
        Subscribing._getSubscribers({ target: conversation }).is({ user: subscriber }),
        Posting._getPost({ post: item }).is.not({ author: subscriber }),
        Conversing._getItem({ node: parent }).is({ item: parentItem }),
        Posting._getPost({ post: parentItem }).is.not({ author: subscriber }),
        isNotMentionedIn({ user: subscriber, post: item }),
        postReader({ user: subscriber, post: item }),
      )
      .then(
        Notifying.notify({
          recipient: subscriber,
          kind: "followed_reply",
          subject: item,
          link: item,
          at,
        }),
      ),
);

export const RootMentionsNotify = reaction(({ conversation, node, item, mentioned, at }) =>
  when(Accessing.establish({ resource: conversation }).responds())
    .where(
      Conversing._getThread({ conversation }).is({ node, item }),
      no(Conversing._parentOf({ node })),
      otherUsersMentionedIn({ post: item }).is({ user: mentioned }),
      now(at),
    )
    .then(
      Notifying.notify({
        recipient: mentioned,
        kind: "mention",
        subject: item,
        link: item,
        at,
      }),
    ),
);

export const ReplyMentionsNotify = reaction(({ item, parent, mentioned, parentItem, at }) =>
  when(Conversing.reply({ item, parent, at }).responds({}))
    .where(
      otherUsersMentionedIn({ post: item }).is({ user: mentioned }),
      Conversing._getItem({ node: parent }).is({ item: parentItem }),
      Posting._getPost({ post: parentItem }).is.not({ author: mentioned }),
    )
    .then(
      Notifying.notify({
        recipient: mentioned,
        kind: "mention",
        subject: item,
        link: item,
        at,
      }),
    ),
);

export const EditMentionsNotify = reaction(({ post, mentioned, at }) =>
  when(Posting.edit({ at }).responds({ post }))
    .where(
      otherUsersMentionedIn({ post }).is({ user: mentioned }),
      isNotYetNotifiedAbout({ user: mentioned, subject: post }),
    )
    .then(
      Notifying.notify({
        recipient: mentioned,
        kind: "mention",
        subject: post,
        link: post,
        at,
      }),
    ),
);

export const AcceptNotifiesAnswerAuthor = reaction(({ answer, by, answerAuthor, at }) =>
  when(Resolving.accept({ answer, by, at }).responds({}))
    .where(
      Posting._getPost({ post: answer }).is({ author: answerAuthor }),
      Posting._getPost({ post: answer }).is.not({ author: by }),
      postReader({ user: answerAuthor, post: answer }),
    )
    .then(
      Notifying.notify({
        recipient: answerAuthor,
        kind: "accepted",
        subject: answer,
        link: answer,
        at,
      }),
    ),
);

export const readableNotification = view(
  "(notification) is available to (user)",
  ({ notification, user }, _out, { subject, link }) =>
    where(
      Notifying._getInbox({ recipient: user }).is({ notification, subject, link }),
      postReader({ user, post: subject }),
      postReader({ user, post: link }),
    ),
).holds();
/** Which notifications belong to this recipient? */
export const theNotificationsOf = former(
  "the notifications of (user)",
  ({ user }, { notification, kind, subject, link, createdAt, read }) =>
    each(
      Notifying._getInbox({ recipient: user }).is({
        notification,
        kind,
        subject,
        link,
        createdAt,
        read,
      }),
    )
      .where(postReader({ user, post: subject }), postReader({ user, post: link }))
      .form({ notification, kind, subject, link, createdAt, read }),
);

/** What post and public author identity present this notification? */
export const theNotificationPresentationOf = former(
  "the notification presentation of (item)",
  ({ item, reader }, { author, content, createdAt, editedAt, username, displayName, avatar }) =>
    where(
      postReader({ user: reader, post: item }),
      Posting._getPost({ post: item }).is({ author, content, createdAt, editedAt }),
      Authenticating._getById({ user: author }).is({ username }),
      whether(Profiling._getProfileFields({ user: author }).is({ displayName, avatar })),
    ).form({
      post: form({ author, content, createdAt, editedAt }),
      actor: form({ user: author, username, displayName, avatar }),
    }),
);

/** What is this recipient's notification inbox? */
export const theInboxOf = former(
  "the inbox of (user)",
  ({ user }, { notification, kind, link, createdAt, read }) =>
    each(
      Notifying._getInbox({ recipient: user }).is({
        notification,
        kind,
        link,
        createdAt,
        read,
      }),
    )
      .where(readableNotification({ notification, user }))
      .form({ notification, kind, link, createdAt, read })
      .splicing(whether(theNotificationPresentationOf({ item: link, reader: user }))),
);

export const ListNotifications = endpoint("/notifications/list", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }))
    .then(respond({ notifications: theNotificationsOf({ user }) })),
);

export const ReadInbox = endpoint("/notifications/inbox", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }))
    .then(respond({ notifications: theInboxOf({ user }) })),
);

export const theUnreadCount = former(
  "the visible unread notifications of (user)",
  ({ user }, { notification }) =>
    each(Notifying._getInbox({ recipient: user }).is({ notification, read: false }))
      .where(readableNotification({ user, notification }))
      .count(),
);
export const UnreadCount = endpoint("/notifications/unreadCount", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }))
    .then(respond({ count: theUnreadCount({ user }) })),
);
export const MarkRead = endpoint(
  "/notifications/markRead",
  ({ session, notification, user, marked }) =>
    receive({ session, notification })
      .where(activeUser({ session }).is({ user }))
      .then(
        where(readableNotification({ notification, user }))
          .then(
            Notifying.markRead({ notification, recipient: user }).responds({
              notification: marked,
            }),
          )
          .then(respond({ notification: marked }))
          .named("read"),
        where(no(readableNotification({ notification, user })))
          .then(respond({ error: "NOT_FOUND" }))
          .named("hidden"),
      ),
);
export const MarkAllRead = endpoint(
  "/notifications/markAllRead",
  ({ session, user, notification }) =>
    receive({ session })
      .where(activeUser({ session }).is({ user }))
      .then(
        where(
          Notifying._getInbox({ recipient: user }).is({ notification, read: false }),
          readableNotification({ notification, user }),
        )
          .then(Notifying.markRead({ notification, recipient: user }))
          .named("visible"),
        respond({ recipient: user }).named("answer"),
      ),
);
export const Dismiss = endpoint(
  "/notifications/dismiss",
  ({ session, notification, user, dismissed }) =>
    receive({ session, notification })
      .where(activeUser({ session }).is({ user }))
      .then(
        where(readableNotification({ notification, user }))
          .then(
            Notifying.dismiss({ notification, recipient: user }).responds({
              notification: dismissed,
            }),
          )
          .then(respond({ notification: dismissed }))
          .named("dismiss"),
        where(no(readableNotification({ notification, user })))
          .then(respond({ error: "NOT_FOUND" }))
          .named("hidden"),
      ),
);
export const theMailEligibility = former(
  "the current mail eligibility of (recipient) for (post) at (queued)",
  ({ recipient, post, queued }, _vars) =>
    where(
      postReader({ user: recipient, post }),
      Authenticating._getById({ user: recipient }).is({ email: queued }),
    ).form({ recipient }),
).optional();

export const RootNotifiesAddressedAccounts = reaction(
  ({ conversation, holders, users, recipient, node, item, at }) =>
    when(Accessing.establish({ resource: conversation, holders }).responds())
      .where(
        compute(computations.selectedIdentities, { holders, kind: "account" }, users),
        Authenticating._selectedUsers({ users }).is({ user: recipient }),
        Conversing._getThread({ conversation }).is({ node, item }),
        no(Conversing._parentOf({ node })),
        Posting._getPost({ post: item }).is.not({ author: recipient }),
        postReader({ user: recipient, post: item }),
        isNotMentionedIn({ user: recipient, post: item }),
        now(at),
      )
      .then(Notifying.notify({ recipient, kind: "addressed", subject: item, link: item, at })),
);
