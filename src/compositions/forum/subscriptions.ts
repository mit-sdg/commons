import { conversationReader } from "./audience-policy.ts";
import { activeUser } from "../access/session.ts";
import {
  each,
  former,
  no,
  reaction,
  when,
  whether,
  where,
  now,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts.ts";
import { thePostSummaryOf, theThreadStatsOf } from "./fragments.ts";
import { readableConversation } from "./threads.ts";

const { Accessing, Conversing, Posting, Subscribing, Trashing } = concepts;

/** Which targets does this user follow? */
export const theSubscriptionsOf = former(
  "the subscriptions of (user)",
  ({ user }, { target, subscribedAt }) =>
    each(Subscribing._getSubscriptions({ user }).is({ target, subscribedAt }))
      .where(readableConversation({ conversation: target, reader: user }))
      .form({
        target,
        subscribedAt,
      }),
);

/** Which users follow this target? */
export const theSubscribersOf = former(
  "the subscribers of (target) for (reader)",
  ({ target, reader }, { user }) =>
    each(Subscribing._getSubscribers({ target }).is({ user }))
      .where(readableConversation({ conversation: target, reader }))
      .form({ user }),
);

/** Which followed conversations should this user see? */
export const theWatchedThreadsOf = former(
  "the watched threads of (user)",
  ({ user }, { target, subscribedAt, rootItem, rootNode }) =>
    each(Subscribing._getSubscriptions({ user }).is({ target, subscribedAt }))
      .where(
        readableConversation({ conversation: target, reader: user }),
        Conversing._getThread({ conversation: target }).is({
          node: rootNode,
          item: rootItem,
        }),
        no(Conversing._parentOf({ node: rootNode })),
      )
      .form({
        conversation: target,
        subscribedAt,
        post: whether(thePostSummaryOf({ item: rootItem, reader: user })),
      })
      .splicing(whether(theThreadStatsOf({ conversation: target, reader: user }))),
);

export const Subscribe = endpoint(
  "/subscriptions/subscribe",
  ({ session, target, user, at, subscription }) =>
    receive({ session, target }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        readableConversation({ conversation: target, reader: user }),
      )
        .then(Subscribing.subscribe({ user, target, at }).responds({ subscription }))
        .then(respond({ subscription }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        no(readableConversation({ conversation: target, reader: user })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);

export const Unsubscribe = endpoint(
  "/subscriptions/unsubscribe",
  ({ session, target, user, subscription }) =>
    receive({ session, target }).then(
      where(
        activeUser({ session }).is({ user }),
        readableConversation({ conversation: target, reader: user }),
      )
        .then(Subscribing.unsubscribe({ user, target }).responds({ subscription }))
        .then(respond({ subscription }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        no(readableConversation({ conversation: target, reader: user })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);

export const MySubscriptions = endpoint("/subscriptions/mine", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }))
    .then(respond({ subscriptions: theSubscriptionsOf({ user }) })),
);

export const IsSubscribed = endpoint(
  "/subscriptions/isSubscribed",
  ({ session, target, user, subscribed }) =>
    receive({ session, target }).then(
      where(
        activeUser({ session }).is({ user }),
        readableConversation({ conversation: target, reader: user }),
        Subscribing._isSubscribed({ user, target }).is({ subscribed }),
      )
        .then(respond({ subscribed }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        no(readableConversation({ conversation: target, reader: user })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);

export const Subscribers = endpoint("/subscriptions/subscribers", ({ session, target, reader }) =>
  receive({ session, target })
    .where(activeUser({ session }).is({ user: reader }))
    .then(
      where(readableConversation({ conversation: target, reader }))
        .then(respond({ subscribers: theSubscribersOf({ target, reader }) }))
        .named("success"),
      where(no(readableConversation({ conversation: target, reader })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);

export const PurgeClearsConversationSubscriptions = reaction(({ item, node, conversation }) =>
  when(Trashing.purge({}).responds({ item }))
    .where(
      Conversing._getNodeByItem({ item }).is({ node }),
      no(Conversing._parentOf({ node })),
      Conversing._hasChildren({ node }).is({ present: false }),
      Conversing._getConversation({ node }).is({ conversation }),
    )
    .then(Subscribing.clearTarget({ target: conversation })),
);

export const StartingFollowsConversation = reaction(({ resource, user, item, at }) =>
  when(Accessing.establish({ resource }).responds())
    .where(
      Conversing._getConversations({}).is({ conversation: resource, item }),
      Posting._getPost({ post: item }).is({ author: user, createdAt: at }),
      conversationReader({ user, conversation: resource }),
      Subscribing._isSubscribed({ user, target: resource }).is({ subscribed: false }),
    )
    .then(Subscribing.subscribe({ user, target: resource, at })),
);
