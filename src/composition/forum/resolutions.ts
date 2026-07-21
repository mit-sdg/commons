import { activeUser } from "../access/session.ts";
import { each, former, reaction, when } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { authored, didNotAuthor } from "../access/policy.ts";
import { concepts } from "../../concepts/index.ts";
import { notReadable, readable } from "./posts.ts";

const { Resolving, Trashing, Timing } = concepts;

/** What is the accepted resolution of this question? */
export const theResolutionOf = former(
  "the resolution of (question)",
  ({ question }, { answer, resolvedBy, resolvedAt }) =>
    each(Resolving._getResolution({ question }).is({ answer, resolvedBy, resolvedAt }))
      .where(readable({ post: answer }))
      .form({
        answer,
        resolvedBy,
        resolvedAt,
      }),
);

export const PurgeClearsQuestionResolution = reaction(({ item }) =>
  when(Trashing.purge({}).responds({ item }))
    .where(Resolving._getResolution({ question: item }))
    .then(Resolving.clear({ question: item })),
);
export const PurgeClearsAnsweringResolutions = reaction(({ item, question }) =>
  when(Trashing.purge({}).responds({ item }))
    .where(
      Resolving._getQuestionsAnswered({ answer: item }).is({ question }).is.not({ question: item }),
    )
    .then(Resolving.clear({ question })),
);

export const AcceptAnswer = endpoint(
  "/resolutions/accept",
  ({ session, question, answer, user, at, resolution }) =>
    receive({ session, question, answer })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        authored({ user, post: question }),
        readable({ post: question }),
        readable({ post: answer }),
      )
      .then(Resolving.accept({ question, answer, by: user, at }).responds({ resolution }))
      .then(respond({ resolution })),
);

export const AcceptAnswerNotAuthor = endpoint(
  "/resolutions/accept",
  ({ session, question, answer, user }) =>
    receive({ session, question, answer })
      .where(
        activeUser({ session }).is({ user }),
        didNotAuthor({ user, post: question }),
        readable({ post: question }),
        readable({ post: answer }),
      )
      .then(respond({ error: "FORBIDDEN" })),
);
export const ClearResolution = endpoint(
  "/resolutions/clear",
  ({ session, question, user, cleared }) =>
    receive({ session, question })
      .where(
        activeUser({ session }).is({ user }),
        authored({ user, post: question }),
        readable({ post: question }),
      )
      .then(Resolving.clear({ question }).responds({ question: cleared }))
      .then(respond({ question: cleared })),
);

export const ClearResolutionNotAuthor = endpoint(
  "/resolutions/clear",
  ({ session, question, user }) =>
    receive({ session, question })
      .where(
        activeUser({ session }).is({ user }),
        didNotAuthor({ user, post: question }),
        readable({ post: question }),
      )
      .then(respond({ error: "FORBIDDEN" })),
);

export const AcceptAnswerHidden = endpoint("/resolutions/accept", ({ session, question, answer }) =>
  receive({ session, question, answer })
    .where(activeUser({ session }), notReadable({ post: question }))
    .then(respond({ error: "NOT_FOUND" })),
);
export const AcceptHiddenAnswer = endpoint("/resolutions/accept", ({ session, question, answer }) =>
  receive({ session, question, answer })
    .where(activeUser({ session }), readable({ post: question }), notReadable({ post: answer }))
    .then(respond({ error: "NOT_FOUND" })),
);
export const ClearResolutionHidden = endpoint("/resolutions/clear", ({ session, question }) =>
  receive({ session, question })
    .where(activeUser({ session }), notReadable({ post: question }))
    .then(respond({ error: "NOT_FOUND" })),
);

export const GetResolution = endpoint("/resolutions/get", ({ question }) =>
  receive({ question })
    .where(readable({ post: question }))
    .then(respond({ resolution: theResolutionOf({ question }) })),
);

export const IsResolved = endpoint("/resolutions/isResolved", ({ question, resolved }) =>
  receive({ question })
    .where(readable({ post: question }), Resolving._isResolved({ question }).is({ resolved }))
    .then(respond({ resolved })),
);
export const GetResolutionHidden = endpoint("/resolutions/get", ({ question }) =>
  receive({ question })
    .where(notReadable({ post: question }))
    .then(respond({ error: "NOT_FOUND" })),
);
export const IsResolvedHidden = endpoint("/resolutions/isResolved", ({ question }) =>
  receive({ question })
    .where(notReadable({ post: question }))
    .then(respond({ error: "NOT_FOUND" })),
);
