import { compute, each, former, is, no, view, where, whether } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts, computations as c } from "../../concepts.ts";
import { activeUser } from "../access/session.ts";
import { conversationPosts, conversationReader, postReader, staff } from "./audience-policy.ts";
import { theAudience } from "./audiences.ts";
import { readableHome } from "./feed.ts";
import { theThreadStatsOf } from "./fragments.ts";
import { visibleResolution } from "./resolutions.ts";

const { Accessing, Conversing, Locking, Posting, Tagging, Trashing } = concepts;

export const nonStaffMetadataOpening = view(
  "the visible opening author outside Staff in (conversation)",
  ({ conversation, item, reader }, { author }, { posts }) =>
    where(
      conversationPosts({ user: reader, conversation }).is({ posts }),
      Trashing._isTrashed({ item }).is({ trashed: false }),
      compute(c.metadataOpeningAuthor, { item, posts }, author),
      no(staff({ user: author })),
    ),
).optional();

/** Which audience and filter metadata may this reader see? */
export const theFeedEntry = former(
  "the feed metadata of (conversation) for (reader)",
  ({ conversation, item, reader }, { holders, nonStaffAuthor, staffQuestion }) =>
    where(
      conversationReader({ user: reader, conversation }),
      Accessing._holders({ resource: conversation }).is({ holders }),
      whether(
        nonStaffMetadataOpening({ conversation, item, reader }).is({ author: nonStaffAuthor }),
      ),
      compute(c.staffQuestion, { holders, nonStaffAuthor }, staffQuestion),
    ).form({ audience: theAudience({ conversation }), staffQuestion }),
).optional();

/** Which readable discussions occur in creation order? */
export const theCreationIndex = former(
  "the creation-ordered feed index for (reader)",
  ({ reader }, { conversation, item }) =>
    each(Conversing._getConversations({}).is({ conversation, item }))
      .form({ conversation })
      .splicing(theFeedEntry({ conversation, item, reader })),
);

/** Which readable discussions occur in activity order? */
export const theActivityIndex = former(
  "the activity-ordered feed index for (reader)",
  ({ reader }, { conversation, item }) =>
    each(Conversing._getConversationsByLastActivity({}).is({ conversation, item }))
      .form({ conversation })
      .splicing(theFeedEntry({ conversation, item, reader })),
);

/** What text and attribution belong in this opening's preview? */
export const theOpeningPreview = former(
  "the preview of opening (item) for (reader)",
  ({ item, reader }, { author, content, createdAt, editedAt, preview }) =>
    where(
      postReader({ user: reader, post: item }),
      Posting._getPost({ post: item }).is({ author, content, createdAt, editedAt }),
      compute(c.postPreview, { content }, preview),
    ).form({ author, createdAt, editedAt, preview }),
).optional();

/** What current details belong to this selected discussion? */
export const theSelectedSummary = former(
  "the selected summary of (conversation) for (reader)",
  ({ conversation, item, reader }, { locked, answer, resolved, home, tag, tagName }) =>
    where(
      conversationReader({ user: reader, conversation }),
      Locking._isLocked({ target: conversation }).is({ locked }),
      whether(visibleResolution({ question: item, reader }).is({ answer })),
      compute(c.visibleAnswer, { answer }, resolved),
      whether(readableHome({ item, reader }).is({ home })),
    )
      .form({
        category: home,
        locked,
        resolved,
        post: whether(theOpeningPreview({ item, reader })),
        tags: each(Tagging._getTags({ target: item }).is({ tag, name: tagName }))
          .where(postReader({ user: reader, post: item }))
          .form({ tag, name: tagName }),
      })
      .splicing(theFeedEntry({ conversation, item, reader }))
      .splicing(theThreadStatsOf({ conversation, reader })),
).optional();

/** Which selected discussions remain readable? */
export const theSelectedSummaries = former(
  "the summaries selected by (conversations) for (reader)",
  ({ conversations, reader }, { conversation, root, item, createdAt }) =>
    each(Conversing._getConversations({}).is({ conversation, root, item, createdAt }))
      .where(is.among(conversation, conversations))
      .form({ conversation, root, item, createdAt })
      .splicing(theSelectedSummary({ conversation, item, reader })),
);

export const Index = endpoint(
  "/threads/index",
  ({ session, order, valid, reader }) =>
    receive({ session, order })
      .where(activeUser({ session }), compute(c.validFeedOrder, { order }, valid))
      .then(
        where(is.among(order, ["latest"]), activeUser({ session }).is({ user: reader }))
          .then(respond({ conversations: theCreationIndex({ reader }) }))
          .named("latest"),
        where(is.among(order, ["activity"]), activeUser({ session }).is({ user: reader }))
          .then(respond({ conversations: theActivityIndex({ reader }) }))
          .named("activity"),
        where(is.among(valid, [false]))
          .then(respond({ error: "INVALID_REQUEST" }))
          .named("invalid"),
      ),
  { input: { required: ["session", "order"] } },
);

export const Summaries = endpoint(
  "/threads/summaries",
  ({ session, conversations, valid, reader }) =>
    receive({ session, conversations })
      .where(activeUser({ session }), compute(c.validThreadSelection, { conversations }, valid))
      .then(
        where(is.among(valid, [true]), activeUser({ session }).is({ user: reader }))
          .then(respond({ conversations: theSelectedSummaries({ conversations, reader }) }))
          .named("valid"),
        where(is.among(valid, [false]))
          .then(respond({ error: "INVALID_REQUEST" }))
          .named("invalid"),
      ),
  { input: { required: ["session", "conversations"] } },
);
