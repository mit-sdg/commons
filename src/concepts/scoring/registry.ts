import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Scoring.md" with { type: "text" };
import { MongoScoringConcept } from "./scoring.mongo.ts";
import { AlreadyGraded, KeyExists, KeyNotFound, UnknownDisclosure } from "./errors.ts";

export const scoring = registerConcept({
  class: MongoScoringConcept,
  spec,
  refusals: {
    KEY_EXISTS: KeyExists,
    UNKNOWN_DISCLOSURE: UnknownDisclosure,
    KEY_NOT_FOUND: KeyNotFound,
    ALREADY_GRADED: AlreadyGraded,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoScoringConcept(database) },
});
