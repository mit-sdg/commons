import {
  AssignmentAudienceInvalid,
  AssignmentEveryoneNoTargets,
  AssignmentNotDraft,
  AssignmentNotFound,
  AssignmentNotPublished,
  AssignmentNotRevisable,
  AssignmentTargetsRequired,
  ReleaseAlreadyExists,
  ReleaseNotFound,
} from "./errors.ts";

const freshID = () => crypto.randomUUID();

type Audience = "EVERYONE" | "TARGETS";

interface AssignmentDoc {
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
}

interface ReleaseDoc {
  assignment: string;
  assignee: string;
  assignedAt: Date;
  dueOverride: string | null;
  status: "ASSIGNED";
}

export class AssigningConcept {
  private readonly assignments = new Map<string, AssignmentDoc>();
  private readonly releases = new Map<string, ReleaseDoc>();

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

  createDraft({
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
    const assignment = freshID();
    this.assignments.set(assignment, {
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
    });
    return { assignment };
  }

  revise({
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
    const doc = this.assignments.get(assignment);
    if (doc === undefined) {
      throw new AssignmentNotFound(assignment);
    }
    if (doc.status === "ARCHIVED") {
      throw new AssignmentNotRevisable(assignment);
    }
    this.#checkTargets(audience, targets);
    doc.title = title;
    doc.instructions = instructions;
    doc.kind = kind;
    doc.availableAt = availableAt;
    doc.dueAt = dueAt;
    doc.closeAt = closeAt ?? null;
    doc.acceptsSubmissions = acceptsSubmissions;
    doc.audience = audience;
    doc.targets = [...targets];
    doc.updatedAt = at;
    return {
      assignment,
      status: doc.status,
      audience,
      targets: [...targets],
      acceptsSubmissions,
    };
  }

  publish({ assignment, at }: { assignment: string; at: Date }) {
    const doc = this.assignments.get(assignment);
    if (doc === undefined) {
      throw new AssignmentNotFound(assignment);
    }
    if (doc.status !== "DRAFT") {
      throw new AssignmentNotDraft(assignment);
    }
    doc.status = "PUBLISHED";
    doc.updatedAt = at;
    return {
      assignment,
      audience: doc.audience,
      targets: [...doc.targets],
      acceptsSubmissions: doc.acceptsSubmissions,
    };
  }

  archive({ assignment, at }: { assignment: string; at: Date }) {
    const doc = this.assignments.get(assignment);
    if (doc === undefined) {
      throw new AssignmentNotFound(assignment);
    }
    doc.status = "ARCHIVED";
    doc.updatedAt = at;
    return { assignment };
  }

  assign({ assignment, assignee, at }: { assignment: string; assignee: string; at: Date }) {
    const doc = this.assignments.get(assignment);
    if (doc === undefined) {
      throw new AssignmentNotFound(assignment);
    }
    if (doc.status !== "PUBLISHED") {
      throw new AssignmentNotPublished(assignment);
    }
    for (const rel of this.releases.values()) {
      if (rel.assignment === assignment && rel.assignee === assignee) {
        throw new ReleaseAlreadyExists(`${assignee} <- ${assignment}`);
      }
    }
    const release = freshID();
    this.releases.set(release, {
      assignment,
      assignee,
      assignedAt: at,
      dueOverride: null,
      status: "ASSIGNED",
    });
    return { release };
  }

  setDueOverride({
    assignment,
    assignee,
    dueAt,
  }: {
    assignment: string;
    assignee: string;
    dueAt: string;
  }) {
    for (const [release, rel] of this.releases) {
      if (rel.assignment === assignment && rel.assignee === assignee) {
        rel.dueOverride = dueAt;
        return { release };
      }
    }
    throw new ReleaseNotFound(`${assignee} <- ${assignment}`);
  }

  clearDueOverride({ assignment, assignee }: { assignment: string; assignee: string }) {
    for (const [release, rel] of this.releases) {
      if (rel.assignment === assignment && rel.assignee === assignee) {
        rel.dueOverride = null;
        return { release };
      }
    }
    throw new ReleaseNotFound(`${assignee} <- ${assignment}`);
  }

  _getDetail({ assignment }: { assignment: string }): {
    detail: {
      assignment: string;
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
      status: string;
      createdAt: Date;
      updatedAt: Date | null;
    };
  }[] {
    const doc = this.assignments.get(assignment);
    if (doc === undefined) return [];
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

  _getAssignments(): {
    assignment: string;
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
    status: string;
    createdAt: Date;
    updatedAt: Date | null;
  }[] {
    return [...this.assignments.entries()].map(([assignment, doc]) => ({
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
    }));
  }

  _getAssigned({ assignee }: { assignee: string }): {
    assignment: string;
    release: string;
    dueOverride: string | null;
    status: "ASSIGNED";
  }[] {
    return [...this.releases.entries()]
      .filter(([, rel]) => rel.assignee === assignee)
      .map(([release, rel]) => ({
        assignment: rel.assignment,
        release,
        dueOverride: rel.dueOverride,
        status: rel.status,
      }));
  }

  _getAssignees({ assignment }: { assignment: string }): { assignee: string }[] {
    return [...this.releases.values()]
      .filter((rel) => rel.assignment === assignment)
      .map((rel) => ({ assignee: rel.assignee }));
  }

  _isAssigned({ assignment, assignee }: { assignment: string; assignee: string }): {
    assigned: boolean;
  } {
    for (const rel of this.releases.values()) {
      if (rel.assignment === assignment && rel.assignee === assignee) {
        return { assigned: true };
      }
    }
    return { assigned: false };
  }

  _getPublishedForAudience({ audience }: { audience: string | null }): {
    assignment: string;
  }[] {
    return [...this.assignments.entries()]
      .filter(
        ([, doc]) =>
          doc.status === "PUBLISHED" &&
          (doc.audience === "EVERYONE" || (audience !== null && doc.targets.includes(audience))),
      )
      .map(([assignment]) => ({ assignment }));
  }

  _getPublishedInWindow({
    start,
    end,
  }: {
    start: string | Date;
    end: string | Date;
  }): { assignment: string }[] {
    const iso = (v: string | Date): string => (typeof v === "string" ? v : v.toISOString());
    const lo = iso(start);
    const hi = iso(end);
    const within = (d: string | Date): boolean => {
      const s = iso(d);
      return s >= lo && s <= hi;
    };
    return [...this.assignments.entries()]
      .filter(
        ([, doc]) => doc.status === "PUBLISHED" && (within(doc.dueAt) || within(doc.availableAt)),
      )
      .map(([assignment]) => ({ assignment }));
  }
}
