import { activeUser } from "../access/session.ts";
import {
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
import { concepts } from "../../concepts/index.ts";

const {
  Authenticating,
  Conversing,
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
    ),
).many();

export const ReplyNotifiesParentAuthor = reaction(
  ({ item, parent, parentItem, parentAuthor, at }) =>
    when(Conversing.reply({ item, parent, at }).responds({}))
      .where(
        Conversing._getItem({ node: parent }).is({ item: parentItem }),
        Posting._getPost({ post: parentItem }).is({ author: parentAuthor }),
        Posting._getPost({ post: item }).is.not({ author: parentAuthor }),
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

export const RootMentionsNotify = reaction(({ item, mentioned, at }) =>
  when(Conversing.start({ item, at }).responds({}))
    .where(otherUsersMentionedIn({ post: item }).is({ user: mentioned }))
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
    ).form({ notification, kind, subject, link, createdAt, read }),
);

/** What post and public author identity present this notification? */
export const theNotificationPresentationOf = former(
  "the notification presentation of (item)",
  ({ item }, { author, content, createdAt, editedAt, username, displayName, avatar }) =>
    where(
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
      .form({ notification, kind, link, createdAt, read })
      .splicing(whether(theNotificationPresentationOf({ item: link }))),
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

export const UnreadCount = endpoint("/notifications/unreadCount", ({ session, user, count }) =>
  receive({ session })
    .where(
      activeUser({ session }).is({ user }),
      Notifying._getUnreadCount({ recipient: user }).is({ count }),
    )
    .then(respond({ count })),
);

export const MarkRead = endpoint(
  "/notifications/markRead",
  ({ session, notification, user, marked }) =>
    receive({ session, notification })
      .where(activeUser({ session }).is({ user }))
      .then(
        Notifying.markRead({ notification, recipient: user }).responds({ notification: marked }),
      )
      .then(respond({ notification: marked })),
);

export const MarkAllRead = endpoint("/notifications/markAllRead", ({ session, user, recipient }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }))
    .then(Notifying.markAllRead({ recipient: user }).responds({ recipient }))
    .then(respond({ recipient })),
);

export const Dismiss = endpoint(
  "/notifications/dismiss",
  ({ session, notification, user, dismissed }) =>
    receive({ session, notification })
      .where(activeUser({ session }).is({ user }))
      .then(
        Notifying.dismiss({ notification, recipient: user }).responds({ notification: dismissed }),
      )
      .then(respond({ notification: dismissed })),
);
