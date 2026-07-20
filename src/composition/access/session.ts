import { view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts/index.ts";

const { Sessioning, Timing } = concepts;

export const activeUser = view(
  "the active user of (session) with optional (user)",
  ({ session, user, at }) =>
    where(Timing._now({}).is({ at }), Sessioning._getUser({ session, at }).is({ user })),
);
