import { activeUser } from "../access/session.ts";
import {
  each,
  form,
  former,
  no,
  reaction,
  request,
  when,
  whether,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { mayModerate, mayNotModerate } from "../access/policy.ts";
import { concepts } from "../../concepts/index.ts";
import { notReadable, readable, thePost } from "./posts.ts";
import { publicTarget } from "./threads.ts";

const { Conversing, Flagging, Formatting, Linking, Locking, Posting, Tracking, Trashing, Timing } =
  concepts;

/** Which items are in the trash? */
export const theTrashBin = former("the trash bin ()", ({ item, trashedBy, trashedAt }) =>
  each(Trashing._getTrashed({}).is({ item, trashedBy, trashedAt })).form({
    item,
    trashedBy,
    trashedAt,
  }),
);

/** Which targets are locked? */
export const theLockedList = former("the locked list ()", ({ target, lockedAt }) =>
  each(Locking._getLocked({}).is({ target, lockedAt }))
    .where(publicTarget({ target }))
    .form({ target, lockedAt }),
);

/** Which targets have open flags? */
export const theOpenFlags = former("the open flags ()", ({ target, count }) =>
  each(Flagging._getOpenTargets({}).is({ target, count }))
    .where(readable({ post: target }))
    .form({ target, count }),
);

/** Which flags are on this target? */
export const theFlagsOn = former(
  "the flags on (target)",
  ({ target, flag, reporter, reason, status, createdAt }) =>
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
  ({
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
  }) =>
    each(Flagging._getOpenTargets({}).is({ target, count }))
      .where(
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

export const PurgeDeletesPost = reaction(({ item }) =>
  when(Trashing.purge, { item })
    .where(Posting._getPost({ post: item }))
    .then(request(Posting.delete, { post: item })),
);

export const PurgeClearsFormatting = reaction(({ item }) =>
  when(Trashing.purge, { item }).then(request(Formatting.clear, { target: item })),
);

export const PurgeClearsLinks = reaction(({ item }) =>
  when(Trashing.purge, { item }).then(request(Linking.clearLinks, { source: item })),
);

export const PurgeClearsBacklinks = reaction(({ item }) =>
  when(Trashing.purge, { item }).then(request(Linking.clearBacklinks, { target: item })),
);
export const PurgeClearsFlags = reaction(({ item }) =>
  when(Trashing.purge, {}, { item }).then(request(Flagging.clearTarget, { target: item })),
);
export const PurgeUnlocksItem = reaction(({ item }) =>
  when(Trashing.purge, {}, { item })
    .where(Locking._isLocked({ target: item }).is({ locked: true }))
    .then(request(Locking.unlock, { target: item })),
);
export const PurgeUnlocksConversation = reaction(({ item, node, conversation }) =>
  when(Trashing.purge, {}, { item })
    .where(
      Conversing._getNodeByItem({ item }).is({ node }),
      Conversing._getConversation({ node }).is({ conversation }),
      Locking._isLocked({ target: conversation }).is({ locked: true }),
    )
    .then(request(Locking.unlock, { target: conversation })),
);

export const PurgeUnregistersTracking = reaction(({ item }) =>
  when(Trashing.purge, { item }).then(request(Tracking.unregister, { item })),
);
export const PurgeRemovesLeafNode = reaction(({ item, node }) =>
  when(Trashing.purge, { item })
    .where(
      Conversing._getNodeByItem({ item }).is({ node }),
      Conversing._hasChildren({ node }).is({ present: false }),
    )
    .then(request(Conversing.remove, { node })),
);

export const TrashItem = endpoint("/trash/trash", ({ session, item, user, at }) =>
  receive({ session, item })
    .where(
      Timing._now({}).is({ at }),
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      Posting._getPost({ post: item }),
    )
    .then(request(Trashing.trash, { item, by: user, at }), respond({ item })),
);

export const TrashItemForbidden = endpoint("/trash/trash", ({ session, item, user }) =>
  receive({ session, item })
    .where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const TrashItemMissing = endpoint("/trash/trash", ({ session, item, user }) =>
  receive({ session, item })
    .where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      no(Posting._getPost({ post: item })),
    )
    .then(respond({ error: "NOT_FOUND" })),
);

export const RestoreItem = endpoint("/trash/restore", ({ session, item, user }) =>
  receive({ session, item })
    .where(activeUser({ session }).is({ user }), mayModerate({ user }))
    .then(request(Trashing.restore, { item }), respond({ item })),
);

export const RestoreItemForbidden = endpoint("/trash/restore", ({ session, item, user }) =>
  receive({ session, item })
    .where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);

export const PurgeItem = endpoint("/trash/purge", ({ session, item, user }) =>
  receive({ session, item })
    .where(activeUser({ session }).is({ user }), mayModerate({ user }))
    .then(request(Trashing.purge, { item }), respond({ item })),
);

export const PurgeItemForbidden = endpoint("/trash/purge", ({ session, item, user }) =>
  receive({ session, item })
    .where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const TrashList = endpoint("/trash/list", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), mayModerate({ user }))
    .then(respond({ trashed: theTrashBin() })),
);

export const IsTrashed = endpoint("/trash/isTrashed", ({ session, item, trashed, user }) =>
  receive({ session, item })
    .where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      Trashing._isTrashed({ item }).is({ trashed }),
    )
    .then(respond({ trashed })),
);
export const TrashListHidden = endpoint("/trash/list", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
    .then(respond({ error: "NOT_FOUND" })),
);
export const IsTrashedHidden = endpoint("/trash/isTrashed", ({ session, item, user }) =>
  receive({ session, item })
    .where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
    .then(respond({ error: "NOT_FOUND" })),
);

export const GetTrashedPost = endpoint("/moderation/posts/get", ({ session, item, user }) =>
  receive({ session, item })
    .where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      Posting._getPost({ post: item }),
      Trashing._isTrashed({ item }).is({ trashed: true }),
    )
    .then(respond({ post: thePost(item) })),
);
export const GetTrashedPostHidden = endpoint("/moderation/posts/get", ({ session, item, user }) =>
  receive({ session, item })
    .where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
    .then(respond({ error: "NOT_FOUND" })),
);
export const GetTrashedPostMissing = endpoint("/moderation/posts/get", ({ session, item, user }) =>
  receive({ session, item })
    .where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      no(Posting._getPost({ post: item })),
    )
    .then(respond({ error: "NOT_FOUND" })),
);
export const GetTrashedPostLive = endpoint("/moderation/posts/get", ({ session, item, user }) =>
  receive({ session, item })
    .where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      Posting._getPost({ post: item }),
      Trashing._isTrashed({ item }).is({ trashed: false }),
    )
    .then(respond({ error: "NOT_FOUND" })),
);

export const LockTarget = endpoint("/locks/lock", ({ session, target, user, at }) =>
  receive({ session, target })
    .where(
      Timing._now({}).is({ at }),
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      publicTarget({ target }),
    )
    .then(request(Locking.lock, { target, at }), respond({ target })),
);

export const LockTargetForbidden = endpoint("/locks/lock", ({ session, target, user }) =>
  receive({ session, target })
    .where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);

export const UnlockTarget = endpoint("/locks/unlock", ({ session, target, user }) =>
  receive({ session, target })
    .where(activeUser({ session }).is({ user }), mayModerate({ user }), publicTarget({ target }))
    .then(request(Locking.unlock, { target }), respond({ target })),
);

export const UnlockTargetForbidden = endpoint("/locks/unlock", ({ session, target, user }) =>
  receive({ session, target })
    .where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const LockTargetHidden = endpoint("/locks/lock", ({ session, target, user }) =>
  receive({ session, target })
    .where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      no(publicTarget({ target })),
    )
    .then(respond({ error: "NOT_FOUND" })),
);
export const UnlockTargetHidden = endpoint("/locks/unlock", ({ session, target, user }) =>
  receive({ session, target })
    .where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      no(publicTarget({ target })),
    )
    .then(respond({ error: "NOT_FOUND" })),
);

export const LockList = endpoint("/locks/list", () =>
  receive().then(respond({ locked: theLockedList() })),
);

export const IsLocked = endpoint("/locks/isLocked", ({ target, locked }) =>
  receive({ target })
    .where(publicTarget({ target }), Locking._isLocked({ target }).is({ locked }))
    .then(respond({ locked })),
);
export const IsLockedHidden = endpoint("/locks/isLocked", ({ target }) =>
  receive({ target })
    .where(no(publicTarget({ target })))
    .then(respond({ error: "NOT_FOUND" })),
);

export const FlagRaise = endpoint("/flags/raise", ({ session, target, reason, user, at, flag }) =>
  receive({ session, target, reason })
    .where(
      Timing._now({}).is({ at }),
      activeUser({ session }).is({ user }),
      readable({ post: target }),
    )
    .then(
      request(Flagging.flag, { reporter: user, target, reason, at }, { flag }),
      respond({ flag }),
    ),
);
export const FlagRaiseHidden = endpoint("/flags/raise", ({ session, target, reason }) =>
  receive({ session, target, reason })
    .where(activeUser({ session }), notReadable({ post: target }))
    .then(respond({ error: "NOT_FOUND" })),
);

export const FlagResolve = endpoint(
  "/flags/resolve",
  ({ session, target, outcome, user }) =>
    receive({ session, target, outcome })
      .where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        readable({ post: target }),
      )
      .then(request(Flagging.resolve, { target, outcome }), respond({ target })),
  { input: { required: ["session", "target", "outcome"] } },
);

export const FlagResolveForbidden = endpoint(
  "/flags/resolve",
  ({ session, target, outcome, user }) =>
    receive({ session, target, outcome })
      .where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);
export const FlagResolveHidden = endpoint("/flags/resolve", ({ session, target, outcome, user }) =>
  receive({ session, target, outcome })
    .where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      notReadable({ post: target }),
    )
    .then(respond({ error: "NOT_FOUND" })),
);

export const FlagsOpen = endpoint("/flags/open", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), mayModerate({ user }))
    .then(respond({ targets: theOpenFlags() })),
);

export const FlagsOpenHidden = endpoint("/flags/open", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
    .then(respond({ error: "NOT_FOUND" })),
);

export const FlagsForTarget = endpoint("/flags/forTarget", ({ session, target, user }) =>
  receive({ session, target })
    .where(activeUser({ session }).is({ user }), mayModerate({ user }), readable({ post: target }))
    .then(respond({ flags: theFlagsOn(target) })),
);
export const FlagsForTargetHidden = endpoint("/flags/forTarget", ({ session, target, user }) =>
  receive({ session, target })
    .where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
    .then(respond({ error: "NOT_FOUND" })),
);
export const FlagsForMissingTarget = endpoint("/flags/forTarget", ({ session, target, user }) =>
  receive({ session, target })
    .where(
      activeUser({ session }).is({ user }),
      mayModerate({ user }),
      notReadable({ post: target }),
    )
    .then(respond({ error: "NOT_FOUND" })),
);
