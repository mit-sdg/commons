import { postReader } from "./audience-policy.ts";
import { activeUser } from "../access/session.ts";
import { each, former, no, reaction, view, when, where, now } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { mayEditPost, mayNotEditPost } from "../access/policy.ts";
import { concepts } from "../../concepts.ts";

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
} = concepts;

export const readable = view("(post) is readable", ({ post, reader }, _outputs, _bindings) =>
  where(postReader({ post, user: reader })),
).holds();
export const notReadable = view("(post) is not readable", ({ post, reader }, _outputs, _bindings) =>
  where(no(readable({ post, reader }))),
).holds();
export const publicPostsBy = view(
  "the public posts by (author)",
  ({ author, reader }, { post }, _bindings) =>
    where(Posting._getByAuthor({ author }).is({ post }), readable({ post, reader })),
).many();
/** What is this post? */
export const thePost = former(
  "the post (post)",
  ({ post, reader }, { author, content, createdAt, editedAt, rendered }) =>
    where(
      postReader({ post, user: reader }),
      Posting._getPost({ post }).is({ author, content, createdAt, editedAt }),
      Formatting._getRendered({ target: post }).is({ rendered }),
    ).form({ author, content, createdAt, editedAt, rendered }),
);
/** Which public posts belong to this author? */
export const thePublicPostsOf = former(
  "the public posts of (author)",
  ({ author, reader }, { post }) =>
    each(publicPostsBy({ author, reader }).is({ post })).form({ post }),
);

export const CreatedPostRefreshesDerivedContent = reaction(({ content, post }) =>
  when(Posting.create({ content }).responds({ post })).then(
    Formatting.setSource({ target: post, source: content }).named("render"),
    Linking.setLinksFrom({ source: post, content }).named("links"),
  ),
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
  ({ session, post, reader }) =>
    receive({ session, post })
      .where(activeUser({ session }).is({ user: reader }))
      .then(
        where(readable({ post, reader }))
          .then(respond({ post: thePost({ post, reader }) }))
          .named("success"),
        where(notReadable({ post, reader }))
          .then(respond({ error: "NOT_FOUND" }))
          .named("not-found"),
      ),
  { input: { required: ["session", "post"] } },
);

export const PostsByAuthor = endpoint(
  "/posts/byAuthor",
  ({ session, author, reader }) =>
    receive({ session, author })
      .where(activeUser({ session }).is({ user: reader }))
      .then(respond({ posts: thePublicPostsOf({ author, reader }) })),
  { input: { required: ["session", "author"] } },
);
export const EditPost = endpoint("/posts/edit", ({ session, post, content, user, at }) =>
  receive({ session, post, content }).then(
    where(
      now(at),
      activeUser({ session }).is({ user }),
      postReader({ user, post }),
      mayEditPost({ user, post }),
    )
      .then(Posting.edit({ post, content, at }))
      .then(respond({ post }))
      .named("edit"),
    where(
      activeUser({ session }).is({ user }),
      postReader({ user, post }),
      mayNotEditPost({ user, post }),
    )
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
    where(activeUser({ session }).is({ user }), no(postReader({ user, post })))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);
export const DeletePost = endpoint("/posts/delete", ({ session, post, user, node }) =>
  receive({ session, post }).then(
    where(
      activeUser({ session }).is({ user }),
      postReader({ user, post }),
      Posting._getPost({ post }).is({ author: user }),
      Conversing._getNodeByItem({ item: post }).is({ node }),
      Conversing._hasChildren({ node }).is({ present: false }),
    )
      .then(Posting.delete({ post }))
      .then(respond({ post }))
      .named("delete"),
    where(
      activeUser({ session }).is({ user }),
      postReader({ user, post }),
      Posting._getPost({ post }).is({ author: user }),
      Conversing._getNodeByItem({ item: post }).is({ node }),
      Conversing._hasChildren({ node }).is({ present: true }),
    )
      .then(respond({ error: "POST_HAS_REPLIES" }))
      .named("has-replies"),
    where(
      activeUser({ session }).is({ user }),
      postReader({ user, post }),
      Posting._getPost({ post }).is.not({ author: user }),
    )
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
    where(activeUser({ session }).is({ user }), no(postReader({ user, post })))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);
