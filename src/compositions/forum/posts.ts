import { activeUser } from "../access/session.ts";
import { each, former, no, reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { mayEditPost, mayNotEditPost } from "../access/policy.ts";
import { concepts } from "../../vocabulary.ts";
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

export const readable = view("(post) is readable", ({ post }, _outputs, _bindings) =>
  where(Posting._getPost({ post }), Trashing._isTrashed({ item: post }).is({ trashed: false })),
).holds();
export const notReadable = view("(post) is not readable", ({ post }, _outputs, _bindings) => [
  where(Trashing._isTrashed({ item: post }).is({ trashed: true })),
  where(no(Posting._getPost({ post }))),
]).holds();
export const publicPostsBy = view(
  "the public posts by (author)",
  ({ author }, { post }, _bindings) =>
    where(Posting._getByAuthor({ author }).is({ post }), intact({ item: post })),
).many();
/** What is this post? */
export const thePost = former(
  "the post (post)",
  ({ post }, { author, content, createdAt, editedAt, rendered }) =>
    where(
      Posting._getPost({ post }).is({ author, content, createdAt, editedAt }),
      Formatting._getRendered({ target: post }).is({ rendered }),
    ).form({ author, content, createdAt, editedAt, rendered }),
);
/** Which public posts belong to this author? */
export const thePublicPostsOf = former("the public posts of (author)", ({ author }, { post }) =>
  each(publicPostsBy({ author }).is({ post })).form({ post }),
);

export const EditedPostRefreshesDerivedContent = reaction(({ content, post }) =>
  when(Posting.edit({ content }).responds({ post })).then(
    Formatting.setSource({ target: post, source: content }).named("render"),
    Linking.setLinksFrom({ source: post, content }).named("links"),
  ),
);

export const DeletedPostClearsSatellites = reaction(({ post, node }) =>
  when(Posting.delete({}).responds({ post })).then(
    Formatting.clear({ target: post }).named("formatting"),
    Reacting.clearTarget({ target: post }).named("reactions"),
    Pinning.clearItem({ item: post }).named("pins"),
    Bookmarking.clearItem({ item: post }).named("bookmarks"),
    Tagging.clearTarget({ target: post }).named("tags"),
    Tracking.unregister({ item: post }).named("tracking"),
    Linking.clearLinks({ source: post }).named("links"),
    Linking.clearBacklinks({ target: post }).named("backlinks"),
    where(
      Conversing._getNodeByItem({ item: post }).is({ node }),
      Conversing._hasChildren({ node }).is({ present: false }),
    )
      .then(Conversing.remove({ node }))
      .named("leaf-node"),
  ),
);

export const GetPost = endpoint(
  "/posts/get",
  ({ post }) =>
    receive({ post }).then(
      where(readable({ post }))
        .then(respond({ post: thePost({ post }) }))
        .named("success"),
      where(notReadable({ post }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("not-found"),
    ),
  { input: { required: ["post"] } },
);

export const PostsByAuthor = endpoint(
  "/posts/byAuthor",
  ({ author }) => receive({ author }).then(respond({ posts: thePublicPostsOf({ author }) })),
  { input: { required: ["author"] } },
);
export const EditPost = endpoint(
  "/posts/edit",
  ({ session, post, content, user, at }) =>
    receive({ session, post, content }).then(
      where(activeUser({ session }), no(Posting._getPost({ post })))
        .then(respond({ error: "POST_NOT_FOUND" }))
        .named("missing-post"),
      where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayEditPost({ user, post }),
      )
        .then(Posting.edit({ post, content, at }))
        .then(respond({ post }))
        .named("post"),
      where(activeUser({ session }), Trashing._isTrashed({ item: post }).is({ trashed: true }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("trashed-post"),
      where(activeUser({ session }).is({ user }), mayNotEditPost({ user, post }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("post-forbidden"),
    ),
  { input: { required: ["session", "post", "content"] } },
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
        .named("delete"),
      where(
        activeUser({ session }).is({ user }),
        Posting._getPost({ post }),
        Trashing._isTrashed({ item: post }).is({ trashed: false }),
        Posting._getPost({ post }).is({ author: user }),
        Conversing._getNodeByItem({ item: post }).is({ node }),
        Conversing._hasChildren({ node }).is({ present: true }),
      )
        .then(respond({ error: "POST_HAS_REPLIES" }))
        .named("has-replies"),
      where(
        activeUser({ session }).is({ user }),
        Posting._getPost({ post }),
        Trashing._isTrashed({ item: post }).is({ trashed: false }),
        Posting._getPost({ post }).is.not({ author: user }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(
        activeUser({ session }),
        Posting._getPost({ post }),
        Trashing._isTrashed({ item: post }).is({ trashed: true }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("trashed"),
      where(activeUser({ session }), no(Posting._getPost({ post })))
        .then(respond({ error: "POST_NOT_FOUND" }))
        .named("missing"),
    ),
  { input: { required: ["session", "post"] } },
);
