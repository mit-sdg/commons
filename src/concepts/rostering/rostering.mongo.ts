import type { Collection, Db } from "mongodb";
import {
  ClassAlreadyConfigured,
  SeatAlreadyActive,
  SeatNotActive,
  SeatNotDropped,
  SeatNotFound,
  SeatNotPending,
  SectionNotFound,
} from "./errors.ts";

interface ClassDoc {
  _id: string;
  code: string;
  title: string;
  term: string;
  timezone: string;
  status: string;
}

interface SectionDoc {
  _id: string;
  name: string;
  location: string;
  meetingPattern: string;
  status: string;
  seq: number;
}

interface SeatDoc {
  _id: string;
  externalKey: string;
  email: string;
  rosterName: string;
  kind: string;
  section: string | null;
  status: "PENDING" | "ACTIVE" | "DROPPED";
  user: string | null;
  seq: number;
}

interface SeatRow {
  _id: string;
  externalKey: string;
  email: string;
  rosterName: string;
  kind: string;
  section: string | null;
  status: string;
  user?: string;
}

export class MongoRosteringConcept {
  private readonly classes: Collection<ClassDoc>;
  private readonly sections: Collection<SectionDoc>;
  private readonly seats: Collection<SeatDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.classes = db.collection<ClassDoc>("rostering.classes");
    this.sections = db.collection<SectionDoc>("rostering.sections");
    this.seats = db.collection<SeatDoc>("rostering.seats");
    this.counters = db.collection("rostering.counters");
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async configureClass({
    code,
    title,
    term,
    timezone,
  }: {
    code: string;
    title: string;
    term: string;
    timezone: string;
  }) {
    const existing = await this.classes.findOne({});
    if (existing !== null) {
      throw new ClassAlreadyConfigured(existing.code);
    }
    const theClass: ClassDoc = {
      _id: crypto.randomUUID(),
      code,
      title,
      term,
      timezone,
      status: "ACTIVE",
    };
    await this.classes.insertOne(theClass);
    return { class: { ...theClass } };
  }

  async createSection({
    name,
    location,
    meetingPattern,
  }: {
    name: string;
    location: string;
    meetingPattern: string;
  }) {
    const _id = crypto.randomUUID();
    const seq = await this.#nextSeq("sections");
    await this.sections.insertOne({
      _id,
      name,
      location,
      meetingPattern,
      status: "ACTIVE",
      seq,
    });
    return { section: { _id, name, location, meetingPattern, status: "ACTIVE" } };
  }

  async updateSection({
    section,
    name,
    location,
    meetingPattern,
  }: {
    section: string;
    name: string;
    location: string;
    meetingPattern: string;
  }) {
    const doc = await this.sections.findOne({ _id: section });
    if (doc === null) {
      throw new SectionNotFound(section);
    }
    await this.sections.updateOne({ _id: section }, { $set: { name, location, meetingPattern } });
    return { section: { _id: section, name, location, meetingPattern, status: doc.status } };
  }

  previewImport({ csv }: { csv: string }) {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return { rows: [] };
    const headers = lines[0].split(",").map((header) => header.trim());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((value) => value.trim());
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });
    return { rows };
  }

  async importSeats({
    rows,
  }: {
    rows: {
      externalKey?: string;
      email?: string;
      rosterName?: string;
      kind?: string;
      section?: string;
    }[];
  }) {
    const created: SeatRow[] = [];
    const skipped: string[] = [];
    for (const row of rows) {
      const externalKey = row.externalKey ?? "";
      if ((await this.seats.findOne({ externalKey })) !== null) {
        skipped.push(externalKey);
        continue;
      }
      const _id = crypto.randomUUID();
      const seq = await this.#nextSeq("seats");
      const doc: SeatDoc = {
        _id,
        externalKey,
        email: row.email ?? "",
        rosterName: row.rosterName ?? "",
        kind: row.kind ?? "STUDENT",
        section: row.section ?? null,
        status: "PENDING",
        user: null,
        seq,
      };
      await this.seats.insertOne(doc);
      created.push(this.#row(doc));
    }
    return { created, skipped };
  }

  async claimSeat({ seat, user }: { seat: string; user: string }) {
    const doc = await this.seats.findOne({ _id: seat });
    if (doc === null) {
      throw new SeatNotFound(seat);
    }
    if (doc.status !== "PENDING") {
      throw new SeatNotPending(seat);
    }
    const other = await this.seats.findOne({ user, status: "ACTIVE", _id: { $ne: seat } });
    if (other !== null) {
      throw new SeatAlreadyActive(user);
    }
    await this.seats.updateOne({ _id: seat }, { $set: { user, status: "ACTIVE" } });
    const updated: SeatDoc = { ...doc, user, status: "ACTIVE" };
    return { seat: this.#row(updated), kind: doc.kind, user, section: doc.section };
  }

  async dropSeat({ seat }: { seat: string }) {
    const doc = await this.seats.findOne({ _id: seat });
    if (doc === null) {
      throw new SeatNotFound(seat);
    }
    if (doc.status !== "ACTIVE") {
      throw new SeatNotActive(seat);
    }
    await this.seats.updateOne({ _id: seat }, { $set: { status: "DROPPED" } });
    const updated: SeatDoc = { ...doc, status: "DROPPED" };
    return { seat: this.#row(updated), kind: doc.kind, user: doc.user };
  }

  async reinstateSeat({ seat }: { seat: string }) {
    const doc = await this.seats.findOne({ _id: seat });
    if (doc === null) {
      throw new SeatNotFound(seat);
    }
    if (doc.status !== "DROPPED") {
      throw new SeatNotDropped(seat);
    }
    const other = await this.seats.findOne({
      user: doc.user,
      status: "ACTIVE",
      _id: { $ne: seat },
    });
    if (other !== null) {
      throw new SeatAlreadyActive(doc.user ?? "");
    }
    await this.seats.updateOne({ _id: seat }, { $set: { status: "ACTIVE" } });
    const updated: SeatDoc = { ...doc, status: "ACTIVE" };
    return { seat: this.#row(updated), kind: doc.kind, user: doc.user, section: doc.section };
  }

  async moveSection({ seat, section }: { seat: string; section: string }) {
    const doc = await this.seats.findOne({ _id: seat });
    if (doc === null) {
      throw new SeatNotFound(seat);
    }
    await this.seats.updateOne({ _id: seat }, { $set: { section } });
    const updated: SeatDoc = { ...doc, section };
    return { seat: this.#row(updated) };
  }

  async _getSections(_: Record<string, never>) {
    const docs = await this.sections.find({}).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      section: doc._id,
      name: doc.name,
      location: doc.location,
      meetingPattern: doc.meetingPattern,
      status: doc.status,
    }));
  }

  async _getSeatByExternalKey({ externalKey }: { externalKey: string }) {
    const seat = await this.seats.findOne({ externalKey });
    return seat === null ? [] : [{ seat: seat._id, email: seat.email }];
  }

  async _getSeatByUser({ user }: { user: string }) {
    const doc = await this.seats.findOne({ user }, { sort: { seq: 1 } });
    if (doc === null) return [];
    return [
      {
        seat: doc._id,
        user: doc.user,
        externalKey: doc.externalKey,
        email: doc.email,
        rosterName: doc.rosterName,
        kind: doc.kind,
        section: doc.section,
        status: doc.status,
      },
    ];
  }

  async _getSeatDetail({ user }: { user: string }) {
    const doc = await this.seats.findOne({ user }, { sort: { seq: 1 } });
    if (doc === null) return [];
    return [
      {
        detail: {
          seat: doc._id,
          user,
          externalKey: doc.externalKey,
          email: doc.email,
          rosterName: doc.rosterName,
          kind: doc.kind,
          section: doc.section,
          status: doc.status,
        },
      },
    ];
  }

  async _getActiveMembers(_: Record<string, never>) {
    const docs = await this.seats.find({ status: "ACTIVE" }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      user: doc.user,
      seat: doc._id,
      kind: doc.kind,
      section: doc.section,
      rosterName: doc.rosterName,
      email: doc.email,
    }));
  }

  async _isActiveStudent({ user }: { user: string }) {
    const doc = await this.seats.findOne({ user, status: "ACTIVE", kind: "STUDENT" });
    return { active: doc !== null };
  }

  async _getActiveStudents(_: Record<string, never>) {
    const docs = await this.seats
      .find({ status: "ACTIVE", kind: "STUDENT", user: { $ne: null } })
      .sort({ seq: 1 })
      .toArray();
    return docs.map((doc) => ({
      user: doc.user as string,
      seat: doc._id,
      section: doc.section,
      rosterName: doc.rosterName,
      email: doc.email,
    }));
  }

  async _getUnclaimedSeats(_: Record<string, never>) {
    const docs = await this.seats
      .find({ status: "PENDING", user: null })
      .sort({ seq: 1 })
      .toArray();
    return docs.map((doc) => ({
      seat: doc._id,
      externalKey: doc.externalKey,
      email: doc.email,
      rosterName: doc.rosterName,
      kind: doc.kind,
      section: doc.section,
    }));
  }

  #row(doc: SeatDoc): SeatRow {
    return {
      _id: doc._id,
      externalKey: doc.externalKey,
      email: doc.email,
      rosterName: doc.rosterName,
      kind: doc.kind,
      section: doc.section,
      status: doc.status,
      ...(doc.user !== null ? { user: doc.user } : {}),
    };
  }
}
