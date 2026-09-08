import { activeUser } from "../access/session.ts";
import { each, former, no, reaction, view, when, where, now } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { authored, didNotAuthor } from "../access/policy.ts";
import { concepts } from "../../concepts.ts";
import { notReadable, readable } from "./posts.ts";

const { Conversing, Resolving, Trashing } = concepts;

export const admissibleAnswer = view(
  "(answer) is a visible answer to (question) for (reader)",
  ({ answer, question, reader }, _out, { conversation, questionNode, answerNode }) =>
    where(
      readable({ post: question, reader }),
      readable({ post: answer, reader }),
      Conversing._getNodeByItem({ item: question }).is({ node: questionNode }),
      Conversing._getNodeByItem({ item: answer })
        .is({ node: answerNode })
        .is.not({ node: questionNode }),
      Conversing._getConversation({ node: questionNode }).is({ conversation }),
      Conversing._getConversation({ node: answerNode }).is({ conversation }),
    ),
).holds();
export const visibleResolution = view(
  "the visible resolution of (question) for (reader)",
  ({ question, reader }, { answer, resolvedBy, resolvedAt }, _vars) =>
    where(
      Resolving._getResolution({ question }).is({ answer, resolvedBy, resolvedAt }),
      admissibleAnswer({ question, answer, reader }),
    ),
).optional();
/** What accepted answer may this reader see? */
export const theResolutionOf = former(
  "the resolution of (question) for (reader)",
  ({ question, reader }, { answer, resolvedBy, resolvedAt }) =>
    each(visibleResolution({ question, reader }).is({ answer, resolvedBy, resolvedAt })).form({
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
        now(at),
        activeUser({ session }).is({ user }),
        authored({ user, post: question }),
        admissibleAnswer({ question, answer, reader: user }),
      )
        .then(Resolving.accept({ question, answer, by: user, at }).responds({ resolution }))
        .then(respond({ resolution }))
        .named("accepted"),
      where(
        activeUser({ session }).is({ user }),
        didNotAuthor({ user, post: question }),
        admissibleAnswer({ question, answer, reader: user }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("not-author"),
      where(activeUser({ session }).is({ user }), notReadable({ post: question, reader: user }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden-question"),
      where(
        activeUser({ session }).is({ user }),
        readable({ post: question, reader: user }),
        no(admissibleAnswer({ question, answer, reader: user })),
      )
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
        readable({ post: question, reader: user }),
      )
        .then(Resolving.clear({ question }).responds({ question: cleared }))
        .then(respond({ question: cleared }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        didNotAuthor({ user, post: question }),
        readable({ post: question, reader: user }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("not-author"),
      where(activeUser({ session }).is({ user }), notReadable({ post: question, reader: user }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);

export const GetResolution = endpoint("/resolutions/get", ({ session, question, reader }) =>
  receive({ session, question })
    .where(activeUser({ session }).is({ user: reader }))
    .then(
      where(readable({ post: question, reader }))
        .then(respond({ resolution: theResolutionOf({ question, reader }) }))
        .named("success"),
      where(notReadable({ post: question, reader }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);
export const IsResolved = endpoint("/resolutions/isResolved", ({ session, question, reader }) =>
  receive({ session, question })
    .where(activeUser({ session }).is({ user: reader }))
    .then(
      where(readable({ post: question, reader }), visibleResolution({ question, reader }))
        .then(respond({ resolved: true }))
        .named("resolved"),
      where(readable({ post: question, reader }), no(visibleResolution({ question, reader })))
        .then(respond({ resolved: false }))
        .named("unresolved"),
      where(notReadable({ post: question, reader }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);
