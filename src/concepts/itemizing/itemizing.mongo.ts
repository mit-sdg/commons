import type { Collection, Db, Filter } from "mongodb";
import {
  CriterionNotFound,
  GradeItemConflict,
  GradeItemNotFound,
  InvalidCriterion,
} from "./errors.ts";

export const GRADING_METHODS = ["COMPETENCY", "POINTS"] as const;
type GradingMethod = (typeof GRADING_METHODS)[number];

interface CompetencyCriterion {
  criterion: string;
  kind: "COMPETENCY";
  basis: string;
  position: number;
  active: boolean;
}

interface PointCriterion {
  criterion: string;
  kind: "POINTS";
  name: string;
  maxPoints: number;
  position: number;
  active: boolean;
}

type Criterion = CompetencyCriterion | PointCriterion;

interface LegacyCriterion {
  criterion: string;
  basis: string;
  position: number;
  active?: boolean;
}

interface ItemDoc {
  _id: string;
  label: string;
  status: "ACTIVE" | "ARCHIVED";
  method?: GradingMethod;
  revision?: number;
  criteria: (Criterion | LegacyCriterion)[];
}

export interface CompetencyCriterionInput {
  criterion?: string;
  kind: "COMPETENCY";
  basis: string;
  position: number;
}

export interface PointCriterionInput {
  criterion?: string;
  kind: "POINTS";
  name: string;
  maxPoints: number;
  position: number;
}

export type CriterionInput = CompetencyCriterionInput | PointCriterionInput;

const MAX_CRITERIA = 100;
const MAX_NAME = 1_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeCriterion(criterion: Criterion | LegacyCriterion): Criterion {
  if (!("kind" in criterion))
    return {
      criterion: criterion.criterion,
      kind: "COMPETENCY",
      basis: criterion.basis,
      position: criterion.position,
      active: criterion.active !== false,
    };
  return { ...criterion, active: criterion.active !== false };
}

function selected(doc: ItemDoc) {
  return doc.criteria
    .map(normalizeCriterion)
    .filter(({ active }) => active)
    .sort(
      (left, right) =>
        left.position - right.position || left.criterion.localeCompare(right.criterion),
    );
}

function itemMethod(doc: ItemDoc): GradingMethod {
  return doc.method ?? "COMPETENCY";
}

function itemRevision(doc: ItemDoc) {
  return doc.revision ?? 0;
}

function revisionFilter(revision: number): Filter<ItemDoc> {
  return (
    revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision }
  ) as Filter<ItemDoc>;
}

function setupMaximum(criteria: Criterion[]) {
  if (!criteria.length || criteria[0]?.kind !== "POINTS") return 0;
  return criteria.reduce((total, criterion) => total + (criterion as PointCriterion).maxPoints, 0);
}

export class MongoItemizingConcept {
  private readonly items: Collection<ItemDoc>;

  constructor(db: Db) {
    this.items = db.collection("itemizing.assessmentItems");
  }

  async configureItem({ item, label }: { item: string; label: string }) {
    await this.items.updateOne(
      { _id: item },
      {
        $set: { label, status: "ACTIVE" },
        $setOnInsert: { criteria: [], method: "COMPETENCY", revision: 0 },
      },
      { upsert: true },
    );
    return { gradeItem: item };
  }

  async ensureItem({ item, label }: { item: string; label: string }) {
    await this.items.updateOne(
      { _id: item },
      {
        $setOnInsert: {
          label,
          status: "ACTIVE",
          criteria: [],
          method: "COMPETENCY",
          revision: 0,
        },
      },
      { upsert: true },
    );
    return { gradeItem: item };
  }

  async archiveItem({ item }: { item: string }) {
    const result = await this.items.updateOne(
      { _id: item, status: "ACTIVE" },
      { $set: { status: "ARCHIVED" } },
    );
    if (!result.modifiedCount) throw new GradeItemNotFound("There is no active item.");
    return { gradeItem: item };
  }

  #validatedInputs(method: GradingMethod, criteria: unknown): CriterionInput[] {
    if (!Array.isArray(criteria) || criteria.length > MAX_CRITERIA)
      throw new InvalidCriterion("Supply at most 100 valid criteria.");
    const parsed = criteria as CriterionInput[];
    if (
      parsed.some(
        (criterion) =>
          !isObject(criterion) ||
          criterion.kind !== method ||
          (criterion.criterion !== undefined && typeof criterion.criterion !== "string") ||
          !Number.isSafeInteger(criterion.position) ||
          criterion.position < 0,
      ) ||
      new Set(parsed.map(({ position }) => position)).size !== parsed.length
    )
      throw new InvalidCriterion("Criteria must match the method and have distinct positions.");

    if (method === "COMPETENCY") {
      if (
        parsed.some(
          (criterion) =>
            criterion.kind !== "COMPETENCY" ||
            typeof criterion.basis !== "string" ||
            !criterion.basis.trim(),
        ) ||
        new Set(parsed.map((criterion) => (criterion as CompetencyCriterionInput).basis)).size !==
          parsed.length
      )
        throw new InvalidCriterion("Select distinct competency rubric editions.");
    } else {
      if (parsed.length === 0)
        throw new InvalidCriterion("Points grading requires at least one criterion.");
      if (
        parsed.some(
          (criterion) =>
            criterion.kind !== "POINTS" ||
            typeof criterion.name !== "string" ||
            !criterion.name.trim() ||
            criterion.name.length > MAX_NAME ||
            typeof criterion.maxPoints !== "number" ||
            !Number.isFinite(criterion.maxPoints) ||
            criterion.maxPoints <= 0,
        )
      )
        throw new InvalidCriterion("Point criteria need a name and positive finite maximum.");
      const total = parsed.reduce(
        (sum, criterion) => sum + (criterion as PointCriterionInput).maxPoints,
        0,
      );
      if (!Number.isFinite(total) || total <= 0)
        throw new InvalidCriterion("The total point maximum must be positive and finite.");
    }
    return parsed;
  }

  #nextCriteria(doc: ItemDoc, method: GradingMethod, inputs: CriterionInput[]) {
    const previous = doc.criteria.map(normalizeCriterion);
    const known = new Map(previous.map((criterion) => [criterion.criterion, criterion]));
    const used = new Set<string>();
    const current: Criterion[] = [];
    for (const input of inputs) {
      const requested = input.criterion?.trim() ?? "";
      if (requested && used.has(requested))
        throw new InvalidCriterion("Each criterion identity may appear only once.");
      const old = requested ? known.get(requested) : undefined;
      if (requested && (!old || old.kind !== input.kind))
        throw new InvalidCriterion("A criterion identity must belong to this item and method.");
      if (old?.kind === "COMPETENCY" && input.kind === "COMPETENCY" && old.basis !== input.basis)
        throw new InvalidCriterion("A competency criterion cannot change its rubric edition.");
      const criterion = requested || crypto.randomUUID();
      used.add(criterion);
      current.push(
        input.kind === "COMPETENCY"
          ? {
              criterion,
              kind: "COMPETENCY",
              basis: input.basis,
              position: input.position,
              active: true,
            }
          : {
              criterion,
              kind: "POINTS",
              name: input.name.trim(),
              maxPoints: input.maxPoints,
              position: input.position,
              active: true,
            },
      );
    }
    const retired = previous
      .filter(({ criterion }) => !used.has(criterion))
      .map((criterion) => ({
        ...criterion,
        active: false as const,
      }));
    return [...retired, ...current];
  }

  #sameSetup(doc: ItemDoc, method: GradingMethod, next: Criterion[]) {
    const current = selected(doc).map(({ active: _active, ...criterion }) => criterion);
    const replacement = next
      .filter(({ active }) => active)
      .sort(
        (left, right) =>
          left.position - right.position || left.criterion.localeCompare(right.criterion),
      )
      .map(({ active: _active, ...criterion }) => criterion);
    return itemMethod(doc) === method && JSON.stringify(current) === JSON.stringify(replacement);
  }

  async configureSetup({
    item,
    method,
    revision,
    criteria,
    resolvedCriteria,
  }: {
    item: string;
    method: string;
    revision: number;
    criteria: CriterionInput[];
    resolvedCriteria: unknown;
  }) {
    if (
      !GRADING_METHODS.some((candidate) => candidate === method) ||
      !Number.isSafeInteger(revision) ||
      revision < 0
    )
      throw new InvalidCriterion("Choose a grading method and current setup revision.");
    const gradingMethod = method as GradingMethod;
    const inputs = this.#validatedInputs(gradingMethod, criteria);
    const doc = await this.items.findOne({ _id: item, status: "ACTIVE" });
    if (!doc) throw new GradeItemNotFound("There is no active item.");
    if (itemRevision(doc) !== revision)
      throw new GradeItemConflict("This grading setup changed. Reload before saving.");
    const next = this.#nextCriteria(doc, gradingMethod, inputs);
    const present = (saved: Criterion[]) => {
      const resolved = Array.isArray(resolvedCriteria) ? resolvedCriteria : [];
      return saved
        .filter(({ active }) => active)
        .sort(
          (left, right) =>
            left.position - right.position || left.criterion.localeCompare(right.criterion),
        )
        .map(({ active: _active, ...criterion }) => {
          const definition = resolved.find(
            (candidate) =>
              isObject(candidate) &&
              candidate.kind === criterion.kind &&
              candidate.position === criterion.position &&
              (criterion.kind === "COMPETENCY"
                ? candidate.basis === criterion.basis
                : candidate.name === criterion.name && candidate.maxPoints === criterion.maxPoints),
          );
          return { ...(definition ?? criterion), ...criterion };
        });
    };
    if (this.#sameSetup(doc, gradingMethod, next))
      return {
        gradeItem: item,
        label: doc.label,
        status: doc.status,
        method: gradingMethod,
        revision,
        criteria: present(next),
        maxPoints: setupMaximum(selected(doc)),
      };
    const result = await this.items.updateOne(
      { _id: item, status: "ACTIVE", ...revisionFilter(revision) },
      { $set: { method: gradingMethod, revision: revision + 1, criteria: next } },
    );
    if (!result.modifiedCount)
      throw new GradeItemConflict("This grading setup changed. Reload before saving.");
    return {
      gradeItem: item,
      label: doc.label,
      status: doc.status,
      method: gradingMethod,
      revision: revision + 1,
      criteria: present(next),
      maxPoints: setupMaximum(next.filter(({ active }) => active)),
    };
  }

  async addCriterion({
    item,
    basis,
    position,
    revision,
  }: {
    item: string;
    basis: string;
    position: number;
    revision: number;
  }) {
    const doc = await this.items.findOne({ _id: item, status: "ACTIVE" });
    if (!doc) throw new GradeItemNotFound("There is no active item.");
    if (itemMethod(doc) !== "COMPETENCY")
      throw new InvalidCriterion("Competency criteria require competency grading.");
    const result = await this.configureSetup({
      item,
      method: "COMPETENCY",
      revision,
      criteria: [
        ...selected(doc).map(({ active: _active, ...criterion }) => criterion),
        { kind: "COMPETENCY", basis, position },
      ],
      resolvedCriteria: [],
    });
    const changed = await this.items.findOne({ _id: item });
    const criterion = selected(changed!).find(
      (entry) => entry.kind === "COMPETENCY" && entry.basis === basis,
    )!;
    return { criterion: criterion.criterion, revision: result.revision };
  }

  async reviseCriterion({
    criterion,
    position,
    revision,
  }: {
    criterion: string;
    position: number;
    revision: number;
  }) {
    const doc = await this.items.findOne({
      status: "ACTIVE",
      criteria: { $elemMatch: { criterion, active: { $ne: false } } },
    });
    const current = doc && selected(doc).find((entry) => entry.criterion === criterion);
    if (!doc || !current || current.kind !== "COMPETENCY")
      throw new CriterionNotFound("There is no active competency criterion.");
    const result = await this.configureSetup({
      item: doc._id,
      method: "COMPETENCY",
      revision,
      criteria: selected(doc).map(({ active: _active, ...entry }) =>
        entry.criterion === criterion ? { ...entry, position } : entry,
      ),
      resolvedCriteria: [],
    });
    return { criterion, revision: result.revision };
  }

  async addPointCriterion({
    item,
    name,
    maxPoints,
    position,
    revision,
  }: {
    item: string;
    name: string;
    maxPoints: number;
    position: number;
    revision: number;
  }) {
    const doc = await this.items.findOne({ _id: item, status: "ACTIVE" });
    if (!doc) throw new GradeItemNotFound("There is no active item.");
    if (itemMethod(doc) !== "POINTS")
      throw new InvalidCriterion("Point criteria require points grading.");
    const result = await this.configureSetup({
      item,
      method: "POINTS",
      revision,
      criteria: [
        ...selected(doc).map(({ active: _active, ...criterion }) => criterion),
        { kind: "POINTS", name, maxPoints, position },
      ],
      resolvedCriteria: [],
    });
    const changed = await this.items.findOne({ _id: item });
    const criterion = selected(changed!).find(
      (entry) =>
        entry.kind === "POINTS" && entry.name === name.trim() && entry.position === position,
    )!;
    return { criterion: criterion.criterion, revision: result.revision };
  }

  async revisePointCriterion({
    criterion,
    name,
    maxPoints,
    position,
    revision,
  }: {
    criterion: string;
    name: string;
    maxPoints: number;
    position: number;
    revision: number;
  }) {
    const doc = await this.items.findOne({
      status: "ACTIVE",
      criteria: { $elemMatch: { criterion, active: { $ne: false } } },
    });
    const current = doc && selected(doc).find((entry) => entry.criterion === criterion);
    if (!doc || !current || current.kind !== "POINTS")
      throw new CriterionNotFound("There is no active point criterion.");
    const result = await this.configureSetup({
      item: doc._id,
      method: "POINTS",
      revision,
      criteria: selected(doc).map(({ active: _active, ...entry }) =>
        entry.criterion === criterion ? { ...entry, name, maxPoints, position } : entry,
      ),
      resolvedCriteria: [],
    });
    return { criterion, revision: result.revision };
  }

  async removeCriterion({ criterion, revision }: { criterion: string; revision: number }) {
    const doc = await this.items.findOne({
      status: "ACTIVE",
      criteria: { $elemMatch: { criterion, active: { $ne: false } } },
    });
    const current = doc && selected(doc).find((entry) => entry.criterion === criterion);
    if (!doc || !current) throw new CriterionNotFound("There is no active criterion.");
    const result = await this.configureSetup({
      item: doc._id,
      method: itemMethod(doc),
      revision,
      criteria: selected(doc)
        .filter((entry) => entry.criterion !== criterion)
        .map(({ active: _active, ...entry }) => entry),
      resolvedCriteria: [],
    });
    return { criterion, revision: result.revision };
  }

  async _getItem({ item }: { item: string }) {
    const doc = await this.items.findOne({ _id: item });
    if (!doc) return [];
    const criteria = selected(doc);
    return [
      {
        item,
        label: doc.label,
        status: doc.status,
        method: itemMethod(doc),
        revision: itemRevision(doc),
        maxPoints: setupMaximum(criteria),
      },
    ];
  }

  async _getItems() {
    const docs = await this.items.find({ status: "ACTIVE" }).sort({ label: 1 }).toArray();
    return docs.map((doc) => {
      const criteria = selected(doc);
      return {
        item: doc._id,
        label: doc.label,
        method: itemMethod(doc),
        revision: itemRevision(doc),
        maxPoints: setupMaximum(criteria),
      };
    });
  }

  async _getSetup({ item }: { item: string }) {
    const doc = await this.items.findOne({ _id: item });
    if (!doc) return [];
    const criteria = selected(doc).map(({ active: _active, ...criterion }) => criterion);
    return [
      {
        item,
        label: doc.label,
        status: doc.status,
        method: itemMethod(doc),
        revision: itemRevision(doc),
        criteria,
        maxPoints: setupMaximum(selected(doc)),
      },
    ];
  }
}
