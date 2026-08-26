import type { Collection, Db } from "mongodb";
import { AlreadyGraded, KeyExists, KeyNotFound, UnknownDisclosure } from "./errors.ts";

const DISCLOSURES = ["score", "answers", "explanations"];

interface KeyDoc {
  _id: string;
  subject: string;
  disclosure: string;
}

interface ExpectationDoc {
  _id: string;
  key: string;
  item: string;
  expected: string;
  explanation: string;
  seq: number;
}

interface ResultDoc {
  _id: string;
  key: string;
  submission: string;
  score: number;
  seq: number;
}

export class MongoScoringConcept {
  private readonly keys: Collection<KeyDoc>;
  private readonly expectations: Collection<ExpectationDoc>;
  private readonly results: Collection<ResultDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.keys = db.collection<KeyDoc>("scoring.keys");
    this.expectations = db.collection<ExpectationDoc>("scoring.expectations");
    this.results = db.collection<ResultDoc>("scoring.results");
    this.counters = db.collection("scoring.counters");
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  #expectationsOf(key: string): Promise<ExpectationDoc[]> {
    return this.expectations.find({ key }).sort({ seq: 1 }).toArray();
  }

  async establish({
    subject,
    disclosure,
    expectations,
  }: {
    subject: string;
    disclosure: string;
    expectations: { item: string; expected: string; explanation: string }[];
  }) {
    const existing = await this.keys.findOne({ subject });
    if (existing !== null) {
      throw new KeyExists("This already has a key.");
    }
    if (!DISCLOSURES.includes(disclosure)) {
      throw new UnknownDisclosure("That is not a disclosure level.");
    }
    const key = crypto.randomUUID();
    await this.keys.insertOne({ _id: key, subject, disclosure });
    for (const entry of expectations) {
      const seq = await this.#nextSeq("expectations");
      await this.expectations.insertOne({
        _id: crypto.randomUUID(),
        key,
        item: entry.item,
        expected: entry.expected,
        explanation: entry.explanation,
        seq,
      });
    }
    return { key };
  }

  async grade({
    key,
    submission,
    answers,
  }: {
    key: string;
    submission: string;
    answers: { item: string; value: string }[];
  }) {
    const keyDoc = await this.keys.findOne({ _id: key });
    if (keyDoc === null) {
      throw new KeyNotFound("There is no such key.");
    }
    const existing = await this.results.findOne({ key, submission });
    if (existing !== null) {
      throw new AlreadyGraded("This submission was already graded.");
    }
    const given = new Map<string, string>();
    for (const entry of answers) {
      given.set(entry.item, entry.value);
    }
    const expectations = await this.#expectationsOf(key);
    let score = 0;
    for (const expectation of expectations) {
      if (given.has(expectation.item) && given.get(expectation.item) === expectation.expected) {
        score += 1;
      }
    }
    const result = crypto.randomUUID();
    const seq = await this.#nextSeq("results");
    await this.results.insertOne({ _id: result, key, submission, score, seq });
    return { result, score };
  }

  async _keyFor({ subject }: { subject: string }) {
    const doc = await this.keys.findOne({ subject });
    return doc === null ? [] : [{ key: doc._id, disclosure: doc.disclosure }];
  }

  async _key({ key }: { key: string }) {
    const doc = await this.keys.findOne({ _id: key });
    return doc === null ? [] : [{ subject: doc.subject, disclosure: doc.disclosure }];
  }

  async _expectations({ key }: { key: string }) {
    const docs = await this.#expectationsOf(key);
    return docs.map((doc) => ({
      item: doc.item,
      expected: doc.expected,
      explanation: doc.explanation,
    }));
  }

  async _resultFor({ key, submission }: { key: string; submission: string }) {
    const doc = await this.results.findOne({ key, submission });
    if (doc === null) return [];
    const outOf = await this.expectations.countDocuments({ key });
    return [{ result: doc._id, score: doc.score, outOf }];
  }

  async _results({ key }: { key: string }) {
    const docs = await this.results.find({ key }).sort({ seq: 1 }).toArray();
    if (docs.length === 0) return [];
    const outOf = await this.expectations.countDocuments({ key });
    return docs.map((doc) => ({
      result: doc._id,
      submission: doc.submission,
      score: doc.score,
      outOf,
    }));
  }
}
