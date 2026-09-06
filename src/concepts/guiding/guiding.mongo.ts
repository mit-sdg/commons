import type { Collection, Db } from "mongodb";
import { GuidanceNotFound, InvalidGuidance, InvalidTitle, InvalidUse } from "./errors.ts";

export const GUIDING_LIMITS = { title: 200, body: 40_000 } as const;

interface GuidanceDoc {
  _id: string;
  subject: string;
  use: string;
  title: string;
  body: string;
  /** The order given, within a subject and a use. */
  seq: number;
}

type Text = { title: string; body: string };

function checked({ title, body }: { title: string; body: string }): Text {
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  if (trimmedTitle.length > GUIDING_LIMITS.title) {
    throw new InvalidTitle(`title is longer than ${GUIDING_LIMITS.title} characters`);
  }
  if (trimmedBody === "" || trimmedBody.length > GUIDING_LIMITS.body) {
    throw new InvalidGuidance(`body must be 1 to ${GUIDING_LIMITS.body} characters`);
  }
  return { title: trimmedTitle, body: trimmedBody };
}

export class MongoGuidingConcept {
  private readonly guidance: Collection<GuidanceDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  // The Mongo floor has one Guiding instance per database. Mutations share
  // this queue because set replaces several rows, and selections must not
  // retain a document removed between validation and saving. This provides
  // ordering within the supported process, not a distributed transaction.
  private writing: Promise<void> = Promise.resolve();

  #write<Result>(action: () => Promise<Result>): Promise<Result> {
    const result = this.writing.then(action);
    this.writing = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private readonly selections: Collection<{
    _id: string;
    subject: string;
    use: string;
    guidances: string[];
  }>;

  constructor(db: Db) {
    this.selections = db.collection("guiding.selections");
    this.guidance = db.collection<GuidanceDoc>("guiding.guidance");
    this.counters = db.collection("guiding.counters");
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "guidance" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async give({
    subject,
    use,
    title,
    body,
  }: {
    subject: string;
    use: string;
    title: string;
    body: string;
  }) {
    return this.#write(async () => {
      const named = use.trim();
      if (named === "") throw new InvalidUse("guidance needs a use");
      const text = checked({ title, body });
      const guidance = crypto.randomUUID();
      const seq = await this.#nextSeq();
      await this.guidance.insertOne({ _id: guidance, subject, use: named, ...text, seq });
      return { guidance };
    });
  }

  async set({
    subject,
    use,
    title,
    body,
  }: {
    subject: string;
    use: string;
    title: string;
    body: string;
  }) {
    return this.#write(async () => {
      const named = use.trim();
      if (named === "") throw new InvalidUse("guidance needs a use");
      const text = checked({ title, body });
      const standing = await this.guidance.find({ subject, use: named }).sort({ seq: 1 }).toArray();
      let kept = standing[0];
      if (kept === undefined) {
        const guidance = crypto.randomUUID();
        const seq = await this.#nextSeq();
        kept = { _id: guidance, subject, use: named, ...text, seq };
        await this.guidance.insertOne(kept);
      }
      await this.guidance.updateOne({ _id: kept._id }, { $set: text });
      await this.guidance.deleteMany({ subject, use: named, _id: { $ne: kept._id } });
      const removed = standing.slice(1).map((doc) => doc._id);
      if (removed.length > 0) {
        await this.selections.updateMany(
          { guidances: { $in: removed } },
          { $pull: { guidances: { $in: removed } } },
        );
      }
      return { guidance: kept._id };
    });
  }

  async revise({ guidance, title, body }: { guidance: string; title: string; body: string }) {
    return this.#write(async () => {
      const doc = await this.guidance.findOne({ _id: guidance });
      if (doc === null) throw new GuidanceNotFound(guidance);
      const text = checked({ title, body });
      await this.guidance.updateOne({ _id: guidance }, { $set: text });
      return { guidance };
    });
  }

  async remove({ guidance }: { guidance: string }) {
    return this.#write(async () => {
      const deleted = await this.guidance.deleteOne({ _id: guidance });
      if (deleted.deletedCount === 0) throw new GuidanceNotFound(guidance);
      await this.selections.updateMany({ guidances: guidance }, { $pull: { guidances: guidance } });
      return { guidance };
    });
  }

  /** Clear the subject's guidance as one mutation, including its selections. */
  async clear({ subject, use }: { subject: string; use: string }) {
    return this.#write(async () => {
      const named = use.trim();
      if (named === "") throw new InvalidUse("guidance needs a use");
      const docs = await this.guidance.find({ subject, use: named }).toArray();
      const guidances = docs.map((doc) => doc._id);
      if (guidances.length === 0) return { cleared: false };
      await this.guidance.deleteMany({ subject, use: named });
      await this.selections.updateMany(
        { guidances: { $in: guidances } },
        { $pull: { guidances: { $in: guidances } } },
      );
      return { cleared: true };
    });
  }

  /** Select existing guidance without copying or changing its source. */
  async select({ subject, use, guidances }: { subject: string; use: string; guidances: string[] }) {
    return this.#write(async () => {
      const named = use.trim();
      if (!named) throw new InvalidUse("guidance needs a use");
      const unique = [...new Set(guidances)];
      const found = await this.guidance.find({ _id: { $in: unique }, use: named }).toArray();
      if (found.length !== unique.length)
        throw new GuidanceNotFound("A selected document no longer exists.");
      await this.selections.updateOne(
        { _id: JSON.stringify([subject, named]) },
        { $set: { subject, use: named, guidances: unique } },
        { upsert: true },
      );
      return { subject };
    });
  }

  async _selection({ subject, use }: { subject: string; use: string }) {
    const selection = await this.selections.findOne({ _id: JSON.stringify([subject, use]) });
    return { guidances: selection?.guidances ?? [] };
  }

  async _documentsById({ guidances, use }: { guidances: string[]; use: string }) {
    const found = await this.guidance.find({ _id: { $in: guidances }, use }).toArray();
    const byId = new Map(found.map((doc) => [doc._id, doc]));
    return {
      guidances: [...new Set(guidances)].filter((id) => byId.has(id)),
      documents: [...new Set(guidances)].flatMap((id) => {
        const doc = byId.get(id);
        return doc ? [{ guidance: id, title: doc.title, body: doc.body }] : [];
      }),
    };
  }

  async _selectedDocuments({ subject, use }: { subject: string; use: string }) {
    const { guidances } = await this._selection({ subject, use });
    const { documents } = await this._documentsById({ guidances, use });
    return { documents };
  }

  async _guidanceFor({ subject, use }: { subject: string; use: string }) {
    const docs = await this.guidance.find({ subject, use }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ guidance: doc._id, title: doc.title, body: doc.body }));
  }

  async _guidance({ guidance }: { guidance: string }) {
    const doc = await this.guidance.findOne({ _id: guidance });
    return doc === null
      ? []
      : [{ subject: doc.subject, use: doc.use, title: doc.title, body: doc.body }];
  }

  async _guidanceText({ subject, use }: { subject: string; use: string }) {
    const docs = await this.guidance.find({ subject, use }).sort({ seq: 1 }).toArray();
    return { text: docs.map((doc) => doc.body).join("\n\n") };
  }

  async _documents({ subject, use }: { subject: string; use: string }) {
    const docs = await this.guidance.find({ subject, use }).sort({ seq: 1 }).toArray();
    return {
      documents: docs.map((doc) => ({ guidance: doc._id, title: doc.title, body: doc.body })),
    };
  }

  async _guidanceTexts({ subjects, use }: { subjects: string[]; use: string }) {
    const docs = await this.guidance
      .find({ subject: { $in: subjects }, use })
      .sort({ seq: 1 })
      .toArray();
    return {
      texts: subjects.map((subject) => ({
        subject,
        text: docs
          .filter((doc) => doc.subject === subject)
          .map((doc) => doc.body)
          .join("\n\n"),
      })),
    };
  }
}
