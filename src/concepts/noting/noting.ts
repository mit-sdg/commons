import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import {
  InvalidVisibility,
  NoteNotFound,
  NoteNotLearnerVisible,
  NoteNotOpen,
  NoteNotOwner,
  NoteNotResolved,
  NoteNotRestorable,
} from "./errors.ts";

const freshID = () => crypto.randomUUID();

type Status = "OPEN" | "RESOLVED" | "ARCHIVED";

interface NoteDoc {
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
}

const namesAVisibility = (visibility: string): boolean =>
  visibility === "STAFF_ONLY" || visibility === "LEARNER_VISIBLE";

const visibilityOf = (doc: NoteDoc): string => (doc.disclosed ? "LEARNER_VISIBLE" : "STAFF_ONLY");

export class NotingConcept {
  static readonly queries = {
    _getNote: "optional",
    _getActiveNotesFor: "many",
    _getShownTo: "many",
    _getByAuthor: "many",
    _getOpenFollowUpsBefore: "many",
  } as const satisfies Record<string, QueryPromise>;

  private readonly notes = new Map<string, NoteDoc>();

  write({
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
    const note = freshID();
    this.notes.set(note, {
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
    });
    return { note };
  }

  revise({
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
    const doc = this.notes.get(note);
    if (doc === undefined) {
      throw new NoteNotFound("There is no such note.");
    }
    if (doc.status !== "OPEN") {
      throw new NoteNotOpen("This note is no longer open.");
    }
    if (!namesAVisibility(visibility)) {
      throw new InvalidVisibility("Visibility must be staff-only or learner-visible.");
    }
    doc.body = body;
    doc.tags = tags;
    doc.followUpAt = followUpAt;
    doc.updatedAt = at;
    doc.disclosed = visibility === "LEARNER_VISIBLE";
    return { note };
  }

  resolve({ note, at }: { note: string; at: Date }) {
    const doc = this.notes.get(note);
    if (doc === undefined) {
      throw new NoteNotFound("There is no such note.");
    }
    if (doc.status !== "OPEN") {
      throw new NoteNotOpen("This note is no longer open.");
    }
    doc.status = "RESOLVED";
    doc.updatedAt = at;
    return { note };
  }

  archive({ note, at }: { note: string; at: Date }) {
    const doc = this.notes.get(note);
    if (doc === undefined) {
      throw new NoteNotFound("There is no such note.");
    }
    if (doc.status !== "RESOLVED") {
      throw new NoteNotResolved("Only a resolved note can be archived.");
    }
    doc.status = "ARCHIVED";
    doc.updatedAt = at;
    return { note };
  }

  restore({ note, at }: { note: string; at: Date }) {
    const doc = this.notes.get(note);
    if (doc === undefined) {
      throw new NoteNotFound("There is no such note.");
    }
    if (doc.status === "OPEN") {
      throw new NoteNotRestorable("This note cannot be restored.");
    }
    doc.status = "OPEN";
    doc.updatedAt = at;
    return { note };
  }

  acknowledge({ note, learner, at }: { note: string; learner: string; at: Date }) {
    const doc = this.notes.get(note);
    if (doc === undefined) {
      throw new NoteNotFound("There is no such note.");
    }
    if (!doc.disclosed) {
      throw new NoteNotLearnerVisible("This note is not shown to its learner.");
    }
    if (doc.learner !== learner) {
      throw new NoteNotOwner("Only the learner a note concerns may acknowledge it.");
    }
    doc.acknowledgedAt = at;
    return { note };
  }

  _getNote({ note }: { note: string }): {
    note: string;
    author: string;
    learner: string;
    body: string;
    visibility: string;
    status: string;
    createdAt: Date;
    updatedAt: Date | null;
    followUpAt: Date | null;
    acknowledgedAt: Date | null;
    tags: string[];
  }[] {
    const doc = this.notes.get(note);
    if (doc === undefined) return [];
    return [
      {
        note,
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

  _getActiveNotesFor({ learner }: { learner: string }): {
    note: string;
    author: string;
    learner: string;
    body: string;
    visibility: string;
    status: string;
    createdAt: Date;
    updatedAt: Date | null;
    followUpAt: Date | null;
    acknowledgedAt: Date | null;
    tags: string[];
  }[] {
    const rows = [];
    for (const [note, doc] of this.notes) {
      if (doc.learner === learner && (doc.status === "OPEN" || doc.status === "RESOLVED")) {
        rows.push({
          note,
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
        });
      }
    }
    return rows;
  }

  _getShownTo({ learner }: { learner: string }): {
    note: string;
    author: string;
    learner: string;
    body: string;
    status: string;
    createdAt: Date;
    updatedAt: Date | null;
    followUpAt: Date | null;
    acknowledgedAt: Date | null;
    tags: string[];
  }[] {
    const rows = [];
    for (const [note, doc] of this.notes) {
      if (
        doc.learner === learner &&
        doc.disclosed &&
        (doc.status === "OPEN" || doc.status === "RESOLVED")
      ) {
        rows.push({
          note,
          author: doc.author,
          learner: doc.learner,
          body: doc.body,
          status: doc.status,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          followUpAt: doc.followUpAt,
          acknowledgedAt: doc.acknowledgedAt,
          tags: doc.tags,
        });
      }
    }
    return rows;
  }

  _getByAuthor({ author }: { author: string }): {
    note: string;
    learner: string;
    status: string;
    visibility: string;
    createdAt: Date;
  }[] {
    const rows = [];
    for (const [note, doc] of this.notes) {
      if (doc.author === author) {
        rows.push({
          note,
          learner: doc.learner,
          status: doc.status,
          visibility: visibilityOf(doc),
          createdAt: doc.createdAt,
        });
      }
    }
    return rows;
  }

  _getOpenFollowUpsBefore({ before }: { before: Date }): {
    note: string;
    author: string;
    learner: string;
    body: string;
    followUpAt: Date;
    createdAt: Date;
  }[] {
    const rows = [];
    for (const [note, doc] of this.notes) {
      const iso = (v: Date | string): string => (typeof v === "string" ? v : v.toISOString());
      if (doc.status === "OPEN" && doc.followUpAt !== null && iso(doc.followUpAt) <= iso(before)) {
        rows.push({
          note,
          author: doc.author,
          learner: doc.learner,
          body: doc.body,
          followUpAt: doc.followUpAt,
          createdAt: doc.createdAt,
        });
      }
    }
    return rows;
  }
}
