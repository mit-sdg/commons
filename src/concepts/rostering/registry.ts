import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { RosteringConcept } from "./rostering.ts";
import { MongoRosteringConcept } from "./rostering.mongo.ts";
import {
  ClassAlreadyConfigured,
  SeatAlreadyActive,
  SeatNotActive,
  SeatNotDropped,
  SeatNotFound,
  SeatNotPending,
  SectionNotFound,
} from "./errors.ts";

export const rostering = registerConcept({
  class: RosteringConcept,
  spec,
  queries: {
    _getSections: "many",
    _getSeatByExternalKey: "optional",
    _getSeatByUser: "optional",
    _getSeatDetail: "optional",
    _getActiveMembers: "many",
    _isActiveStudent: "one",
    _getActiveStudents: "many",
    _getUnclaimedSeats: "many",
  },
  refusals: {
    CLASS_ALREADY_CONFIGURED: {
      error: ClassAlreadyConfigured,
      on: ["configureClass"],
      public: PublicError.CONFLICT,
    },
    SECTION_NOT_FOUND: {
      error: SectionNotFound,
      on: ["updateSection"],
      public: PublicError.NOT_FOUND,
    },
    SEAT_NOT_FOUND: {
      error: SeatNotFound,
      on: ["claimSeat", "dropSeat", "reinstateSeat", "moveSection"],
      public: PublicError.NOT_FOUND,
    },
    SEAT_NOT_PENDING: {
      error: SeatNotPending,
      on: ["claimSeat"],
      public: PublicError.CONFLICT,
    },
    SEAT_ALREADY_ACTIVE: {
      error: SeatAlreadyActive,
      on: ["claimSeat", "reinstateSeat"],
      public: PublicError.CONFLICT,
    },
    SEAT_NOT_ACTIVE: {
      error: SeatNotActive,
      on: ["dropSeat"],
      public: PublicError.CONFLICT,
    },
    SEAT_NOT_DROPPED: {
      error: SeatNotDropped,
      on: ["reinstateSeat"],
      public: PublicError.CONFLICT,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoRosteringConcept(database) },
});
