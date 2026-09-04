import type { Collection, Db } from "mongodb";
import {
  normalizeParts,
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
  InvalidParts,
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

/**
 * The material violations `reviseQuestion` answers before it weighs a
 * question's parts against the choices it is being given.
 */
const MATERIAL_BEFORE_PARTS = new Set<QuestionMaterialViolation["kind"]>([
  "prompt",
  "choices",
  "duplicateChoices",
]);

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
  /** Absent only on questions stored before a question could take parts. */
  parts?: string[];
  /** Absent only on questions stored before a question could take parts. */
  cap?: number;
  position: number;
}

/** A question stored before parts existed takes one answer, like any other. */
const partsOf = (doc: QuestionDoc): string[] => doc.parts ?? [];
const capOf = (doc: QuestionDoc): number => doc.cap ?? 0;

/** One question as `_material` and `_materials` hand it over. */
const materialOf = (doc: QuestionDoc) => ({
  prompt: doc.prompt,
  choices: doc.choices,
  expected: doc.expected,
  explanation: doc.explanation,
  parts: partsOf(doc),
  cap: capOf(doc),
});

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
        parts: [],
        cap: 0,
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
    // The material rules that come before this one still decide first; only a
    // question whose choices are otherwise acceptable can clash with its parts.
    const material = normalizeQuestionMaterial({ prompt, choices, expected, explanation });
    if (!material.ok && MATERIAL_BEFORE_PARTS.has(material.violation.kind)) {
      refuseMaterial(material.violation);
    }
    if (Array.isArray(choices) && choices.length > 0 && partsOf(doc).length > 0) {
      throw new InvalidParts("A question offers choices or takes parts, not both.");
    }
    if (!material.ok) refuseMaterial(material.violation);
    await this.questions.updateOne({ _id: question }, { $set: { ...material.value, position } });
    return { question };
  }

  async setParts({ question, parts, cap }: { question: string; parts: string[]; cap: number }) {
    const doc = await this.questions.findOne({ _id: question });
    if (doc === null) {
      throw new QuestionNotFound(`No question named ${question}`);
    }
    await this.#revisable(doc.questionnaire);
    // Clearing parts is always allowed; only parts a question would keep can
    // clash with the choices it offers.
    if (Array.isArray(parts) && parts.length > 0 && doc.choices.length > 0) {
      throw new InvalidParts("A question offers choices or takes parts, not both.");
    }
    const result = normalizeParts({ parts, cap });
    if (!result.ok) throw new InvalidParts(result.violation.message);
    await this.questions.updateOne(
      { _id: question },
      { $set: { parts: result.value.parts, cap: result.value.cap } },
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
      parts: partsOf(doc),
      cap: capOf(doc),
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
            parts: partsOf(doc),
            cap: capOf(doc),
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
        material: docs.map((entry) => materialOf(entry)),
      },
    ];
  }

  async _materials({ questionnaires }: { questionnaires: string[] }) {
    const identities = Array.isArray(questionnaires) ? questionnaires : [];
    if (identities.length === 0) return { materials: [] };
    const docs = await this.questionnaires.find({ _id: { $in: identities } }).toArray();
    const titles = new Map(docs.map((doc) => [doc._id, doc.title]));
    const questions = await this.questions
      .find({ questionnaire: { $in: [...titles.keys()] } })
      .sort({ position: 1 })
      .toArray();
    const grouped = new Map<string, QuestionDoc[]>();
    for (const question of questions) {
      const entries = grouped.get(question.questionnaire);
      if (entries === undefined) grouped.set(question.questionnaire, [question]);
      else entries.push(question);
    }
    // In the given order, and an identity that names no questionnaire simply
    // contributes no entry.
    const materials = identities.flatMap((questionnaire) => {
      const title = titles.get(questionnaire);
      if (title === undefined) return [];
      return [
        {
          questionnaire,
          title,
          questions: (grouped.get(questionnaire) ?? []).map((entry) => materialOf(entry)),
        },
      ];
    });
    return { materials };
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
      parts: partsOf(question),
      cap: capOf(question),
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
