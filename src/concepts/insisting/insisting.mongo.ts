import type { Collection, Db } from "mongodb";
import { NoPatience, NotInsisting, PatienceSpent } from "./errors.ts";

interface InsistenceDoc {
  _id: string;
  aim: string;
  patience: number;
  settled: boolean;
  satisfied: boolean;
  exhausted: boolean;
  seq: number;
}

interface ComplaintDoc {
  _id: string;
  insistence: string;
  offering: string;
  account: string;
  seq: number;
}

export class MongoInsistingConcept {
  private readonly insistences: Collection<InsistenceDoc>;
  private readonly complaints: Collection<ComplaintDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.insistences = db.collection<InsistenceDoc>("insisting.insistences");
    this.complaints = db.collection<ComplaintDoc>("insisting.complaints");
    this.counters = db.collection("insisting.counters");
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async #unsettled(aim: string): Promise<InsistenceDoc | null> {
    return await this.insistences.findOne({ aim, settled: false });
  }

  async #settle(aim: string, outcome: "satisfied" | "exhausted") {
    const doc = await this.#unsettled(aim);
    if (doc === null) {
      throw new NotInsisting("Nothing is being insisted on for this aim.");
    }
    await this.insistences.updateOne(
      { _id: doc._id },
      { $set: { settled: true, [outcome]: true } },
    );
    return { insistence: doc._id };
  }

  async complain({
    aim,
    patience,
    offering,
    account,
  }: {
    aim: string;
    patience: number;
    offering: string;
    account: string;
  }) {
    if (patience < 1) {
      throw new NoPatience("Insisting takes at least one complaint.");
    }
    let doc = await this.#unsettled(aim);
    if (doc === null) {
      const insistence = crypto.randomUUID();
      const seq = await this.#nextSeq("insistences");
      doc = {
        _id: insistence,
        aim,
        patience,
        settled: false,
        satisfied: false,
        exhausted: false,
        seq,
      };
      await this.insistences.insertOne(doc);
    } else {
      const recorded = await this.complaints.countDocuments({ insistence: doc._id });
      if (recorded >= doc.patience) {
        throw new PatienceSpent("This aim has had every complaint it was given.");
      }
    }
    const complaint = crypto.randomUUID();
    const seq = await this.#nextSeq("complaints");
    await this.complaints.insertOne({
      _id: complaint,
      insistence: doc._id,
      offering,
      account,
      seq,
    });
    const recorded = await this.complaints.countDocuments({ insistence: doc._id });
    return { complaint, insistence: doc._id, remaining: doc.patience - recorded };
  }

  async giveUp({ aim }: { aim: string }) {
    return await this.#settle(aim, "exhausted");
  }

  async satisfy({ aim }: { aim: string }) {
    return await this.#settle(aim, "satisfied");
  }

  async _unsettledFor({ aim }: { aim: string }) {
    const doc = await this.#unsettled(aim);
    if (doc === null) return [];
    const recorded = await this.complaints.countDocuments({ insistence: doc._id });
    return [{ insistence: doc._id, patience: doc.patience, remaining: doc.patience - recorded }];
  }

  async _standingFor({ aim }: { aim: string }) {
    const doc = await this.#unsettled(aim);
    if (doc === null) return [];
    const recorded = await this.complaints.countDocuments({ insistence: doc._id });
    if (recorded >= doc.patience) return [];
    return [{ insistence: doc._id, remaining: doc.patience - recorded }];
  }

  async _spentFor({ aim }: { aim: string }) {
    const doc = await this.#unsettled(aim);
    if (doc === null) return [];
    const recorded = await this.complaints.countDocuments({ insistence: doc._id });
    if (recorded < doc.patience) return [];
    return [{ insistence: doc._id, complaints: recorded }];
  }

  async _for({ aim }: { aim: string }) {
    const docs = await this.insistences.find({ aim }).sort({ seq: 1 }).toArray();
    const rows = [];
    for (const doc of docs) {
      const recorded = await this.complaints.countDocuments({ insistence: doc._id });
      rows.push({
        insistence: doc._id,
        patience: doc.patience,
        settled: doc.settled,
        satisfied: doc.satisfied,
        exhausted: doc.exhausted,
        remaining: doc.patience - recorded,
      });
    }
    return rows;
  }

  async _complaints({ insistence }: { insistence: string }) {
    const docs = await this.complaints.find({ insistence }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      complaint: doc._id,
      offering: doc.offering,
      account: doc.account,
    }));
  }
}
