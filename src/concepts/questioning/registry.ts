import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Questioning.md" with { type: "text" };
import { MongoQuestioningConcept } from "./questioning.mongo.ts";
import {
  DuplicateChoices,
  InvalidChoices,
  InvalidExpected,
  InvalidExplanation,
  InvalidPrompt,
  InvalidReference,
  InvalidTitle,
  NotSiblings,
  QuestionNotFound,
  QuestionLimitReached,
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
    INVALID_TITLE: InvalidTitle,
    QUESTIONNAIRE_NOT_FOUND: QuestionnaireNotFound,
    QUESTIONNAIRE_RETIRED: QuestionnaireRetired,
    QUESTION_LIMIT_REACHED: QuestionLimitReached,
    QUESTION_NOT_FOUND: QuestionNotFound,
    INVALID_PROMPT: InvalidPrompt,
    INVALID_CHOICES: InvalidChoices,
    DUPLICATE_CHOICES: DuplicateChoices,
    INVALID_EXPECTED: InvalidExpected,
    INVALID_REFERENCE: InvalidReference,
    INVALID_EXPLANATION: InvalidExplanation,
    NOT_SIBLINGS: NotSiblings,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoQuestioningConcept(database) },
});
