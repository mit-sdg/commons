import { activeUser } from "../access/session.ts";
import { each, former, no, view, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts.ts";
import { conversationReader, postReader, postConversation } from "./audience-policy.ts";
const { Tracking } = concepts;

export const visibleUnread = view(
  "the unread items for (user) in (scope)",
  ({ user, scope }, { item }, _vars) =>
    where(
      conversationReader({ user, conversation: scope }),
      Tracking._getUnread({ user, scope }).is({ item }),
      postReader({ user, post: item }),
      postConversation({ post: item }).is({ conversation: scope }),
    ),
).many();
/** Which currently visible items remain unread? */
export const theUnreadOf = former("the unread of (user) in (scope)", ({ user, scope }, { item }) =>
  each(visibleUnread({ user, scope }).is({ item })).form({ item }),
);
/** How many currently visible items remain unread? */
export const theUnreadCount = former(
  "the unread count of (user) in (scope)",
  ({ user, scope }, { item }) => each(visibleUnread({ user, scope }).is({ item })).count(),
);
export const UnreadList = endpoint("/unread/list", ({ session, scope, user }) =>
  receive({ session, scope })
    .where(activeUser({ session }).is({ user }))
    .then(
      where(conversationReader({ user, conversation: scope }))
        .then(respond({ items: theUnreadOf({ user, scope }) }))
        .named("visible"),
      where(no(conversationReader({ user, conversation: scope })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("unavailable"),
    ),
);
export const UnreadCount = endpoint("/unread/count", ({ session, scope, user }) =>
  receive({ session, scope })
    .where(activeUser({ session }).is({ user }))
    .then(
      where(conversationReader({ user, conversation: scope }))
        .then(respond({ count: theUnreadCount({ user, scope }) }))
        .named("visible"),
      where(no(conversationReader({ user, conversation: scope })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("unavailable"),
    ),
);
export const MarkSeen = endpoint("/unread/markSeen", ({ session, item, user }) =>
  receive({ session, item })
    .where(activeUser({ session }).is({ user }))
    .then(
      where(postReader({ user, post: item }))
        .then(Tracking.markSeen({ user, item }))
        .then(respond({ item }))
        .named("seen"),
      where(no(postReader({ user, post: item })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("unavailable"),
    ),
);
export const MarkAllSeen = endpoint("/unread/markAllSeen", ({ session, scope, user, item }) =>
  receive({ session, scope })
    .where(activeUser({ session }).is({ user }), visibleUnread({ user, scope }).is({ item }))
    .then(Tracking.markSeen({ user, item })),
);
export const MarkAllSeenResult = endpoint("/unread/markAllSeen", ({ session, scope, user }) =>
  receive({ session, scope })
    .afterFlowSettles()
    .where(activeUser({ session }).is({ user }))
    .then(
      where(conversationReader({ user, conversation: scope }))
        .then(respond({ user }))
        .named("seen"),
      where(no(conversationReader({ user, conversation: scope })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("unavailable"),
    ),
);
