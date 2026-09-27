import type { Collection, Db, IndexDescription } from "mongodb";
import {
  AlreadyClosed,
  EditionNotFound,
  MaterialAlreadyShared,
  PartDone,
  PartOpen,
  WholeClosed,
} from "./errors.ts";

interface EditionDoc {
  _id: string;
  author: string;
  material: string;
  whole?: string;
  openedAt: Date;
  closedAt: Date | null;
  open: boolean;
  seq: number;
}

type Publication = Pick<EditionDoc, "author" | "material" | "whole" | "openedAt">;

export const EDITION_INDEXES: IndexDescription[] = [
  {
    name: "one_open_edition_per_material",
    key: { material: 1 },
    unique: true,
    partialFilterExpression: { open: true },
  },
  {
    name: "one_open_part_per_whole",
    key: { whole: 1 },
    unique: true,
    partialFilterExpression: { whole: { $type: "string" }, open: true },
  },
  {
    name: "one_part_per_material_per_whole",
    key: { whole: 1, material: 1 },
    unique: true,
    partialFilterExpression: { whole: { $type: "string" } },
  },
];

/** Names the partial indexes' filter so a query by whole can use them. */
const inWhole = (whole: string) => ({ whole: { $eq: whole, $type: "string" as const } });

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11_000;
}

export class MongoPublishingConcept {
  private readonly editions: Collection<EditionDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;
  private indexes: Promise<string[]> | undefined;
  private writing: Promise<void> = Promise.resolve();

  #write<Result>(action: () => Promise<Result>): Promise<Result> {
    const result = this.writing.then(action);
    this.writing = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  constructor(db: Db) {
    this.editions = db.collection<EditionDoc>("publishing.editions");
    this.counters = db.collection("publishing.counters");
  }

  async #ready(): Promise<void> {
    await (this.indexes ??= this.editions.createIndexes(EDITION_INDEXES));
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "editions" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async #open(publication: Publication, refuse: () => Promise<void>) {
    await this.#ready();
    for (;;) {
      await refuse();
      const edition = crypto.randomUUID();
      try {
        await this.editions.insertOne({
          _id: edition,
          ...publication,
          closedAt: null,
          open: true,
          seq: await this.#nextSeq(),
        });
        return { edition };
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
      }
    }
  }

  async #refuseShared(material: string): Promise<void> {
    if ((await this.editions.findOne({ material, open: true })) !== null) {
      throw new MaterialAlreadyShared("This is already running; close the open run first.");
    }
  }

  async #refuseWithin(whole: string, material: string): Promise<void> {
    const related = await this.editions
      .find({ $or: [{ _id: whole }, inWhole(whole), { material, open: true }] })
      .toArray();
    const standing = related.find((doc) => doc._id === whole);
    const parts = related.filter((doc) => doc.whole === whole);
    if (standing === undefined) {
      throw new EditionNotFound("There is no such edition.");
    }
    if (!standing.open) {
      throw new WholeClosed("What this belongs to is closed.");
    }
    if (parts.some((part) => part.material === material)) {
      throw new PartDone("This was already released here.");
    }
    if (parts.some((part) => part.open)) {
      throw new PartOpen("Another part is open; close it first.");
    }
    if (related.some((doc) => doc.material === material && doc.open)) {
      throw new MaterialAlreadyShared("This is already running; close the open run first.");
    }
  }

  async publish({ author, material, at }: { author: string; material: string; at: Date }) {
    return this.#write(() =>
      this.#open({ author, material, openedAt: at }, () => this.#refuseShared(material)),
    );
  }

  async publishWithin({
    whole,
    author,
    material,
    at,
  }: {
    whole: string;
    author: string;
    material: string;
    at: Date;
  }) {
    return this.#write(() =>
      this.#open({ whole, author, material, openedAt: at }, () =>
        this.#refuseWithin(whole, material),
      ),
    );
  }

  async close({ edition, at }: { edition: string; at: Date }) {
    return this.#write(async () => {
      const closing = await this.editions.updateOne(
        { _id: edition, open: true },
        { $set: { open: false, closedAt: at } },
      );
      if (closing.matchedCount === 1) return { edition };
      if ((await this.editions.findOne({ _id: edition })) === null) {
        throw new EditionNotFound("There is no such edition.");
      }
      throw new AlreadyClosed("This edition is already closed.");
    });
  }

  async _edition({ edition }: { edition: string }) {
    const doc = await this.editions.findOne({ _id: edition });
    return doc === null
      ? []
      : [
          {
            author: doc.author,
            material: doc.material,
            whole: doc.whole ?? null,
            open: doc.open,
            openedAt: doc.openedAt,
            closedAt: doc.closedAt,
          },
        ];
  }

  async _parts({ whole }: { whole: string }) {
    const docs = await this.editions.find(inWhole(whole)).sort({ openedAt: 1, seq: 1 }).toArray();
    return docs.map((doc) => ({
      edition: doc._id,
      material: doc.material,
      open: doc.open,
      openedAt: doc.openedAt,
      closedAt: doc.closedAt,
    }));
  }

  async _openPart({ whole }: { whole: string }) {
    const doc = await this.editions.findOne({ ...inWhole(whole), open: true });
    return doc === null ? [] : [{ edition: doc._id, material: doc.material }];
  }

  async _hasOpenEditionFor({ material }: { material: string }) {
    const doc = await this.editions.findOne({ material, open: true });
    return { open: doc !== null };
  }

  async _editionsFor({ material }: { material: string }) {
    const docs = await this.editions.find({ material }).sort({ openedAt: -1, seq: -1 }).toArray();
    return docs.map((doc) => ({
      edition: doc._id,
      open: doc.open,
      openedAt: doc.openedAt,
      closedAt: doc.closedAt,
    }));
  }

  async _openEditions() {
    const docs = await this.editions.find({ open: true }).sort({ openedAt: -1, seq: -1 }).toArray();
    return docs.map((doc) => ({
      edition: doc._id,
      author: doc.author,
      material: doc.material,
      openedAt: doc.openedAt,
    }));
  }
}
