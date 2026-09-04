import { activeUser } from "../access/session.ts";
import { each, form, former, no, whether, where, now } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { mayModerate, mayNotModerate } from "../access/policy.ts";
import { concepts } from "../../concepts.ts";
import { notReadable, readable, thePost } from "./posts.ts";
import { forumPost, publicTarget } from "./threads.ts";

const { Conversing, Flagging, Formatting, Locking, Posting, Trashing } = concepts;

/** Which forum posts are in the trash? Trashing holds other kinds too, and they are not the forum's. */
export const theTrashBin = former("the trash bin ()", (_inputs, { item, trashedBy, trashedAt }) =>
  each(Trashing._getTrashed({}).is({ item, trashedBy, trashedAt }))
    .where(forumPost({ post: item }))
    .form({ item, trashedBy, trashedAt }),
);

/** Which targets are locked? */
export const theLockedList = former("the locked list ()", (_inputs, { target, lockedAt }) =>
  each(Locking._getLocked({}).is({ target, lockedAt }))
    .where(publicTarget({ target }))
    .form({ target, lockedAt }),
);

/** Which targets have open flags? */
export const theOpenFlags = former("the open flags ()", (_inputs, { target, count }) =>
  each(Flagging._getOpenTargets({}).is({ target, count }))
    .where(readable({ post: target }))
    .form({ target, count }),
);

/** Which flags are on this target? */
export const theFlagsOn = former(
  "the flags on (target)",
  ({ target }, { flag, reporter, reason, status, createdAt }) =>
    each(Flagging._getFlags({ target }).is({ flag, reporter, reason, status, createdAt })).form({
      flag,
      reporter,
      reason,
      status,
      createdAt,
    }),
);
/** What is the moderation queue? */
export const theModerationQueue = former(
  "the moderation queue ()",
  (
    _inputs,
    {
      target,
      count,
      node,
      conversation,
      author,
      content,
      createdAt,
      editedAt,
      rendered,
      flag,
      reporter,
      reason,
      status,
      flaggedAt,
    },
  ) =>
    each(Flagging._getOpenTargets({}).is({ target, count }))
      .where(
        readable({ post: target }),
        Posting._getPost({ post: target }).is({ author, content, createdAt, editedAt }),
        Formatting._getRendered({ target }).is({ rendered }),
        whether(Conversing._getNodeByItem({ item: target }).is({ node })),
        whether(Conversing._getConversation({ node }).is({ conversation })),
      )
      .form({
        target,
        count,
        conversation,
        post: form({ author, content, createdAt, editedAt }),
        rendered,
        flags: each(
          Flagging._getFlags({ target }).is({
            flag,
            reporter,
            reason,
            status,
            createdAt: flaggedAt,
          }),
        )
          .where(Flagging._getFlags({ target }).is({ flag, status: "open" }))
          .form({ flag, reporter, reason, createdAt: flaggedAt }),
      }),
);

export const TrashItem = endpoint("/trash/trash", ({ session, item, user, at }) =>
  receive({ session, item }).then(
    where(
      now(at),
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      forumPost({ post: item }),
    )
      .then(Trashing.trash({ item, by: user, at }))
      .then(respond({ item }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
    where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      no(forumPost({ post: item })),
    )
      .then(respond({ error: "NOT_FOUND" }))
      .named("missing"),
  ),
);

export const RestoreItem = endpoint("/trash/restore", ({ session, item, user }) =>
  receive({ session, item }).then(
    where(activeUser({ session }).is({ user }), mayModerate({ user }), forumPost({ post: item }))
      .then(Trashing.restore({ item }))
      .then(respond({ item }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
    where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      no(forumPost({ post: item })),
    )
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const PurgeItem = endpoint("/trash/purge", ({ session, item, user }) =>
  receive({ session, item }).then(
    where(activeUser({ session }).is({ user }), mayModerate({ user }), forumPost({ post: item }))
      .then(Trashing.purge({ item }))
      .then(respond({ item }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
    where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      no(forumPost({ post: item })),
    )
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const TrashList = endpoint("/trash/list", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayModerate({ user }))
      .then(respond({ trashed: theTrashBin({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const IsTrashed = endpoint("/trash/isTrashed", ({ session, item, trashed, user }) =>
  receive({ session, item }).then(
    where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      forumPost({ post: item }),
      Trashing._isTrashed({ item }).is({ trashed }),
    )
      .then(respond({ trashed }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
    where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      no(forumPost({ post: item })),
    )
      .then(respond({ error: "NOT_FOUND" }))
      .named("missing"),
  ),
);

export const GetTrashedPost = endpoint("/moderation/posts/get", ({ session, item, user }) =>
  receive({ session, item }).then(
    where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      forumPost({ post: item }),
      Trashing._isTrashed({ item }).is({ trashed: true }),
    )
      .then(respond({ post: thePost({ post: item }) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
    where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      no(forumPost({ post: item })),
    )
      .then(respond({ error: "NOT_FOUND" }))
      .named("missing"),
    where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      forumPost({ post: item }),
      Trashing._isTrashed({ item }).is({ trashed: false }),
    )
      .then(respond({ error: "NOT_FOUND" }))
      .named("live"),
  ),
);

export const LockTarget = endpoint("/locks/lock", ({ session, target, user, at }) =>
  receive({ session, target }).then(
    where(
      now(at),
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      publicTarget({ target }),
    )
      .then(Locking.lock({ target, at }))
      .then(respond({ target }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
    where(activeUser({ session }).is({ user }), mayModerate({ user }), no(publicTarget({ target })))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const UnlockTarget = endpoint("/locks/unlock", ({ session, target, user }) =>
  receive({ session, target }).then(
    where(activeUser({ session }).is({ user }), mayModerate({ user }), publicTarget({ target }))
      .then(Locking.unlock({ target }))
      .then(respond({ target }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
    where(activeUser({ session }).is({ user }), mayModerate({ user }), no(publicTarget({ target })))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const LockList = endpoint("/locks/list", () =>
  receive().then(respond({ locked: theLockedList({}) })),
);

export const IsLocked = endpoint("/locks/isLocked", ({ target, locked }) =>
  receive({ target }).then(
    where(publicTarget({ target }), Locking._isLocked({ target }).is({ locked }))
      .then(respond({ locked }))
      .named("success"),
    where(no(publicTarget({ target })))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const FlagRaise = endpoint("/flags/raise", ({ session, target, reason, user, at, flag }) =>
  receive({ session, target, reason }).then(
    where(now(at), activeUser({ session }).is({ user }), readable({ post: target }))
      .then(Flagging.flag({ reporter: user, target, reason, at }).responds({ flag }))
      .then(respond({ flag }))
      .named("success"),
    where(activeUser({ session }), notReadable({ post: target }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const FlagResolve = endpoint(
  "/flags/resolve",
  ({ session, target, outcome, user }) =>
    receive({ session, target, outcome }).then(
      where(activeUser({ session }).is({ user }), mayModerate({ user }), readable({ post: target }))
        .then(Flagging.resolve({ target, outcome }))
        .then(respond({ target }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        notReadable({ post: target }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "target", "outcome"] } },
);

export const FlagsOpen = endpoint("/flags/open", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayModerate({ user }))
      .then(respond({ targets: theOpenFlags({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const FlagsForTarget = endpoint("/flags/forTarget", ({ session, target, user }) =>
  receive({ session, target }).then(
    where(activeUser({ session }).is({ user }), mayModerate({ user }), readable({ post: target }))
      .then(respond({ flags: theFlagsOn({ target }) }))
      .named("target"),
    where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("target-hidden"),
    where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      notReadable({ post: target }),
    )
      .then(respond({ error: "NOT_FOUND" }))
      .named("missing-target"),
  ),
);
