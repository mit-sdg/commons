import { view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts.ts";

const { Sessioning, Timing } = concepts;

export const activeUser = view("the active user of (session)", ({ session }, { user }, { at }) =>
  where(Timing._now({}).is({ at }), Sessioning._getUser({ session, at }).is({ user })),
).optional();
