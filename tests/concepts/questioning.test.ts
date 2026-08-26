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

    test("swapQuestions trades exactly the positions of the two questions", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const first = await questioning.addQuestion({
        questionnaire,
        prompt: "First?",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      });
      const second = await questioning.addQuestion({
        questionnaire,
        prompt: "Second?",
        choices: [],
        expected: "",
        explanation: "",
        position: 2,
      });
      const third = await questioning.addQuestion({
        questionnaire,
        prompt: "Third?",
        choices: [],
        expected: "",
        explanation: "",
        position: 3,
      });
      expect(
        await questioning.swapQuestions({ question: first.question, other: third.question }),
      ).toEqual({ question: first.question, other: third.question });
      expect(
        (await questioning._getQuestions({ questionnaire })).map((q) => [q.prompt, q.position]),
      ).toEqual([
        ["Third?", 1],
        ["Second?", 2],
        ["First?", 3],
      ]);
      expect((await questioning._getQuestion({ question: second.question }))[0]?.position).toBe(2);
    });

    test("swapping questions of different questionnaires refuses NOT_SIBLINGS", async () => {
      const questioning = await make();
      const here = await questioning.compose({
        author: "lee",
        title: "Here",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const there = await questioning.compose({
        author: "lee",
        title: "There",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const mine = await questioning.addQuestion({
        questionnaire: here.questionnaire,
        prompt: "Mine?",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      });
      const theirs = await questioning.addQuestion({
        questionnaire: there.questionnaire,
        prompt: "Theirs?",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      });
      const err = await refusal(() =>
        questioning.swapQuestions({ question: mine.question, other: theirs.question }),
      );
      expect(err).toBeInstanceOf(refusalErrors.NotSiblings);
    });

    test("swapping on a retired questionnaire refuses QUESTIONNAIRE_RETIRED", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const first = await questioning.addQuestion({
        questionnaire,
        prompt: "First?",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      });
      const second = await questioning.addQuestion({
        questionnaire,
        prompt: "Second?",
        choices: [],
        expected: "",
        explanation: "",
        position: 2,
      });
      await questioning.retire({ questionnaire });
      const err = await refusal(() =>
        questioning.swapQuestions({ question: first.question, other: second.question }),
      );
      expect(err).toBeInstanceOf(refusalErrors.QuestionnaireRetired);
      expect(
        (await questioning._getQuestions({ questionnaire })).map((q) => [q.prompt, q.position]),
      ).toEqual([
        ["First?", 1],
        ["Second?", 2],
      ]);
    });

    test("swapping with a question that does not exist refuses QUESTION_NOT_FOUND", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const only = await questioning.addQuestion({
        questionnaire,
        prompt: "Only?",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      });
      const missingOther = await refusal(() =>
        questioning.swapQuestions({ question: only.question, other: "no-such" }),
      );
      expect(missingOther).toBeInstanceOf(refusalErrors.QuestionNotFound);
      const missingFirst = await refusal(() =>
        questioning.swapQuestions({ question: "no-such", other: only.question }),
      );
      expect(missingFirst).toBeInstanceOf(refusalErrors.QuestionNotFound);
    });

    test("removeQuestion answers the question, its questionnaire, and the position it stood at", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const dropped = await questioning.addQuestion({
        questionnaire,
        prompt: "Dropped?",
        choices: ["a"],
        expected: "a",
        explanation: "why",
        position: 3,
      });
      expect(await questioning.removeQuestion({ question: dropped.question })).toEqual({
        question: dropped.question,
        questionnaire,
        position: 3,
      });
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

    test("_material answers the form and the questions back in position order", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "explanations",
        at,
      });
      await questioning.addQuestion({
        questionnaire,
        prompt: "Second?",
        choices: [],
        expected: "",
        explanation: "",
        position: 2,
      });
      await questioning.addQuestion({
        questionnaire,
        prompt: "First?",
        choices: ["a", "b"],
        expected: "b",
        explanation: "because",
        position: 1,
      });
      expect(await questioning._material({ questionnaire })).toEqual([
        {
          form: "quiz",
          material: [
            { prompt: "First?", choices: ["a", "b"], expected: "b", explanation: "because" },
            { prompt: "Second?", choices: [], expected: "", explanation: "" },
          ],
        },
      ]);
    });

    test("_material answers one row with empty material when there are no questions", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Survey",
        form: "survey",
        disclosure: "score",
        at,
      });
      expect(await questioning._material({ questionnaire })).toEqual([
        { form: "survey", material: [] },
      ]);
    });

    test("_material answers no rows for an unknown questionnaire", async () => {
      const questioning = await make();
      expect(await questioning._material({ questionnaire: "no-such" })).toEqual([]);
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
