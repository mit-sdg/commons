import { postConversation, postReader, staff, usableUser } from "./audience-policy.ts";
import { activeUser } from "../access/session.ts";
import {
  compute,
  is,
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
  Assigning,
  Rostering,
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

/** Content admission is shared by inbox reads, actions, counts, and mail dispatch. */
export const notificationSubjectReader = view(
  "(user) may read notification subject (subject)",
  ({ user, subject }, _out, _vars) => [
    where(postReader({ user, post: subject })),
    where(
      usableUser({ user }),
      Rostering._isActiveStudent({ user }).is({ active: true }),
      Assigning._isAssigned({ assignment: subject, assignee: user }).is({ assigned: true }),
      Assigning._getAssignments({}).is({ assignment: subject, status: "PUBLISHED" }),
    ),
  ],
).holds();

export const assignmentNotificationTitle = view(
  "the notification title of (assignment)",
  ({ assignment }, { assignmentTitle }, _vars) =>
    where(
      Assigning._getAssignments({}).is({ assignment, title: assignmentTitle, status: "PUBLISHED" }),
    ),
).optional();

export const theAssignmentNotificationPresentation = former(
  "the assignment notification presentation of (assignment) for (user)",
  ({ assignment, user }, { assignmentTitle }) =>
    where(
      notificationSubjectReader({ user, subject: assignment }),
      assignmentNotificationTitle({ assignment }).is({ assignmentTitle }),
    ).form({ assignmentTitle }),
).optional();

export const PurgeClearsNotifications = reaction(({ item }) =>
  when(Trashing.purge({}).responds({ item })).then(Notifying.clearSubject({ subject: item })),
);

/** An unavailable opening is not a source of title text, even when replies survive. */
export const readableDiscussionOpening = view(
  "the readable opening of (conversation) for (reader)",
  ({ conversation, reader }, { content }, { item }) =>
    where(
      Conversing._getRoot({ conversation }).is({ item }),
      postReader({ user: reader, post: item }),
      Posting._getPost({ post: item }).is({ content }),
    ),
).optional();

export const notificationDiscussion = view(
  "the discussion context of (post) for (reader)",
  ({ post, reader }, { conversation, discussionTitle }, { content }) =>
    where(
      postReader({ user: reader, post }),
      postConversation({ post }).is({ conversation }),
      whether(readableDiscussionOpening({ conversation, reader }).is({ content })),
      compute(computations.notificationDiscussionTitle, { content }, discussionTitle),
    ),
).optional();

export const theDiscussionNotificationPresentation = former(
  "the discussion notification presentation of (post) for (reader)",
  ({ post, reader }, { conversation, discussionTitle }) =>
    where(notificationDiscussion({ post, reader }).is({ conversation, discussionTitle })).form({
      conversation,
      discussionTitle,
    }),
).optional();

export const notificationMailContext = view(
  "the email context of notification subject (subject) for (user)",
  ({ subject, user }, { title, url }, { conversation }) => [
    where(
      notificationDiscussion({ post: subject, reader: user }).is({
        conversation,
        discussionTitle: title,
      }),
      compute(computations.forumNotificationUrl, { conversation, post: subject }, url),
    ),
    where(
      notificationSubjectReader({ user, subject }),
      assignmentNotificationTitle({ assignment: subject }).is({ assignmentTitle: title }),
      compute(computations.assignmentNotificationUrl, { assignment: subject }, url),
    ),
  ],
).optional();

export const notificationMailPost = view(
  "the email post content and author of (post) for (reader)",
  ({ post, reader }, { content, authorName }, { author, username, displayName }) =>
    where(
      postReader({ user: reader, post }),
      Posting._getPost({ post }).is({ author, content }),
      Authenticating._getById({ user: author }).is({ username }),
      whether(Profiling._getProfileFields({ user: author }).is({ displayName })),
      compute(computations.notificationMailAuthor, { username, displayName }, authorName),
    ),
).optional();

export const NotificationQueuesEmail = reaction(
  ({
    notification,
    recipient,
    kind,
    subject,
    email,
    at,
    title,
    url,
    content,
    authorName,
    mailSubject,
    text,
    html,
    message,
    key,
  }) =>
    when(Notifying.notify({ recipient, kind, subject, at }).responds({ notification }))
      .where(
        notificationSubjectReader({ user: recipient, subject }),
        Authenticating._getById({ user: recipient }).is({ email }),
        compute(computations.forumMailKey, { notification, recipient, post: subject }, key),
        notificationMailContext({ subject, user: recipient }).is({ title, url }),
        whether(
          notificationMailPost({ post: subject, reader: recipient }).is({
            content,
            authorName,
          }),
        ),
        compute(computations.notificationMailSubject, { kind, title }, mailSubject),
        compute(computations.notificationMailText, { kind, title, url, content, authorName }, text),
        compute(computations.notificationMailHtml, { kind, title, url, content, authorName }, html),
      )
      .then(
        Mailing.enqueue({
          key,
          recipient: email,
          subject: mailSubject,
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
      notificationSubjectReader({ user, subject }),
      notificationSubjectReader({ user, subject: link }),
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
      .where(readableNotification({ notification, user }))
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
).optional();

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
      .splicing(whether(theNotificationPresentationOf({ item: link, reader: user })))
      .splicing(whether(theDiscussionNotificationPresentation({ post: link, reader: user })))
      .splicing(whether(theAssignmentNotificationPresentation({ assignment: link, user }))),
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
      notificationSubjectReader({ user: recipient, subject: post }),
      Authenticating._getById({ user: recipient }).is({ email: queued }),
    ).form({ recipient }),
).optional();

export const courseWideNotificationAudience = view(
  "(holders) include the whole course",
  ({ holders }, _out, _vars) => where(is.among("standing:everyone", holders)),
).holds();
export const staffNotificationRecipient = view(
  "(user) receives a staff notification for (holders)",
  ({ user, holders }, _out, _vars) =>
    where(
      is.among("standing:staff", holders),
      no(courseWideNotificationAudience({ holders })),
      staff({ user }),
    ),
).holds();

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
        no(staffNotificationRecipient({ user: recipient, holders })),
        now(at),
      )
      .then(Notifying.notify({ recipient, kind: "addressed", subject: item, link: item, at })),
);

export const RootNotifiesStaff = reaction(({ conversation, holders, recipient, node, item, at }) =>
  when(Accessing.establish({ resource: conversation, holders }).responds())
    .where(
      Authenticating._getUsers({}).is({ user: recipient }),
      staffNotificationRecipient({ user: recipient, holders }),
      Conversing._getThread({ conversation }).is({ node, item }),
      no(Conversing._parentOf({ node })),
      Posting._getPost({ post: item }).is.not({ author: recipient }),
      postReader({ user: recipient, post: item }),
      isNotMentionedIn({ user: recipient, post: item }),
      now(at),
    )
    .then(Notifying.notify({ recipient, kind: "staff_message", subject: item, link: item, at })),
);
