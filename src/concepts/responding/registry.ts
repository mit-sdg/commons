import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Responding.md" with { type: "text" };
import { MongoRespondingConcept } from "./responding.mongo.ts";
import { AlreadySubmitted, AnswerBlank, NoParticipant, ResponseNotFound } from "./errors.ts";

export const responding = registerConcept({
  class: MongoRespondingConcept,
  spec,
  refusals: {
    RESPONSE_NOT_FOUND: ResponseNotFound,
    ALREADY_SUBMITTED: AlreadySubmitted,
    NO_PARTICIPANT: NoParticipant,
    BLANK_ANSWER: AnswerBlank,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoRespondingConcept(database) },
});
