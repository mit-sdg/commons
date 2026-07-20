import {
  ClassAlreadyConfigured,
  SeatAlreadyActive,
  SeatNotActive,
  SeatNotDropped,
  SeatNotFound,
  SeatNotPending,
  SectionNotFound,
} from "./errors.ts";

const freshID = () => crypto.randomUUID();

interface SeatDoc {
  externalKey: string;
  email: string;
  rosterName: string;
  kind: string;
  section: string | null;
  status: "PENDING" | "ACTIVE" | "DROPPED";
  user: string | null;
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

export class RosteringConcept {
  private theClass: {
    _id: string;
    code: string;
    title: string;
    term: string;
    timezone: string;
    status: string;
  } | null = null;
  private readonly sections = new Map<
    string,
    { name: string; location: string; meetingPattern: string; status: string }
  >();
  private readonly seats = new Map<string, SeatDoc>();

  configureClass({
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
    if (this.theClass !== null) {
      throw new ClassAlreadyConfigured(this.theClass.code);
    }
    this.theClass = { _id: freshID(), code, title, term, timezone, status: "ACTIVE" };
    return { class: { ...this.theClass } };
  }

  createSection({
    name,
    location,
    meetingPattern,
  }: {
    name: string;
    location: string;
    meetingPattern: string;
  }) {
    const _id = freshID();
    this.sections.set(_id, { name, location, meetingPattern, status: "ACTIVE" });
    return { section: { _id, name, location, meetingPattern, status: "ACTIVE" } };
  }

  updateSection({
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
    const doc = this.sections.get(section);
    if (doc === undefined) {
      throw new SectionNotFound(section);
    }
    doc.name = name;
    doc.location = location;
    doc.meetingPattern = meetingPattern;
    return { section: { _id: section, ...doc } };
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

  importSeats({
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
      if (this.#seatByExternalKey(externalKey) !== undefined) {
        skipped.push(externalKey);
        continue;
      }
      const _id = freshID();
      const doc: SeatDoc = {
        externalKey,
        email: row.email ?? "",
        rosterName: row.rosterName ?? "",
        kind: row.kind ?? "STUDENT",
        section: row.section ?? null,
        status: "PENDING",
        user: null,
      };
      this.seats.set(_id, doc);
      created.push(this.#row(_id, doc));
    }
    return { created, skipped };
  }

  claimSeat({ seat, user }: { seat: string; user: string }) {
    const doc = this.seats.get(seat);
    if (doc === undefined) {
      throw new SeatNotFound(seat);
    }
    if (doc.status !== "PENDING") {
      throw new SeatNotPending(seat);
    }
    for (const [other, otherDoc] of this.seats) {
      if (other !== seat && otherDoc.user === user && otherDoc.status === "ACTIVE") {
        throw new SeatAlreadyActive(user);
      }
    }
    doc.user = user;
    doc.status = "ACTIVE";
    return { seat: this.#row(seat, doc), kind: doc.kind, user, section: doc.section };
  }

  dropSeat({ seat }: { seat: string }) {
    const doc = this.seats.get(seat);
    if (doc === undefined) {
      throw new SeatNotFound(seat);
    }
    if (doc.status !== "ACTIVE") {
      throw new SeatNotActive(seat);
    }
    doc.status = "DROPPED";
    return { seat: this.#row(seat, doc), kind: doc.kind, user: doc.user };
  }

  reinstateSeat({ seat }: { seat: string }) {
    const doc = this.seats.get(seat);
    if (doc === undefined) {
      throw new SeatNotFound(seat);
    }
    if (doc.status !== "DROPPED") {
      throw new SeatNotDropped(seat);
    }
    for (const [other, otherDoc] of this.seats) {
      if (other !== seat && otherDoc.user === doc.user && otherDoc.status === "ACTIVE") {
        throw new SeatAlreadyActive(doc.user ?? "");
      }
    }
    doc.status = "ACTIVE";
    return { seat: this.#row(seat, doc), kind: doc.kind, user: doc.user, section: doc.section };
  }

  moveSection({ seat, section }: { seat: string; section: string }) {
    const doc = this.seats.get(seat);
    if (doc === undefined) {
      throw new SeatNotFound(seat);
    }
    doc.section = section;
    return { seat: this.#row(seat, doc) };
  }

  _getSections(_: Record<string, never>): {
    section: string;
    name: string;
    location: string;
    meetingPattern: string;
    status: string;
  }[] {
    return [...this.sections.entries()].map(([section, doc]) => ({ section, ...doc }));
  }

  _getSeatByExternalKey({ externalKey }: { externalKey: string }): {
    seat: string;
    email: string;
  }[] {
    for (const [seat, doc] of this.seats) {
      if (doc.externalKey === externalKey) return [{ seat, email: doc.email }];
    }
    return [];
  }

  _getSeatByUser({ user }: { user: string }): {
    seat: string;
    user: string | null;
    externalKey: string;
    email: string;
    rosterName: string;
    kind: string;
    section: string | null;
    status: string;
  }[] {
    for (const [seat, doc] of this.seats) {
      if (doc.user === user) {
        return [
          {
            seat,
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
    }
    return [];
  }

  _getSeatDetail({ user }: { user: string }): {
    detail: {
      seat: string;
      user: string;
      externalKey: string;
      email: string;
      rosterName: string;
      kind: string;
      section: string | null;
      status: string;
    };
  }[] {
    for (const [seat, doc] of this.seats) {
      if (doc.user === user) {
        return [
          {
            detail: {
              seat,
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
    }
    return [];
  }

  _getActiveMembers(_: Record<string, never>): {
    user: string | null;
    seat: string;
    kind: string;
    section: string | null;
    rosterName: string;
    email: string;
  }[] {
    return [...this.seats.entries()]
      .filter(([, doc]) => doc.status === "ACTIVE")
      .map(([seat, doc]) => ({
        user: doc.user,
        seat,
        kind: doc.kind,
        section: doc.section,
        rosterName: doc.rosterName,
        email: doc.email,
      }));
  }

  _isActiveStudent({ user }: { user: string }): { active: boolean } {
    for (const doc of this.seats.values()) {
      if (doc.user === user && doc.status === "ACTIVE" && doc.kind === "STUDENT") {
        return { active: true };
      }
    }
    return { active: false };
  }

  _getActiveStudents(_: Record<string, never>): {
    user: string;
    seat: string;
    section: string | null;
    rosterName: string;
    email: string;
  }[] {
    return [...this.seats.entries()]
      .filter(([, doc]) => doc.status === "ACTIVE" && doc.kind === "STUDENT" && doc.user !== null)
      .map(([seat, doc]) => ({
        user: doc.user as string,
        seat,
        section: doc.section,
        rosterName: doc.rosterName,
        email: doc.email,
      }));
  }

  _getUnclaimedSeats(_: Record<string, never>): {
    seat: string;
    externalKey: string;
    email: string;
    rosterName: string;
    kind: string;
    section: string | null;
  }[] {
    return [...this.seats.entries()]
      .filter(([, doc]) => doc.status === "PENDING" && doc.user === null)
      .map(([seat, doc]) => ({
        seat,
        externalKey: doc.externalKey,
        email: doc.email,
        rosterName: doc.rosterName,
        kind: doc.kind,
        section: doc.section,
      }));
  }

  #seatByExternalKey(externalKey: string): string | undefined {
    for (const [seat, doc] of this.seats) {
      if (doc.externalKey === externalKey) return seat;
    }
    return undefined;
  }

  #row(_id: string, doc: SeatDoc): SeatRow {
    return {
      _id,
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
