import type { Collection, Db } from "mongodb";
import {
  InvalidVisibility,
  NoteNotFound,
  NoteNotLearnerVisible,
  NoteNotOpen,
  NoteNotOwner,
  NoteNotResolved,
  NoteNotRestorable,
} from "./errors.ts";

type Status = "OPEN" | "RESOLVED" | "ARCHIVED";

interface NoteDoc {
  _id: string;
  author: string;
  learner: string;
  body: string;
  tags: string[];
  status: Status;
  disclosed: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  followUpAt: Date | null;
  acknowledgedAt: Date | null;
  seq: number;
}

const namesAVisibility = (visibility: string): boolean =>
  visibility === "STAFF_ONLY" || visibility === "LEARNER_VISIBLE";

const visibilityOf = (doc: NoteDoc): string => (doc.disclosed ? "LEARNER_VISIBLE" : "STAFF_ONLY");

export class MongoNotingConcept {
  private readonly notes: Collection<NoteDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.notes = db.collection<NoteDoc>("noting.notes");
    this.counters = db.collection("noting.counters");
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "notes" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async write({
    author,
    learner,
    body,
    visibility,
    tags,
    followUpAt,
    at,
  }: {
    author: string;
    learner: string;
    body: string;
    visibility: string;
    tags: string[];
    followUpAt: Date | null;
    at: Date;
  }) {
    if (!namesAVisibility(visibility)) {
      throw new InvalidVisibility("Visibility must be staff-only or learner-visible.");
    }
    const note = crypto.randomUUID();
    const seq = await this.#nextSeq();
    await this.notes.insertOne({
      _id: note,
      author,
      learner,
      body,
      tags,
      status: "OPEN",
      disclosed: visibility === "LEARNER_VISIBLE",
      createdAt: at,
      updatedAt: null,
      followUpAt,
      acknowledgedAt: null,
      seq,
    });
    return { note };
  }

  async revise({
    note,
    body,
    visibility,
    tags,
    followUpAt,
    at,
  }: {
    note: string;
    body: string;
    visibility: string;
    tags: string[];
    followUpAt: Date | null;
    at: Date;
  }) {
    const doc = await this.notes.findOne({ _id: note });
    if (doc === null) {
      throw new NoteNotFound("There is no such note.");
    }
    if (doc.status !== "OPEN") {
      throw new NoteNotOpen("This note is no longer open.");
    }
    if (!namesAVisibility(visibility)) {
      throw new InvalidVisibility("Visibility must be staff-only or learner-visible.");
    }
    await this.notes.updateOne(
      { _id: note },
      {
        $set: {
          body,
          tags,
          followUpAt,
          updatedAt: at,
          disclosed: visibility === "LEARNER_VISIBLE",
        },
      },
    );
    return { note };
  }

  async resolve({ note, at }: { note: string; at: Date }) {
    const doc = await this.notes.findOne({ _id: note });
    if (doc === null) {
      throw new NoteNotFound("There is no such note.");
    }
    if (doc.status !== "OPEN") {
      throw new NoteNotOpen("This note is no longer open.");
    }
    await this.notes.updateOne({ _id: note }, { $set: { status: "RESOLVED", updatedAt: at } });
    return { note };
  }

  async archive({ note, at }: { note: string; at: Date }) {
    const doc = await this.notes.findOne({ _id: note });
    if (doc === null) {
      throw new NoteNotFound("There is no such note.");
    }
    if (doc.status !== "RESOLVED") {
      throw new NoteNotResolved("Only a resolved note can be archived.");
    }
    await this.notes.updateOne({ _id: note }, { $set: { status: "ARCHIVED", updatedAt: at } });
    return { note };
  }

  async restore({ note, at }: { note: string; at: Date }) {
    const doc = await this.notes.findOne({ _id: note });
    if (doc === null) {
      throw new NoteNotFound("There is no such note.");
    }
    if (doc.status === "OPEN") {
      throw new NoteNotRestorable("This note cannot be restored.");
    }
    await this.notes.updateOne({ _id: note }, { $set: { status: "OPEN", updatedAt: at } });
    return { note };
  }

  async acknowledge({ note, learner, at }: { note: string; learner: string; at: Date }) {
    const doc = await this.notes.findOne({ _id: note });
    if (doc === null) {
      throw new NoteNotFound("There is no such note.");
    }
    if (!doc.disclosed) {
      throw new NoteNotLearnerVisible("This note is not shown to its learner.");
    }
    if (doc.learner !== learner) {
      throw new NoteNotOwner("Only the learner a note concerns may acknowledge it.");
    }
    await this.notes.updateOne({ _id: note }, { $set: { acknowledgedAt: at } });
    return { note };
  }

  async _getNote({ note }: { note: string }) {
    const doc = await this.notes.findOne({ _id: note });
    if (doc === null) return [];
    return [
      {
        note: doc._id,
        author: doc.author,
        learner: doc.learner,
        body: doc.body,
        visibility: visibilityOf(doc),
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        followUpAt: doc.followUpAt,
        acknowledgedAt: doc.acknowledgedAt,
        tags: doc.tags,
      },
    ];
  }

  async _getActiveNotesFor({ learner }: { learner: string }) {
    const docs = await this.notes
      .find({ learner, status: { $in: ["OPEN", "RESOLVED"] } })
      .sort({ seq: 1 })
      .toArray();
    return docs.map((doc) => ({
      note: doc._id,
      author: doc.author,
      learner: doc.learner,
      body: doc.body,
      visibility: visibilityOf(doc),
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      followUpAt: doc.followUpAt,
      acknowledgedAt: doc.acknowledgedAt,
      tags: doc.tags,
    }));
  }

  async _getShownTo({ learner }: { learner: string }) {
    const docs = await this.notes
      .find({ learner, disclosed: true, status: { $in: ["OPEN", "RESOLVED"] } })
      .sort({ seq: 1 })
      .toArray();
    return docs.map((doc) => ({
      note: doc._id,
      author: doc.author,
      learner: doc.learner,
      body: doc.body,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      followUpAt: doc.followUpAt,
      acknowledgedAt: doc.acknowledgedAt,
      tags: doc.tags,
    }));
  }

  async _getByAuthor({ author }: { author: string }) {
    const docs = await this.notes.find({ author }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      note: doc._id,
      learner: doc.learner,
      status: doc.status,
      visibility: visibilityOf(doc),
      createdAt: doc.createdAt,
    }));
  }

  async _getOpenFollowUpsBefore({ before }: { before: Date }) {
    const docs = await this.notes
      .find({ status: "OPEN", followUpAt: { $ne: null } })
      .sort({ seq: 1 })
      .toArray();
    const iso = (v: Date | string): string => (typeof v === "string" ? v : v.toISOString());
    return docs
      .filter((doc) => doc.followUpAt !== null && iso(doc.followUpAt) <= iso(before))
      .map((doc) => ({
        note: doc._id,
        author: doc.author,
        learner: doc.learner,
        body: doc.body,
        followUpAt: doc.followUpAt as Date,
        createdAt: doc.createdAt,
      }));
  }
}
