import type { Collection, Db } from "mongodb";
import { AlreadySubmitted, NoParticipant, ResponseNotFound } from "./errors.ts";

interface ResponseDoc {
  _id: string;
  subject: string;
  participant: string;
  startedAt: Date;
  submittedAt: Date | null;
  submitted: boolean;
  seq: number;
}

interface AnswerDoc {
  _id: string;
  response: string;
  item: string;
  value: string;
  seq: number;
}

export class MongoRespondingConcept {
  private readonly responses: Collection<ResponseDoc>;
  private readonly answers: Collection<AnswerDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.responses = db.collection<ResponseDoc>("responding.responses");
    this.answers = db.collection<AnswerDoc>("responding.answers");
    this.counters = db.collection("responding.counters");
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async #inProgress(response: string): Promise<ResponseDoc> {
    const doc = await this.responses.findOne({ _id: response });
    if (doc === null) {
      throw new ResponseNotFound("There is no such response.");
    }
    if (doc.submitted) {
      throw new AlreadySubmitted("This was already handed in.");
    }
    return doc;
  }

  async begin({ participant, subject, at }: { participant: string; subject: string; at: Date }) {
    if (participant.trim() === "") {
      throw new NoParticipant("A response needs someone to belong to.");
    }
    const existing = await this.responses.findOne({ subject, participant });
    if (existing !== null) {
      if (existing.submitted) {
        throw new AlreadySubmitted("This was already handed in.");
      }
      return { response: existing._id };
    }
    const response = crypto.randomUUID();
    const seq = await this.#nextSeq("responses");
    await this.responses.insertOne({
      _id: response,
      subject,
      participant,
      startedAt: at,
      submittedAt: null,
      submitted: false,
      seq,
    });
    return { response };
  }

  async answer({ response, item, value }: { response: string; item: string; value: string }) {
    await this.#inProgress(response);
    const existing = await this.answers.findOne({ response, item });
    if (existing !== null) {
      await this.answers.updateOne({ _id: existing._id }, { $set: { value } });
      return { response };
    }
    const seq = await this.#nextSeq("answers");
    await this.answers.insertOne({
      _id: crypto.randomUUID(),
      response,
      item,
      value,
      seq,
    });
    return { response };
  }

  async submit({ response, at }: { response: string; at: Date }) {
    await this.#inProgress(response);
    await this.responses.updateOne(
      { _id: response },
      { $set: { submitted: true, submittedAt: at } },
    );
    return { response };
  }

  async _response({ response }: { response: string }) {
    const doc = await this.responses.findOne({ _id: response });
    return doc === null
      ? []
      : [
          {
            subject: doc.subject,
            participant: doc.participant,
            submitted: doc.submitted,
            startedAt: doc.startedAt,
            submittedAt: doc.submittedAt,
          },
        ];
  }

  async _responseFor({ subject, participant }: { subject: string; participant: string }) {
    const doc = await this.responses.findOne({ subject, participant });
    return doc === null ? [] : [{ response: doc._id, submitted: doc.submitted }];
  }

  async _responsesFor({ subject }: { subject: string }) {
    const docs = await this.responses.find({ subject }).sort({ startedAt: 1, seq: 1 }).toArray();
    return docs.map((doc) => ({
      response: doc._id,
      participant: doc.participant,
      submitted: doc.submitted,
      startedAt: doc.startedAt,
      submittedAt: doc.submittedAt,
    }));
  }

  async _answers({ response }: { response: string }) {
    const docs = await this.answers.find({ response }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ item: doc.item, value: doc.value }));
  }

  async _valuesFor({ subject, item }: { subject: string; item: string }) {
    const submitted = await this.responses
      .find({ subject, submitted: true })
      .sort({ submittedAt: 1, seq: 1 })
      .toArray();
    const rows: { response: string; participant: string; value: string }[] = [];
    for (const response of submitted) {
      const answer = await this.answers.findOne({ response: response._id, item });
      if (answer !== null) {
        rows.push({
          response: response._id,
          participant: response.participant,
          value: answer.value,
        });
      }
    }
    return rows;
  }

  async _collectedAnswers({ response }: { response: string }) {
    const doc = await this.responses.findOne({ _id: response });
    if (doc === null) return [];
    const docs = await this.answers.find({ response }).sort({ seq: 1 }).toArray();
    return [{ answers: docs.map((entry) => ({ item: entry.item, value: entry.value })) }];
  }

  async _submittedAnswers({ subject }: { subject: string }) {
    const submitted = await this.responses
      .find({ subject, submitted: true })
      .sort({ submittedAt: 1, seq: 1 })
      .toArray();
    const rows: { response: string; participant: string; item: string; value: string }[] = [];
    for (const response of submitted) {
      const answers = await this.answers
        .find({ response: response._id })
        .sort({ seq: 1 })
        .toArray();
      for (const answer of answers) {
        rows.push({
          response: response._id,
          participant: response.participant,
          item: answer.item,
          value: answer.value,
        });
      }
    }
    return rows;
  }

  /** The same answers `_submittedAnswers` gives, handed over as one value. */
  async _valuesForSubject({ subject }: { subject: string }) {
    return { values: await this._submittedAnswers({ subject }) };
  }
}
