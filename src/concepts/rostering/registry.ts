import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Rostering.md" with { type: "text" };
import { MongoRosteringConcept } from "./rostering.mongo.ts";
import {
  ClassAlreadyConfigured,
  SeatAlreadyActive,
  SeatAlreadyExists,
  SeatNotActive,
  SeatNotDropped,
  SeatNotFound,
  SeatNotPending,
  SectionNotFound,
} from "./errors.ts";

export const rostering = registerConcept({
  class: MongoRosteringConcept,
  spec,
  refusals: {
    CLASS_ALREADY_CONFIGURED: ClassAlreadyConfigured,
    SECTION_NOT_FOUND: SectionNotFound,
    SEAT_NOT_FOUND: SeatNotFound,
    SEAT_NOT_PENDING: SeatNotPending,
    SEAT_ALREADY_ACTIVE: SeatAlreadyActive,
    SEAT_ALREADY_EXISTS: SeatAlreadyExists,
    SEAT_NOT_ACTIVE: SeatNotActive,
    SEAT_NOT_DROPPED: SeatNotDropped,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoRosteringConcept(database) },
});
