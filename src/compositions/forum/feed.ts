import { visibleResolution } from "./resolutions.ts";
import { activeUser } from "../access/session.ts";
import { conversationReader, postReader, staff } from "./audience-policy.ts";
import { theAudience } from "./audiences.ts";
import { each, former, no, whether, where, compute, view } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts, computations as c } from "../../concepts.ts";
import { thePostSummaryOf, theThreadStatsOf } from "./fragments.ts";
import { theThread } from "./threads.ts";

const { Categorizing, Conversing, Locking, Tagging, Posting, Accessing } = concepts;

export const nonStaffOpening = view(
  "the opening (item) by someone outside Staff",
  ({ item }, { author }, _vars) =>
    where(Posting._getPost({ post: item }).is({ author }), no(staff({ user: author }))),
).optional();
/** What is the home feed ordered by activity? */
export const theHomeFeedByActivity = former(
  "the home feed by activity ()",
  (
    { reader },
    {
      conversation,
      root,
      item,
      createdAt,
      locked,
      resolved,
      home,
      tag,
      tagName,
      answer,
      holders,
      nonStaffAuthor,
      staffQuestion,
    },
  ) =>
    each(
      Conversing._getConversationsByLastActivity({}).is({
        conversation,
        root,
        item,
        createdAt,
      }),
    )
      .where(
        conversationReader({ user: reader, conversation }),
        postReader({ user: reader, post: item }),
        Accessing._holders({ resource: conversation }).is({ holders }),
        whether(nonStaffOpening({ item }).is({ author: nonStaffAuthor })),
        compute(c.staffQuestion, { holders, nonStaffAuthor }, staffQuestion),
        Locking._isLocked({ target: conversation }).is({ locked }),
        whether(visibleResolution({ question: item, reader }).is({ answer })),
        compute(c.visibleAnswer, { answer }, resolved),
        whether(Categorizing._getHome({ item }).is({ home })),
      )
      .form({
        conversation,
        root,
        item,
        createdAt,
        audience: theAudience({ conversation }),
        staffQuestion,
        category: home,
        tags: each(Tagging._getTags({ target: item }).is({ tag, name: tagName })).form({
          tag,
          name: tagName,
        }),
        locked,
        resolved,
        post: thePostSummaryOf({ item, reader }),
      })
      .splicing(theThreadStatsOf({ conversation, reader })),
);

/** What is the home feed ordered by creation? */
export const theHomeFeedByCreation = former(
  "the home feed by creation ()",
  (
    { reader },
    {
      conversation,
      root,
      item,
      createdAt,
      locked,
      resolved,
      home,
      tag,
      tagName,
      answer,
      holders,
      nonStaffAuthor,
      staffQuestion,
    },
  ) =>
    each(Conversing._getConversations({}).is({ conversation, root, item, createdAt }))
      .where(
        conversationReader({ user: reader, conversation }),
        postReader({ user: reader, post: item }),
        Accessing._holders({ resource: conversation }).is({ holders }),
        whether(nonStaffOpening({ item }).is({ author: nonStaffAuthor })),
        compute(c.staffQuestion, { holders, nonStaffAuthor }, staffQuestion),
        Locking._isLocked({ target: conversation }).is({ locked }),
        whether(visibleResolution({ question: item, reader }).is({ answer })),
        compute(c.visibleAnswer, { answer }, resolved),
        whether(Categorizing._getHome({ item }).is({ home })),
      )
      .form({
        conversation,
        root,
        item,
        createdAt,
        audience: theAudience({ conversation }),
        staffQuestion,
        category: home,
        tags: each(Tagging._getTags({ target: item }).is({ tag, name: tagName })).form({
          tag,
          name: tagName,
        }),
        locked,
        resolved,
        post: thePostSummaryOf({ item, reader }),
      })
      .splicing(theThreadStatsOf({ conversation, reader })),
);

/** What context belongs beside this conversation's thread? */
export const theThreadContext = former(
  "the thread context (conversation)",
  ({ conversation, reader }, { node, item, category, tag, tagName, locked, answer }) =>
    each(Conversing._getThread({ conversation }).is({ node, item }))
      .where(
        no(Conversing._parentOf({ node })),
        conversationReader({ user: reader, conversation }),
        postReader({ user: reader, post: item }),
        whether(Categorizing._getHome({ item }).is({ home: category })),
        Locking._isLocked({ target: conversation }).is({ locked }),
        whether(visibleResolution({ question: item, reader }).is({ answer })),
      )
      .form({
        item,
        audience: theAudience({ conversation }),
        category,
        tags: each(Tagging._getTags({ target: item }).is({ tag, name: tagName })).form({
          tag,
          name: tagName,
        }),
        locked,
        acceptedAnswer: answer,
      })
      .splicing(theThreadStatsOf({ conversation, reader })),
);

export const GetThread = endpoint("/threads/get", ({ session, reader, conversation }) =>
  receive({ session, conversation })
    .where(activeUser({ session }).is({ user: reader }))
    .then(
      where(conversationReader({ user: reader, conversation }))
        .then(
          respond({
            thread: theThread({ conversation, reader }),
            context: theThreadContext({ conversation, reader }),
          }),
        )
        .named("visible"),
      where(no(conversationReader({ user: reader, conversation })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);
export const ListLatest = endpoint("/threads/latest", ({ session, reader }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user: reader }))
    .then(respond({ conversations: theHomeFeedByCreation({ reader }) })),
);
export const ListActivity = endpoint("/threads/activity", ({ session, reader }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user: reader }))
    .then(respond({ conversations: theHomeFeedByActivity({ reader }) })),
);
