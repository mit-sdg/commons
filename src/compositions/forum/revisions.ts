import { activeUser } from "../access/session.ts";
import { each, former, no, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts.ts";
import { mayModerate, mayNotModerate } from "../access/policy.ts";
import { intact } from "./threads.ts";

const { Posting, Revising, Trashing } = concepts;

/** What is the revision history of this item? */
export const theRevisionHistoryOf = former(
  "the revision history of (item)",
  ({ item }, { revision, number, content, savedAt }) =>
    each(Revising._getRevisions({ item }).is({ revision, number, content, savedAt })).form({
      revision,
      number,
      content,
      savedAt,
    }),
);

/** What is this numbered revision of the item? */
export const theRevisionNumberedOf = former(
  "the revision numbered (number) of (item)",
  ({ number, item }, { content, savedAt }) =>
    each(Revising._getRevision({ item, number }).is({ content, savedAt })).form({
      content,
      savedAt,
    }),
);

/** What is the latest revision of this item? */
export const theLatestRevisionOf = former(
  "the latest revision of (item)",
  ({ item }, { revision, number, content, savedAt }) =>
    each(Revising._getLatest({ item }).is({ revision, number, content, savedAt })).form({
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
  ({ item }) =>
    receive({ item }).then(
      where(Posting._getPost({ post: item }), intact({ item }))
        .then(respond({ revisions: theRevisionHistoryOf({ item }) }))
        .named("success"),
      where(Trashing._isTrashed({ item }).is({ trashed: true }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
      where(no(Posting._getPost({ post: item })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
    ),
  { input: { required: ["item"] } },
);

export const GetRevision = endpoint(
  "/revisions/get",
  ({ item, number }) =>
    receive({ item, number }).then(
      where(Posting._getPost({ post: item }), intact({ item }))
        .then(respond({ revision: theRevisionNumberedOf({ number, item }) }))
        .named("success"),
      where(Trashing._isTrashed({ item }).is({ trashed: true }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
      where(no(Posting._getPost({ post: item })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
    ),
  { input: { required: ["item", "number"] } },
);

export const LatestRevision = endpoint(
  "/revisions/latest",
  ({ item }) =>
    receive({ item }).then(
      where(Posting._getPost({ post: item }), intact({ item }))
        .then(respond({ revision: theLatestRevisionOf({ item }) }))
        .named("success"),
      where(Trashing._isTrashed({ item }).is({ trashed: true }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
      where(no(Posting._getPost({ post: item })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
    ),
  { input: { required: ["item"] } },
);

export const ModeratorListRevisions = endpoint(
  "/moderation/revisions/list",
  ({ session, item, user }) =>
    receive({ session, item }).then(
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        Posting._getPost({ post: item }),
        Trashing._isTrashed({ item }).is({ trashed: true }),
      )
        .then(respond({ revisions: theRevisionHistoryOf({ item }) }))
        .named("revisions"),
      where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        no(Posting._getPost({ post: item })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        Posting._getPost({ post: item }),
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
        Posting._getPost({ post: item }),
        Trashing._isTrashed({ item }).is({ trashed: true }),
      )
        .then(respond({ revision: theRevisionNumberedOf({ number, item }) }))
        .named("revision"),
      where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        no(Posting._getPost({ post: item })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        Posting._getPost({ post: item }),
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
        Posting._getPost({ post: item }),
        Trashing._isTrashed({ item }).is({ trashed: true }),
      )
        .then(respond({ revision: theLatestRevisionOf({ item }) }))
        .named("revision"),
      where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        no(Posting._getPost({ post: item })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        Posting._getPost({ post: item }),
        intact({ item }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("live"),
    ),
);
