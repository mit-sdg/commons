import { hiddenPost, storedPostReader } from "./audience-policy.ts";
import { activeUser } from "../access/session.ts";
import { each, former, no, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts.ts";
import { mayModerate, mayNotModerate } from "../access/policy.ts";
import { notReadable, readable } from "./posts.ts";
import { intact } from "./threads.ts";

const { Posting, Revising, Trashing } = concepts;

/** What is the revision history of this item? */
export const theRevisionHistoryOf = former(
  "the revision history of (item)",
  ({ item, reader }, { revision, number, content, savedAt }) =>
    each(Revising._getRevisions({ item }).is({ revision, number, content, savedAt }))
      .where(storedPostReader({ post: item, user: reader }))
      .form({
        revision,
        number,
        content,
        savedAt,
      }),
);

/** What is this numbered revision of the item? */
export const theRevisionNumberedOf = former(
  "the revision numbered (number) of (item)",
  ({ number, item, reader }, { content, savedAt }) =>
    each(Revising._getRevision({ item, number }).is({ content, savedAt }))
      .where(storedPostReader({ post: item, user: reader }))
      .form({
        content,
        savedAt,
      }),
);

/** What is the latest revision of this item? */
export const theLatestRevisionOf = former(
  "the latest revision of (item)",
  ({ item, reader }, { revision, number, content, savedAt }) =>
    each(Revising._getLatest({ item }).is({ revision, number, content, savedAt }))
      .where(storedPostReader({ post: item, user: reader }))
      .form({
        revision,
        number,
        content,
        savedAt,
      }),
);

export const RecordRevisionOnCreate = reaction(({ content, post, at }) =>
  when(Posting.create({ content, at }).responds({ post })).then(
    Revising.record({ item: post, content, at }),
  ),
);

export const RecordRevisionOnEdit = reaction(({ content, post, at }) =>
  when(Posting.edit({ content, at }).responds({ post })).then(
    Revising.record({ item: post, content, at }),
  ),
);
export const PurgeClearsRevisions = reaction(({ item }) =>
  when(Trashing.purge({}).responds({ item })).then(Revising.clearItem({ item })),
);

export const ListRevisions = endpoint(
  "/revisions/list",
  ({ session, item, user }) =>
    receive({ session, item })
      .where(activeUser({ session }).is({ user }))
      .then(
        where(readable({ post: item, reader: user }))
          .then(respond({ revisions: theRevisionHistoryOf({ item, reader: user }) }))
          .named("success"),
        where(notReadable({ post: item, reader: user }))
          .then(respond({ error: "NOT_FOUND" }))
          .named("hidden"),
      ),
  { input: { required: ["session", "item"] } },
);

export const GetRevision = endpoint(
  "/revisions/get",
  ({ session, item, number, user }) =>
    receive({ session, item, number })
      .where(activeUser({ session }).is({ user }))
      .then(
        where(readable({ post: item, reader: user }))
          .then(respond({ revision: theRevisionNumberedOf({ number, item, reader: user }) }))
          .named("success"),
        where(notReadable({ post: item, reader: user }))
          .then(respond({ error: "NOT_FOUND" }))
          .named("hidden"),
      ),
  { input: { required: ["session", "item", "number"] } },
);

export const LatestRevision = endpoint(
  "/revisions/latest",
  ({ session, item, user }) =>
    receive({ session, item })
      .where(activeUser({ session }).is({ user }))
      .then(
        where(readable({ post: item, reader: user }))
          .then(respond({ revision: theLatestRevisionOf({ item, reader: user }) }))
          .named("success"),
        where(notReadable({ post: item, reader: user }))
          .then(respond({ error: "NOT_FOUND" }))
          .named("hidden"),
      ),
  { input: { required: ["session", "item"] } },
);

export const ModeratorListRevisions = endpoint(
  "/moderation/revisions/list",
  ({ session, item, user }) =>
    receive({ session, item }).then(
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        storedPostReader({ post: item, user }),
        hiddenPost({ post: item }),
      )
        .then(respond({ revisions: theRevisionHistoryOf({ item, reader: user }) }))
        .named("revisions"),
      where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        no(storedPostReader({ post: item, user })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        storedPostReader({ post: item, user }),
        intact({ item }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("live"),
    ),
);
export const ModeratorGetRevision = endpoint(
  "/moderation/revisions/get",
  ({ session, item, number, user }) =>
    receive({ session, item, number }).then(
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        storedPostReader({ post: item, user }),
        hiddenPost({ post: item }),
      )
        .then(respond({ revision: theRevisionNumberedOf({ number, item, reader: user }) }))
        .named("revision"),
      where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        no(storedPostReader({ post: item, user })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        storedPostReader({ post: item, user }),
        intact({ item }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("live"),
    ),
);
export const ModeratorLatestRevision = endpoint(
  "/moderation/revisions/latest",
  ({ session, item, user }) =>
    receive({ session, item }).then(
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        storedPostReader({ post: item, user }),
        hiddenPost({ post: item }),
      )
        .then(respond({ revision: theLatestRevisionOf({ item, reader: user }) }))
        .named("revision"),
      where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        no(storedPostReader({ post: item, user })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        storedPostReader({ post: item, user }),
        intact({ item }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("live"),
    ),
);
