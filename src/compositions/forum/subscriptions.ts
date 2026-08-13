import { activeUser } from "../access/session.ts";
import { each, former, no, reaction, when, whether, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../vocabulary.ts";
import { thePostSummaryOf, theThreadStatsOf } from "./fragments.ts";
import { readableConversation } from "./threads.ts";

const { Conversing, Subscribing, Trashing, Timing } = concepts;

/** Which targets does this user follow? */
export const theSubscriptionsOf = former(
  "the subscriptions of (user)",
  ({ user }, { target, subscribedAt }) =>
    each(Subscribing._getSubscriptions({ user }).is({ target, subscribedAt }))
      .where(readableConversation({ conversation: target }))
      .form({
        target,
        subscribedAt,
      }),
);

/** Which users follow this target? */
export const theSubscribersOf = former("the subscribers of (target)", ({ target }, { user }) =>
  each(Subscribing._getSubscribers({ target }).is({ user }))
    .where(readableConversation({ conversation: target }))
    .form({ user }),
);

/** Which followed conversations should this user see? */
export const theWatchedThreadsOf = former(
  "the watched threads of (user)",
  ({ user }, { target, subscribedAt, rootItem, rootNode }) =>
    each(Subscribing._getSubscriptions({ user }).is({ target, subscribedAt }))
      .where(
        readableConversation({ conversation: target }),
        Conversing._getThread({ conversation: target }).is({
          node: rootNode,
          item: rootItem,
        }),
        no(Conversing._parentOf({ node: rootNode })),
      )
      .form({
        conversation: target,
        subscribedAt,
        post: whether(thePostSummaryOf({ item: rootItem })),
      })
      .splicing(whether(theThreadStatsOf({ conversation: target }))),
);

export const PurgeClearsConversationSubscriptions = reaction(({ item, node, conversation }) =>
  when(Trashing.purge({}).responds({ item }))
    .where(
      Conversing._getNodeByItem({ item }).is({ node }),
      Conversing._getConversation({ node }).is({ conversation }),
    )
    .then(Subscribing.clearTarget({ target: conversation })),
);

export const Subscribe = endpoint(
  "/subscriptions/subscribe",
  ({ session, target, user, at, subscription }) =>
    receive({ session, target }).then(
      where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        readableConversation({ conversation: target }),
      )
        .then(Subscribing.subscribe({ user, target, at }).responds({ subscription }))
        .then(respond({ subscription }))
        .named("success"),
      where(activeUser({ session }), no(readableConversation({ conversation: target })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);

export const Unsubscribe = endpoint(
  "/subscriptions/unsubscribe",
  ({ session, target, user, subscription }) =>
    receive({ session, target }).then(
      where(activeUser({ session }).is({ user }), readableConversation({ conversation: target }))
        .then(Subscribing.unsubscribe({ user, target }).responds({ subscription }))
        .then(respond({ subscription }))
        .named("success"),
      where(activeUser({ session }), no(readableConversation({ conversation: target })))
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
        readableConversation({ conversation: target }),
        Subscribing._isSubscribed({ user, target }).is({ subscribed }),
      )
        .then(respond({ subscribed }))
        .named("success"),
      where(activeUser({ session }), no(readableConversation({ conversation: target })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);

export const Subscribers = endpoint("/subscriptions/subscribers", ({ target }) =>
  receive({ target }).then(
    where(readableConversation({ conversation: target }))
      .then(respond({ subscribers: theSubscribersOf({ target }) }))
      .named("success"),
    where(no(readableConversation({ conversation: target })))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);
