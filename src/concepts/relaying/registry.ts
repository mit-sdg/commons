import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Relaying.md" with { type: "text" };
import {
  ForwardDraw,
  InvalidShape,
  InvalidTitle,
  LegDrawnOn,
  LegNotFound,
  NoDraw,
  NoSuchPosition,
  NotSiblings,
  RelayNotFound,
} from "./errors.ts";
import { MongoRelayingConcept } from "./relaying.mongo.ts";

export const relaying = registerConcept({
  class: MongoRelayingConcept,
  spec,
  refusals: {
    INVALID_TITLE: InvalidTitle,
    RELAY_NOT_FOUND: RelayNotFound,
    LEG_NOT_FOUND: LegNotFound,
    LEG_DRAWN_ON: LegDrawnOn,
    NO_SUCH_POSITION: NoSuchPosition,
    FORWARD_DRAW: ForwardDraw,
    NOT_SIBLINGS: NotSiblings,
    INVALID_SHAPE: InvalidShape,
    NO_DRAW: NoDraw,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoRelayingConcept(database) },
});
