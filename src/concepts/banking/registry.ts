import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { BankingConcept } from "./banking.ts";
import { MongoBankingConcept } from "./banking.mongo.ts";
import {
  InsufficientBalance,
  LateDaysExceedMax,
  LateDaysMustBePositive,
  LateDaysNegative,
  LateUseAlreadyExists,
  LateUseNotFound,
} from "./errors.ts";

export const banking = registerConcept({
  class: BankingConcept,
  spec,
  queries: {
    _getTerms: "one",
    _getBalance: "one",
    _getApplied: "optional",
    _getUses: "many",
    _getUsesForItem: "many",
    _getGrants: "many",
  },
  refusals: {
    LATE_DAYS_MUST_BE_POSITIVE: {
      error: LateDaysMustBePositive,
      on: ["grant", "apply"],
      public: PublicError.INVALID_REQUEST,
    },
    LATE_DAYS_EXCEED_MAX: {
      error: LateDaysExceedMax,
      on: ["apply", "change"],
      public: PublicError.INVALID_REQUEST,
    },
    LATE_DAYS_NEGATIVE: {
      error: LateDaysNegative,
      on: ["change"],
      public: PublicError.INVALID_REQUEST,
    },
    LATE_USE_ALREADY_EXISTS: {
      error: LateUseAlreadyExists,
      on: ["apply"],
      public: PublicError.CONFLICT,
    },
    INSUFFICIENT_BALANCE: {
      error: InsufficientBalance,
      on: ["apply", "change"],
      public: PublicError.CONFLICT,
    },
    LATE_USE_NOT_FOUND: {
      error: LateUseNotFound,
      on: ["change", "cancel"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoBankingConcept(database) },
});
