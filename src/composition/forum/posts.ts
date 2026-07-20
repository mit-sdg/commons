import { activeUser } from "../access/session.ts";
import {
  each,
  former,
  no,
  reaction,
  request,
  view,
  when,
  where,
} from "@mit-sdg/sync-engine/language";
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
  when(Posting.edit, { content }, { post }).then(
    request(Formatting.setSource, { target: post, source: content }),
  ),
);

export const DeriveEditedLinks = reaction(({ content, post }) =>
  when(Posting.edit, { content }, { post }).then(
    request(Linking.setLinksFrom, { source: post, content }),
  ),
);
export const DeleteClearsFormatting = reaction(({ post }) =>
  when(Posting.delete, {}, { post }).then(request(Formatting.clear, { target: post })),
);

export const DeleteClearsReactions = reaction(({ post }) =>
  when(Posting.delete, {}, { post }).then(request(Reacting.clearTarget, { target: post })),
);

export const DeleteClearsPins = reaction(({ post }) =>
  when(Posting.delete, {}, { post }).then(request(Pinning.clearItem, { item: post })),
);

export const DeleteClearsBookmarks = reaction(({ post }) =>
  when(Posting.delete, {}, { post }).then(request(Bookmarking.clearItem, { item: post })),
);

export const DeleteClearsTags = reaction(({ post }) =>
  when(Posting.delete, {}, { post }).then(request(Tagging.clearTarget, { target: post })),
);

export const DeleteUnregisters = reaction(({ post }) =>
  when(Posting.delete, {}, { post }).then(request(Tracking.unregister, { item: post })),
);

export const DeleteClearsLinks = reaction(({ post }) =>
  when(Posting.delete, {}, { post }).then(request(Linking.clearLinks, { source: post })),
);

export const DeleteClearsBacklinks = reaction(({ post }) =>
  when(Posting.delete, {}, { post }).then(request(Linking.clearBacklinks, { target: post })),
);

export const DeleteRemovesLeafNode = reaction(({ post, node }) =>
  when(Posting.delete, {}, { post })
    .where(
      Conversing._getNodeByItem({ item: post }).is({ node }),
      Conversing._hasChildren({ node }).is({ present: false }),
    )
    .then(request(Conversing.remove, { node })),
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
      .then(request(Posting.edit, { post, content, at }), respond({ post })),
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
    receive({ session, post })
      .where(activeUser({ session }).is({ user }))
      .either(
        where(Posting._getPost({ post })).either(
          where(Trashing._isTrashed({ item: post }).is({ trashed: false })).either(
            where(
              Posting._getPost({ post }).is({ author: user }),
              Conversing._getNodeByItem({ item: post }).is({ node }),
            ).either(
              where(Conversing._hasChildren({ node }).is({ present: false })).then(
                request(Posting.delete, { post }),
                respond({ post }),
              ),
              where(Conversing._hasChildren({ node }).is({ present: true })).then(
                respond({ error: "POST_HAS_REPLIES" }),
              ),
            ),
            where(Posting._getPost({ post }).is.not({ author: user })).then(
              respond({ error: "FORBIDDEN" }),
            ),
          ),
          where(Trashing._isTrashed({ item: post }).is({ trashed: true })).then(
            respond({ error: "NOT_FOUND" }),
          ),
        ),
        where(no(Posting._getPost({ post }))).then(respond({ error: "POST_NOT_FOUND" })),
      ),
  { input: { required: ["session", "post"] } },
);
