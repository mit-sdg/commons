import { receive, respond } from "@mit-sdg/sync-engine/boundary";
import { no, reaction, view, where, now } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts.ts";

const { Sessioning } = concepts;

export const activeUser = view("the active user of (session)", ({ session }, { user }, _bindings) =>
  where(Sessioning._getUser({ session }).is({ user })),
).optional();

export const InvalidSessionIsRejected = reaction(({ session, at }) =>
  receive({ session })
    .where(now(at))
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
