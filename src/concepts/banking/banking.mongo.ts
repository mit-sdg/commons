import type { Collection, Db } from "mongodb";
import {
  InsufficientBalance,
  LateDaysExceedMax,
  LateDaysMustBePositive,
  LateDaysNegative,
  LateUseAlreadyExists,
  LateUseNotFound,
} from "./errors.ts";

interface GrantDoc {
  _id: string;
  learner: string;
  days: number;
  reason: string;
  grantedAt: Date;
  seq: number;
}

interface UseDoc {
  _id: string;
  learner: string;
  item: string;
  days: number;
  status: "APPLIED" | "CANCELED";
  appliedAt: Date;
  seq: number;
}

interface Terms {
  allowance: number;
  perItemLimit: number;
  unitHours: number;
}

const DEFAULT_TERMS: Terms = { allowance: 0, perItemLimit: 5, unitHours: 24 };
const TERMS_ID = "terms";

export class MongoBankingConcept {
  private readonly terms: Collection<{ _id: string } & Terms>;
  private readonly grants: Collection<GrantDoc>;
  private readonly uses: Collection<UseDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.terms = db.collection<{ _id: string } & Terms>("banking.terms");
    this.grants = db.collection<GrantDoc>("banking.grants");
    this.uses = db.collection<UseDoc>("banking.uses");
    this.counters = db.collection("banking.counters");
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async #terms(): Promise<Terms> {
    const doc = await this.terms.findOne({ _id: TERMS_ID });
    if (doc === null) return DEFAULT_TERMS;
    return { allowance: doc.allowance, perItemLimit: doc.perItemLimit, unitHours: doc.unitHours };
  }

  #appliedUse(learner: string, item: string): Promise<UseDoc | null> {
    return this.uses.findOne({ learner, item, status: "APPLIED" });
  }

  async #balance(learner: string): Promise<number> {
    let granted = (await this.#terms()).allowance;
    for (const doc of await this.grants.find({ learner }).toArray()) {
      granted += doc.days;
    }
    let used = 0;
    for (const doc of await this.uses.find({ learner, status: "APPLIED" }).toArray()) {
      used += doc.days;
    }
    return granted - used;
  }

  async setTerms({
    allowance,
    perItemLimit,
    unitHours,
  }: {
    allowance: number;
    perItemLimit: number;
    unitHours: number;
  }) {
    await this.terms.updateOne(
      { _id: TERMS_ID },
      { $set: { allowance, perItemLimit, unitHours } },
      { upsert: true },
    );
    return { allowance, perItemLimit, unitHours };
  }

  async grant({
    learner,
    days,
    reason,
    at,
  }: {
    learner: string;
    days: number;
    reason: string;
    at: Date;
  }) {
    if (!(days > 0)) {
      throw new LateDaysMustBePositive("A grant must be for a positive number of days.");
    }
    const grant = crypto.randomUUID();
    const seq = await this.#nextSeq("grants");
    await this.grants.insertOne({ _id: grant, learner, days, reason, grantedAt: at, seq });
    return { grant };
  }

  async apply({
    learner,
    item,
    days,
    at,
  }: {
    learner: string;
    item: string;
    days: number;
    at: Date;
  }) {
    if (!(days > 0)) {
      throw new LateDaysMustBePositive("Late days must be a positive number.");
    }
    if (days > (await this.#terms()).perItemLimit) {
      throw new LateDaysExceedMax("That is more late days than any one item may absorb.");
    }
    if ((await this.#appliedUse(learner, item)) !== null) {
      throw new LateUseAlreadyExists("Late days already stand applied to this item.");
    }
    if (days > (await this.#balance(learner))) {
      throw new InsufficientBalance("The learner's balance is short of the days requested.");
    }
    const use = crypto.randomUUID();
    const seq = await this.#nextSeq("uses");
    await this.uses.insertOne({
      _id: use,
      learner,
      item,
      days,
      status: "APPLIED",
      appliedAt: at,
      seq,
    });
    return { use };
  }

  async change({ learner, item, days }: { learner: string; item: string; days: number }) {
    const applied = await this.#appliedUse(learner, item);
    if (applied === null) {
      throw new LateUseNotFound("No late days stand applied to this item.");
    }
    if (days < 0) {
      throw new LateDaysNegative("Late days cannot be negative.");
    }
    if (days > (await this.#terms()).perItemLimit) {
      throw new LateDaysExceedMax("That is more late days than any one item may absorb.");
    }
    const increase = days - applied.days;
    if (increase > (await this.#balance(learner))) {
      throw new InsufficientBalance("The learner's balance is short of the increase requested.");
    }
    await this.uses.updateOne({ _id: applied._id }, { $set: { days } });
    return { use: applied._id };
  }

  async cancel({ learner, item }: { learner: string; item: string }) {
    const applied = await this.#appliedUse(learner, item);
    if (applied === null) {
      throw new LateUseNotFound("No late days stand applied to this item.");
    }
    await this.uses.updateOne({ _id: applied._id }, { $set: { status: "CANCELED" } });
    return { use: applied._id };
  }

  async _getTerms() {
    const t = await this.#terms();
    return { allowance: t.allowance, perItemLimit: t.perItemLimit, unitHours: t.unitHours };
  }

  async _getBalance({ learner }: { learner: string }) {
    let granted = (await this.#terms()).allowance;
    for (const doc of await this.grants.find({ learner }).toArray()) {
      granted += doc.days;
    }
    let used = 0;
    for (const doc of await this.uses.find({ learner, status: "APPLIED" }).toArray()) {
      used += doc.days;
    }
    return { granted, used, remaining: granted - used };
  }

  async _getApplied({ learner, item }: { learner: string; item: string }) {
    const applied = await this.#appliedUse(learner, item);
    if (applied === null) return [];
    return [{ use: applied._id, days: applied.days, appliedAt: applied.appliedAt }];
  }

  async _getUses({ learner }: { learner: string }) {
    const docs = await this.uses.find({ learner }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      use: doc._id,
      item: doc.item,
      days: doc.days,
      status: doc.status,
      appliedAt: doc.appliedAt,
    }));
  }

  async _getUsesForItem({ item }: { item: string }) {
    const docs = await this.uses.find({ item, status: "APPLIED" }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ learner: doc.learner, days: doc.days }));
  }

  async _getGrants({ learner }: { learner: string }) {
    const docs = await this.grants.find({ learner }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      grant: doc._id,
      days: doc.days,
      reason: doc.reason,
      grantedAt: doc.grantedAt,
    }));
  }
}
