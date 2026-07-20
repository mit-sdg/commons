import { activeUser } from "../access/session.ts";
import { each, former, request } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts/index.ts";

const { Tracking } = concepts;

/** Which items are unread for this user in this scope? */
export const theUnreadOf = former("the unread of (user) in (scope)", ({ user, scope, item }) =>
  each(Tracking._getUnread({ user, scope }).is({ item })).form({ item }),
);

export const UnreadList = endpoint(
  "/unread/list",
  ({ session, scope, user }) =>
    receive({ session, scope })
      .where(activeUser({ session }).is({ user }))
      .then(respond({ items: theUnreadOf(user, scope) })),
  { input: { required: ["session", "scope"] } },
);

export const UnreadCount = endpoint(
  "/unread/count",
  ({ session, scope, user, count }) =>
    receive({ session, scope })
      .where(
        activeUser({ session }).is({ user }),
        Tracking._getUnreadCount({ user, scope }).is({ count }),
      )
      .then(respond({ count })),
  { input: { required: ["session", "scope"] } },
);

export const MarkSeen = endpoint(
  "/unread/markSeen",
  ({ session, item, user }) =>
    receive({ session, item })
      .where(activeUser({ session }).is({ user }))
      .then(request(Tracking.markSeen, { user, item }), respond({ item })),
  { input: { required: ["session", "item"] } },
);

export const MarkAllSeen = endpoint(
  "/unread/markAllSeen",
  ({ session, scope, user }) =>
    receive({ session, scope })
      .where(activeUser({ session }).is({ user }))
      .then(request(Tracking.markAllSeen, { user, scope }), respond({ user })),
  { input: { required: ["session", "scope"] } },
);
