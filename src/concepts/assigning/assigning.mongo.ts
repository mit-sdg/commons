import type { Collection, Db } from "mongodb";
import {
  AssignmentAudienceInvalid,
  AssignmentEveryoneNoTargets,
  AssignmentNotDraft,
  AssignmentNotFound,
  AssignmentNotPublished,
  AssignmentNotRevisable,
  AssignmentScheduleInvalid,
  AssignmentTargetsRequired,
  ReleaseAlreadyExists,
  ReleaseNotFound,
} from "./errors.ts";

type Audience = "EVERYONE" | "TARGETS";

interface AssignmentDoc {
  _id: string;
  author: string;
  title: string;
  instructions: string;
  kind: string;
  availableAt: string;
  dueAt: string;
  closeAt: string | null;
  acceptsSubmissions: boolean;
  audience: Audience;
  targets: string[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date | null;
  seq: number;
}

interface ReleaseDoc {
  _id: string;
  assignment: string;
  assignee: string;
  assignedAt: Date;
  dueOverride: string | null;
  status: "ASSIGNED";
  seq: number;
}

export class MongoAssigningConcept {
  private readonly assignments: Collection<AssignmentDoc>;
  private readonly releases: Collection<ReleaseDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.assignments = db.collection<AssignmentDoc>("assigning.assignments");
    this.releases = db.collection<ReleaseDoc>("assigning.releases");
    this.counters = db.collection("assigning.counters");
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  #checkSchedule(availableAt: string, dueAt: string, closeAt?: string | null) {
    const available = new Date(availableAt).getTime();
    const due = new Date(dueAt).getTime();
    const close = closeAt ? new Date(closeAt).getTime() : null;
    if (
      !Number.isFinite(available) ||
      !Number.isFinite(due) ||
      (close !== null && !Number.isFinite(close)) ||
      available > due ||
      (close !== null && due > close)
    ) {
      throw new AssignmentScheduleInvalid(
        "Availability must be on or before the due date, and the due date must be on or before close.",
      );
    }
  }

  #checkTargets(audience: Audience, targets: string[]) {
    if (audience !== "EVERYONE" && audience !== "TARGETS") {
      throw new AssignmentAudienceInvalid("The assignment audience must be EVERYONE or TARGETS.");
    }
    if (audience === "EVERYONE" && targets.length > 0) {
      throw new AssignmentEveryoneNoTargets("EVERYONE addresses everyone; targets must be empty");
    }
    if (audience === "TARGETS" && targets.length === 0) {
      throw new AssignmentTargetsRequired("TARGETS needs at least one target");
    }
  }

  async createDraft({
    author,
    title,
    instructions,
    kind,
    availableAt,
    dueAt,
    closeAt,
    acceptsSubmissions,
    audience,
    targets,
    at,
  }: {
    author: string;
    title: string;
    instructions: string;
    kind: string;
    availableAt: string;
    dueAt: string;
    closeAt: string;
    acceptsSubmissions: boolean;
    audience: Audience;
    targets: string[];
    at: Date;
  }) {
    this.#checkTargets(audience, targets);
    this.#checkSchedule(availableAt, dueAt, closeAt);
    const assignment = crypto.randomUUID();
    const seq = await this.#nextSeq("assignments");
    await this.assignments.insertOne({
      _id: assignment,
      author,
      title,
      instructions,
      kind,
      availableAt,
      dueAt,
      closeAt: closeAt ?? null,
      acceptsSubmissions,
      audience,
      targets: [...targets],
      status: "DRAFT",
      createdAt: at,
      updatedAt: null,
      seq,
    });
    return { assignment };
  }

  async revise({
    assignment,
    title,
    instructions,
    kind,
    availableAt,
    dueAt,
    closeAt,
    acceptsSubmissions,
    audience,
    targets,
    at,
  }: {
    assignment: string;
    title: string;
    instructions: string;
    kind: string;
    availableAt: string;
    dueAt: string;
    closeAt: string;
    acceptsSubmissions: boolean;
    audience: Audience;
    targets: string[];
    at: Date;
  }) {
    const doc = await this.assignments.findOne({ _id: assignment });
    if (doc === null) {
      throw new AssignmentNotFound(assignment);
    }
    if (doc.status === "ARCHIVED") {
      throw new AssignmentNotRevisable(assignment);
    }
    this.#checkTargets(audience, targets);
    this.#checkSchedule(availableAt, dueAt, closeAt);
    await this.assignments.updateOne(
      { _id: assignment },
      {
        $set: {
          title,
          instructions,
          kind,
          availableAt,
          dueAt,
          closeAt: closeAt ?? null,
          acceptsSubmissions,
          audience,
          targets: [...targets],
          updatedAt: at,
        },
      },
    );
    return {
      assignment,
      status: doc.status,
      audience,
      targets: [...targets],
      acceptsSubmissions,
    };
  }

  async publish({ assignment, at }: { assignment: string; at: Date }) {
    const doc = await this.assignments.findOne({ _id: assignment });
    if (doc === null) {
      throw new AssignmentNotFound(assignment);
    }
    if (doc.status !== "DRAFT") {
      throw new AssignmentNotDraft(assignment);
    }
    this.#checkSchedule(doc.availableAt, doc.dueAt, doc.closeAt);
    await this.assignments.updateOne(
      { _id: assignment },
      { $set: { status: "PUBLISHED", updatedAt: at } },
    );
    return {
      assignment,
      audience: doc.audience,
      targets: [...doc.targets],
      acceptsSubmissions: doc.acceptsSubmissions,
    };
  }

  async archive({ assignment, at }: { assignment: string; at: Date }) {
    const doc = await this.assignments.findOne({ _id: assignment });
    if (doc === null) {
      throw new AssignmentNotFound(assignment);
    }
    await this.assignments.updateOne(
      { _id: assignment },
      { $set: { status: "ARCHIVED", updatedAt: at } },
    );
    return { assignment };
  }

  async assign({ assignment, assignee, at }: { assignment: string; assignee: string; at: Date }) {
    const doc = await this.assignments.findOne({ _id: assignment });
    if (doc === null) {
      throw new AssignmentNotFound(assignment);
    }
    if (doc.status !== "PUBLISHED") {
      throw new AssignmentNotPublished(assignment);
    }
    if ((await this.releases.findOne({ assignment, assignee })) !== null) {
      throw new ReleaseAlreadyExists(`${assignee} <- ${assignment}`);
    }
    const release = crypto.randomUUID();
    const seq = await this.#nextSeq("releases");
    await this.releases.insertOne({
      _id: release,
      assignment,
      assignee,
      assignedAt: at,
      dueOverride: null,
      status: "ASSIGNED",
      seq,
    });
    return { release };
  }

  async setDueOverride({
    assignment,
    assignee,
    dueAt,
  }: {
    assignment: string;
    assignee: string;
    dueAt: string;
  }) {
    const rel = await this.releases.findOne({ assignment, assignee });
    if (rel === null) {
      throw new ReleaseNotFound(`${assignee} <- ${assignment}`);
    }
    await this.releases.updateOne({ _id: rel._id }, { $set: { dueOverride: dueAt } });
    return { release: rel._id };
  }

  async clearDueOverride({ assignment, assignee }: { assignment: string; assignee: string }) {
    const rel = await this.releases.findOne({ assignment, assignee });
    if (rel === null) {
      throw new ReleaseNotFound(`${assignee} <- ${assignment}`);
    }
    await this.releases.updateOne({ _id: rel._id }, { $set: { dueOverride: null } });
    return { release: rel._id };
  }

  async _getDetail({ assignment }: { assignment: string }) {
    const doc = await this.assignments.findOne({ _id: assignment });
    if (doc === null) return [];
    return [
      {
        detail: {
          assignment,
          author: doc.author,
          title: doc.title,
          instructions: doc.instructions,
          kind: doc.kind,
          availableAt: doc.availableAt,
          dueAt: doc.dueAt,
          closeAt: doc.closeAt,
          acceptsSubmissions: doc.acceptsSubmissions,
          audience: doc.audience,
          targets: [...doc.targets],
          status: doc.status,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        },
      },
    ];
  }

  async _getAssignments() {
    const docs = await this.assignments.find().sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      assignment: doc._id,
      author: doc.author,
      title: doc.title,
      instructions: doc.instructions,
      kind: doc.kind,
      availableAt: doc.availableAt,
      dueAt: doc.dueAt,
      closeAt: doc.closeAt,
      acceptsSubmissions: doc.acceptsSubmissions,
      audience: doc.audience,
      targets: [...doc.targets],
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  async _getAssigned({ assignee }: { assignee: string }) {
    const docs = await this.releases.find({ assignee }).sort({ seq: 1 }).toArray();
    return docs.map((rel) => ({
      assignment: rel.assignment,
      release: rel._id,
      dueOverride: rel.dueOverride,
      status: rel.status,
    }));
  }

  async _getAssignees({ assignment }: { assignment: string }) {
    const docs = await this.releases.find({ assignment }).sort({ seq: 1 }).toArray();
    return docs.map((rel) => ({ assignee: rel.assignee }));
  }

  async _isAssigned({ assignment, assignee }: { assignment: string; assignee: string }) {
    const rel = await this.releases.findOne({ assignment, assignee });
    return { assigned: rel !== null };
  }

  async _getPublishedForAudience({ audience }: { audience: string | null }) {
    const docs = await this.assignments.find({ status: "PUBLISHED" }).sort({ seq: 1 }).toArray();
    return docs
      .filter(
        (doc) =>
          doc.audience === "EVERYONE" || (audience !== null && doc.targets.includes(audience)),
      )
      .map((doc) => ({ assignment: doc._id }));
  }

  async _getPublishedInWindow({ start, end }: { start: string | Date; end: string | Date }) {
    const iso = (v: string | Date): string => (typeof v === "string" ? v : v.toISOString());
    const lo = iso(start);
    const hi = iso(end);
    const within = (d: string | Date): boolean => {
      const s = iso(d);
      return s >= lo && s <= hi;
    };
    const docs = await this.assignments.find({ status: "PUBLISHED" }).sort({ seq: 1 }).toArray();
    return docs
      .filter((doc) => within(doc.dueAt) || within(doc.availableAt))
      .map((doc) => ({ assignment: doc._id }));
  }
}
