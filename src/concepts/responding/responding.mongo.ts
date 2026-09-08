import type { Collection, Db } from "mongodb";
import {
  AlreadySubmitted,
  AnswerBlank,
  NoParticipant,
  ResponseNotFound,
  ResponseIncomplete,
} from "./errors.ts";

interface ResponseDoc {
  _id: string;
  subject: string;
  participant: string;
  startedAt: Date;
  submittedAt: Date | null;
  submitted: boolean;
  seq: number;
  answers: { item: string; value: string }[];
}

export class MongoRespondingConcept {
  private readonly responses: Collection<ResponseDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;
  private responseIndex: Promise<string> | undefined;

  constructor(db: Db) {
    this.responses = db.collection<ResponseDoc>("responding.responses");
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
    await (this.responseIndex ??= this.responses.createIndex(
      { subject: 1, participant: 1 },
      { unique: true },
    ));
    const existing = await this.responses.findOne({ subject, participant });
    if (existing !== null) {
      if (existing.submitted) throw new AlreadySubmitted("This was already handed in.");
      return { response: existing._id };
    }
    const seq = await this.#nextSeq("responses");
    const begun = await this.responses.findOneAndUpdate(
      { subject, participant },
      {
        $setOnInsert: {
          _id: crypto.randomUUID(),
          subject,
          participant,
          startedAt: at,
          submittedAt: null,
          submitted: false,
          seq,
          answers: [],
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (begun === null) throw new Error("Beginning a response returned no response.");
    if (begun.submitted) throw new AlreadySubmitted("This was already handed in.");
    return { response: begun._id };
  }

  async answer({ response, item, value }: { response: string; item: string; value: string }) {
    const said = value.trim();
    if (said === "") {
      throw new AnswerBlank("An answer needs something in it.");
    }
    // Answers and submission share a document so a save cannot cross a
    // completed hand-in. The pipeline replaces an existing item in place or
    // appends it once, preserving first-answer order under concurrent saves.
    const answered = await this.responses.updateOne({ _id: response, submitted: false }, [
      {
        $set: {
          answers: {
            $cond: [
              { $in: [{ $literal: item }, "$answers.item"] },
              {
                $map: {
                  input: "$answers",
                  as: "answer",
                  in: {
                    $cond: [
                      { $eq: ["$$answer.item", { $literal: item }] },
                      { $literal: { item, value: said } },
                      "$$answer",
                    ],
                  },
                },
              },
              { $concatArrays: ["$answers", { $literal: [{ item, value: said }] }] },
            ],
          },
        },
      },
    ]);
    if (answered.matchedCount === 0) await this.#inProgress(response);
    return { response };
  }

  async submit({
    response,
    at,
    required = [],
  }: {
    response: string;
    at: Date;
    required?: string[][];
  }) {
    const submitted = await this.responses.updateOne(
      {
        _id: response,
        submitted: false,
        // Each group requires an answer to at least one of its items. The
        // caller supplies the requirements; the response owns their check.
        ...(required.length === 0
          ? {}
          : {
              $and: required.map((items) => ({ "answers.item": { $in: items } })),
            }),
      },
      { $set: { submitted: true, submittedAt: at } },
    );
    // Only the transition into Submitted succeeds. Racing hand-ins must not
    // produce a second successful action (and therefore a second reaction).
    if (submitted.matchedCount === 0) {
      await this.#inProgress(response);
      throw new ResponseIncomplete("An answer is still required.");
    }
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
    const doc = await this.responses.findOne({ _id: response });
    return doc?.answers ?? [];
  }

  async _valuesFor({ subject, item }: { subject: string; item: string }) {
    const submitted = await this.responses
      .find({ subject, submitted: true })
      .sort({ submittedAt: 1, seq: 1 })
      .toArray();
    return submitted.flatMap((response) => {
      const answer = response.answers.find((answer) => answer.item === item);
      return answer === undefined
        ? []
        : [
            {
              response: response._id,
              participant: response.participant,
              value: answer.value,
            },
          ];
    });
  }

  async _collectedAnswers({ response }: { response: string }) {
    const doc = await this.responses.findOne({ _id: response });
    return doc === null ? [] : [{ answers: doc.answers }];
  }

  async _submittedAnswers({ subject }: { subject: string }) {
    const submitted = await this.responses
      .find({ subject, submitted: true })
      .sort({ submittedAt: 1, seq: 1 })
      .toArray();
    return submitted.flatMap((response) =>
      response.answers.map((answer) => ({
        response: response._id,
        participant: response.participant,
        item: answer.item,
        value: answer.value,
      })),
    );
  }

  /** The same answers `_submittedAnswers` gives, handed over as one value. */
  async _valuesForSubject({ subject }: { subject: string }) {
    return { values: await this._submittedAnswers({ subject }) };
  }
}
