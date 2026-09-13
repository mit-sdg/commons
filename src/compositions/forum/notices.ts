import { activeUser } from "../access/session.ts";
import { establishedConversationReader, postReader, staff } from "./audience-policy.ts";
import {
  compute,
  each,
  former,
  no,
  now,
  reaction,
  view,
  when,
  where,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { computations, concepts } from "../../concepts.ts";

const { Authenticating, Conversing, NoticeSnapshotting, Notifying, Posting } = concepts;

/** Staff decide to notify; the audience is still whoever may read the post. */
export const noticeable = view(
  "(by) may notify the audience of (post)",
  ({ by, post }, _out, _vars) => where(staff({ user: by }), postReader({ user: by, post })),
).holds();

export const noticed = view("(post) has notified its audience", ({ post }, _out, _vars) =>
  where(NoticeSnapshotting._snapshot({ subject: post })),
).holds();

/** Who the notice reaches: current readers of the post, never its author. */
export const theNoticeAudienceOf = former("the notice audience of (post)", ({ post }, { user }) =>
  each(Authenticating._getUsers({}).is({ user }))
    .where(Posting._getPost({ post }).is.not({ author: user }), postReader({ user, post }))
    .count(),
);

/** Which posts of this discussion have already notified their audience? */
export const theNoticedPostsOf = former(
  "the notified posts of (conversation) for (reader)",
  ({ conversation, reader }, { item }) =>
    each(Conversing._getThread({ conversation }).is({ item }))
      .where(
        staff({ user: reader }),
        establishedConversationReader({ user: reader, conversation }),
        noticed({ post: item }),
      )
      .form({ post: item }),
);

export const Preview = endpoint("/notices/preview", ({ session, post, user }) =>
  receive({ session, post })
    .where(activeUser({ session }).is({ user }))
    .then(
      where(noticeable({ post, by: user }), no(noticed({ post })))
        .then(respond({ recipients: theNoticeAudienceOf({ post }), notified: false }))
        .named("pending"),
      where(noticeable({ post, by: user }), noticed({ post }))
        .then(respond({ recipients: theNoticeAudienceOf({ post }), notified: true }))
        .named("sent"),
      where(no(noticeable({ post, by: user })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);

export const ForConversation = endpoint(
  "/notices/forConversation",
  ({ session, conversation, user }) =>
    receive({ session, conversation })
      .where(activeUser({ session }).is({ user }))
      .then(
        where(staff({ user }), establishedConversationReader({ user, conversation }))
          .then(respond({ notices: theNoticedPostsOf({ conversation, reader: user }) }))
          .named("staff"),
        where(no(establishedConversationReader({ user, conversation })))
          .then(respond({ error: "NOT_FOUND" }))
          .named("hidden"),
        where(no(staff({ user })), establishedConversationReader({ user, conversation }))
          .then(respond({ error: "FORBIDDEN" }))
          .named("reader"),
      ),
);

/**
 * The capture is the decision to notify, not a side effect of it: Snapshotting
 * admits one per post, so a second press — or a second click racing the first —
 * is refused before any recipient is chosen.
 */
export const Notify = endpoint(
  "/notices/notify",
  ({ session, post, user, at, author, content, value, snapshot }) =>
    receive({ session, post })
      .where(activeUser({ session }).is({ user }))
      .then(
        where(
          noticeable({ post, by: user }),
          no(noticed({ post })),
          now(at),
          Posting._getPost({ post }).is({ author, content }),
          compute(computations.noticeRecord, { content, author, by: user, at }, value),
        )
          .then(NoticeSnapshotting.capture({ subject: post, value }).responds({ snapshot }))
          .then(respond({ post, recipients: theNoticeAudienceOf({ post }) }))
          .named("notify"),
        where(noticeable({ post, by: user }), noticed({ post }))
          .then(respond({ error: "CONFLICT" }))
          .named("already"),
        where(no(noticeable({ post, by: user })))
          .then(respond({ error: "NOT_FOUND" }))
          .named("hidden"),
      ),
);

export const NoticeNotifiesAudience = reaction(({ post, recipient, at }) =>
  when(NoticeSnapshotting.capture({ subject: post }).responds())
    .where(
      Authenticating._getUsers({}).is({ user: recipient }),
      Posting._getPost({ post }).is.not({ author: recipient }),
      postReader({ user: recipient, post }),
      now(at),
    )
    .then(
      Notifying.notify({
        recipient,
        kind: "audience_notice",
        subject: post,
        link: post,
        // The post already says who wrote it; staff sending it is what the
        // event kind says, exactly as every other forum notification records it.
        actor: null,
        at,
      }),
    ),
);
