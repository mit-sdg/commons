import { each, form, former, view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../vocabulary.ts";
import { intact } from "./threads.ts";

const { Conversing, Posting, Profiling } = concepts;

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

export const thePrivateProfileOf = former(
  "the private profile of (user)",
  ({ user }, { displayName, bio, avatar, email }) =>
    where(Profiling._getProfileFields({ user }).is({ displayName, bio, avatar, email })).form({
      displayName,
      bio,
      avatar,
      email,
    }),
).optional();

/** What summary describes this post? */
export const thePostSummaryOf = former(
  "the post summary of (item)",
  ({ item }, { author, content, createdAt, editedAt }) =>
    where(Posting._getPost({ post: item }).is({ author, content, createdAt, editedAt })).form({
      author,
      content,
      createdAt,
      editedAt,
    }),
).optional();

export const publicThreadPosts = view(
  "the public posts in (conversation)",
  ({ conversation }, { node, item, author, createdAt }, _bindings) =>
    where(
      Conversing._getThread({ conversation }).is({ node, item }),
      intact({ item }),
      Posting._getPost({ post: item }).is({ author, createdAt }),
    ),
).many();

/** What statistics describe this conversation? */
export const theThreadStatsOf = former(
  "the thread stats of (conversation)",
  ({ conversation }, { replyNode, replyItem, activityItem, activityAt, partItem, participant }) =>
    form({
      replyCount: each(publicThreadPosts({ conversation }).is({ node: replyNode, item: replyItem }))
        .where(Conversing._parentOf({ node: replyNode }))
        .count(),
      lastActivityAt: each(
        publicThreadPosts({ conversation }).is({ item: activityItem, createdAt: activityAt }),
      )
        .arranged(activityAt, "descending")
        .first(activityAt),
      participants: each(
        publicThreadPosts({ conversation }).is({ item: partItem, author: participant }),
      ).distinct(participant),
    }),
);
