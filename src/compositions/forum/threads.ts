import { createThreadInput } from "./audience-inputs.ts";
import { activeUser } from "../access/session.ts";
import {
  conversationReader,
  postReader,
  targetReader,
  addressedAudience,
  forumReader,
} from "./audience-policy.ts";
import {
  each,
  form,
  former,
  no,
  reaction,
  view,
  when,
  where,
  now,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts.ts";

const { Accessing, Locking, Conversing, Formatting, Posting, Tracking, Trashing } = concepts;

export const intact = view("(item) is intact", ({ item }, _outputs, _bindings) =>
  where(Trashing._isTrashed({ item }).is({ trashed: false })),
).holds();
export const forumPost = view(
  "(post) belongs to a forum conversation",
  ({ post }, _outputs, { node }) =>
    where(
      Posting._getPost({ post }),
      Conversing._getNodeByItem({ item: post }).is({ node }),
      Conversing._getConversation({ node }),
    ),
).holds();
export const readableConversation = view(
  "(conversation) is readable by (reader)",
  ({ conversation, reader }, _out, _vars) =>
    where(conversationReader({ conversation, user: reader })),
).holds();
export const publicTarget = view(
  "(target) is readable by (reader)",
  ({ target, reader }, _out, _vars) => where(targetReader({ target, user: reader })),
).holds();
/** What is this conversation's thread? */
export const theThread = former(
  "the thread (conversation) for (reader)",
  (
    { conversation, reader },
    { node, item, parent, depth, author, content, createdAt, editedAt, rendered },
  ) =>
    each(Conversing._getThread({ conversation }).is({ node, item, parent, depth }))
      .where(
        postReader({ user: reader, post: item }),
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
  "the conversation placing (item) for (reader)",
  ({ item, reader }, { conversation }, { node }) =>
    where(
      Conversing._getNodeByItem({ item }).is({ node }),
      postReader({ user: reader, post: item }),
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

export const ForItem = endpoint("/threads/forItem", ({ session, item, reader, conversation }) =>
  receive({ session, item })
    .where(activeUser({ session }).is({ user: reader }))
    .then(
      where(placementOf({ item, reader }).is({ conversation }))
        .then(respond({ conversation }))
        .named("found"),
      where(no(placementOf({ item, reader })))
        .then(respond({ conversation: null }))
        .named("absent"),
    ),
);

export const CreateThread = endpoint(
  "/threads/create",
  ({ session, content, holders, user, at, post, conversation, node }) =>
    receive({ session, content, holders })
      .where(now(at), forumReader({ session }).is({ user }), addressedAudience({ user, holders }))
      .then(Posting.create({ author: user, content, at }).responds({ post }))
      .then(Conversing.start({ item: post, at }).responds({ conversation, node }))
      .then(Accessing.establish({ resource: conversation, holders }))
      .then(respond({ post, conversation, node })),
  { validators: { input: createThreadInput } },
);
export const CreateThreadDenied = endpoint(
  "/threads/create",
  ({ session, content, holders, user }) =>
    receive({ session, content, holders })
      .where(forumReader({ session }).is({ user }), no(addressedAudience({ user, holders })))
      .then(respond({ error: "FORBIDDEN" })),
);
export const replyParent = view(
  "the readable parent (parent) for (user)",
  ({ parent, user }, { conversation }, { item }) =>
    where(
      Conversing._getItem({ node: parent }).is({ item }),
      postReader({ user, post: item }),
      Conversing._getConversation({ node: parent }).is({ conversation }),
    ),
).optional();
export const ReplyToThread = endpoint(
  "/threads/reply",
  ({ session, parent, content, user, conversation, at, post, node }) =>
    receive({ session, parent, content }).then(
      where(
        forumReader({ session }).is({ user }),
        replyParent({ parent, user }).is({ conversation }),
        Locking._isLocked({ target: conversation }).is({ locked: false }),
        now(at),
      )
        .then(Posting.create({ author: user, content, at }).responds({ post }))
        .then(Conversing.reply({ item: post, parent, at }).responds({ node }))
        .then(respond({ post, node }))
        .named("reply"),
      where(
        forumReader({ session }).is({ user }),
        replyParent({ parent, user }).is({ conversation }),
        Locking._isLocked({ target: conversation }).is({ locked: true }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("locked"),
      where(forumReader({ session }).is({ user }), no(replyParent({ parent, user })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing-parent"),
    ),
);
