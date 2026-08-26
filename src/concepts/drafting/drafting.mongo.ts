import type { Collection, Db } from "mongodb";
import {
  AlreadyAdopted,
  AlreadyAnswered,
  AlreadyDrafted,
  AwaitingClarification,
  BriefNotFound,
  CandidateNotFound,
  ClarificationNotFound,
  NotAwaitingDraft,
  RequestStalled,
} from "./errors.ts";

interface BriefDoc {
  _id: string;
  author: string;
  request: string;
  createdAt: Date;
  basis: string | null;
  clarifying: boolean;
  stalled: boolean;
  seq: number;
}

interface ClarificationDoc {
  _id: string;
  brief: string;
  question: string;
  answer: string | null;
  seq: number;
}

interface CandidateDoc {
  _id: string;
  brief: string;
  form: string;
  adopted: boolean;
}

interface ItemDoc {
  _id: string;
  candidate: string;
  prompt: string;
  choices: string[];
  expected: string;
  explanation: string;
  order: number;
}

interface MaterialEntry {
  prompt: string;
  choices?: string[];
  expected?: string;
  explanation?: string;
}

export class MongoDraftingConcept {
  private readonly briefs: Collection<BriefDoc>;
  private readonly clarifications: Collection<ClarificationDoc>;
  private readonly candidates: Collection<CandidateDoc>;
  private readonly items: Collection<ItemDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.briefs = db.collection<BriefDoc>("drafting.briefs");
    this.clarifications = db.collection<ClarificationDoc>("drafting.clarifications");
    this.candidates = db.collection<CandidateDoc>("drafting.candidates");
    this.items = db.collection<ItemDoc>("drafting.items");
    this.counters = db.collection("drafting.counters");
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async describe({ author, request, at }: { author: string; request: string; at: Date }) {
    const brief = crypto.randomUUID();
    const seq = await this.#nextSeq("briefs");
    await this.briefs.insertOne({
      _id: brief,
      author,
      request,
      createdAt: at,
      basis: null,
      clarifying: false,
      stalled: false,
      seq,
    });
    return { brief };
  }

  async correct({
    author,
    candidate,
    request,
    at,
  }: {
    author: string;
    candidate: string;
    request: string;
    at: Date;
  }) {
    const doc = await this.candidates.findOne({ _id: candidate });
    if (doc === null) {
      throw new CandidateNotFound("There is no such draft to correct.");
    }
    if (doc.adopted) {
      throw new AlreadyAdopted("This draft was already adopted; edit it directly instead.");
    }
    const brief = crypto.randomUUID();
    const seq = await this.#nextSeq("briefs");
    await this.briefs.insertOne({
      _id: brief,
      author,
      request,
      createdAt: at,
      basis: candidate,
      clarifying: false,
      stalled: false,
      seq,
    });
    return { brief };
  }

  async propose({
    brief,
    form,
    material,
  }: {
    brief: string;
    form: string;
    material: MaterialEntry[];
  }) {
    const doc = await this.briefs.findOne({ _id: brief });
    if (doc === null) {
      throw new BriefNotFound("There is no such request.");
    }
    const standing = await this.candidates.findOne({ brief });
    if (standing !== null) {
      throw new AlreadyDrafted("This request was already drafted; correct the draft instead.");
    }
    if (doc.clarifying) {
      throw new AwaitingClarification("This request is waiting on the author's clarification.");
    }
    if (doc.stalled) {
      throw new RequestStalled("This request stalled; describe it again.");
    }
    const candidate = crypto.randomUUID();
    await this.candidates.insertOne({ _id: candidate, brief, form, adopted: false });
    const entries = material.map((entry, order) => ({
      _id: crypto.randomUUID(),
      candidate,
      prompt: entry.prompt,
      choices: entry.choices ?? [],
      expected: entry.expected ?? "",
      explanation: entry.explanation ?? "",
      order,
    }));
    if (entries.length > 0) await this.items.insertMany(entries);
    return { candidate };
  }

  async ask({ brief, question }: { brief: string; question: string }) {
    const doc = await this.briefs.findOne({ _id: brief });
    if (doc === null) {
      throw new BriefNotFound("There is no such request.");
    }
    const standing = await this.candidates.findOne({ brief });
    if (standing !== null) {
      throw new AlreadyDrafted("This request was already drafted; correct the draft instead.");
    }
    if (doc.stalled) {
      throw new RequestStalled("This request stalled; describe it again.");
    }
    const clarification = crypto.randomUUID();
    const seq = await this.#nextSeq("clarifications");
    await this.clarifications.insertOne({
      _id: clarification,
      brief,
      question,
      answer: null,
      seq,
    });
    await this.briefs.updateOne({ _id: brief }, { $set: { clarifying: true } });
    return { clarification };
  }

  async stall({ brief, reason: _reason }: { brief: string; reason: string }) {
    const doc = await this.briefs.findOne({ _id: brief });
    if (doc === null) {
      throw new BriefNotFound("There is no such request.");
    }
    const standing = await this.candidates.findOne({ brief });
    if (standing !== null || doc.stalled) {
      throw new NotAwaitingDraft("This request is not waiting on a draft.");
    }
    await this.briefs.updateOne({ _id: brief }, { $set: { stalled: true } });
    return { brief };
  }

  async clarify({ clarification, answer }: { clarification: string; answer: string }) {
    const doc = await this.clarifications.findOne({ _id: clarification });
    if (doc === null) {
      throw new ClarificationNotFound("There is no such question.");
    }
    if (doc.answer !== null) {
      throw new AlreadyAnswered("This question was already answered.");
    }
    await this.clarifications.updateOne({ _id: clarification }, { $set: { answer } });
    await this.briefs.updateOne({ _id: doc.brief }, { $set: { clarifying: false } });
    return { clarification, brief: doc.brief };
  }

  async adopt({ candidate }: { candidate: string }) {
    const doc = await this.candidates.findOne({ _id: candidate });
    if (doc === null) {
      throw new CandidateNotFound("There is no such draft.");
    }
    if (doc.adopted) {
      throw new AlreadyAdopted("This draft was already adopted.");
    }
    await this.candidates.updateOne({ _id: candidate }, { $set: { adopted: true } });
    return { candidate };
  }

  async _brief({ brief }: { brief: string }) {
    const doc = await this.briefs.findOne({ _id: brief });
    return doc === null
      ? []
      : [
          {
            author: doc.author,
            request: doc.request,
            createdAt: doc.createdAt,
            basis: doc.basis,
          },
        ];
  }

  async _briefs({ author }: { author: string }) {
    const docs = await this.briefs.find({ author }).sort({ createdAt: -1, seq: -1 }).toArray();
    return docs.map((doc) => ({
      brief: doc._id,
      request: doc.request,
      createdAt: doc.createdAt,
      basis: doc.basis,
    }));
  }

  async _standing({ brief }: { brief: string }) {
    const doc = await this.briefs.findOne({ _id: brief });
    return doc === null ? [] : [{ clarifying: doc.clarifying, stalled: doc.stalled }];
  }

  async _clarifications({ brief }: { brief: string }) {
    const docs = await this.clarifications.find({ brief }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      clarification: doc._id,
      question: doc.question,
      answer: doc.answer,
    }));
  }

  async _candidateOf({ brief }: { brief: string }) {
    const doc = await this.candidates.findOne({ brief });
    return doc === null ? [] : [{ candidate: doc._id, form: doc.form, adopted: doc.adopted }];
  }

  async _candidate({ candidate }: { candidate: string }) {
    const doc = await this.candidates.findOne({ _id: candidate });
    return doc === null ? [] : [{ brief: doc.brief, form: doc.form, adopted: doc.adopted }];
  }

  async _items({ candidate }: { candidate: string }) {
    const docs = await this.items.find({ candidate }).sort({ order: 1 }).toArray();
    return docs.map((doc) => ({
      item: doc._id,
      prompt: doc.prompt,
      choices: doc.choices,
      expected: doc.expected,
      explanation: doc.explanation,
      position: doc.order + 1,
    }));
  }

  async _material({ candidate }: { candidate: string }) {
    const doc = await this.candidates.findOne({ _id: candidate });
    if (doc === null) return [];
    const docs = await this.items.find({ candidate }).sort({ order: 1 }).toArray();
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

  async _line({ brief }: { brief: string }) {
    const start = await this.briefs.findOne({ _id: brief });
    if (start === null) return [];
    const rows: {
      brief: string;
      request: string;
      basis: string | null;
      candidate: string | null;
      form: string | null;
      adopted: boolean;
    }[] = [];
    const seen = new Set<string>([start._id]);
    const queue: BriefDoc[] = [start];
    while (queue.length > 0) {
      const doc = queue.shift() as BriefDoc;
      const candidate = await this.candidates.findOne({ brief: doc._id });
      rows.push({
        brief: doc._id,
        request: doc.request,
        basis: doc.basis,
        candidate: candidate === null ? null : candidate._id,
        form: candidate === null ? null : candidate.form,
        adopted: candidate === null ? false : candidate.adopted,
      });
      if (candidate === null) continue;
      const corrections = await this.briefs
        .find({ basis: candidate._id })
        .sort({ createdAt: 1, seq: 1 })
        .toArray();
      for (const correction of corrections) {
        if (seen.has(correction._id)) continue;
        seen.add(correction._id);
        queue.push(correction);
      }
    }
    return rows;
  }
}
