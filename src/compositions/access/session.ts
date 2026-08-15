import { receive, respond } from "@mit-sdg/sync-engine/boundary";
import { no, reaction, view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../vocabulary.ts";

const { Sessioning, Timing } = concepts;

export const activeUser = view("the active user of (session)", ({ session }, { user }, { at }) =>
  where(Timing._now({}).is({ at }), Sessioning._getUser({ session, at }).is({ user })),
).optional();

export const InvalidSessionIsRejected = reaction(({ session, at }) =>
  receive({ session })
    .where(Timing._now({}).is({ at }))
    .then(
      where(
        Sessioning._isExpired({ session, at }).is({ expired: false }),
        no(activeUser({ session })),
      )
        .then(respond({ error: "UNAUTHORIZED" }))
        .named("unknown-session"),
      where(Sessioning._isExpired({ session, at }).is({ expired: true }))
        .then(Sessioning.end({ session }))
        .then(respond({ error: "UNAUTHORIZED" }))
        .named("expired-session"),
    ),
);
