import { activeUser } from "../access/session.ts";
import { each, form, former, no, reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../vocabulary.ts";

const { Conversing, Formatting, Locking, Posting, Tracking, Trashing, Timing } = concepts;

export const intact = view("(item) is intact", ({ item }, _outputs, _bindings) =>
  where(Trashing._isTrashed({ item }).is({ trashed: false })),
).holds();
export const readableConversation = view(
  "(conversation) is readable",
  ({ conversation }, _outputs, { node, item }) =>
    where(
      Conversing._getThread({ conversation }).is({ node, item }),
      no(Conversing._parentOf({ node })),
      Posting._getPost({ post: item }),
      intact({ item }),
    ),
).holds();
export const publicTarget = view("(target) is public", ({ target }, _outputs, _bindings) => [
  where(Posting._getPost({ post: target }), intact({ item: target })),
  where(readableConversation({ conversation: target })),
]).holds();
/** What is this conversation's thread? */
export const theThread = former(
  "the thread (conversation)",
  (
    { conversation },
    { node, item, parent, depth, author, content, createdAt, editedAt, rendered },
  ) =>
    each(Conversing._getThread({ conversation }).is({ node, item, parent, depth }))
      .where(
        intact({ item }),
        Posting._getPost({ post: item }).is({ author, content, createdAt, editedAt }),
        Formatting._getRendered({ target: item }).is({ rendered }),
      )
      .form({
        node,
        item,
        parent,
        depth,
        post: form({ author, content, createdAt, editedAt }),
        rendered,
      }),
);

/** Which conversation contains this item? */
export const placementOf = view(
  "the conversation placing (item)",
  ({ item }, { conversation }, { node }) =>
    where(
      Conversing._getNodeByItem({ item }).is({ node }),
      Posting._getPost({ post: item }),
      intact({ item }),
      Conversing._getConversation({ node }).is({ conversation }),
    ),
).optional();

export const TrackRootUnread = reaction(({ item, conversation }) =>
  when(Conversing.start({ item }).responds({ conversation })).then(
    Tracking.register({ item, scope: conversation }),
  ),
);

export const TrackReplyUnread = reaction(({ item, node, conversation }) =>
  when(Conversing.reply({ item }).responds({ node }))
    .where(Conversing._getConversation({ node }).is({ conversation }))
    .then(Tracking.register({ item, scope: conversation })),
);

export const CreateThread = endpoint(
  "/threads/create",
  ({ session, content, user, at, post, conversation, node }) =>
    receive({ session, content })
      .where(Timing._now({}).is({ at }), activeUser({ session }).is({ user }))
      .then(Posting.create({ author: user, content, at }).responds({ post }))
      .then(Conversing.start({ item: post, at }).responds({ conversation, node }))
      .then(respond({ post, conversation, node })),
);

export const ReplyToThread = endpoint(
  "/threads/reply",
  ({ session, parent, content, user, conversation, at, post, node }) =>
    receive({ session, parent, content }).then(
      where(
        activeUser({ session }).is({ user }),
        Conversing._getConversation({ node: parent }).is({ conversation }),
        Locking._isLocked({ target: conversation }).is({ locked: false }),
        Timing._now({}).is({ at }),
      )
        .then(Posting.create({ author: user, content, at }).responds({ post }))
        .then(Conversing.reply({ item: post, parent, at }).responds({ node }))
        .then(respond({ post, node }))
        .named("reply"),
      where(
        activeUser({ session }),
        Conversing._getConversation({ node: parent }).is({ conversation }),
        Locking._isLocked({ target: conversation }).is({ locked: true }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("locked"),
      where(activeUser({ session }), no(Conversing._getConversation({ node: parent })))
        .then(respond({ error: "PARENT_NODE_NOT_FOUND" }))
        .named("missing-parent"),
    ),
);

export const ForItem = endpoint("/threads/forItem", ({ item, conversation }) =>
  receive({ item }).then(
    where(placementOf({ item }).is({ conversation }))
      .then(respond({ conversation }))
      .named("found"),
    where(no(placementOf({ item })))
      .then(respond({ conversation: null }))
      .named("absent"),
  ),
);
