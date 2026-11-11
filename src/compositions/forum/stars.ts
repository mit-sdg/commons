import { activeUser } from "../access/session.ts";
import { each, former, no, reaction, view, when, where, now } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts.ts";
import { conversationReader } from "./audience-policy.ts";

const { Starring, Trashing } = concepts;

export const readableStarsOf = view(
  "the readable starred discussions of (user)",
  ({ user }, { conversation, starredAt }, _bindings) =>
    where(
      Starring._getSaved({ user }).is({ item: conversation, savedAt: starredAt }),
      conversationReader({ user, conversation }),
    ),
).many();

/** Which discussions has this user starred and may still read, newest star first? */
export const theStarsOf = former(
  "the starred discussions of (user)",
  ({ user }, { conversation, starredAt }) =>
    each(readableStarsOf({ user }).is({ conversation, starredAt })).form({
      conversation,
      starredAt,
    }),
);

export const PurgeClearsStars = reaction(({ item }) =>
  when(Trashing.purge({}).responds({ item })).then(Starring.clearItem({ item })),
);

export const StarDiscussion = endpoint(
  "/discussions/star",
  ({ session, conversation, user, at, bookmark }) =>
    receive({ session, conversation }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        conversationReader({ user, conversation }),
        Starring._isSaved({ user, item: conversation }).is({ saved: false }),
      )
        .then(Starring.save({ user, item: conversation, at }).responds({ bookmark }))
        .then(respond({ conversation, starred: true }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        conversationReader({ user, conversation }),
        Starring._isSaved({ user, item: conversation }).is({ saved: true }),
      )
        .then(respond({ conversation, starred: true }))
        .named("already"),
      where(activeUser({ session }).is({ user }), no(conversationReader({ user, conversation })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "conversation"] } },
);

export const UnstarDiscussion = endpoint(
  "/discussions/unstar",
  ({ session, conversation, user, bookmark }) =>
    receive({ session, conversation }).then(
      where(
        activeUser({ session }).is({ user }),
        conversationReader({ user, conversation }),
        Starring._isSaved({ user, item: conversation }).is({ saved: true }),
      )
        .then(Starring.unsave({ user, item: conversation }).responds({ bookmark }))
        .then(respond({ conversation, starred: false }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        conversationReader({ user, conversation }),
        Starring._isSaved({ user, item: conversation }).is({ saved: false }),
      )
        .then(respond({ conversation, starred: false }))
        .named("already"),
      where(activeUser({ session }).is({ user }), no(conversationReader({ user, conversation })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "conversation"] } },
);

export const StarredDiscussions = endpoint("/discussions/starred", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }))
    .then(respond({ starred: theStarsOf({ user }) })),
);
