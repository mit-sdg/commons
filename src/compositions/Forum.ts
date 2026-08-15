import * as bookmarks from "./forum/bookmarks.ts";
import * as categories from "./forum/categories.ts";
import * as feed from "./forum/feed.ts";
import * as fragments from "./forum/fragments.ts";
import * as links from "./forum/links.ts";
import * as moderation from "./forum/moderation.ts";
import * as notifications from "./forum/notifications.ts";
import * as pins from "./forum/pins.ts";
import * as posts from "./forum/posts.ts";
import * as profiles from "./forum/profiles.ts";
import * as reactions from "./forum/reactions.ts";
import * as resolutions from "./forum/resolutions.ts";
import * as revisions from "./forum/revisions.ts";
import * as subscriptions from "./forum/subscriptions.ts";
import * as tags from "./forum/tags.ts";
import * as threads from "./forum/threads.ts";
import * as unread from "./forum/unread.ts";

export const compositions = {
  threads: { ...threads, ...feed },
  fragments,
  moderation,
  categories,
  tags,
  resolutions,
  posts,
  revisions,
  profiles,
  reactions,
  bookmarks,
  notifications,
  subscriptions,
  pins,
  unread,
  links,
};
