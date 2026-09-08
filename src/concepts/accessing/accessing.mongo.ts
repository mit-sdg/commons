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

  async _holders({ resource }: { resource: string }) {
    const doc = await this.resources.findOne({ _id: resource });
    return doc === null || doc.retired ? [] : [{ holders: doc.holders }];
  }

  async _grants({ resource }: { resource: string }) {
    const [audience] = await this._holders({ resource });
    return audience?.holders.map((holder) => ({ holder })) ?? [];
  }

  async _isRetired({ resource }: { resource: string }) {
    const doc = await this.resources.findOne({ _id: resource });
    return { retired: doc?.retired === true };
  }
}
