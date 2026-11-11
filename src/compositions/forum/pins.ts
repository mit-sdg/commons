import { activeUser } from "../access/session.ts";
import { each, former, no, reaction, view, when, where, now } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { mayModerate, mayNotModerate } from "../access/policy.ts";
import { concepts } from "../../concepts.ts";
import { readable } from "./posts.ts";
import { conversationReader, postConversation, staff } from "./audience-policy.ts";

const { Pinning, Trashing } = concepts;

/** The reserved scope whose pins stand above the discussion list for every reader. */
export const DISCUSSIONS = "discussions";

export const pinnable = view(
  "(item) belongs to pin scope (scope) for (reader)",
  ({ item, scope, reader }, _out, _vars) =>
    where(
      readable({ post: item, reader }),
      postConversation({ post: item }).is({ conversation: scope }),
    ),
).holds();
/** Which items are pinned in this scope? */
export const thePinsOf = former(
  "the pins of (scope) for (reader)",
  ({ scope, reader }, { item, priority }) =>
    each(Pinning._getPinned({ scope }).is({ item, priority }))
      .where(pinnable({ item, scope, reader }))
      .form({ item, priority }),
);

export const PurgeClearsPins = reaction(({ item }) =>
  when(Trashing.purge({}).responds({ item })).then(Pinning.clearItem({ item })),
);

export const PinItem = endpoint(
  "/pins/pin",
  ({ session, item, scope, priority, user, at, pin }) =>
    receive({ session, item, scope, priority }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        pinnable({ item, scope, reader: user }),
      )
        .then(Pinning.pin({ item, scope, priority, at }).responds({ pin }))
        .then(respond({ pin }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayNotModerate({ user }),
        pinnable({ item, scope, reader: user }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(activeUser({ session }).is({ user }), no(pinnable({ item, scope, reader: user })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "item", "scope", "priority"] } },
);

export const UnpinItem = endpoint(
  "/pins/unpin",
  ({ session, item, scope, user }) =>
    receive({ session, item, scope }).then(
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        pinnable({ item, scope, reader: user }),
      )
        .then(Pinning.unpin({ item, scope }).responds())
        .then(respond({ item }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayNotModerate({ user }),
        pinnable({ item, scope, reader: user }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(activeUser({ session }).is({ user }), no(pinnable({ item, scope, reader: user })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "item", "scope"] } },
);

export const SetPinPriority = endpoint(
  "/pins/setPriority",
  ({ session, item, scope, priority, user, pin }) =>
    receive({ session, item, scope, priority }).then(
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        pinnable({ item, scope, reader: user }),
      )
        .then(Pinning.setPriority({ item, scope, priority }).responds({ pin }))
        .then(respond({ pin }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayNotModerate({ user }),
        pinnable({ item, scope, reader: user }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(activeUser({ session }).is({ user }), no(pinnable({ item, scope, reader: user })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "item", "scope", "priority"] } },
);

export const PinsForScope = endpoint(
  "/pins/forScope",
  ({ session, scope, reader }) =>
    receive({ session, scope })
      .where(activeUser({ session }).is({ user: reader }))
      .then(
        where(conversationReader({ user: reader, conversation: scope }))
          .then(respond({ pinned: thePinsOf({ scope, reader }) }))
          .named("visible"),
        where(no(conversationReader({ user: reader, conversation: scope })))
          .then(respond({ error: "NOT_FOUND" }))
          .named("unavailable"),
      ),
  { input: { required: ["session", "scope"] } },
);
export const IsPinned = endpoint(
  "/pins/isPinned",
  ({ session, item, scope, pinned, reader }) =>
    receive({ session, item, scope })
      .where(activeUser({ session }).is({ user: reader }))
      .then(
        where(pinnable({ item, scope, reader }), Pinning._isPinned({ item, scope }).is({ pinned }))
          .then(respond({ pinned }))
          .named("success"),
        where(no(pinnable({ item, scope, reader })))
          .then(respond({ error: "NOT_FOUND" }))
          .named("hidden"),
      ),
  { input: { required: ["session", "item", "scope"] } },
);

/** Which pinned discussions may this reader see, highest priority first? */
export const thePinnedDiscussionsOf = former(
  "the pinned discussions for (reader)",
  ({ reader }, { item, priority }) =>
    each(Pinning._getPinned({ scope: DISCUSSIONS }).is({ item, priority }))
      .where(conversationReader({ user: reader, conversation: item }))
      .form({ conversation: item }),
);

export const PinDiscussion = endpoint(
  "/discussions/pin",
  ({ session, conversation, user, at, pin }) =>
    receive({ session, conversation }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        staff({ user }),
        conversationReader({ user, conversation }),
        Pinning._isPinned({ item: conversation, scope: DISCUSSIONS }).is({ pinned: false }),
      )
        .then(
          Pinning.pin({ item: conversation, scope: DISCUSSIONS, priority: 0, at }).responds({
            pin,
          }),
        )
        .then(respond({ conversation }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        staff({ user }),
        conversationReader({ user, conversation }),
        Pinning._isPinned({ item: conversation, scope: DISCUSSIONS }).is({ pinned: true }),
      )
        .then(respond({ conversation }))
        .named("already"),
      where(
        activeUser({ session }).is({ user }),
        no(staff({ user })),
        conversationReader({ user, conversation }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(activeUser({ session }).is({ user }), no(conversationReader({ user, conversation })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "conversation"] } },
);

export const UnpinDiscussion = endpoint(
  "/discussions/unpin",
  ({ session, conversation, user }) =>
    receive({ session, conversation }).then(
      where(
        activeUser({ session }).is({ user }),
        staff({ user }),
        conversationReader({ user, conversation }),
      )
        .then(Pinning.unpin({ item: conversation, scope: DISCUSSIONS }).responds())
        .then(respond({ conversation }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        no(staff({ user })),
        conversationReader({ user, conversation }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(activeUser({ session }).is({ user }), no(conversationReader({ user, conversation })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "conversation"] } },
);

export const PinnedDiscussions = endpoint("/discussions/pinned", ({ session, reader }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user: reader }))
    .then(respond({ pinned: thePinnedDiscussionsOf({ reader }) })),
);
