import type { Collection, Db } from "mongodb";
import { OverrideReasonRequired, OverrideValueRequired } from "./errors.ts";

interface OverrideDoc {
  _id: string;
  subject: string;
  value: string;
  reason: string;
  replaced: string;
  author: string;
  setAt: Date;
}

export class MongoOverridingConcept {
  private readonly overrides: Collection<OverrideDoc>;
  private indexes: Promise<unknown> | undefined;

  constructor(db: Db) {
    this.overrides = db.collection<OverrideDoc>("overriding.overrides");
  }

  async #ready(): Promise<void> {
    await (this.indexes ??= this.overrides.createIndexes([
      { key: { subject: 1 }, unique: true },
      { key: { setAt: 1 } },
    ]));
  }

  async set({
    subject,
    value,
    reason,
    replaced,
    author,
    at,
  }: {
    subject: string;
    value: string;
    reason: string;
    replaced: string;
    author: string;
    at: Date;
  }) {
    if (value.trim() === "") throw new OverrideValueRequired("An override needs a value.");
    if (reason.trim() === "") throw new OverrideReasonRequired("An override needs a reason.");
    await this.#ready();
    const doc = await this.overrides.findOneAndUpdate(
      { subject },
      {
        $set: { value: value.trim(), reason: reason.trim(), replaced, author, setAt: at },
        $setOnInsert: { _id: crypto.randomUUID() },
      },
      { upsert: true, returnDocument: "after" },
    );
    return { override: doc!._id };
  }

  async clear({ subject }: { subject: string }) {
    await this.#ready();
    await this.overrides.deleteOne({ subject });
    return { subject };
  }

  async _override({ subject }: { subject: string }) {
    await this.#ready();
    const doc = await this.overrides.findOne({ subject });
    return doc === null
      ? []
      : [
          {
            override: doc._id,
            value: doc.value,
            reason: doc.reason,
            replaced: doc.replaced,
            author: doc.author,
            setAt: doc.setAt,
          },
        ];
  }

  async _overrides() {
    await this.#ready();
    const docs = await this.overrides.find().sort({ setAt: 1, _id: 1 }).toArray();
    return {
      overrides: docs.map(({ subject, value, reason, replaced, author, setAt }) => ({
        subject,
        value,
        reason,
        replaced,
        author,
        setAt,
      })),
    };
  }
}
