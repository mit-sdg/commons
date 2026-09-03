import type { Collection, Db } from "mongodb";
import {
  InvalidSuggestion,
  NothingOffered,
  SuggestionNotFound,
  SuggestionSettled,
} from "./errors.ts";

/** A suggestion is in exactly one of pending, taken, or declined. */
type Standing = "pending" | "taken" | "declined";

interface OfferingDoc {
  _id: string;
  subject: string;
  offeredAt: Date;
  seq: number;
}

interface SuggestionDoc {
  _id: string;
  offering: string;
  kind: string;
  target: string;
  value: string;
  position: number;
  standing: Standing;
}

/** Each entry of offer's lines, as it arrives from outside the concept. */
interface Line {
  kind?: unknown;
  target?: unknown;
  value?: unknown;
}

/** A target or value is a String that may be empty; an absent one is empty. */
function normalizedField(field: unknown): string {
  if (field === undefined || field === null) return "";
  if (typeof field !== "string") {
    throw new InvalidSuggestion("A suggestion's target and value must be Strings.");
  }
  return field;
}

function normalizedLine(line: Line): { kind: string; target: string; value: string } {
  if (line === null || typeof line !== "object" || typeof line.kind !== "string") {
    throw new InvalidSuggestion("Every suggestion needs a kind.");
  }
  if (line.kind.trim() === "") {
    throw new InvalidSuggestion("Every suggestion needs a kind.");
  }
  return {
    kind: line.kind,
    target: normalizedField(line.target),
    value: normalizedField(line.value),
  };
}

export class MongoSuggestingConcept {
  private readonly offerings: Collection<OfferingDoc>;
  private readonly suggestions: Collection<SuggestionDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.offerings = db.collection<OfferingDoc>("suggesting.offerings");
    this.suggestions = db.collection<SuggestionDoc>("suggesting.suggestions");
    this.counters = db.collection("suggesting.counters");
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async offer({ subject, lines, at }: { subject: string; lines: Line[]; at: Date }) {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new NothingOffered("An offering needs at least one suggestion.");
    }
    const normalized = lines.map(normalizedLine);
    const offering = crypto.randomUUID();
    const seq = await this.#nextSeq("offerings");
    await this.offerings.insertOne({ _id: offering, subject, offeredAt: at, seq });
    await this.suggestions.insertMany(
      normalized.map((line, index) => ({
        _id: crypto.randomUUID(),
        offering,
        kind: line.kind,
        target: line.target,
        value: line.value,
        position: index + 1,
        standing: "pending" as Standing,
      })),
    );
    return { offering };
  }

  async #settle(suggestion: string, standing: Standing): Promise<SuggestionDoc> {
    const doc = await this.suggestions.findOne({ _id: suggestion });
    if (doc === null) {
      throw new SuggestionNotFound("There is no such suggestion.");
    }
    if (doc.standing !== "pending") {
      throw new SuggestionSettled("This suggestion was already settled.");
    }
    const settled = await this.suggestions.updateOne(
      { _id: suggestion, standing: "pending" },
      { $set: { standing } },
    );
    if (settled.modifiedCount === 0) {
      throw new SuggestionSettled("This suggestion was already settled.");
    }
    return doc;
  }

  async take({ suggestion }: { suggestion: string }) {
    const doc = await this.#settle(suggestion, "taken");
    return {
      suggestion,
      offering: doc.offering,
      kind: doc.kind,
      target: doc.target,
      value: doc.value,
    };
  }

  async decline({ suggestion }: { suggestion: string }) {
    await this.#settle(suggestion, "declined");
    return { suggestion };
  }

  async _offering({ offering }: { offering: string }) {
    const doc = await this.offerings.findOne({ _id: offering });
    return doc === null ? [] : [{ subject: doc.subject, offeredAt: doc.offeredAt }];
  }

  async _offeringsAbout({ subject }: { subject: string }) {
    const docs = await this.offerings.find({ subject }).sort({ offeredAt: -1, seq: -1 }).toArray();
    return docs.map((doc) => ({ offering: doc._id, offeredAt: doc.offeredAt }));
  }

  async _suggestions({ offering }: { offering: string }) {
    const docs = await this.suggestions.find({ offering }).sort({ position: 1 }).toArray();
    return docs.map((doc) => ({
      suggestion: doc._id,
      kind: doc.kind,
      target: doc.target,
      value: doc.value,
      position: doc.position,
      standing: doc.standing,
    }));
  }

  async _pendingIn({ offering }: { offering: string }) {
    const docs = await this.suggestions
      .find({ offering, standing: "pending" })
      .sort({ position: 1 })
      .toArray();
    return docs.map((doc) => ({
      suggestion: doc._id,
      kind: doc.kind,
      target: doc.target,
      value: doc.value,
      position: doc.position,
    }));
  }

  async _suggestion({ suggestion }: { suggestion: string }) {
    const doc = await this.suggestions.findOne({ _id: suggestion });
    if (doc === null) return [];
    const offering = await this.offerings.findOne({ _id: doc.offering });
    return [
      {
        offering: doc.offering,
        subject: offering?.subject ?? "",
        kind: doc.kind,
        target: doc.target,
        value: doc.value,
        position: doc.position,
        standing: doc.standing,
      },
    ];
  }
}
