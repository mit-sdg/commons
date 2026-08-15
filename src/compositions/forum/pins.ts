import { activeUser } from "../access/session.ts";
import { each, former, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { mayNotPinInScope, mayPinInScope } from "../access/policy.ts";
import { concepts } from "../../concepts.ts";
import { notReadable, readable } from "./posts.ts";

const { Pinning, Trashing, Timing } = concepts;

/** Which items are pinned in this scope? */
export const thePinsOf = former("the pins of (scope)", ({ scope }, { item, priority }) =>
  each(Pinning._getPinned({ scope }).is({ item, priority }))
    .where(readable({ post: item }))
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
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayPinInScope({ user, scope }),
        readable({ post: item }),
      )
        .then(Pinning.pin({ item, scope, priority, at }).responds({ pin }))
        .then(respond({ pin }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotPinInScope({ user, scope }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(
        activeUser({ session }).is({ user }),
        mayPinInScope({ user, scope }),
        notReadable({ post: item }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "item", "scope", "priority"] } },
);

export const UnpinItem = endpoint(
  "/pins/unpin",
  ({ session, item, scope, user, pin }) =>
    receive({ session, item, scope }).then(
      where(
        activeUser({ session }).is({ user }),
        mayPinInScope({ user, scope }),
        readable({ post: item }),
      )
        .then(Pinning.unpin({ item, scope }).responds({ pin }))
        .then(respond({ pin }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotPinInScope({ user, scope }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(
        activeUser({ session }).is({ user }),
        mayPinInScope({ user, scope }),
        notReadable({ post: item }),
      )
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
        mayPinInScope({ user, scope }),
        readable({ post: item }),
      )
        .then(Pinning.setPriority({ item, scope, priority }).responds({ pin }))
        .then(respond({ pin }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotPinInScope({ user, scope }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(
        activeUser({ session }).is({ user }),
        mayPinInScope({ user, scope }),
        notReadable({ post: item }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "item", "scope", "priority"] } },
);

export const PinsForScope = endpoint(
  "/pins/forScope",
  ({ scope }) => receive({ scope }).then(respond({ pinned: thePinsOf({ scope }) })),
  { input: { required: ["scope"] } },
);
export const IsPinned = endpoint(
  "/pins/isPinned",
  ({ item, scope, pinned }) =>
    receive({ item, scope }).then(
      where(readable({ post: item }), Pinning._isPinned({ item, scope }).is({ pinned }))
        .then(respond({ pinned }))
        .named("success"),
      where(notReadable({ post: item }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["item", "scope"] } },
);
