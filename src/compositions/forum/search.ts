import { activeUser } from "../access/session.ts";
import { compute, each, former, is, view, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts, computations as c } from "../../concepts.ts";
import { establishedConversationReader } from "./audience-policy.ts";

const { Conversing, Posting, Trashing } = concepts;

/** Each readable discussion holding a live match, beside its newest live match. */
export const readableSearchHit = view(
  "the readable discussions matching (text) for (reader)",
  ({ text, reader }, { post, conversation }, { posts, trashed, live }) =>
    where(
      Posting._search({ text }).is({ posts }),
      Trashing._trashedAmong({ items: posts }).is({ trashed }),
      compute(c.withoutTrashed, { items: posts, trashed }, live),
      Conversing._conversationsHolding({ items: live }).is({ conversation, item: post }),
      establishedConversationReader({ user: reader, conversation }),
    ),
).many();

/** Which discussions hold readable posts containing this text, and the newest such post? */
export const theSearchHitsOf = former(
  "the discussions matching (text) for (reader)",
  ({ text, reader }, { post, conversation }) =>
    each(readableSearchHit({ text, reader }).is({ post, conversation })).form({
      conversation,
      post,
    }),
);

export const SearchDiscussions = endpoint(
  "/discussions/search",
  ({ session, text, valid, reader }) =>
    receive({ session, text })
      .where(activeUser({ session }), compute(c.validSearchText, { text }, valid))
      .then(
        where(is.among(valid, [true]), activeUser({ session }).is({ user: reader }))
          .then(respond({ matches: theSearchHitsOf({ text, reader }) }))
          .named("valid"),
        where(is.among(valid, [false]))
          .then(respond({ error: "INVALID_REQUEST" }))
          .named("invalid"),
      ),
  { input: { required: ["session", "text"] } },
);
