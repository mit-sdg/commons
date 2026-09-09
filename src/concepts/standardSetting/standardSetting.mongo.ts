import type { Collection, Db } from "mongodb";
import { InvalidStandard, StandardConflict, StandardNotFound } from "./errors.ts";

export interface StandardContent {
  name: string;
  description: string;
  deficient: string;
  emergent: string;
  competent: string;
  expert: string;
  referenceUrl: string;
}
interface Edition extends StandardContent {
  edition: string;
  number: number;
}
interface StandardDoc {
  _id: string;
  current: string;
  editions: Edition[];
}

export class MongoStandardSettingConcept {
  private readonly standards: Collection<StandardDoc>;
  constructor(db: Db) {
    this.standards = db.collection("standardSetting.standards");
  }

  #content(content: StandardContent): StandardContent {
    const fields = ["name", "description", "deficient", "emergent", "competent", "expert"] as const;
    for (const field of fields) {
      if (
        typeof content[field] !== "string" ||
        !content[field].trim() ||
        content[field].length > 10000
      ) {
        throw new InvalidStandard(
          "Supply a name, description, and all four level descriptions (at most 10,000 characters each).",
        );
      }
    }
    if (typeof content.referenceUrl !== "string" || content.referenceUrl.length > 2048)
      throw new InvalidStandard("The reference link is invalid.");
    const referenceUrl = content.referenceUrl.trim();
    if (referenceUrl) {
      try {
        const url = new URL(referenceUrl);
        if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
          throw new Error();
      } catch {
        throw new InvalidStandard(
          "Use an absolute HTTP or HTTPS reference link without credentials.",
        );
      }
    }
    return {
      name: content.name.trim(),
      description: content.description.trim(),
      deficient: content.deficient.trim(),
      emergent: content.emergent.trim(),
      competent: content.competent.trim(),
      expert: content.expert.trim(),
      referenceUrl,
    };
  }
  async define(content: StandardContent) {
    const validated = this.#content(content);
    const standard = crypto.randomUUID();
    const edition = crypto.randomUUID();
    await this.standards.insertOne({
      _id: standard,
      current: edition,
      editions: [{ ...validated, edition, number: 1 }],
    });
    return { standard, edition };
  }
  async revise({
    standard,
    expectedEdition,
    ...content
  }: StandardContent & { standard: string; expectedEdition: string }) {
    const validated = this.#content(content);
    const doc = await this.standards.findOne({ _id: standard });
    if (!doc) throw new StandardNotFound("There is no such standard.");
    const edition = crypto.randomUUID();
    const result = await this.standards.updateOne(
      { _id: standard, current: expectedEdition },
      {
        $set: { current: edition },
        $push: { editions: { ...validated, edition, number: doc.editions.length + 1 } },
      },
    );
    if (!result.modifiedCount)
      throw new StandardConflict("This standard changed. Reload before issuing an edition.");
    return { standard, edition };
  }
  async _getStandards() {
    const docs = await this.standards.find().toArray();
    return docs
      .map((doc) => ({
        standard: doc._id,
        ...doc.editions.find((e) => e.edition === doc.current)!,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async _getEdition({ edition }: { edition: string }) {
    const doc = await this.standards.findOne({ "editions.edition": edition });
    if (!doc) return [];
    return [{ standard: doc._id, ...doc.editions.find((e) => e.edition === edition)! }];
  }
}
