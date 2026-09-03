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

    test("Questioning trims the text it retains", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "  Photosynthesis check  ",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const { question } = await questioning.addQuestion({
        questionnaire,
        prompt: "  Which pigment?  ",
        choices: ["  chlorophyll  ", " carotene "],
        expected: " chlorophyll ",
        explanation: "  It captures light.  ",
        position: 1,
      });
      expect((await questioning._getQuestionnaire({ questionnaire }))[0]?.title).toBe(
        "Photosynthesis check",
      );
      expect(await questioning._getQuestion({ question })).toEqual([
        {
          questionnaire,
          prompt: "Which pigment?",
          choices: ["chlorophyll", "carotene"],
          expected: "chlorophyll",
          explanation: "It captures light.",
          parts: [],
          cap: 0,
          position: 1,
        },
      ]);
      await questioning.retitle({ questionnaire, title: "  Revised title  " });
      expect((await questioning._getQuestionnaire({ questionnaire }))[0]?.title).toBe(
        "Revised title",
      );
    });

    test("compose and retitle require a nonblank title no longer than 200 characters", async () => {
      const questioning = await make();
      for (const title of ["   ", "x".repeat(201)]) {
        const err = await refusal(() =>
          questioning.compose({ author: "lee", title, form: "quiz", disclosure: "score", at }),
        );
        expect(err).toBeInstanceOf(refusalErrors.InvalidTitle);
      }
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "x".repeat(200),
        form: "quiz",
        disclosure: "score",
        at,
      });
      const err = await refusal(() => questioning.retitle({ questionnaire, title: "\t" }));
      expect(err).toBeInstanceOf(refusalErrors.InvalidTitle);
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
          parts: [],
          cap: 0,
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
          parts: [],
          cap: 0,
          position: 1,
        },
      ]);
    });

    test("question material observes its intrinsic limits", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "answers",
        at,
      });
      const invalid: Array<{
        material: { prompt: string; choices: string[]; expected: string; explanation: string };
        error: new (...args: never[]) => Error;
      }> = [
        {
          material: { prompt: " ", choices: [], expected: "", explanation: "" },
          error: refusalErrors.InvalidPrompt,
        },
        {
          material: {
            prompt: "x".repeat(10_001),
            choices: [],
            expected: "",
            explanation: "",
          },
          error: refusalErrors.InvalidPrompt,
        },
        {
          material: {
            prompt: "Many?",
            choices: Array.from({ length: 51 }, (_, index) => `${index}`),
            expected: "",
            explanation: "",
          },
          error: refusalErrors.InvalidChoices,
        },
        {
          material: { prompt: "Blank?", choices: ["yes", " "], expected: "", explanation: "" },
          error: refusalErrors.InvalidChoices,
        },
        {
          material: {
            prompt: "Long?",
            choices: ["x".repeat(501)],
            expected: "",
            explanation: "",
          },
          error: refusalErrors.InvalidChoices,
        },
        {
          material: {
            prompt: "Same?",
            choices: [" Yes ", "yes"],
            expected: "",
            explanation: "",
          },
          error: refusalErrors.DuplicateChoices,
        },
        {
          material: {
            prompt: "Exact?",
            choices: ["Yes", "No"],
            expected: "yes",
            explanation: "",
          },
          error: refusalErrors.InvalidExpected,
        },
        {
          material: {
            prompt: "Written?",
            choices: [],
            expected: "x".repeat(2_001),
            explanation: "",
          },
          error: refusalErrors.InvalidReference,
        },
        {
          material: {
            prompt: "Why?",
            choices: [],
            expected: "",
            explanation: "x".repeat(2_001),
          },
          error: refusalErrors.InvalidExplanation,
        },
      ];
      for (const { material, error } of invalid) {
        const err = await refusal(() =>
          questioning.addQuestion({ questionnaire, ...material, position: 1 }),
        );
        expect(err).toBeInstanceOf(error);
      }

      const boundary = await questioning.addQuestion({
        questionnaire,
        prompt: "x".repeat(10_000),
        choices: [],
        expected: "r".repeat(2_000),
        explanation: "e".repeat(2_000),
        position: 1,
      });
      expect(
        (await questioning._getQuestion({ question: boundary.question }))[0]?.prompt.length,
      ).toBe(10_000);
    });

    test("reviseQuestion applies the same material rules without changing the question", async () => {
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
        prompt: "Original?",
        choices: ["a", "b"],
        expected: "a",
        explanation: "",
        position: 1,
      });
      const err = await refusal(() =>
        questioning.reviseQuestion({
          question,
          prompt: "Revised?",
          choices: ["same", " SAME "],
          expected: "same",
          explanation: "",
          position: 2,
        }),
      );
      expect(err).toBeInstanceOf(refusalErrors.DuplicateChoices);
      expect((await questioning._getQuestion({ question }))[0]?.prompt).toBe("Original?");
    });

    test("the 100-question boundary holds under concurrent additions and reopens on removal", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Question bank",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const attempts = await Promise.allSettled(
        Array.from({ length: 101 }, (_, index) =>
          questioning.addQuestion({
            questionnaire,
            prompt: `Question ${index + 1}?`,
            choices: [],
            expected: "",
            explanation: "",
            position: index + 1,
          }),
        ),
      );
      const accepted = attempts.filter((attempt) => attempt.status === "fulfilled");
      const refused = attempts.filter((attempt) => attempt.status === "rejected");
      expect(accepted).toHaveLength(100);
      expect(refused).toHaveLength(1);
      expect(refused[0]?.reason).toBeInstanceOf(refusalErrors.QuestionLimitReached);
      expect(await questioning._getQuestions({ questionnaire })).toHaveLength(100);

      const first = accepted[0];
      if (first?.status !== "fulfilled") throw new Error("expected an accepted question");
      await questioning.removeQuestion({ question: first.value.question });
      await questioning.addQuestion({
        questionnaire,
        prompt: "Replacement?",
        choices: [],
        expected: "",
        explanation: "",
        position: 101,
      });
      expect(await questioning._getQuestions({ questionnaire })).toHaveLength(100);
    });

    test("legacy material over the limit must return below it before another addition", async () => {
      const db = await testDb();
      const questioning = new MongoQuestioningConcept(db);
      const questionnaire = "legacy-over-limit";
      await db
        .collection<{ _id: string; [field: string]: unknown }>("questioning.questionnaires")
        .insertOne({
          _id: questionnaire,
          author: "lee",
          title: "Legacy bank",
          form: "quiz",
          disclosure: "score",
          createdAt: at,
          retired: false,
          seq: 1,
        });
      await db
        .collection<{ _id: string; [field: string]: unknown }>("questioning.questions")
        .insertMany(
          Array.from({ length: 101 }, (_, index) => ({
            _id: `legacy-question-${index + 1}`,
            questionnaire,
            prompt: `Question ${index + 1}?`,
            choices: [],
            expected: "",
            explanation: "",
            position: index + 1,
          })),
        );

      await questioning.removeQuestion({ question: "legacy-question-1" });
      const stillFull = await refusal(() =>
        questioning.addQuestion({
          questionnaire,
          prompt: "Still too soon?",
          choices: [],
          expected: "",
          explanation: "",
          position: 102,
        }),
      );
      expect(stillFull).toBeInstanceOf(refusalErrors.QuestionLimitReached);

      await questioning.removeQuestion({ question: "legacy-question-2" });
      await questioning.addQuestion({
        questionnaire,
        prompt: "Now there is room?",
        choices: [],
        expected: "",
        explanation: "",
        position: 102,
      });
      expect(await questioning._getQuestions({ questionnaire })).toHaveLength(100);
    });

    test("a failed insertion returns its reserved question place", async () => {
      const db = await testDb();
      const questioning = new MongoQuestioningConcept(db);
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Question bank",
        form: "quiz",
        disclosure: "score",
        at,
      });
      for (let position = 1; position <= 99; position += 1) {
        await questioning.addQuestion({
          questionnaire,
          prompt: `Question ${position}?`,
          choices: [],
          expected: "",
          explanation: "",
          position,
        });
      }
      await db
        .collection("questioning.questions")
        .createIndex({ questionnaire: 1, position: 1 }, { unique: true });

      await expect(
        questioning.addQuestion({
          questionnaire,
          prompt: "Conflicting position?",
          choices: [],
          expected: "",
          explanation: "",
          position: 1,
        }),
      ).rejects.toThrow();
      await questioning.addQuestion({
        questionnaire,
        prompt: "Last available place?",
        choices: [],
        expected: "",
        explanation: "",
        position: 100,
      });
      expect(await questioning._getQuestions({ questionnaire })).toHaveLength(100);
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
            {
              prompt: "First?",
              choices: ["a", "b"],
              expected: "b",
              explanation: "because",
              parts: [],
              cap: 0,
            },
            {
              prompt: "Second?",
              choices: [],
              expected: "",
              explanation: "",
              parts: [],
              cap: 0,
            },
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

    test("present returns one complete ordered authored value", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "  Plant check  ",
        form: "quiz",
        disclosure: "answers",
        at,
      });
      const second = await questioning.addQuestion({
        questionnaire,
        prompt: "Second?",
        choices: [],
        expected: "A reference",
        explanation: "Read more",
        position: 2,
      });
      const first = await questioning.addQuestion({
        questionnaire,
        prompt: "First?",
        choices: ["a", "b"],
        expected: "b",
        explanation: "Because",
        position: 1,
      });

      expect(await questioning.present({ questionnaire })).toEqual({
        presentation: {
          title: "Plant check",
          form: "quiz",
          disclosure: "answers",
          questions: [
            {
              item: first.question,
              prompt: "First?",
              choices: ["a", "b"],
              expected: "b",
              explanation: "Because",
              parts: [],
              cap: 0,
              position: 1,
            },
            {
              item: second.question,
              prompt: "Second?",
              choices: [],
              expected: "A reference",
              explanation: "Read more",
              parts: [],
              cap: 0,
              position: 2,
            },
          ],
        },
        form: "quiz",
        disclosure: "answers",
        proposes: true,
        expectations: [{ item: first.question, expected: "b", explanation: "Because" }],
      });
      await questioning.retitle({ questionnaire, title: "Plant check, revised" });
      expect((await questioning._getQuestionnaire({ questionnaire }))[0]?.title).toBe(
        "Plant check, revised",
      );
    });

    test("present refuses missing and retired questionnaires", async () => {
      const questioning = await make();
      const missing = await refusal(() => questioning.present({ questionnaire: "no-such" }));
      expect(missing).toBeInstanceOf(refusalErrors.QuestionnaireNotFound);

      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Retired quiz",
        form: "quiz",
        disclosure: "score",
        at,
      });
      await questioning.retire({ questionnaire });
      const retired = await refusal(() => questioning.present({ questionnaire }));
      expect(retired).toBeInstanceOf(refusalErrors.QuestionnaireRetired);
    });

    test("present proposes only nonempty expected answers on choice questions", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Ungraded check",
        form: "quiz",
        disclosure: "answers",
        at,
      });
      await questioning.addQuestion({
        questionnaire,
        prompt: "Choose freely.",
        choices: ["a", "b"],
        expected: "",
        explanation: "",
        position: 1,
      });
      await questioning.addQuestion({
        questionnaire,
        prompt: "Write freely.",
        choices: [],
        expected: "A written reference",
        explanation: "For later comparison",
        position: 2,
      });

      const result = await questioning.present({ questionnaire });
      expect(result.form).toBe(result.presentation.form);
      expect(result.disclosure).toBe(result.presentation.disclosure);
      expect(result.proposes).toBe(false);
      expect(result.expectations).toEqual([]);
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

    test("a written answer's expected is a reference, not an expectation", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "answers",
        at,
      });
      const written = await questioning.addQuestion({
        questionnaire,
        prompt: "Name the pigment.",
        choices: [],
        expected: "Chlorophyll",
        explanation: "It captures light.",
        position: 1,
      });
      expect(await questioning._proposesAnswers({ questionnaire })).toEqual({ proposes: false });
      expect(await questioning._expectedAnswers({ questionnaire })).toEqual([{ expectations: [] }]);
      expect(await questioning._references({ questionnaire })).toEqual([
        {
          question: written.question,
          prompt: "Name the pigment.",
          expected: "Chlorophyll",
          explanation: "It captures light.",
          position: 1,
        },
      ]);
    });

    test("_references answers the written questions keeping one, in position order", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "answers",
        at,
      });
      const later = await questioning.addQuestion({
        questionnaire,
        prompt: "Later written?",
        choices: [],
        expected: "second",
        explanation: "",
        position: 3,
      });
      const earlier = await questioning.addQuestion({
        questionnaire,
        prompt: "Earlier written?",
        choices: [],
        expected: "first",
        explanation: "",
        position: 1,
      });
      await questioning.addQuestion({
        questionnaire,
        prompt: "Chosen?",
        choices: ["yes", "no"],
        expected: "yes",
        explanation: "",
        position: 2,
      });
      await questioning.addQuestion({
        questionnaire,
        prompt: "Bare written?",
        choices: [],
        expected: "",
        explanation: "",
        position: 4,
      });
      expect((await questioning._references({ questionnaire })).map((row) => row.question)).toEqual(
        [earlier.question, later.question],
      );
    });

    test("_references answers no rows when nothing keeps one", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "score",
        at,
      });
      await questioning.addQuestion({
        questionnaire,
        prompt: "Chosen?",
        choices: ["yes", "no"],
        expected: "yes",
        explanation: "",
        position: 1,
      });
      expect(await questioning._references({ questionnaire })).toEqual([]);
      expect(await questioning._references({ questionnaire: "no-such" })).toEqual([]);
    });

    test("setParts gives a question labeled boxes or one box repeated to a cap", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Warm-up",
        form: "survey",
        disclosure: "score",
        at,
      });
      const { question: boxes } = await questioning.addQuestion({
        questionnaire,
        prompt: "Name three.",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      });
      const { question: repeated } = await questioning.addQuestion({
        questionnaire,
        prompt: "Name up to six.",
        choices: [],
        expected: "",
        explanation: "",
        position: 2,
      });
      // A new question takes no parts.
      expect((await questioning._getQuestion({ question: boxes }))[0]).toMatchObject({
        parts: [],
        cap: 0,
      });

      expect(
        await questioning.setParts({
          question: boxes,
          parts: ["  one  ", "two", "three"],
          cap: 0,
        }),
      ).toEqual({ question: boxes });
      expect((await questioning._getQuestion({ question: boxes }))[0]).toMatchObject({
        parts: ["one", "two", "three"],
        cap: 0,
      });

      expect(
        await questioning.setParts({ question: repeated, parts: [" a thing "], cap: 6 }),
      ).toEqual({ question: repeated });
      expect((await questioning._getQuestion({ question: repeated }))[0]).toMatchObject({
        parts: ["a thing"],
        cap: 6,
      });

      // Clearing puts a question back to taking one answer.
      await questioning.setParts({ question: repeated, parts: [], cap: 0 });
      expect((await questioning._getQuestion({ question: repeated }))[0]).toMatchObject({
        parts: [],
        cap: 0,
      });
    });

    test("setParts refuses parts and a cap that are not valid together", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Warm-up",
        form: "survey",
        disclosure: "score",
        at,
      });
      const { question } = await questioning.addQuestion({
        questionnaire,
        prompt: "Name three.",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      });
      for (const invalid of [
        { parts: [], cap: 3 },
        { parts: ["one", "two"], cap: 3 },
        { parts: ["one"], cap: 1 },
        { parts: ["one"], cap: 21 },
        { parts: ["one"], cap: -1 },
        { parts: ["one"], cap: 2.5 },
        { parts: Array.from({ length: 13 }, (_, index) => `part ${index}`), cap: 0 },
        { parts: ["   "], cap: 0 },
        { parts: ["x".repeat(41)], cap: 0 },
        { parts: ["One", " one "], cap: 0 },
      ]) {
        const err = await refusal(() => questioning.setParts({ question, ...invalid }));
        expect(err).toBeInstanceOf(refusalErrors.InvalidParts);
      }
      // A boundary of each valid pairing stands.
      await questioning.setParts({
        question,
        parts: Array.from({ length: 12 }, (_, index) => `part ${index}`),
        cap: 0,
      });
      await questioning.setParts({ question, parts: ["x".repeat(40)], cap: 20 });
      expect((await questioning._getQuestion({ question }))[0]).toMatchObject({
        parts: ["x".repeat(40)],
        cap: 20,
      });
    });

    test("setParts refuses an unknown question and a retired questionnaire", async () => {
      const questioning = await make();
      expect(
        await refusal(() => questioning.setParts({ question: "no-such", parts: [], cap: 0 })),
      ).toBeInstanceOf(refusalErrors.QuestionNotFound);

      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Retired",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const { question } = await questioning.addQuestion({
        questionnaire,
        prompt: "Anything?",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      });
      await questioning.retire({ questionnaire });
      expect(
        await refusal(() => questioning.setParts({ question, parts: ["one"], cap: 0 })),
      ).toBeInstanceOf(refusalErrors.QuestionnaireRetired);
    });

    test("a question offers choices or takes parts, never both", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "score",
        at,
      });
      const { question: chosen } = await questioning.addQuestion({
        questionnaire,
        prompt: "Which pigment?",
        choices: ["a", "b"],
        expected: "a",
        explanation: "",
        position: 1,
      });
      expect(
        await refusal(() => questioning.setParts({ question: chosen, parts: ["one"], cap: 0 })),
      ).toBeInstanceOf(refusalErrors.InvalidParts);
      // Clearing parts is always allowed, choices or not.
      expect(await questioning.setParts({ question: chosen, parts: [], cap: 0 })).toEqual({
        question: chosen,
      });

      const { question: parted } = await questioning.addQuestion({
        questionnaire,
        prompt: "Name three.",
        choices: [],
        expected: "",
        explanation: "",
        position: 2,
      });
      await questioning.setParts({ question: parted, parts: ["one", "two", "three"], cap: 0 });
      expect(
        await refusal(() =>
          questioning.reviseQuestion({
            question: parted,
            prompt: "Name three.",
            choices: ["a", "b"],
            expected: "a",
            explanation: "",
            position: 2,
          }),
        ),
      ).toBeInstanceOf(refusalErrors.InvalidParts);
      // The question is untouched, and revising it without choices still stands.
      expect((await questioning._getQuestion({ question: parted }))[0]).toMatchObject({
        prompt: "Name three.",
        choices: [],
        parts: ["one", "two", "three"],
        cap: 0,
      });
      await questioning.reviseQuestion({
        question: parted,
        prompt: "Name three things.",
        choices: [],
        expected: "",
        explanation: "",
        position: 2,
      });
      expect((await questioning._getQuestion({ question: parted }))[0]).toMatchObject({
        prompt: "Name three things.",
        parts: ["one", "two", "three"],
        cap: 0,
      });
    });

    test("parts and cap are carried by _getQuestions, _material, and present", async () => {
      const questioning = await make();
      const { questionnaire } = await questioning.compose({
        author: "lee",
        title: "Warm-up",
        form: "survey",
        disclosure: "score",
        at,
      });
      const { question } = await questioning.addQuestion({
        questionnaire,
        prompt: "Name three.",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      });
      await questioning.setParts({ question, parts: ["one", "two", "three"], cap: 0 });

      expect(await questioning._getQuestions({ questionnaire })).toEqual([
        {
          question,
          prompt: "Name three.",
          choices: [],
          expected: "",
          explanation: "",
          parts: ["one", "two", "three"],
          cap: 0,
          position: 1,
        },
      ]);
      expect(await questioning._material({ questionnaire })).toEqual([
        {
          form: "survey",
          material: [
            {
              prompt: "Name three.",
              choices: [],
              expected: "",
              explanation: "",
              parts: ["one", "two", "three"],
              cap: 0,
            },
          ],
        },
      ]);
      const presented = await questioning.present({ questionnaire });
      expect(presented.presentation.questions).toEqual([
        {
          item: question,
          prompt: "Name three.",
          choices: [],
          expected: "",
          explanation: "",
          parts: ["one", "two", "three"],
          cap: 0,
          position: 1,
        },
      ]);
    });

    test("_materials answers several questionnaires in the order asked for", async () => {
      const questioning = await make();
      expect(await questioning._materials({ questionnaires: [] })).toEqual({ materials: [] });

      const first = await questioning.compose({
        author: "lee",
        title: "Warm-up",
        form: "survey",
        disclosure: "score",
        at,
      });
      const second = await questioning.compose({
        author: "lee",
        title: "Quiz",
        form: "quiz",
        disclosure: "score",
        at,
      });
      await questioning.addQuestion({
        questionnaire: first.questionnaire,
        prompt: "Second?",
        choices: [],
        expected: "",
        explanation: "",
        position: 2,
      });
      const { question } = await questioning.addQuestion({
        questionnaire: first.questionnaire,
        prompt: "First?",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      });
      await questioning.setParts({ question, parts: ["a thing"], cap: 4 });

      // The given order, questions in position order, and no entry at all for
      // an identity that names no questionnaire.
      expect(
        await questioning._materials({
          questionnaires: [second.questionnaire, "no-such", first.questionnaire],
        }),
      ).toEqual({
        materials: [
          { questionnaire: second.questionnaire, title: "Quiz", questions: [] },
          {
            questionnaire: first.questionnaire,
            title: "Warm-up",
            questions: [
              {
                prompt: "First?",
                choices: [],
                expected: "",
                explanation: "",
                parts: ["a thing"],
                cap: 4,
              },
              {
                prompt: "Second?",
                choices: [],
                expected: "",
                explanation: "",
                parts: [],
                cap: 0,
              },
            ],
          },
        ],
      });
      expect(await questioning._materials({ questionnaires: ["no-such"] })).toEqual({
        materials: [],
      });
    });

    test("unknown questionnaires refuse with QUESTIONNAIRE_NOT_FOUND", async () => {
      const questioning = await make();
      const err = await refusal(() => questioning.retitle({ questionnaire: "none", title: "x" }));
      expect(err).toBeInstanceOf(refusalErrors.QuestionnaireNotFound);
    });
  });
}
