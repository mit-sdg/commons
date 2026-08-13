import { each, former, no, whether } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../vocabulary.ts";
import { thePostSummaryOf, theThreadStatsOf } from "./fragments.ts";
import { intact, theThread } from "./threads.ts";

const { Categorizing, Conversing, Locking, Resolving, Tagging } = concepts;

/** What is the home feed ordered by activity? */
export const theHomeFeedByActivity = former(
  "the home feed by activity ()",
  (_inputs, { conversation, root, item, createdAt, locked, resolved, home, tag, tagName }) =>
    each(
      Conversing._getConversationsByLastActivity({}).is({
        conversation,
        root,
        item,
        createdAt,
      }),
    )
      .where(
        intact({ item }),
        Locking._isLocked({ target: conversation }).is({ locked }),
        Resolving._isResolved({ question: item }).is({ resolved }),
        whether(Categorizing._getHome({ item }).is({ home })),
      )
      .form({
        conversation,
        root,
        item,
        createdAt,
        category: home,
        tags: each(Tagging._getTags({ target: item }).is({ tag, name: tagName })).form({
          tag,
          name: tagName,
        }),
        locked,
        resolved,
        post: thePostSummaryOf({ item }),
      })
      .splicing(theThreadStatsOf({ conversation })),
);

/** What is the home feed ordered by creation? */
export const theHomeFeedByCreation = former(
  "the home feed by creation ()",
  (_inputs, { conversation, root, item, createdAt, locked, resolved, home, tag, tagName }) =>
    each(Conversing._getConversations({}).is({ conversation, root, item, createdAt }))
      .where(
        intact({ item }),
        Locking._isLocked({ target: conversation }).is({ locked }),
        Resolving._isResolved({ question: item }).is({ resolved }),
        whether(Categorizing._getHome({ item }).is({ home })),
      )
      .form({
        conversation,
        root,
        item,
        createdAt,
        category: home,
        tags: each(Tagging._getTags({ target: item }).is({ tag, name: tagName })).form({
          tag,
          name: tagName,
        }),
        locked,
        resolved,
        post: thePostSummaryOf({ item }),
      })
      .splicing(theThreadStatsOf({ conversation })),
);

/** What context belongs beside this conversation's thread? */
export const theThreadContext = former(
  "the thread context (conversation)",
  ({ conversation }, { node, item, category, tag, tagName, locked, answer }) =>
    each(Conversing._getThread({ conversation }).is({ node, item }))
      .where(
        no(Conversing._parentOf({ node })),
        intact({ item }),
        whether(Categorizing._getHome({ item }).is({ home: category })),
        Locking._isLocked({ target: conversation }).is({ locked }),
        whether(Resolving._getResolution({ question: item }).is({ answer })),
      )
      .form({
        item,
        category,
        tags: each(Tagging._getTags({ target: item }).is({ tag, name: tagName })).form({
          tag,
          name: tagName,
        }),
        locked,
        acceptedAnswer: answer,
      })
      .splicing(theThreadStatsOf({ conversation })),
);

export const GetThread = endpoint("/threads/get", ({ conversation }) =>
  receive({ conversation }).then(
    respond({
      thread: theThread({ conversation }),
      context: theThreadContext({ conversation }),
    }),
  ),
);

export const ListLatest = endpoint("/threads/latest", () =>
  receive().then(respond({ conversations: theHomeFeedByCreation({}) })),
);

export const ListActivity = endpoint("/threads/activity", () =>
  receive().then(respond({ conversations: theHomeFeedByActivity({}) })),
);
