import { activeUser } from "../access/session.ts";
import { each, former, reaction, when, where, now } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts.ts";
import { notReadable, readable } from "./posts.ts";

const { Reacting, Trashing } = concepts;

/** Which reactions are on this target? */
export const theReactionsOn = former(
  "the reactions on (target) for (reader)",
  ({ target, reader }, { reaction, reactor, kind }) =>
    each(Reacting._getReactionsForTarget({ target }).is({ reaction, reactor, kind }))
      .where(readable({ post: target, reader }))
      .form({
        reaction,
        user: reactor,
        kind,
      }),
);

/** How many reactions of each kind are on this target? */
export const theReactionCountsOn = former(
  "the reaction counts on (target) for (reader)",
  ({ target, reader }, { kind, count }) =>
    each(Reacting._countByKind({ target }).is({ kind, count }))
      .where(readable({ post: target, reader }))
      .form({ kind, count }),
);

export const PurgeClearsReactions = reaction(({ item }) =>
  when(Trashing.purge({}).responds({ item })).then(Reacting.clearTarget({ target: item })),
);

export const AddReaction = endpoint(
  "/reactions/add",
  ({ session, target, kind, user, at, reaction }) =>
    receive({ session, target, kind }).then(
      where(now(at), activeUser({ session }).is({ user }), readable({ post: target, reader: user }))
        .then(Reacting.react({ reactor: user, target, kind, at }).responds({ reaction }))
        .then(respond({ reaction }))
        .named("success"),
      where(activeUser({ session }).is({ user }), notReadable({ post: target, reader: user }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "target", "kind"] } },
);

export const RemoveReaction = endpoint(
  "/reactions/remove",
  ({ session, target, kind, user, reaction }) =>
    receive({ session, target, kind }).then(
      where(activeUser({ session }).is({ user }), readable({ post: target, reader: user }))
        .then(Reacting.unreact({ reactor: user, target, kind }).responds({ reaction }))
        .then(respond({ ok: true }))
        .named("success"),
      where(activeUser({ session }).is({ user }), notReadable({ post: target, reader: user }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);

export const ReactionsForTarget = endpoint("/reactions/forTarget", ({ session, target, reader }) =>
  receive({ session, target })
    .where(activeUser({ session }).is({ user: reader }))
    .then(
      where(readable({ post: target, reader }))
        .then(respond({ reactions: theReactionsOn({ target, reader }) }))
        .named("success"),
      where(notReadable({ post: target, reader }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);
