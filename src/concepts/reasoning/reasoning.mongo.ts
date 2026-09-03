import type { Collection, Db } from "mongodb";
import { AlreadySettled, AskingNotFound } from "./errors.ts";

interface AskingDoc {
  _id: string;
  reasoner: string;
  about: string;
  passage: string;
  askedAt: Date;
  pending: boolean;
  seq: number;
}

interface ReplyDoc {
  _id: string;
  asking: string;
  reply: string;
  answeredAt: Date;
  seq: number;
}

interface FailureDoc {
  _id: string;
  asking: string;
  account: string;
  failedAt: Date;
}

export class MongoReasoningConcept {
  private readonly askings: Collection<AskingDoc>;
  private readonly replies: Collection<ReplyDoc>;
  private readonly failures: Collection<FailureDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db, instance = "Reasoning") {
    const prefix = `${instance[0]?.toLowerCase() ?? ""}${instance.slice(1)}`;
    this.askings = db.collection<AskingDoc>(`${prefix}.askings`);
    this.replies = db.collection<ReplyDoc>(`${prefix}.replies`);
    this.failures = db.collection<FailureDoc>(`${prefix}.failures`);
    this.counters = db.collection(`${prefix}.counters`);
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async #settle(asking: string): Promise<AskingDoc> {
    const doc = await this.askings.findOne({ _id: asking });
    if (doc === null) {
      throw new AskingNotFound(`No asking named ${asking}`);
    }
    if (!doc.pending) {
      throw new AlreadySettled("This ask was already settled.");
    }
    return doc;
  }

  async ask({
    reasoner,
    about,
    passage,
    at,
  }: {
    reasoner: string;
    about: string;
    passage: string;
    at: Date;
  }) {
    const asking = crypto.randomUUID();
    const seq = await this.#nextSeq("askings");
    await this.askings.insertOne({
      _id: asking,
      reasoner,
      about,
      passage,
      askedAt: at,
      pending: true,
      seq,
    });
    return { asking };
  }

  async answer({ asking, reply, at }: { asking: string; reply: string; at: Date }) {
    await this.#settle(asking);
    const seq = await this.#nextSeq("replies");
    await this.askings.updateOne({ _id: asking }, { $set: { pending: false } });
    await this.replies.insertOne({
      _id: crypto.randomUUID(),
      asking,
      reply,
      answeredAt: at,
      seq,
    });
    return { asking, reply };
  }

  async fail({ asking, account, at }: { asking: string; account: string; at: Date }) {
    await this.#settle(asking);
    await this.askings.updateOne({ _id: asking }, { $set: { pending: false } });
    await this.failures.insertOne({
      _id: crypto.randomUUID(),
      asking,
      account,
      failedAt: at,
    });
    return { asking };
  }

  async _pending() {
    const docs = await this.askings.find({ pending: true }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      asking: doc._id,
      reasoner: doc.reasoner,
      about: doc.about,
      passage: doc.passage,
      askedAt: doc.askedAt,
    }));
  }

  async _asking({ asking }: { asking: string }) {
    const doc = await this.askings.findOne({ _id: asking });
    return doc === null
      ? []
      : [
          {
            reasoner: doc.reasoner,
            about: doc.about,
            passage: doc.passage,
            askedAt: doc.askedAt,
            pending: doc.pending,
          },
        ];
  }

  async _replyOf({ asking }: { asking: string }) {
    const doc = await this.replies.findOne({ asking });
    return doc === null ? [] : [{ reply: doc.reply, answeredAt: doc.answeredAt }];
  }

  async _failureOf({ asking }: { asking: string }) {
    const doc = await this.failures.findOne({ asking });
    return doc === null ? [] : [{ account: doc.account, failedAt: doc.failedAt }];
  }

  async _repliesAbout({ about }: { about: string }) {
    const askings = await this.askings.find({ about }).toArray();
    const byId = new Map(askings.map((doc) => [doc._id, doc]));
    const replies = await this.replies
      .find({ asking: { $in: [...byId.keys()] } })
      .sort({ seq: -1 })
      .toArray();
    return replies.map((doc) => {
      const asking = byId.get(doc.asking);
      return {
        asking: doc.asking,
        reasoner: asking?.reasoner ?? "",
        passage: asking?.passage ?? "",
        reply: doc.reply,
        answeredAt: doc.answeredAt,
      };
    });
  }
}
