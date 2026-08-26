import type { Collection, Db } from "mongodb";
import {
  NotSiblings,
  QuestionNotFound,
  QuestionnaireNotFound,
  QuestionnaireRetired,
  UnknownDisclosure,
  UnknownForm,
} from "./errors.ts";

const FORMS = ["quiz", "survey"];
const LEVELS = ["score", "answers", "explanations"];

interface QuestionnaireDoc {
  _id: string;
  author: string;
  title: string;
  form: string;
  disclosure: string;
  createdAt: Date;
  retired: boolean;
  seq: number;
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
    const questionnaire = crypto.randomUUID();
    const seq = await this.#nextSeq();
    await this.questionnaires.insertOne({
      _id: questionnaire,
      author,
      title,
      form,
      disclosure,
      createdAt: at,
      retired: false,
      seq,
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
    await this.questionnaires.updateOne({ _id: questionnaire }, { $set: { title } });
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
    const question = crypto.randomUUID();
    await this.questions.insertOne({
      _id: question,
      questionnaire,
      prompt,
      choices,
      expected,
      explanation,
      position,
    });
    return { question };
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
    await this.questions.updateOne(
      { _id: question },
      { $set: { prompt, choices, expected, explanation, position } },
    );
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
    await this.questions.deleteOne({ _id: question });
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

  async _proposesAnswers({ questionnaire }: { questionnaire: string }) {
    const doc = await this.questions.findOne({ questionnaire, expected: { $ne: "" } });
    return { proposes: doc !== null };
  }

  async _expectedAnswers({ questionnaire }: { questionnaire: string }) {
    const doc = await this.questionnaires.findOne({ _id: questionnaire });
    if (doc === null) return [];
    const docs = await this.questions
      .find({ questionnaire, expected: { $ne: "" } })
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
}
