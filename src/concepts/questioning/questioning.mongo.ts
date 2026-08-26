import type { Collection, Db } from "mongodb";
import {
  normalizeQuestionMaterial,
  normalizeTitle,
  QUESTIONING_LIMITS,
  type QuestionMaterialViolation,
} from "./constraints.ts";
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

const FORMS = ["quiz", "survey"];
const LEVELS = ["score", "answers", "explanations"];
function normalizedTitle(title: string): string {
  const result = normalizeTitle(title);
  if (!result.ok) throw new InvalidTitle(result.violation.message);
  return result.value;
}

function refuseMaterial(violation: QuestionMaterialViolation): never {
  const ErrorClass = {
    prompt: InvalidPrompt,
    choices: InvalidChoices,
    duplicateChoices: DuplicateChoices,
    expected: InvalidExpected,
    reference: InvalidReference,
    explanation: InvalidExplanation,
  }[violation.kind];
  throw new ErrorClass(violation.message);
}

function normalizedMaterial(input: {
  prompt: string;
  choices: string[];
  expected: string;
  explanation: string;
}) {
  const result = normalizeQuestionMaterial(input);
  if (!result.ok) refuseMaterial(result.violation);
  return result.value;
}

/**
 * Only a question that offers choices proposes its expected answer; a
 * written-answer question's expected is a reference the questionnaire keeps.
 */
const PROPOSING = { expected: { $ne: "" }, "choices.0": { $exists: true } };
const KEEPS_REFERENCE = { expected: { $ne: "" }, "choices.0": { $exists: false } };

interface QuestionnaireDoc {
  _id: string;
  author: string;
  title: string;
  form: string;
  disclosure: string;
  createdAt: Date;
  retired: boolean;
  seq: number;
  /** Atomic capacity ledger; absent only on questionnaires stored by an earlier floor. */
  questionPlaces?: number;
}

interface QuestionDoc {
  _id: string;
  questionnaire: string;
  prompt: string;
  choices: string[];
  expected: string;
  explanation: string;
  position: number;
}

export class MongoQuestioningConcept {
  private readonly questionnaires: Collection<QuestionnaireDoc>;
  private readonly questions: Collection<QuestionDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.questionnaires = db.collection<QuestionnaireDoc>("questioning.questionnaires");
    this.questions = db.collection<QuestionDoc>("questioning.questions");
    this.counters = db.collection("questioning.counters");
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "questionnaires" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async #revisable(questionnaire: string): Promise<QuestionnaireDoc> {
    const doc = await this.questionnaires.findOne({ _id: questionnaire });
    if (doc === null) {
      throw new QuestionnaireNotFound(`No questionnaire named ${questionnaire}`);
    }
    if (doc.retired) {
      throw new QuestionnaireRetired("This questionnaire was retired.");
    }
    if (doc.questionPlaces === undefined) {
      const count = await this.questions.countDocuments({ questionnaire });
      await this.questionnaires.updateOne(
        { _id: questionnaire, questionPlaces: { $exists: false } },
        { $set: { questionPlaces: QUESTIONING_LIMITS.questions - count } },
      );
    }
    return doc;
  }

  async compose({
    author,
    title,
    form,
    disclosure,
    at,
  }: {
    author: string;
    title: string;
    form: string;
    disclosure: string;
    at: Date;
  }) {
    if (!FORMS.includes(form)) {
      throw new UnknownForm("A questionnaire is a quiz or a survey.");
    }
    if (!LEVELS.includes(disclosure)) {
      throw new UnknownDisclosure("That is not a disclosure level.");
    }
    const normalized = normalizedTitle(title);
    const questionnaire = crypto.randomUUID();
    const seq = await this.#nextSeq();
    await this.questionnaires.insertOne({
      _id: questionnaire,
      author,
      title: normalized,
      form,
      disclosure,
      createdAt: at,
      retired: false,
      seq,
      questionPlaces: QUESTIONING_LIMITS.questions,
    });
    return { questionnaire };
  }

  async setDisclosure({
    questionnaire,
    disclosure,
  }: {
    questionnaire: string;
    disclosure: string;
  }) {
    await this.#revisable(questionnaire);
    if (!LEVELS.includes(disclosure)) {
      throw new UnknownDisclosure("That is not a disclosure level.");
    }
    await this.questionnaires.updateOne({ _id: questionnaire }, { $set: { disclosure } });
    return { questionnaire };
  }

  async retitle({ questionnaire, title }: { questionnaire: string; title: string }) {
    await this.#revisable(questionnaire);
    const normalized = normalizedTitle(title);
    await this.questionnaires.updateOne({ _id: questionnaire }, { $set: { title: normalized } });
    return { questionnaire };
  }

  async addQuestion({
    questionnaire,
    prompt,
    choices,
    expected,
    explanation,
    position,
  }: {
    questionnaire: string;
    prompt: string;
    choices: string[];
    expected: string;
    explanation: string;
    position: number;
  }) {
    await this.#revisable(questionnaire);
    const material = normalizedMaterial({ prompt, choices, expected, explanation });
    const reserved = await this.questionnaires.updateOne(
      { _id: questionnaire, retired: false, questionPlaces: { $gt: 0 } },
      { $inc: { questionPlaces: -1 } },
    );
    if (reserved.modifiedCount === 0) {
      await this.#revisable(questionnaire);
      throw new QuestionLimitReached("A questionnaire may contain at most 100 questions.");
    }
    try {
      const question = crypto.randomUUID();
      await this.questions.insertOne({
        _id: question,
        questionnaire,
        ...material,
        position,
      });
      return { question };
    } catch (error) {
      await this.questionnaires.updateOne({ _id: questionnaire }, { $inc: { questionPlaces: 1 } });
      throw error;
    }
  }

  async reviseQuestion({
    question,
    prompt,
    choices,
    expected,
    explanation,
    position,
  }: {
    question: string;
    prompt: string;
    choices: string[];
    expected: string;
    explanation: string;
    position: number;
  }) {
    const doc = await this.questions.findOne({ _id: question });
    if (doc === null) {
      throw new QuestionNotFound(`No question named ${question}`);
    }
    await this.#revisable(doc.questionnaire);
    const material = normalizedMaterial({ prompt, choices, expected, explanation });
    await this.questions.updateOne({ _id: question }, { $set: { ...material, position } });
    return { question };
  }

  async swapQuestions({ question, other }: { question: string; other: string }) {
    const first = await this.questions.findOne({ _id: question });
    const second = await this.questions.findOne({ _id: other });
    if (first === null || second === null) {
      throw new QuestionNotFound("There is no such question.");
    }
    if (first.questionnaire !== second.questionnaire) {
      throw new NotSiblings("These questions do not share a questionnaire.");
    }
    await this.#revisable(first.questionnaire);
    await this.questions.updateOne({ _id: question }, { $set: { position: second.position } });
    await this.questions.updateOne({ _id: other }, { $set: { position: first.position } });
    return { question, other };
  }

  async removeQuestion({ question }: { question: string }) {
    const doc = await this.questions.findOne({ _id: question });
    if (doc === null) {
      throw new QuestionNotFound(`No question named ${question}`);
    }
    await this.#revisable(doc.questionnaire);
    const removed = await this.questions.deleteOne({ _id: question });
    if (removed.deletedCount === 1) {
      await this.questionnaires.updateOne(
        { _id: doc.questionnaire },
        { $inc: { questionPlaces: 1 } },
      );
    }
    return { question, questionnaire: doc.questionnaire, position: doc.position };
  }

  async retire({ questionnaire }: { questionnaire: string }) {
    await this.#revisable(questionnaire);
    await this.questionnaires.updateOne({ _id: questionnaire }, { $set: { retired: true } });
    return { questionnaire };
  }

  async _getQuestionnaire({ questionnaire }: { questionnaire: string }) {
    const doc = await this.questionnaires.findOne({ _id: questionnaire });
    return doc === null
      ? []
      : [
          {
            author: doc.author,
            title: doc.title,
            form: doc.form,
            disclosure: doc.disclosure,
            createdAt: doc.createdAt,
            retired: doc.retired,
          },
        ];
  }

  async _getQuestionnaires() {
    const docs = await this.questionnaires.find({}).sort({ createdAt: -1, seq: -1 }).toArray();
    return docs.map((doc) => ({
      questionnaire: doc._id,
      author: doc.author,
      title: doc.title,
      form: doc.form,
      disclosure: doc.disclosure,
      createdAt: doc.createdAt,
      retired: doc.retired,
    }));
  }

  async _getQuestions({ questionnaire }: { questionnaire: string }) {
    const docs = await this.questions.find({ questionnaire }).sort({ position: 1 }).toArray();
    return docs.map((doc) => ({
      question: doc._id,
      prompt: doc.prompt,
      choices: doc.choices,
      expected: doc.expected,
      explanation: doc.explanation,
      position: doc.position,
    }));
  }

  async _getQuestion({ question }: { question: string }) {
    const doc = await this.questions.findOne({ _id: question });
    return doc === null
      ? []
      : [
          {
            questionnaire: doc.questionnaire,
            prompt: doc.prompt,
            choices: doc.choices,
            expected: doc.expected,
            explanation: doc.explanation,
            position: doc.position,
          },
        ];
  }

  async _material({ questionnaire }: { questionnaire: string }) {
    const doc = await this.questionnaires.findOne({ _id: questionnaire });
    if (doc === null) return [];
    const docs = await this.questions.find({ questionnaire }).sort({ position: 1 }).toArray();
    return [
      {
        form: doc.form,
        material: docs.map((entry) => ({
          prompt: entry.prompt,
          choices: entry.choices,
          expected: entry.expected,
          explanation: entry.explanation,
        })),
      },
    ];
  }

  async present({ questionnaire }: { questionnaire: string }) {
    const [doc] = await this.questionnaires
      .aggregate<
        Pick<QuestionnaireDoc, "title" | "form" | "disclosure" | "retired"> & {
          questions: QuestionDoc[];
        }
      >([
        { $match: { _id: questionnaire } },
        {
          $lookup: {
            from: "questioning.questions",
            let: { questionnaire: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$questionnaire", "$$questionnaire"] } } },
              { $sort: { position: 1 } },
            ],
            as: "questions",
          },
        },
      ])
      .toArray();
    if (doc === undefined) {
      throw new QuestionnaireNotFound(`No questionnaire named ${questionnaire}`);
    }
    if (doc.retired) {
      throw new QuestionnaireRetired("This questionnaire was retired.");
    }
    const questions = doc.questions.map((question) => ({
      item: question._id,
      prompt: question.prompt,
      choices: question.choices,
      expected: question.expected,
      explanation: question.explanation,
      position: question.position,
    }));
    const expectations = questions
      .filter((question) => question.choices.length > 0 && question.expected !== "")
      .map((question) => ({
        item: question.item,
        expected: question.expected,
        explanation: question.explanation,
      }));
    const presentation = {
      title: doc.title,
      form: doc.form,
      disclosure: doc.disclosure,
      questions,
    };
    return {
      presentation,
      form: presentation.form,
      disclosure: presentation.disclosure,
      proposes: expectations.length > 0,
      expectations,
    };
  }

  async _proposesAnswers({ questionnaire }: { questionnaire: string }) {
    const doc = await this.questions.findOne({ questionnaire, ...PROPOSING });
    return { proposes: doc !== null };
  }

  async _expectedAnswers({ questionnaire }: { questionnaire: string }) {
    const doc = await this.questionnaires.findOne({ _id: questionnaire });
    if (doc === null) return [];
    const docs = await this.questions
      .find({ questionnaire, ...PROPOSING })
      .sort({ position: 1 })
      .toArray();
    return [
      {
        expectations: docs.map((entry) => ({
          item: entry._id,
          expected: entry.expected,
          explanation: entry.explanation,
        })),
      },
    ];
  }

  async _references({ questionnaire }: { questionnaire: string }) {
    const docs = await this.questions
      .find({ questionnaire, ...KEEPS_REFERENCE })
      .sort({ position: 1 })
      .toArray();
    return docs.map((doc) => ({
      question: doc._id,
      prompt: doc.prompt,
      expected: doc.expected,
      explanation: doc.explanation,
      position: doc.position,
    }));
  }
}
