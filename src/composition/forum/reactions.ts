import { activeUser } from "../access/session.ts";
import { each, former, reaction, when } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts/index.ts";
import { notReadable, readable } from "./posts.ts";

const { Reacting, Trashing, Timing } = concepts;

/** Which reactions are on this target? */
export const theReactionsOn = former(
  "the reactions on (target)",
  ({ target, reaction, reactor, kind }) =>
    each(Reacting._getReactionsForTarget({ target }).is({ reaction, reactor, kind })).form({
      reaction,
      user: reactor,
      kind,
    }),
);

/** How many reactions of each kind are on this target? */
export const theReactionCountsOn = former(
  "the reaction counts on (target)",
  ({ target, kind, count }) =>
    each(Reacting._countByKind({ target }).is({ kind, count })).form({ kind, count }),
);

export const PurgeClearsReactions = reaction(({ item }) =>
  when(Trashing.purge({}).responds({ item })).then(Reacting.clearTarget({ target: item })),
);

export const AddReaction = endpoint(
  "/reactions/add",
  ({ session, target, kind, user, at, reaction }) =>
    receive({ session, target, kind })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        readable({ post: target }),
      )
      .then(Reacting.react({ reactor: user, target, kind, at }).responds({ reaction }))
      .then(respond({ reaction })),
  { input: { required: ["session", "target", "kind"] } },
);

export const RemoveReaction = endpoint(
  "/reactions/remove",
  ({ session, target, kind, user, reaction }) =>
    receive({ session, target, kind })
      .where(activeUser({ session }).is({ user }), readable({ post: target }))
      .then(Reacting.unreact({ reactor: user, target, kind }).responds({ reaction }))
      .then(respond({ ok: true })),
);
export const AddReactionHidden = endpoint("/reactions/add", ({ session, target, kind }) =>
  receive({ session, target, kind })
    .where(activeUser({ session }), notReadable({ post: target }))
    .then(respond({ error: "NOT_FOUND" })),
);
export const RemoveReactionHidden = endpoint("/reactions/remove", ({ session, target, kind }) =>
  receive({ session, target, kind })
    .where(activeUser({ session }), notReadable({ post: target }))
    .then(respond({ error: "NOT_FOUND" })),
);

export const ReactionsForTarget = endpoint("/reactions/forTarget", ({ target }) =>
  receive({ target })
    .where(readable({ post: target }))
    .then(respond({ reactions: theReactionsOn(target) })),
);
export const ReactionsForTargetHidden = endpoint("/reactions/forTarget", ({ target }) =>
  receive({ target })
    .where(notReadable({ post: target }))
    .then(respond({ error: "NOT_FOUND" })),
);
