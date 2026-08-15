import { activeUser } from "../access/session.ts";
import { each, former, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { authored, didNotAuthor } from "../access/policy.ts";
import { concepts } from "../../concepts.ts";
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

export const PurgedPostClearsResolutions = reaction(({ item, question }) =>
  when(Trashing.purge({}).responds({ item })).then(
    where(Resolving._getResolution({ question: item }))
      .then(Resolving.clear({ question: item }))
      .named("question"),
    where(
      Resolving._getQuestionsAnswered({ answer: item }).is({ question }).is.not({ question: item }),
    )
      .then(Resolving.clear({ question }))
      .named("answer"),
  ),
);

export const AcceptAnswer = endpoint(
  "/resolutions/accept",
  ({ session, question, answer, user, at, resolution }) =>
    receive({ session, question, answer }).then(
      where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        authored({ user, post: question }),
        readable({ post: question }),
        readable({ post: answer }),
      )
        .then(Resolving.accept({ question, answer, by: user, at }).responds({ resolution }))
        .then(respond({ resolution }))
        .named("accepted"),
      where(
        activeUser({ session }).is({ user }),
        didNotAuthor({ user, post: question }),
        readable({ post: question }),
        readable({ post: answer }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("not-author"),
      where(activeUser({ session }), notReadable({ post: question }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden-question"),
      where(activeUser({ session }), readable({ post: question }), notReadable({ post: answer }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden-answer"),
    ),
);
export const ClearResolution = endpoint(
  "/resolutions/clear",
  ({ session, question, user, cleared }) =>
    receive({ session, question }).then(
      where(
        activeUser({ session }).is({ user }),
        authored({ user, post: question }),
        readable({ post: question }),
      )
        .then(Resolving.clear({ question }).responds({ question: cleared }))
        .then(respond({ question: cleared }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        didNotAuthor({ user, post: question }),
        readable({ post: question }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("not-author"),
      where(activeUser({ session }), notReadable({ post: question }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);

export const GetResolution = endpoint("/resolutions/get", ({ question }) =>
  receive({ question }).then(
    where(readable({ post: question }))
      .then(respond({ resolution: theResolutionOf({ question }) }))
      .named("success"),
    where(notReadable({ post: question }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const IsResolved = endpoint("/resolutions/isResolved", ({ question, resolved }) =>
  receive({ question }).then(
    where(readable({ post: question }), Resolving._isResolved({ question }).is({ resolved }))
      .then(respond({ resolved }))
      .named("success"),
    where(notReadable({ post: question }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);
