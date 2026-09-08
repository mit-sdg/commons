import { former, view, where, whether, compute } from "@mit-sdg/sync-engine/language";
import { concepts, computations as c } from "../../concepts.ts";
import { conversationPosts, postReader } from "./audience-policy.ts";

const { Authenticating, Posting, Profiling, Trashing } = concepts;

/** What profile face belongs to this user? */
export const theProfileFaceOf = former(
  "the profile face of (user)",
  ({ user }, { displayName, bio, avatar }) =>
    where(Profiling._getProfileFields({ user }).is({ displayName, bio, avatar })).form({
      displayName,
      bio,
      avatar,
    }),
).optional();

/**
 * The private tier of a profile still reports an address, but a profile no
 * longer stores one: Authenticating holds a person's email for the account, and
 * this read joins it to the profile face as it forms its answer, so Commons
 * keeps one address per account and no second copy to reconcile.
 */
export const thePrivateProfileOf = former(
  "the private profile of (user)",
  ({ user }, { displayName, bio, avatar, email }) =>
    where(
      Profiling._getProfileFields({ user }).is({ displayName, bio, avatar }),
      Authenticating._getById({ user }).is({ email }),
    ).form({
      displayName,
      bio,
      avatar,
      email,
    }),
).optional();

/** What summary describes this post? */
export const thePostSummaryOf = former(
  "the post summary of (item) for (reader)",
  ({ item, reader }, { author, content, createdAt, editedAt }) =>
    where(
      postReader({ user: reader, post: item }),
      Posting._getPost({ post: item }).is({ author, content, createdAt, editedAt }),
    ).form({
      author,
      content,
      createdAt,
      editedAt,
    }),
).optional();

const statisticsInputs = view(
  "the available inputs for statistics of (conversation) for (reader)",
  ({ conversation, reader }, { nodes, posts, trashed }, _vars) =>
    where(
      conversationPosts({ user: reader, conversation }).is({ nodes, posts }),
      Trashing._trashedItems({}).is({ items: trashed }),
    ),
).optional();
/** What statistics describe this conversation? */
export const theThreadStatsOf = former(
  "the thread stats of (conversation) for (reader)",
  (
    { conversation, reader },
    { nodes, posts, trashed, visible, replyCount, lastActivityAt, participants },
  ) =>
    where(
      whether(statisticsInputs({ conversation, reader }).is({ nodes, posts, trashed })),
      compute(c.visibleThreadPosts, { nodes, posts, trashed }, visible),
      compute(c.threadReplyCount, { posts: visible }, replyCount),
      compute(c.threadLastActivity, { posts: visible }, lastActivityAt),
      compute(c.threadParticipants, { posts: visible }, participants),
    ).form({ replyCount, lastActivityAt, participants }),
);
