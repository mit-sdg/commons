import { httpWire } from "@mit-sdg/sync-engine-http/tooling";
import type { Db } from "mongodb";
import { assembleCommons } from "./src/assembly/application.ts";
import { commonsHttpPolicy } from "./src/assembly/http-policy.ts";
import { mongoImplementations } from "./src/concepts.ts";

const policy = commonsHttpPolicy("http://127.0.0.1:3000");
// Assembly inspects protocols without executing concept methods; no connection is opened.
const artifactDatabase = { collection: () => ({}) } as unknown as Db;

export default {
  assemble: () => assembleCommons(mongoImplementations(artifactDatabase)),
  directory: new URL("./generated/", import.meta.url),
  specification: "commons.md",
  title: "Commons",
  wire: "wire.ts",
  wireName: "CommonsWire",
  conceptSet: {
    module: new URL("./src/concepts.ts", import.meta.url),
    export: "learningConcepts",
  },
  design: {
    version: 1,
    documents: [
      new URL("./design/application.md", import.meta.url),
      new URL("./design/compositions/access/auth.md", import.meta.url),
      new URL("./design/compositions/access/invitations.md", import.meta.url),
      new URL("./design/compositions/access/mail.md", import.meta.url),
      new URL("./design/compositions/access/roles.md", import.meta.url),
      new URL("./design/compositions/access/session.md", import.meta.url),
      new URL("./design/compositions/course/assignments.md", import.meta.url),
      new URL("./design/compositions/course/calendar.md", import.meta.url),
      new URL("./design/compositions/course/grade-items.md", import.meta.url),
      new URL("./design/compositions/course/grades.md", import.meta.url),
      new URL("./design/compositions/course/late-days.md", import.meta.url),
      new URL("./design/compositions/course/notes.md", import.meta.url),
      new URL("./design/compositions/course/roster.md", import.meta.url),
      new URL("./design/compositions/course/submissions.md", import.meta.url),
      new URL("./design/compositions/forum/bookmarks.md", import.meta.url),
      new URL("./design/compositions/forum/categories.md", import.meta.url),
      new URL("./design/compositions/forum/feed.md", import.meta.url),
      new URL("./design/compositions/forum/links.md", import.meta.url),
      new URL("./design/compositions/forum/moderation.md", import.meta.url),
      new URL("./design/compositions/forum/notifications.md", import.meta.url),
      new URL("./design/compositions/forum/pins.md", import.meta.url),
      new URL("./design/compositions/forum/posts.md", import.meta.url),
      new URL("./design/compositions/forum/profiles.md", import.meta.url),
      new URL("./design/compositions/forum/purge.md", import.meta.url),
      new URL("./design/compositions/forum/reactions.md", import.meta.url),
      new URL("./design/compositions/forum/resolutions.md", import.meta.url),
      new URL("./design/compositions/forum/revisions.md", import.meta.url),
      new URL("./design/compositions/forum/subscriptions.md", import.meta.url),
      new URL("./design/compositions/forum/tags.md", import.meta.url),
      new URL("./design/compositions/forum/threads.md", import.meta.url),
      new URL("./design/compositions/forum/unread.md", import.meta.url),
      new URL("./design/compositions/tasks/lists.md", import.meta.url),
      new URL("./design/compositions/tasks/notifications.md", import.meta.url),
      new URL("./design/compositions/tasks/tasks.md", import.meta.url),
    ],
  },
  projections: [httpWire({ policy, name: "CommonsWireHttp" })],
};
