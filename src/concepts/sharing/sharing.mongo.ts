import type { Collection, Db } from "mongodb";
import { NothingShared } from "./errors.ts";

interface ShareDoc {
  _id: string;
  subject: string;
  token: string;
  seq: number;
}

export class MongoSharingConcept {
  private readonly shares: Collection<ShareDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.shares = db.collection<ShareDoc>("sharing.shares");
    this.counters = db.collection("sharing.counters");
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "shares" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async issue({ subject }: { subject: string }) {
    const share = crypto.randomUUID();
    const token = crypto.randomUUID();
    const seq = await this.#nextSeq();
    await this.shares.insertOne({ _id: share, subject, token, seq });
    return { share, token };
  }

  async open({ token }: { token: string }) {
    const doc = await this.shares.findOne({ token });
    if (doc === null) {
      throw new NothingShared("Nothing is shared here.");
    }
    return { subject: doc.subject };
  }

  async _share({ token }: { token: string }) {
    const doc = await this.shares.findOne({ token });
    return doc === null ? [] : [{ share: doc._id, subject: doc.subject }];
  }

  async _sharesFor({ subject }: { subject: string }) {
    const docs = await this.shares.find({ subject }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ share: doc._id, token: doc.token }));
  }
}
