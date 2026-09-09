import { compute, each, former, is, no, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts, computations as c } from "../../concepts.ts";
import { activeUser } from "../access/session.ts";
import { conversationReader } from "./audience-policy.ts";
import { pinnable } from "./pins.ts";
import { readable } from "./posts.ts";

const { Bookmarking, Conversing, Linking, Pinning, Reacting } = concepts;

/** Which reaction choices and counts belong on this post? */
export const theReactionControls = former(
  "the reaction controls on (post) for (reader)",
  ({ post, reader }, { kind, count, mine }) =>
    each(Reacting._countByKind({ target: post }).is({ kind, count }))
      .where(Reacting._hasReacted({ reactor: reader, target: post, kind }).is({ hasReacted: mine }))
      .arranged(count, "descending")
      .form({ kind, count, mine }),
);

/** Which controls may this reader use on this conversation's post? */
export const thePostControls = former(
  "the controls of (post) in (conversation) for (reader)",
  ({ post, conversation, reader }, { saved, pinned, source, target }) =>
    where(
      pinnable({ item: post, scope: conversation, reader }),
      Bookmarking._isSaved({ user: reader, item: post }).is({ saved }),
      Pinning._isPinned({ item: post, scope: conversation }).is({ pinned }),
    ).form({
      saved,
      pinned,
      reactions: theReactionControls({ post, reader }),
      backlinks: each(Linking._getBacklinks({ target: post }).is({ source }))
        .where(readable({ post: source, reader }))
        .count(),
      forwardLinks: each(Linking._getLinks({ source: post }).is({ target }))
        .where(readable({ post: target, reader }))
        .count(),
    }),
).optional();

/** Which selected posts still have readable controls? */
export const theSelectedPostControls = former(
  "the controls selected by (posts) in (conversation) for (reader)",
  ({ posts, conversation, reader }, { post }) =>
    each(Conversing._getThread({ conversation }).is({ item: post }))
      .where(is.among(post, posts))
      .form({ post })
      .splicing(thePostControls({ post, conversation, reader })),
);

export const PostControls = endpoint(
  "/threads/post-controls",
  ({ session, conversation, posts, reader, valid }) =>
    receive({ session, conversation, posts })
      .where(activeUser({ session }), compute(c.validPostControlSelection, { posts }, valid))
      .then(
        where(is.among(valid, [false]))
          .then(respond({ error: "INVALID_REQUEST" }))
          .named("invalid"),
        where(
          is.among(valid, [true]),
          activeUser({ session }).is({ user: reader }),
          conversationReader({ conversation, user: reader }),
        )
          .then(respond({ posts: theSelectedPostControls({ posts, conversation, reader }) }))
          .named("visible"),
        where(
          is.among(valid, [true]),
          activeUser({ session }).is({ user: reader }),
          no(conversationReader({ conversation, user: reader })),
        )
          .then(respond({ error: "NOT_FOUND" }))
          .named("hidden"),
      ),
  { input: { required: ["session", "conversation", "posts"] } },
);
