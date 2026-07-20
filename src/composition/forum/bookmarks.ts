import { activeUser } from "../access/session.ts";
import { each, former, reaction, request, view, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts/index.ts";
import { thePostSummaryOf } from "./fragments.ts";
import { notReadable, readable } from "./posts.ts";

const { Bookmarking, Trashing, Timing } = concepts;

export const readableBookmarksOf = view(
  "the readable bookmarks of (user) with many (item, savedAt)",
  ({ user, item, savedAt }) =>
    where(Bookmarking._getSaved({ user }).is({ item, savedAt }), readable({ post: item })),
);

/** Which items has this user bookmarked? */
export const theBookmarksOf = former("the bookmarks of (user)", ({ user, item, savedAt }) =>
  each(readableBookmarksOf({ user }).is({ item, savedAt })).form({ item, savedAt }),
);

/** Which bookmarked posts should this user see? */
export const theBookmarkedPostsOf = former(
  "the bookmarked posts of (user)",
  ({ user, item, savedAt }) =>
    each(readableBookmarksOf({ user }).is({ item, savedAt })).form({
      item,
      savedAt,
      post: thePostSummaryOf(item),
    }),
);

export const PurgeClearsBookmarks = reaction(({ item }) =>
  when(Trashing.purge, {}, { item }).then(request(Bookmarking.clearItem, { item })),
);

export const SaveBookmark = endpoint("/bookmarks/save", ({ session, item, user, at, bookmark }) =>
  receive({ session, item })
    .where(
      Timing._now({}).is({ at }),
      activeUser({ session }).is({ user }),
      readable({ post: item }),
    )
    .then(request(Bookmarking.save, { user, item, at }, { bookmark }), respond({ bookmark })),
);

export const UnsaveBookmark = endpoint("/bookmarks/unsave", ({ session, item, user, bookmark }) =>
  receive({ session, item })
    .where(activeUser({ session }).is({ user }), readable({ post: item }))
    .then(request(Bookmarking.unsave, { user, item }, { bookmark }), respond({ bookmark })),
);
export const SaveBookmarkHidden = endpoint("/bookmarks/save", ({ session, item }) =>
  receive({ session, item })
    .where(activeUser({ session }), notReadable({ post: item }))
    .then(respond({ error: "NOT_FOUND" })),
);
export const UnsaveBookmarkHidden = endpoint("/bookmarks/unsave", ({ session, item }) =>
  receive({ session, item })
    .where(activeUser({ session }), notReadable({ post: item }))
    .then(respond({ error: "NOT_FOUND" })),
);

export const ListBookmarks = endpoint("/bookmarks/list", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }))
    .then(respond({ bookmarks: theBookmarksOf(user) })),
);

export const IsSaved = endpoint("/bookmarks/isSaved", ({ session, item, user, saved }) =>
  receive({ session, item })
    .where(
      activeUser({ session }).is({ user }),
      readable({ post: item }),
      Bookmarking._isSaved({ user, item }).is({ saved }),
    )
    .then(respond({ saved })),
);
export const IsSavedHidden = endpoint("/bookmarks/isSaved", ({ session, item }) =>
  receive({ session, item })
    .where(activeUser({ session }), notReadable({ post: item }))
    .then(respond({ error: "NOT_FOUND" })),
);
