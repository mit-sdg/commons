import type { Collection, Db } from "mongodb";
import {
  PolicyIsFinal,
  PolicyNameRequired,
  PolicyNameTaken,
  PolicyNotFound,
  PolicyStale,
} from "./errors.ts";

interface PolicyDoc {
  _id: string;
  name: string;
  /** The trimmed, lower-cased name that keeps names unique. */
  key: string;
  version: number;
  specification: object;
  author: string;
  savedAt: Date;
}

interface VersionDoc {
  _id: string;
  policy: string;
  number: number;
  specification: object;
  author: string;
  savedAt: Date;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11_000;
}

const nameKey = (name: string) => name.trim().toLowerCase();

export class MongoPolicymakingConcept {
  private readonly policies: Collection<PolicyDoc>;
  private readonly versions: Collection<VersionDoc>;
  private readonly marks: Collection<{ _id: string; policy: string }>;
  private indexes: Promise<unknown> | undefined;

  constructor(db: Db) {
    this.policies = db.collection<PolicyDoc>("policymaking.policies");
    this.versions = db.collection<VersionDoc>("policymaking.versions");
    this.marks = db.collection("policymaking.final");
  }

  async #ready(): Promise<void> {
    await (this.indexes ??= Promise.all([
      this.policies.createIndex({ key: 1 }, { unique: true }),
      this.versions.createIndex({ policy: 1, number: 1 }, { unique: true }),
    ]));
  }

  async #final(): Promise<string | null> {
    return (await this.marks.findOne({ _id: "final" }))?.policy ?? null;
  }

  async create({
    name,
    specification,
    author,
    at,
  }: {
    name: string;
    specification: object;
    author: string;
    at: Date;
  }) {
    await this.#ready();
    if (name.trim() === "") throw new PolicyNameRequired("A policy needs a name.");
    const policy = crypto.randomUUID();
    try {
      await this.policies.insertOne({
        _id: policy,
        name: name.trim(),
        key: nameKey(name),
        version: 1,
        specification,
        author,
        savedAt: at,
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new PolicyNameTaken("Another policy has this name.");
      throw error;
    }
    await this.versions.insertOne({
      _id: crypto.randomUUID(),
      policy,
      number: 1,
      specification,
      author,
      savedAt: at,
    });
    return { policy, version: 1 };
  }

  async save({
    policy,
    version,
    specification,
    author,
    at,
  }: {
    policy: string;
    version: number;
    specification: object;
    author: string;
    at: Date;
  }) {
    await this.#ready();
    const next = version + 1;
    const saved = await this.policies.findOneAndUpdate(
      { _id: policy, version },
      { $set: { version: next, specification, author, savedAt: at } },
    );
    if (saved === null) {
      if ((await this.policies.countDocuments({ _id: policy })) === 0)
        throw new PolicyNotFound("There is no such policy.");
      throw new PolicyStale("Someone saved a newer version of this policy.");
    }
    await this.versions.insertOne({
      _id: crypto.randomUUID(),
      policy,
      number: next,
      specification,
      author,
      savedAt: at,
    });
    return { policy, version: next };
  }

  async rename({ policy, name }: { policy: string; name: string }) {
    await this.#ready();
    if ((await this.policies.countDocuments({ _id: policy })) === 0)
      throw new PolicyNotFound("There is no such policy.");
    if (name.trim() === "") throw new PolicyNameRequired("A policy needs a name.");
    try {
      await this.policies.updateOne(
        { _id: policy },
        { $set: { name: name.trim(), key: nameKey(name) } },
      );
    } catch (error) {
      if (isDuplicateKey(error)) throw new PolicyNameTaken("Another policy has this name.");
      throw error;
    }
    return { policy };
  }

  async remove({ policy }: { policy: string }) {
    await this.#ready();
    if ((await this.policies.countDocuments({ _id: policy })) === 0)
      throw new PolicyNotFound("There is no such policy.");
    if ((await this.#final()) === policy)
      throw new PolicyIsFinal("Mark another policy final before removing this one.");
    await this.policies.deleteOne({ _id: policy });
    await this.versions.deleteMany({ policy });
    return { policy };
  }

  async markFinal({ policy }: { policy: string }) {
    await this.#ready();
    if ((await this.policies.countDocuments({ _id: policy })) === 0)
      throw new PolicyNotFound("There is no such policy.");
    await this.marks.updateOne({ _id: "final" }, { $set: { policy } }, { upsert: true });
    return { policy };
  }

  async _policies() {
    await this.#ready();
    const final = await this.#final();
    const docs = await this.policies.find().sort({ key: 1 }).toArray();
    return docs.map((doc) => ({
      policy: doc._id,
      name: doc.name,
      version: doc.version,
      author: doc.author,
      savedAt: doc.savedAt,
      final: doc._id === final,
    }));
  }

  async _policy({ policy }: { policy: string }) {
    await this.#ready();
    const doc = await this.policies.findOne({ _id: policy });
    if (doc === null) return [];
    return [
      {
        name: doc.name,
        version: doc.version,
        specification: doc.specification,
        author: doc.author,
        savedAt: doc.savedAt,
        final: doc._id === (await this.#final()),
      },
    ];
  }

  async _version({ policy, version }: { policy: string; version: number }) {
    await this.#ready();
    const doc = await this.versions.findOne({ policy, number: version });
    return doc === null
      ? []
      : [{ specification: doc.specification, author: doc.author, savedAt: doc.savedAt }];
  }

  async _final() {
    await this.#ready();
    const final = await this.#final();
    const doc = final === null ? null : await this.policies.findOne({ _id: final });
    return doc === null
      ? []
      : [
          {
            policy: doc._id,
            name: doc.name,
            version: doc.version,
            specification: doc.specification,
          },
        ];
  }
}
