import type { Collection, Db } from "mongodb";
import { NothingLocated } from "./errors.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

interface LocationDoc {
  _id: string;
  subject: string;
  code: string;
}

export type LocationCodeMint = () => string;

export function mintLocationCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11_000;
}

export class MongoLocatingConcept {
  private readonly locations: Collection<LocationDoc>;
  private readonly mint: LocationCodeMint;
  private indexes: Promise<string[]> | undefined;

  constructor(db: Db, mint: LocationCodeMint = mintLocationCode) {
    this.locations = db.collection<LocationDoc>("locating.locations");
    this.mint = mint;
  }

  async #ready(): Promise<void> {
    await (this.indexes ??= this.locations.createIndexes([
      { key: { subject: 1 }, name: "subject_1", unique: true },
      { key: { code: 1 }, name: "code_1", unique: true },
    ]));
  }

  async ensure({ subject }: { subject: string }) {
    await this.#ready();
    const existing = await this.locations.findOne({ subject });
    if (existing !== null) return { location: existing._id, code: existing.code };

    const location = crypto.randomUUID();

    for (;;) {
      const code = this.mint();
      if (!CODE_PATTERN.test(code)) {
        throw new Error("Locating minted an invalid code.");
      }

      try {
        await this.locations.insertOne({ _id: location, subject, code });
        return { location, code };
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;

        const raced = await this.locations.findOne({ subject });
        if (raced !== null) return { location: raced._id, code: raced.code };

        const collision = await this.locations.findOne({ code });
        if (collision === null) throw error;
      }
    }
  }

  async locate({ code }: { code: string }) {
    const normalized = normalizeCode(code);
    if (!CODE_PATTERN.test(normalized)) {
      throw new NothingLocated("Nothing is located there.");
    }
    const doc = await this.locations.findOne({ code: normalized });
    if (doc === null) throw new NothingLocated("Nothing is located there.");
    return { subject: doc.subject };
  }

  async _for({ subject }: { subject: string }) {
    const doc = await this.locations.findOne({ subject });
    return doc === null ? [] : [{ location: doc._id, code: doc.code }];
  }

  async _at({ code }: { code: string }) {
    const normalized = normalizeCode(code);
    if (!CODE_PATTERN.test(normalized)) return [];
    const doc = await this.locations.findOne({ code: normalized });
    return doc === null ? [] : [{ location: doc._id, subject: doc.subject }];
  }
}
