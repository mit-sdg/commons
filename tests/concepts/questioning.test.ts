import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/questioning/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoQuestioningConcept } from "../../src/concepts/questioning/questioning.mongo.ts";

const floors: [string, () => Promise<MongoQuestioningConcept>][] = [
  ["on MongoDB", async () => new MongoQuestioningConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

for (const [floor, make] of floors) {
  describe(`Questioning ${floor}`, () => {
    const at = new Date("2026-02-02T10:00:00Z");

    test("compose records the author, title, form, and creation time", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Photosynthesis check",
        form: "quiz",
        disclosure: "score",
        at,
      });
      expect(await questioning._getQuestionnaire({ questionnaire })).toEqual([
        {
          author: "lee",
          title: "Photosynthesis check",
          form: "quiz",
          disclosure: "score",
          createdAt: at,
          retired: false,
        },
      ]);
    });

    test("composing with an unknown form refuses", async () => {
      const questioning = await make();
      const err = await refusal(() =>
        questioning.compose({ author: "lee", title: "x", form: "poll", disclosure: "score", at }),
      );
      expect(err).toBeInstanceOf(refusalErrors.UnknownForm);
    });

    test("questions stand in position order and revise in place", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const second = await questioning.addQuestion({
        questionnaire,
        prompt: "Second?",
        choices: [],
        expected: "",
        explanation: "",
        position: 2,
      });
      const first = await questioning.addQuestion({
        questionnaire,
        prompt: "First?",
        choices: ["a", "b"],
        expected: "b",
        explanation: "because",
        position: 1,
      });
      expect((await questioning._getQuestions({ questionnaire })).map((q) => q.prompt)).toEqual([
        "First?",
        "Second?",
      ]);
      await questioning.reviseQuestion({
        question: second.question,
        prompt: "Second, revised?",
        choices: ["x"],
        expected: "x",
        explanation: "",
        position: 2,
      });
      expect(await questioning._getQuestion({ question: second.question })).toEqual([
        {
          questionnaire,
          prompt: "Second, revised?",
          choices: ["x"],
          expected: "x",
          explanation: "",
          position: 2,
        },
      ]);
      expect(await questioning._getQuestion({ question: first.question })).toEqual([
        {
          questionnaire,
          prompt: "First?",
          choices: ["a", "b"],
          expected: "b",
          explanation: "because",
          position: 1,
        },
      ]);
    });

    test("removeQuestion deletes only that question", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const kept = await questioning.addQuestion({
        questionnaire,
        prompt: "Kept?",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      });
      const dropped = await questioning.addQuestion({
        questionnaire,
        prompt: "Dropped?",
        choices: [],
        expected: "",
        explanation: "",
        position: 2,
      });
      await questioning.removeQuestion({ question: dropped.question });
      expect((await questioning._getQuestions({ questionnaire })).map((q) => q.question)).toEqual([
        kept.question,
      ]);
      const err = await refusal(() => questioning.removeQuestion({ question: dropped.question }));
      expect(err).toBeInstanceOf(refusalErrors.QuestionNotFound);
    });

    test("a retired questionnaire keeps its questions and accepts no change", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const { question } = await questioning.addQuestion({
        questionnaire,
        prompt: "Only?",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      });
      await questioning.retire({ questionnaire });
      expect((await questioning._getQuestionnaire({ questionnaire }))[0]?.retired).toBe(true);
      expect((await questioning._getQuestions({ questionnaire })).length).toBe(1);
      for (const change of [
        () => questioning.retitle({ questionnaire, title: "New" }),
        () =>
          questioning.addQuestion({
            questionnaire,
            prompt: "More?",
            choices: [],
            expected: "",
            explanation: "",
            position: 2,
          }),
        () =>
          questioning.reviseQuestion({
            question,
            prompt: "Changed?",
            choices: [],
            expected: "",
            explanation: "",
            position: 1,
          }),
        () => questioning.removeQuestion({ question }),
        () => questioning.retire({ questionnaire }),
      ]) {
        const err = await refusal(change);
        expect(err).toBeInstanceOf(refusalErrors.QuestionnaireRetired);
      }
    });

    test("_expectedAnswers collects only questions proposing an answer, in position order", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const graded = await questioning.addQuestion({
        questionnaire,
        prompt: "Graded?",
        choices: ["yes", "no"],
        expected: "yes",
        explanation: "why",
        position: 2,
      });
      await questioning.addQuestion({
        questionnaire,
        prompt: "Open?",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      });
      expect(await questioning._expectedAnswers({ questionnaire })).toEqual([
        {
          expectations: [{ item: graded.question, expected: "yes", explanation: "why" }],
        },
      ]);
      expect(await questioning._expectedAnswers({ questionnaire: "no-such" })).toEqual([]);
    });

    test("unknown questionnaires refuse with QUESTIONNAIRE_NOT_FOUND", async () => {
      const questioning = await make();
      const err = await refusal(() => questioning.retitle({ questionnaire: "none", title: "x" }));
      expect(err).toBeInstanceOf(refusalErrors.QuestionnaireNotFound);
    });
  });
}
