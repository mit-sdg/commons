import { activeUser } from "../access/session.ts";
import {
  each,
  form,
  former,
  no,
  reaction,
  request,
  view,
  when,
  where,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts/index.ts";

const { Conversing, Formatting, Linking, Locking, Posting, Tracking, Trashing, Timing } = concepts;

export const intact = view("(item) is intact", ({ item }) =>
  where(Trashing._isTrashed({ item }).is({ trashed: false })),
);
export const readableConversation = view(
  "(conversation) is readable",
  ({ conversation, node, item }) =>
    where(
      Conversing._getThread({ conversation }).is({ node, item }),
      no(Conversing._parentOf({ node })),
      Posting._getPost({ post: item }),
      intact({ item }),
    ),
);
export const publicTarget = view("(target) is public", ({ target }) => [
  where(Posting._getPost({ post: target }), intact({ item: target })),
  where(readableConversation({ conversation: target })),
]);
/** What is this conversation's thread? */
export const theThread = former(
  "the thread (conversation)",
  ({ conversation, node, item, parent, depth, author, content, createdAt, editedAt, rendered }) =>
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
  "the conversation placing (item) with optional (conversation)",
  ({ item, node, conversation }) =>
    where(
      Conversing._getNodeByItem({ item }).is({ node }),
      Posting._getPost({ post: item }),
      intact({ item }),
      Conversing._getConversation({ node }).is({ conversation }),
    ),
);

export const RenderPostSource = reaction(({ content, post }) =>
  when(Posting.create, { content }, { post }).then(
    request(Formatting.setSource, { target: post, source: content }),
  ),
);

export const DerivePostLinks = reaction(({ content, post }) =>
  when(Posting.create, { content }, { post }).then(
    request(Linking.setLinksFrom, { source: post, content }),
  ),
);

export const TrackRootUnread = reaction(({ item, conversation }) =>
  when(Conversing.start, { item }, { conversation }).then(
    request(Tracking.register, { item, scope: conversation }),
  ),
);

export const TrackReplyUnread = reaction(({ item, node, conversation }) =>
  when(Conversing.reply, { item }, { node })
    .where(Conversing._getConversation({ node }).is({ conversation }))
    .then(request(Tracking.register, { item, scope: conversation })),
);

export const CreateThread = endpoint(
  "/threads/create",
  ({ session, content, user, at, post, conversation, node }) =>
    receive({ session, content })
      .where(Timing._now({}).is({ at }), activeUser({ session }).is({ user }))
      .then(
        request(Posting.create, { author: user, content, at }, { post }),
        request(Conversing.start, { item: post, at }, { conversation, node }),
        respond({ post, conversation, node }),
      ),
);

export const ReplyToThread = endpoint(
  "/threads/reply",
  ({ session, parent, content, user, conversation, at, post, node }) =>
    receive({ session, parent, content })
      .where(activeUser({ session }).is({ user }))
      .either(
        where(Conversing._getConversation({ node: parent }).is({ conversation })).either(
          where(
            Locking._isLocked({ target: conversation }).is({ locked: false }),
            Timing._now({}).is({ at }),
          ).then(
            request(Posting.create, { author: user, content, at }, { post }),
            request(Conversing.reply, { item: post, parent, at }, { node }),
            respond({ post, node }),
          ),
          where(Locking._isLocked({ target: conversation }).is({ locked: true })).then(
            respond({ error: "FORBIDDEN" }),
          ),
        ),
        where(no(Conversing._getConversation({ node: parent }))).then(
          respond({ error: "PARENT_NODE_NOT_FOUND" }),
        ),
      ),
);

export const ForItem = endpoint("/threads/forItem", ({ item, conversation }) =>
  receive({ item }).either(
    where(placementOf({ item }).is({ conversation })).then(respond({ conversation })),
    where(no(placementOf({ item }))).then(respond({ conversation: null })),
  ),
);
