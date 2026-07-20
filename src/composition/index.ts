import * as auth from "./access/auth.ts";
import * as policy from "./access/policy.ts";
import * as roles from "./access/roles.ts";
import * as session from "./access/session.ts";
import * as assignments from "./course/assignments.ts";
import * as calendar from "./course/calendar.ts";
import * as grades from "./course/grades.ts";
import * as lateDays from "./course/late-days.ts";
import * as notes from "./course/notes.ts";
import * as roster from "./course/roster.ts";
import * as submissions from "./course/submissions.ts";
import * as bookmarks from "./forum/bookmarks.ts";
import * as categories from "./forum/categories.ts";
import * as feed from "./forum/feed.ts";
import * as fragments from "./forum/fragments.ts";
import * as links from "./forum/links.ts";
import * as moderation from "./forum/moderation.ts";
import * as notifications from "./forum/notifications.ts";
import * as pins from "./forum/pins.ts";
import * as posts from "./forum/posts.ts";
import * as reactions from "./forum/reactions.ts";
import * as resolutions from "./forum/resolutions.ts";
import * as revisions from "./forum/revisions.ts";
import * as subscriptions from "./forum/subscriptions.ts";
import * as tags from "./forum/tags.ts";
import * as threads from "./forum/threads.ts";
import * as unread from "./forum/unread.ts";
import * as profiles from "./forum/profiles.ts";

export const composition = {
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
  policy,
  auth,
  roles,
  session,
  roster,
  assignments,
  submissions,
  grades,
  lateDays,
  notes,
  calendar,
};
