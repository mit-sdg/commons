import { activeUser } from "../access/session.ts";
import { each, former, reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts/index.ts";
import { thePostSummaryOf } from "./fragments.ts";
import { notReadable, readable } from "./posts.ts";

const { Bookmarking, Trashing, Timing } = concepts;

export const readableBookmarksOf = view(
  "the readable bookmarks of (user)",
  ({ user }, { item, savedAt }, _bindings) =>
    where(Bookmarking._getSaved({ user }).is({ item, savedAt }), readable({ post: item })),
).many();

/** Which items has this user bookmarked? */
export const theBookmarksOf = former("the bookmarks of (user)", ({ user }, { item, savedAt }) =>
  each(readableBookmarksOf({ user }).is({ item, savedAt })).form({ item, savedAt }),
);

/** Which bookmarked posts should this user see? */
export const theBookmarkedPostsOf = former(
  "the bookmarked posts of (user)",
  ({ user }, { item, savedAt }) =>
    each(readableBookmarksOf({ user }).is({ item, savedAt })).form({
      item,
      savedAt,
      post: thePostSummaryOf({ item }),
    }),
);

export const PurgeClearsBookmarks = reaction(({ item }) =>
  when(Trashing.purge({}).responds({ item })).then(Bookmarking.clearItem({ item })),
);

export const SaveBookmark = endpoint("/bookmarks/save", ({ session, item, user, at, bookmark }) =>
  receive({ session, item }).then(
    where(
      Timing._now({}).is({ at }),
      activeUser({ session }).is({ user }),
      readable({ post: item }),
    )
      .then(Bookmarking.save({ user, item, at }).responds({ bookmark }))
      .then(respond({ bookmark }))
      .named("success"),
    where(activeUser({ session }), notReadable({ post: item }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const UnsaveBookmark = endpoint("/bookmarks/unsave", ({ session, item, user, bookmark }) =>
  receive({ session, item }).then(
    where(activeUser({ session }).is({ user }), readable({ post: item }))
      .then(Bookmarking.unsave({ user, item }).responds({ bookmark }))
      .then(respond({ bookmark }))
      .named("success"),
    where(activeUser({ session }), notReadable({ post: item }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const ListBookmarks = endpoint("/bookmarks/list", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }))
    .then(respond({ bookmarks: theBookmarksOf({ user }) })),
);

export const IsSaved = endpoint("/bookmarks/isSaved", ({ session, item, user, saved }) =>
  receive({ session, item }).then(
    where(
      activeUser({ session }).is({ user }),
      readable({ post: item }),
      Bookmarking._isSaved({ user, item }).is({ saved }),
    )
      .then(respond({ saved }))
      .named("success"),
    where(activeUser({ session }), notReadable({ post: item }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);
