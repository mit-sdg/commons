import { activeUser } from "../access/session.ts";
import { compute, each, former, is, view, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts, computations as c } from "../../concepts.ts";
import { postConversation, postReader } from "./audience-policy.ts";

const { Posting } = concepts;

/** A matching post counts only while this reader may read it where it stands. */
export const readableSearchHit = view(
  "the readable posts matching (text) for (reader)",
  ({ text, reader }, { post, conversation }, _bindings) =>
    where(
      Posting._search({ text }).is({ post }),
      postConversation({ post }).is({ conversation }),
      postReader({ user: reader, post }),
    ),
).many();

/** Which readable posts, and the discussions holding them, contain this text? */
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
