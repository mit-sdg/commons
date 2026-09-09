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
  ({ item, reader }, { author }, _vars) =>
    where(
      postReader({ user: reader, post: item }),
      Posting._getPost({ post: item }).is({ author }),
      no(staff({ user: author })),
    ),
).optional();
export const readableHome = view(
  "the readable home of opening (item) for (reader)",
  ({ item, reader }, { home }, _vars) =>
    where(postReader({ user: reader, post: item }), Categorizing._getHome({ item }).is({ home })),
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
        Accessing._holders({ resource: conversation }).is({ holders }),
        whether(nonStaffOpening({ item, reader }).is({ author: nonStaffAuthor })),
        compute(c.staffQuestion, { holders, nonStaffAuthor }, staffQuestion),
        Locking._isLocked({ target: conversation }).is({ locked }),
        whether(visibleResolution({ question: item, reader }).is({ answer })),
        compute(c.visibleAnswer, { answer }, resolved),
        whether(readableHome({ item, reader }).is({ home })),
      )
      .form({
        conversation,
        root,
        item,
        createdAt,
        audience: theAudience({ conversation }),
        staffQuestion,
        category: home,
        tags: each(Tagging._getTags({ target: item }).is({ tag, name: tagName }))
          .where(postReader({ user: reader, post: item }))
          .form({
            tag,
            name: tagName,
          }),
        locked,
        resolved,
        post: whether(thePostSummaryOf({ item, reader })),
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
        Accessing._holders({ resource: conversation }).is({ holders }),
        whether(nonStaffOpening({ item, reader }).is({ author: nonStaffAuthor })),
        compute(c.staffQuestion, { holders, nonStaffAuthor }, staffQuestion),
        Locking._isLocked({ target: conversation }).is({ locked }),
        whether(visibleResolution({ question: item, reader }).is({ answer })),
        compute(c.visibleAnswer, { answer }, resolved),
        whether(readableHome({ item, reader }).is({ home })),
      )
      .form({
        conversation,
        root,
        item,
        createdAt,
        audience: theAudience({ conversation }),
        staffQuestion,
        category: home,
        tags: each(Tagging._getTags({ target: item }).is({ tag, name: tagName }))
          .where(postReader({ user: reader, post: item }))
          .form({
            tag,
            name: tagName,
          }),
        locked,
        resolved,
        post: whether(thePostSummaryOf({ item, reader })),
      })
      .splicing(theThreadStatsOf({ conversation, reader })),
);

/** What context belongs beside this conversation's thread? */
export const theThreadContext = former(
  "the thread context (conversation)",
  (
    { conversation, reader },
    { node, item, category, tag, tagName, locked, answer, child, childItem, parent, depth },
  ) =>
    each(Conversing._getThread({ conversation }).is({ node, item }))
      .where(
        no(Conversing._parentOf({ node })),
        conversationReader({ user: reader, conversation }),
        whether(readableHome({ item, reader }).is({ home: category })),
        Locking._isLocked({ target: conversation }).is({ locked }),
        whether(visibleResolution({ question: item, reader }).is({ answer })),
      )
      .form({
        item,
        root: node,
        structure: each(
          Conversing._getThread({ conversation }).is({
            node: child,
            item: childItem,
            parent,
            depth,
          }),
        ).form({ node: child, item: childItem, parent, depth }),
        audience: theAudience({ conversation }),
        category,
        tags: each(Tagging._getTags({ target: item }).is({ tag, name: tagName }))
          .where(postReader({ user: reader, post: item }))
          .form({
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
