import { each, former } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts/index.ts";
import { notReadable, readable } from "./posts.ts";

const { Linking } = concepts;

/** Which sources link to this target? */
export const theBacklinksOf = former("the backlinks of (target)", ({ target }, { source }) =>
  each(Linking._getBacklinks({ target }).is({ source }))
    .where(readable({ post: source }))
    .form({ source }),
);

/** Which targets does this source link to? */
export const theForwardLinksOf = former("the forward links of (source)", ({ source }, { target }) =>
  each(Linking._getLinks({ source }).is({ target }))
    .where(readable({ post: target }))
    .form({ target }),
);

export const Backlinks = endpoint(
  "/links/backlinks",
  ({ target }) =>
    receive({ target })
      .where(readable({ post: target }))
      .then(respond({ sources: theBacklinksOf({ target }) })),
  { input: { required: ["target"] } },
);

export const Forward = endpoint(
  "/links/forward",
  ({ source }) =>
    receive({ source })
      .where(readable({ post: source }))
      .then(respond({ targets: theForwardLinksOf({ source }) })),
  { input: { required: ["source"] } },
);
export const BacklinksHidden = endpoint("/links/backlinks", ({ target }) =>
  receive({ target })
    .where(notReadable({ post: target }))
    .then(respond({ error: "NOT_FOUND" })),
);
export const ForwardHidden = endpoint("/links/forward", ({ source }) =>
  receive({ source })
    .where(notReadable({ post: source }))
    .then(respond({ error: "NOT_FOUND" })),
);
