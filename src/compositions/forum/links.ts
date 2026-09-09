import { activeUser } from "../access/session.ts";
import { each, former, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts.ts";
import { notReadable, readable } from "./posts.ts";

const { Linking } = concepts;

/** Which sources link to this target? */
export const theBacklinksOf = former(
  "the backlinks of (target) for (reader)",
  ({ target, reader }, { source }) =>
    each(Linking._getBacklinks({ target }).is({ source }))
      .where(readable({ post: source, reader }), readable({ post: target, reader }))
      .form({ source }),
);

/** Which targets does this source link to? */
export const theForwardLinksOf = former(
  "the forward links of (source) for (reader)",
  ({ source, reader }, { target }) =>
    each(Linking._getLinks({ source }).is({ target }))
      .where(readable({ post: source, reader }), readable({ post: target, reader }))
      .form({ target }),
);

export const Backlinks = endpoint(
  "/links/backlinks",
  ({ session, target, reader }) =>
    receive({ session, target })
      .where(activeUser({ session }).is({ user: reader }))
      .then(
        where(readable({ post: target, reader }))
          .then(respond({ sources: theBacklinksOf({ target, reader }) }))
          .named("success"),
        where(notReadable({ post: target, reader }))
          .then(respond({ error: "NOT_FOUND" }))
          .named("hidden"),
      ),
  { input: { required: ["session", "target"] } },
);

export const Forward = endpoint(
  "/links/forward",
  ({ session, source, reader }) =>
    receive({ session, source })
      .where(activeUser({ session }).is({ user: reader }))
      .then(
        where(readable({ post: source, reader }))
          .then(respond({ targets: theForwardLinksOf({ source, reader }) }))
          .named("success"),
        where(notReadable({ post: source, reader }))
          .then(respond({ error: "NOT_FOUND" }))
          .named("hidden"),
      ),
  { input: { required: ["session", "source"] } },
);
