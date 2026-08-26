import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Questioning.md" with { type: "text" };
import { MongoQuestioningConcept } from "./questioning.mongo.ts";
import {
  QuestionNotFound,
  QuestionnaireNotFound,
  QuestionnaireRetired,
  UnknownDisclosure,
  UnknownForm,
} from "./errors.ts";

export const questioning = registerConcept({
  class: MongoQuestioningConcept,
  spec,
  refusals: {
    UNKNOWN_FORM: UnknownForm,
    UNKNOWN_DISCLOSURE: UnknownDisclosure,
    QUESTIONNAIRE_NOT_FOUND: QuestionnaireNotFound,
    QUESTIONNAIRE_RETIRED: QuestionnaireRetired,
    QUESTION_NOT_FOUND: QuestionNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoQuestioningConcept(database) },
});
