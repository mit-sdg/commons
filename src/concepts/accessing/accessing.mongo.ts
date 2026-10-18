import type { Collection, Db } from "mongodb";
import { AccessAlreadyEstablished } from "./errors.ts";

type AccessDoc = { _id: string } & ({ retired: false; holders: string[] } | { retired: true });

/** Establish a resource's whole holder set and retire it permanently. */
export class MongoAccessingConcept {
  private readonly resources: Collection<AccessDoc>;

  constructor(db: Db) {
    this.resources = db.collection<AccessDoc>("accessing.resources");
  }

  async establish({ resource, holders }: { resource: string; holders: string[] }) {
    try {
      await this.resources.insertOne({
        _id: resource,
        retired: false,
        holders: [...new Set(holders)].sort(),
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        throw new AccessAlreadyEstablished("Access has already been established or retired.");
      }
      throw error;
    }
    return { resource };
  }

  async retire({ resource }: { resource: string }) {
    await this.resources.updateOne(
      { _id: resource },
      { $set: { retired: true }, $unset: { holders: "" } },
      { upsert: true },
    );
    return { resource };
  }

  /** The holders of a resource still open, or null when it was never established or is retired. */
  async #holdersOf(resource: string): Promise<string[] | null> {
    const doc = await this.resources.findOne({ _id: resource });
    return doc === null || doc.retired ? null : doc.holders;
  }

  /** Each resource's holders, in the order given, from one read. */
  async _holders(inputs: readonly { resource: string }[]) {
    const resources = [...new Set(inputs.map(({ resource }) => resource))];
    if (resources.length === 0) return [];
    const docs = await this.resources.find({ _id: { $in: resources } }).toArray();
    const open = new Map(
      docs.flatMap((doc) => (doc.retired ? [] : [[doc._id, doc.holders] as const])),
    );
    return inputs.map(({ resource }) => {
      const holders = open.get(resource);
      return holders === undefined ? [] : [{ holders: [...holders] }];
    });
  }

  async _grants({ resource }: { resource: string }) {
    const holders = await this.#holdersOf(resource);
    return holders?.map((holder) => ({ holder })) ?? [];
  }

  async _isRetired({ resource }: { resource: string }) {
    const doc = await this.resources.findOne({ _id: resource });
    return { retired: doc?.retired === true };
  }
}
