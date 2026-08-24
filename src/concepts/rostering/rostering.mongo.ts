import type { Collection, Db } from "mongodb";
import {
  ClassAlreadyConfigured,
  ClassNotConfigured,
  SeatAlreadyActive,
  SeatAlreadyExists,
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
  email: string;
  kind: string;
  section: string | null;
  status: "PENDING" | "ACTIVE" | "DROPPED";
  user: string | null;
  seq: number;
}

interface SeatRow {
  _id: string;
  email: string;
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

  async updateClass({
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
    if (existing === null) {
      throw new ClassNotConfigured("no class is configured");
    }
    await this.classes.updateOne({ _id: existing._id }, { $set: { code, title, term, timezone } });
    return { class: { ...existing, code, title, term, timezone } };
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
      email?: string;
      kind?: string;
      section?: string;
    }[];
  }) {
    const created: SeatRow[] = [];
    const skipped: string[] = [];
    for (const row of rows) {
      const email = (row.email ?? "").trim().toLowerCase();
      if (email === "" || (await this.seats.findOne({ email })) !== null) {
        skipped.push(email);
        continue;
      }
      const _id = crypto.randomUUID();
      const seq = await this.#nextSeq("seats");
      const doc: SeatDoc = {
        _id,
        email,
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

  async enrol({
    email,
    kind,
    section,
    user,
  }: {
    email: string;
    kind: string;
    section: string | null;
    user: string;
  }) {
    const address = email.trim().toLowerCase();
    const existing = await this.seats.findOne({ email: address });
    if (existing !== null && existing.status !== "PENDING") {
      throw new SeatAlreadyExists(address);
    }
    if ((await this.seats.findOne({ user, status: "ACTIVE" })) !== null) {
      throw new SeatAlreadyActive(user);
    }
    // An imported seat is already waiting for this address, so enrolling claims
    // it rather than creating a second one.
    if (existing !== null) {
      await this.seats.updateOne({ _id: existing._id }, { $set: { user, status: "ACTIVE" } });
      const claimed: SeatDoc = { ...existing, user, status: "ACTIVE" };
      return {
        seat: this.#row(claimed),
        kind: claimed.kind,
        user,
        section: claimed.section,
      };
    }
    const _id = crypto.randomUUID();
    const seq = await this.#nextSeq("seats");
    const doc: SeatDoc = {
      _id,
      email: address,
      kind: kind || "STUDENT",
      section: section ?? null,
      status: "ACTIVE",
      user,
      seq,
    };
    await this.seats.insertOne(doc);
    return { seat: this.#row(doc), kind: doc.kind, user, section: doc.section };
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

  async removeSeat({ seat }: { seat: string }) {
    // Deleting the seat outright is what frees its address: after this the
    // address carries no seat, so it can be imported or enrolled again.
    const doc = await this.seats.findOneAndDelete({ _id: seat });
    if (doc === null) {
      throw new SeatNotFound(seat);
    }
    return { seat: this.#row(doc), email: doc.email };
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

  async _getClass(_: Record<string, never>) {
    const doc = await this.classes.findOne({});
    return doc === null
      ? []
      : [
          {
            detail: {
              code: doc.code,
              title: doc.title,
              term: doc.term,
              timezone: doc.timezone,
              status: doc.status,
            },
          },
        ];
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

  async _getSeatByEmail({ email }: { email: string }) {
    const seat = await this.seats.findOne({ email: email.trim().toLowerCase() });
    return seat === null ? [] : [{ seat: seat._id, email: seat.email }];
  }

  async _getPendingSeatByEmail({ email }: { email: string }) {
    const seat = await this.seats.findOne({
      email: email.trim().toLowerCase(),
      status: "PENDING",
      user: null,
    });
    return seat === null ? [] : [{ seat: seat._id, email: seat.email }];
  }

  async _getSeatByUser({ user }: { user: string }) {
    const doc = await this.#preferredSeatFor(user);
    if (doc === null) return [];
    return [
      {
        seat: doc._id,
        user: doc.user,
        email: doc.email,
        kind: doc.kind,
        section: doc.section,
        status: doc.status,
      },
    ];
  }

  async _getSeatDetail({ user }: { user: string }) {
    const doc = await this.#preferredSeatFor(user);
    if (doc === null) return [];
    return [
      {
        detail: {
          seat: doc._id,
          user,
          email: doc.email,
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
      email: doc.email,
      kind: doc.kind,
      section: doc.section,
    }));
  }

  async _getDroppedSeats(_: Record<string, never>) {
    const docs = await this.seats.find({ status: "DROPPED" }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      user: doc.user,
      seat: doc._id,
      kind: doc.kind,
      section: doc.section,
      email: doc.email,
    }));
  }

  async #preferredSeatFor(user: string): Promise<SeatDoc | null> {
    const active = await this.seats.findOne({ user, status: "ACTIVE" }, { sort: { seq: -1 } });
    return active ?? this.seats.findOne({ user }, { sort: { seq: -1 } });
  }

  #row(doc: SeatDoc): SeatRow {
    return {
      _id: doc._id,
      email: doc.email,
      kind: doc.kind,
      section: doc.section,
      status: doc.status,
      ...(doc.user !== null ? { user: doc.user } : {}),
    };
  }
}
