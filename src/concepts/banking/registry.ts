import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Banking.md" with { type: "text" };
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
  class: MongoBankingConcept,
  spec,
  refusals: {
    LATE_DAYS_MUST_BE_POSITIVE: LateDaysMustBePositive,
    LATE_DAYS_EXCEED_MAX: LateDaysExceedMax,
    LATE_DAYS_NEGATIVE: LateDaysNegative,
    LATE_USE_ALREADY_EXISTS: LateUseAlreadyExists,
    INSUFFICIENT_BALANCE: InsufficientBalance,
    LATE_USE_NOT_FOUND: LateUseNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoBankingConcept(database) },
});
