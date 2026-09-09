import { audiencePreviewInput } from "./audience-inputs.ts";
import { compute, each, former, is, no, view, where, whether } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts, computations as c } from "../../concepts.ts";
import { activeUser } from "../access/session.ts";
import {
  addressableHolder,
  addressedAudience,
  audienceMember,
  community,
  conversationReader,
  forumReader,
} from "./audience-policy.ts";
const { Accessing, Authenticating, Grouping, Rostering } = concepts;
const holderName = view(
  "the retained name of (identity) as (kind)",
  ({ kind, identity }, { name }, _vars) => [
    where(
      is.among(kind, ["account"]),
      Authenticating._getById({ user: identity }).is({ username: name }),
    ),
    where(is.among(kind, ["group"]), Grouping._getGroup({ group: identity }).is({ title: name })),
    where(is.among(kind, ["section"]), Rostering._getSections({}).is({ section: identity, name })),
  ],
).optional();
export const theHolder = former(
  "the visible holder (holder)",
  ({ holder }, { kind, identity, name, label }) =>
    where(
      compute(c.holderKind, { holder }, kind),
      compute(c.holderSubject, { holder }, identity),
      whether(holderName({ kind, identity }).is({ name })),
      compute(c.audienceLabel, { kind, identity, name }, label),
    ).form({ holder, kind, identity, label }),
);
export const theOptions = former("the current audience options of (user)", ({ user }, { holder }) =>
  each(addressableHolder({ user }).is({ holder })).form({}).splicing(theHolder({ holder })),
);
export const theAudience = former(
  "the explicit audience of (conversation)",
  ({ conversation }, { holder }) =>
    each(Accessing._grants({ resource: conversation }).is({ holder }))
      .form({})
      .splicing(theHolder({ holder })),
);
export const audienceReader = view(
  "the audience reader of (conversation) through (session)",
  ({ conversation, session }, { user }, _vars) =>
    where(forumReader({ session }).is({ user }), conversationReader({ user, conversation })),
).optional();
export const Options = endpoint("/audiences/options", ({ session, user }) =>
  receive({ session }).then(
    where(forumReader({ session }).is({ user }), community({ user }))
      .then(respond({ holders: theOptions({ user }) }))
      .named("options"),
    where(activeUser({ session }).is({ user }), no(community({ user })))
      .then(respond({ error: "FORBIDDEN" }))
      .named("not-in-course"),
    where(activeUser({ session }), no(forumReader({ session })))
      .then(respond({ error: "FORBIDDEN" }))
      .named("unavailable-account"),
  ),
);
export const ForConversation = endpoint("/audiences/forConversation", ({ session, conversation }) =>
  receive({ session, conversation }).then(
    where(audienceReader({ session, conversation }))
      .then(respond({ holders: theAudience({ conversation }) }))
      .named("audience"),
    where(activeUser({ session }), no(audienceReader({ session, conversation })))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const previewAudience = view(
  "the complete audience preview of (selected) for (user)",
  ({ selected, user }, { holders }, _vars) => [
    where(
      audienceMember({ user, holders: selected }),
      compute(c.previewHolders, { user, selected, includeSender: false }, holders),
      addressedAudience({ user, holders }),
    ),
    where(
      no(audienceMember({ user, holders: selected })),
      compute(c.previewHolders, { user, selected, includeSender: true }, holders),
      addressedAudience({ user, holders }),
    ),
  ],
).optional();

export const Preview = endpoint(
  "/audiences/preview",
  ({ session, holders, user, finalHolders }) =>
    receive({ session, holders }).then(
      where(
        forumReader({ session }).is({ user }),
        previewAudience({ user, selected: holders }).is({ holders: finalHolders }),
      )
        .then(respond({ holders: finalHolders }))
        .named("preview"),
      where(forumReader({ session }).is({ user }), no(previewAudience({ user, selected: holders })))
        .then(respond({ error: "FORBIDDEN" }))
        .named("unaddressable"),
      where(no(forumReader({ session })))
        .then(respond({ error: "UNAUTHORIZED" }))
        .named("unavailable"),
    ),
  { validators: { input: audiencePreviewInput } },
);
