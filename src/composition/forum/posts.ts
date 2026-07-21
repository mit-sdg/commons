import { activeUser } from "../access/session.ts";
import { each, former, no, reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { mayEditPost, mayNotEditPost } from "../access/policy.ts";
import { concepts } from "../../concepts/index.ts";
import { intact } from "./threads.ts";

const {
  Bookmarking,
  Conversing,
  Formatting,
  Linking,
  Pinning,
  Posting,
  Reacting,
  Tagging,
  Tracking,
  Trashing,
  Timing,
} = concepts;

export const readable = view("(post) is readable", ({ post }) =>
  where(Posting._getPost({ post }), Trashing._isTrashed({ item: post }).is({ trashed: false })),
);
export const notReadable = view("(post) is not readable", ({ post }) => [
  where(Trashing._isTrashed({ item: post }).is({ trashed: true })),
  where(no(Posting._getPost({ post }))),
]);
export const publicPostsBy = view(
  "the public posts by (author) with many (post)",
  ({ author, post }) =>
    where(Posting._getByAuthor({ author }).is({ post }), intact({ item: post })),
);
/** What is this post? */
export const thePost = former(
  "the post (post)",
  ({ post, author, content, createdAt, editedAt, rendered }) =>
    where(
      Posting._getPost({ post }).is({ author, content, createdAt, editedAt }),
      Formatting._getRendered({ target: post }).is({ rendered }),
    ).form({ author, content, createdAt, editedAt, rendered }),
);
/** Which public posts belong to this author? */
export const thePublicPostsOf = former("the public posts of (author)", ({ author, post }) =>
  each(publicPostsBy({ author }).is({ post })).form({ post }),
);

export const RenderEditedSource = reaction(({ content, post }) =>
  when(Posting.edit({ content }).responds({ post })).then(
    Formatting.setSource({ target: post, source: content }),
  ),
);

export const DeriveEditedLinks = reaction(({ content, post }) =>
  when(Posting.edit({ content }).responds({ post })).then(
    Linking.setLinksFrom({ source: post, content }),
  ),
);
export const DeleteClearsFormatting = reaction(({ post }) =>
  when(Posting.delete({}).responds({ post })).then(Formatting.clear({ target: post })),
);

export const DeleteClearsReactions = reaction(({ post }) =>
  when(Posting.delete({}).responds({ post })).then(Reacting.clearTarget({ target: post })),
);

export const DeleteClearsPins = reaction(({ post }) =>
  when(Posting.delete({}).responds({ post })).then(Pinning.clearItem({ item: post })),
);

export const DeleteClearsBookmarks = reaction(({ post }) =>
  when(Posting.delete({}).responds({ post })).then(Bookmarking.clearItem({ item: post })),
);

export const DeleteClearsTags = reaction(({ post }) =>
  when(Posting.delete({}).responds({ post })).then(Tagging.clearTarget({ target: post })),
);

export const DeleteUnregisters = reaction(({ post }) =>
  when(Posting.delete({}).responds({ post })).then(Tracking.unregister({ item: post })),
);

export const DeleteClearsLinks = reaction(({ post }) =>
  when(Posting.delete({}).responds({ post })).then(Linking.clearLinks({ source: post })),
);

export const DeleteClearsBacklinks = reaction(({ post }) =>
  when(Posting.delete({}).responds({ post })).then(Linking.clearBacklinks({ target: post })),
);

export const DeleteRemovesLeafNode = reaction(({ post, node }) =>
  when(Posting.delete({}).responds({ post }))
    .where(
      Conversing._getNodeByItem({ item: post }).is({ node }),
      Conversing._hasChildren({ node }).is({ present: false }),
    )
    .then(Conversing.remove({ node })),
);

export const GetPost = endpoint(
  "/posts/get",
  ({ post }) =>
    receive({ post })
      .where(readable({ post }))
      .then(respond({ post: thePost(post) })),
  { input: { required: ["post"] } },
);
export const GetPostNotFound = endpoint("/posts/get", ({ post }) =>
  receive({ post })
    .where(notReadable({ post }))
    .then(respond({ error: "NOT_FOUND" })),
);

export const PostsByAuthor = endpoint(
  "/posts/byAuthor",
  ({ author }) => receive({ author }).then(respond({ posts: thePublicPostsOf(author) })),
  { input: { required: ["author"] } },
);
export const EditPost = endpoint(
  "/posts/edit",
  ({ session, post, content, user, at }) =>
    receive({ session, post, content })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayEditPost({ user, post }),
      )
      .then(Posting.edit({ post, content, at }))
      .then(respond({ post })),
  { input: { required: ["session", "post", "content"] } },
);
export const EditTrashedPost = endpoint("/posts/edit", ({ session, post, content }) =>
  receive({ session, post, content })
    .where(activeUser({ session }), Trashing._isTrashed({ item: post }).is({ trashed: true }))
    .then(respond({ error: "NOT_FOUND" })),
);
export const EditPostForbidden = endpoint("/posts/edit", ({ session, post, content, user }) =>
  receive({ session, post, content })
    .where(activeUser({ session }).is({ user }), mayNotEditPost({ user, post }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const EditMissingPost = endpoint("/posts/edit", ({ session, post, content }) =>
  receive({ session, post, content })
    .where(activeUser({ session }), no(Posting._getPost({ post })))
    .then(respond({ error: "POST_NOT_FOUND" })),
);
export const DeletePost = endpoint(
  "/posts/delete",
  ({ session, post, user, node }) =>
    receive({ session, post }).then(
      where(
        activeUser({ session }).is({ user }),
        Posting._getPost({ post }),
        Trashing._isTrashed({ item: post }).is({ trashed: false }),
        Posting._getPost({ post }).is({ author: user }),
        Conversing._getNodeByItem({ item: post }).is({ node }),
        Conversing._hasChildren({ node }).is({ present: false }),
      )
        .then(Posting.delete({ post }))
        .then(respond({ post }))
        .named("case-1-1-1-1"),
      where(
        activeUser({ session }).is({ user }),
        Posting._getPost({ post }),
        Trashing._isTrashed({ item: post }).is({ trashed: false }),
        Posting._getPost({ post }).is({ author: user }),
        Conversing._getNodeByItem({ item: post }).is({ node }),
        Conversing._hasChildren({ node }).is({ present: true }),
      )
        .then(respond({ error: "POST_HAS_REPLIES" }))
        .named("case-1-1-1-2"),
      where(
        activeUser({ session }).is({ user }),
        Posting._getPost({ post }),
        Trashing._isTrashed({ item: post }).is({ trashed: false }),
        Posting._getPost({ post }).is.not({ author: user }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("case-1-1-2"),
      where(
        activeUser({ session }),
        Posting._getPost({ post }),
        Trashing._isTrashed({ item: post }).is({ trashed: true }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("case-1-2"),
      where(activeUser({ session }), no(Posting._getPost({ post })))
        .then(respond({ error: "POST_NOT_FOUND" }))
        .named("case-2"),
    ),
  { input: { required: ["session", "post"] } },
);
