import { isDeepStrictEqual } from "node:util";
import type { Db, Document, IndexDescriptionInfo } from "mongodb";
import type { Migration } from "./migration.ts";

type GradingMethod = "COMPETENCY" | "POINTS";
const RATINGS = new Set(["DEFICIENT", "EMERGENT", "COMPETENT", "EXPERT", "NOT_ASSESSED"]);

interface StoredDocument extends Document {
  _id: string;
  [field: string]: unknown;
}

interface CompetencyCriterion {
  kind: "COMPETENCY";
  criterion: string;
  basis: string;
  position: number;
  active: boolean;
}

interface PointCriterion {
  kind: "POINTS";
  criterion: string;
  name: string;
  maxPoints: number;
  position: number;
  active: boolean;
}

type ItemCriterion = CompetencyCriterion | PointCriterion;

interface NormalizedItem {
  _id: string;
  label: string;
  status: "ACTIVE" | "ARCHIVED";
  method: GradingMethod;
  revision: number;
  criteria: ItemCriterion[];
}

interface FrozenCompetencyCriterion {
  kind: "COMPETENCY";
  criterion: string;
  position: number;
  basis: string;
  standard: string;
  number: number;
  name: string;
  description: string;
  deficient: string;
  emergent: string;
  competent: string;
  expert: string;
  referenceUrl: string;
}

interface FrozenPointCriterion {
  kind: "POINTS";
  criterion: string;
  position: number;
  name: string;
  maxPoints: number;
}

interface PointAssessment extends StoredDocument {
  learner: string;
  item: string;
  evidence: string;
  grader: string;
  method: "POINTS";
  setupRevision: number;
  criteria: FrozenPointCriterion[];
  judgments: { kind: "POINTS"; criterion: string; score: number }[];
  feedback: string;
  status: "DRAFT" | "RELEASED" | "EXCUSED";
  version: number;
  createdAt: Date;
  updatedAt: Date;
  releasedAt: Date | null;
  history: Record<string, unknown>[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonnegativeSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isPositiveFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isDate = (value: unknown): value is Date => value instanceof Date;

const identity = (row: Record<string, unknown>): string =>
  JSON.stringify([row.learner, row.item, row.evidence]);

function completeCompetencyCriterion(value: unknown): value is FrozenCompetencyCriterion {
  if (!isRecord(value)) return false;
  return (
    value.kind === "COMPETENCY" &&
    typeof value.criterion === "string" &&
    typeof value.basis === "string" &&
    isNonnegativeSafeInteger(value.position) &&
    typeof value.standard === "string" &&
    isPositiveSafeInteger(value.number) &&
    [
      value.name,
      value.description,
      value.deficient,
      value.emergent,
      value.competent,
      value.expert,
      value.referenceUrl,
    ].every((field) => typeof field === "string")
  );
}

function completePointCriterion(value: unknown): value is FrozenPointCriterion {
  return (
    isRecord(value) &&
    value.kind === "POINTS" &&
    typeof value.criterion === "string" &&
    isNonnegativeSafeInteger(value.position) &&
    typeof value.name === "string" &&
    isPositiveFinite(value.maxPoints)
  );
}

function completeJudgment(value: unknown, method: GradingMethod): boolean {
  if (!isRecord(value) || value.kind !== method || typeof value.criterion !== "string")
    return false;
  return method === "POINTS"
    ? isFiniteNumber(value.score)
    : typeof value.rating === "string" &&
        RATINGS.has(value.rating) &&
        typeof value.feedback === "string";
}

function completeHistory(value: unknown, method: GradingMethod): boolean {
  if (!isRecord(value) || !Array.isArray(value.judgments)) return false;
  return (
    isNonnegativeSafeInteger(value.revision) &&
    typeof value.grader === "string" &&
    (value.status === "RELEASED" || value.status === "EXCUSED") &&
    value.judgments.every((judgment) => completeJudgment(judgment, method)) &&
    typeof value.feedback === "string" &&
    isDate(value.releasedAt) &&
    isFiniteNumber(value.score) &&
    isFiniteNumber(value.outOf) &&
    typeof value.scored === "boolean"
  );
}

function completeAssessment(row: StoredDocument): boolean {
  if (
    (row.method !== "COMPETENCY" && row.method !== "POINTS") ||
    !isNonnegativeSafeInteger(row.setupRevision) ||
    !Array.isArray(row.criteria) ||
    !Array.isArray(row.judgments) ||
    !Array.isArray(row.history)
  )
    return false;
  const method = row.method;
  const criteriaComplete = row.criteria.every((criterion) =>
    method === "COMPETENCY"
      ? completeCompetencyCriterion(criterion)
      : completePointCriterion(criterion),
  );
  return (
    criteriaComplete &&
    row.judgments.every((judgment) => completeJudgment(judgment, method)) &&
    row.history.every((release) => completeHistory(release, method))
  );
}

function normalizeCriterion(value: unknown, item: string, errors: string[]): ItemCriterion | null {
  if (!isRecord(value) || typeof value.criterion !== "string" || value.criterion === "") {
    errors.push(`item ${item} has a criterion without a usable id`);
    return null;
  }
  const kind = value.kind ?? "COMPETENCY";
  if (!isNonnegativeSafeInteger(value.position) || typeof value.active !== "boolean") {
    errors.push(`item ${item} criterion ${value.criterion} has invalid position or active state`);
    return null;
  }
  if (kind === "COMPETENCY" && typeof value.basis === "string" && value.basis !== "")
    return {
      criterion: value.criterion,
      kind,
      basis: value.basis,
      position: value.position,
      active: value.active,
    };
  if (
    kind === "POINTS" &&
    typeof value.name === "string" &&
    value.name.trim() !== "" &&
    isPositiveFinite(value.maxPoints)
  )
    return {
      criterion: value.criterion,
      kind,
      name: value.name,
      maxPoints: value.maxPoints,
      position: value.position,
      active: value.active,
    };
  errors.push(
    `item ${item} criterion ${value.criterion} cannot be interpreted as ${JSON.stringify(kind)}`,
  );
  return null;
}

function normalizeItem(
  row: StoredDocument,
  configuration: StoredDocument | undefined,
  errors: string[],
): NormalizedItem | null {
  if (
    typeof row.label !== "string" ||
    (row.status !== "ACTIVE" && row.status !== "ARCHIVED") ||
    !Array.isArray(row.criteria)
  ) {
    errors.push(`item ${row._id} has an invalid label, status, or criteria list`);
    return null;
  }
  const criteria = row.criteria
    .map((criterion) => normalizeCriterion(criterion, row._id, errors))
    .filter((criterion): criterion is ItemCriterion => criterion !== null);
  if (criteria.length !== row.criteria.length) return null;
  if (new Set(criteria.map((criterion) => criterion.criterion)).size !== criteria.length) {
    errors.push(`item ${row._id} repeats a criterion id`);
    return null;
  }

  let method: GradingMethod;
  let revision: number;
  if (configuration !== undefined) {
    if (configuration.method !== "COMPETENCY" && configuration.method !== "POINTS") {
      errors.push(`configuration ${configuration._id} has an invalid grading method`);
      return null;
    }
    if (!isNonnegativeSafeInteger(configuration.generation)) {
      errors.push(`configuration ${configuration._id} has an invalid generation`);
      return null;
    }
    method = configuration.method;
    revision = configuration.generation;
    if (method === "POINTS") {
      if (!isPositiveFinite(configuration.maxPoints)) {
        errors.push(`configuration ${configuration._id} has an invalid point maximum`);
        return null;
      }
      const criterionId = `legacy-setup-point:${row._id}`;
      const existing = criteria.find((criterion) => criterion.criterion === criterionId);
      if (
        existing !== undefined &&
        (existing.kind !== "POINTS" ||
          existing.name !== "Overall" ||
          existing.position !== 0 ||
          existing.maxPoints !== configuration.maxPoints)
      ) {
        errors.push(`item ${row._id} already uses reserved criterion ${criterionId}`);
        return null;
      }
      for (const criterion of criteria) criterion.active = criterion.criterion === criterionId;
      if (existing === undefined)
        criteria.push({
          criterion: criterionId,
          kind: "POINTS",
          name: "Overall",
          maxPoints: configuration.maxPoints,
          position: 0,
          active: true,
        });
    } else {
      for (const criterion of criteria) {
        if (criterion.kind === "POINTS") criterion.active = false;
      }
    }
  } else {
    if (row.method === undefined) method = "COMPETENCY";
    else if (row.method === "COMPETENCY" || row.method === "POINTS") method = row.method;
    else {
      errors.push(`item ${row._id} has an invalid grading method`);
      return null;
    }
    if (row.revision === undefined) revision = 0;
    else if (isNonnegativeSafeInteger(row.revision)) revision = row.revision;
    else {
      errors.push(`item ${row._id} has an invalid setup revision`);
      return null;
    }
    if (criteria.some((criterion) => criterion.active && criterion.kind !== method)) {
      errors.push(`item ${row._id} has active criteria that do not match ${method}`);
      return null;
    }
  }
  return { _id: row._id, label: row.label, status: row.status, method, revision, criteria };
}

function findEdition(
  standards: StoredDocument[],
  basis: string,
): { standard: string; edition: Record<string, unknown> } | null {
  const matches: { standard: string; edition: Record<string, unknown> }[] = [];
  for (const standard of standards) {
    if (!Array.isArray(standard.editions)) continue;
    for (const edition of standard.editions) {
      if (isRecord(edition) && edition.edition === basis)
        matches.push({ standard: standard._id, edition });
    }
  }
  return matches.length === 1 ? matches[0]! : null;
}

function freezeCompetencyCriterion(
  criterion: CompetencyCriterion,
  standards: StoredDocument[],
): FrozenCompetencyCriterion | null {
  const found = findEdition(standards, criterion.basis);
  if (found === null) return null;
  const edition = found.edition;
  if (
    !isPositiveSafeInteger(edition.number) ||
    ![
      edition.name,
      edition.description,
      edition.deficient,
      edition.emergent,
      edition.competent,
      edition.expert,
      edition.referenceUrl,
    ].every((field) => typeof field === "string")
  )
    return null;
  return {
    kind: "COMPETENCY",
    criterion: criterion.criterion,
    position: criterion.position,
    basis: criterion.basis,
    standard: found.standard,
    number: edition.number,
    name: edition.name as string,
    description: edition.description as string,
    deficient: edition.deficient as string,
    emergent: edition.emergent as string,
    competent: edition.competent as string,
    expert: edition.expert as string,
    referenceUrl: edition.referenceUrl as string,
  };
}

function competencyJudgments(
  value: unknown,
  assessment: string,
  criteria: Set<string>,
  errors: string[],
): Record<string, unknown>[] | null {
  if (!Array.isArray(value)) {
    errors.push(`assessment ${assessment} has no usable judgments list`);
    return null;
  }
  const judgments: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const judgment of value) {
    if (
      !isRecord(judgment) ||
      typeof judgment.criterion !== "string" ||
      !criteria.has(judgment.criterion) ||
      seen.has(judgment.criterion) ||
      typeof judgment.rating !== "string" ||
      !RATINGS.has(judgment.rating) ||
      typeof judgment.feedback !== "string"
    ) {
      errors.push(`assessment ${assessment} has an uninterpretable competency judgment`);
      return null;
    }
    seen.add(judgment.criterion);
    judgments.push({
      kind: "COMPETENCY",
      criterion: judgment.criterion,
      rating: judgment.rating,
      feedback: judgment.feedback,
    });
  }
  return judgments;
}

function convertCompetencyAssessment(
  row: StoredDocument,
  items: Map<string, NormalizedItem>,
  standards: StoredDocument[],
  errors: string[],
): { set: Record<string, unknown>; unset: Record<string, ""> } | null {
  if (
    typeof row.grader !== "string" ||
    typeof row.feedback !== "string" ||
    (row.status !== "DRAFT" && row.status !== "RELEASED" && row.status !== "EXCUSED") ||
    !isNonnegativeSafeInteger(row.version) ||
    !isDate(row.createdAt) ||
    !isDate(row.updatedAt) ||
    !(row.releasedAt === null || isDate(row.releasedAt)) ||
    ((row.status === "RELEASED" || row.status === "EXCUSED") && !isDate(row.releasedAt))
  ) {
    errors.push(`assessment ${row._id} has invalid state, version, or timestamps`);
    return null;
  }
  const item = typeof row.item === "string" ? items.get(row.item) : undefined;
  if (item === undefined || !Array.isArray(row.criteria)) {
    errors.push(`assessment ${row._id} has no item criteria from which to freeze its snapshot`);
    return null;
  }
  const frozen: FrozenCompetencyCriterion[] = [];
  for (const reference of row.criteria) {
    if (!isRecord(reference) || typeof reference.criterion !== "string") {
      errors.push(`assessment ${row._id} has an invalid criterion reference`);
      return null;
    }
    const selected = item.criteria.find(
      (criterion): criterion is CompetencyCriterion =>
        criterion.criterion === reference.criterion && criterion.kind === "COMPETENCY",
    );
    const snapshot = selected && freezeCompetencyCriterion(selected, standards);
    if (!snapshot) {
      errors.push(
        `assessment ${row._id} criterion ${reference.criterion} is missing its item basis or immutable standard edition`,
      );
      return null;
    }
    frozen.push(snapshot);
  }
  const ids = new Set(frozen.map((criterion) => criterion.criterion));
  if (ids.size !== frozen.length) {
    errors.push(`assessment ${row._id} repeats a criterion`);
    return null;
  }
  const judgments = competencyJudgments(row.judgments, row._id, ids, errors);
  if (judgments === null) return null;
  if (!Array.isArray(row.history)) {
    errors.push(`assessment ${row._id} has no usable release history`);
    return null;
  }
  const history: Record<string, unknown>[] = [];
  for (const release of row.history) {
    if (
      !isRecord(release) ||
      !isNonnegativeSafeInteger(release.revision) ||
      typeof release.grader !== "string" ||
      (release.status !== "RELEASED" && release.status !== "EXCUSED") ||
      typeof release.feedback !== "string" ||
      !isDate(release.releasedAt)
    ) {
      errors.push(`assessment ${row._id} has an uninterpretable release history entry`);
      return null;
    }
    const releaseJudgments = competencyJudgments(release.judgments, row._id, ids, errors);
    if (releaseJudgments === null) return null;
    history.push({
      revision: release.revision,
      grader: release.grader,
      status: release.status,
      judgments: releaseJudgments,
      feedback: release.feedback,
      releasedAt: release.releasedAt,
      score: 0,
      outOf: 0,
      scored: false,
    });
  }
  const generation = row.generation ?? 0;
  if (!isNonnegativeSafeInteger(generation)) {
    errors.push(`assessment ${row._id} has an invalid generation`);
    return null;
  }
  return {
    set: {
      method: "COMPETENCY",
      setupRevision: generation,
      criteria: frozen,
      judgments,
      history,
    },
    unset: { generation: "", score: "", outOf: "", scored: "" },
  };
}

function convertMark(mark: StoredDocument, errors: string[]): PointAssessment | null {
  const requiredStrings = ["learner", "item", "evidence", "grader", "feedback"] as const;
  if (
    !requiredStrings.every((field) => typeof mark[field] === "string") ||
    (mark.status !== "DRAFT" && mark.status !== "RELEASED" && mark.status !== "EXCUSED") ||
    typeof mark.scored !== "boolean" ||
    !isFiniteNumber(mark.score) ||
    !isPositiveFinite(mark.outOf) ||
    !isNonnegativeSafeInteger(mark.version) ||
    !isDate(mark.createdAt) ||
    !isDate(mark.updatedAt) ||
    !(mark.releasedAt === null || isDate(mark.releasedAt))
  ) {
    errors.push(`mark ${mark._id} has invalid identity, state, denominator, value, or timestamps`);
    return null;
  }
  if (mark.scored && (mark.score < 0 || mark.score > mark.outOf)) {
    errors.push(`mark ${mark._id} has a score outside its retained denominator`);
    return null;
  }
  if ((mark.status === "RELEASED" || mark.status === "EXCUSED") && !isDate(mark.releasedAt)) {
    errors.push(`mark ${mark._id} has no release time for its ${mark.status} state`);
    return null;
  }
  const generation = mark.generation ?? 0;
  if (!isNonnegativeSafeInteger(generation)) {
    errors.push(`mark ${mark._id} has an invalid generation`);
    return null;
  }
  const criterion = `legacy-point:${mark._id}`;
  const judgments = mark.scored ? [{ kind: "POINTS" as const, criterion, score: mark.score }] : [];
  const history: Record<string, unknown>[] = [];
  if (mark.status === "RELEASED")
    history.push({
      revision: 1,
      grader: mark.grader,
      status: "RELEASED",
      judgments,
      feedback: mark.feedback,
      releasedAt: mark.releasedAt,
      score: mark.scored ? mark.score : 0,
      outOf: mark.outOf,
      scored: mark.scored,
    });
  else if (mark.status === "EXCUSED")
    history.push({
      revision: 1,
      grader: mark.grader,
      status: "EXCUSED",
      judgments: [],
      feedback: mark.feedback,
      releasedAt: mark.releasedAt,
      score: 0,
      outOf: mark.outOf,
      scored: false,
    });
  return {
    _id: mark._id,
    learner: mark.learner as string,
    item: mark.item as string,
    evidence: mark.evidence as string,
    grader: mark.grader as string,
    method: "POINTS",
    setupRevision: generation,
    criteria: [{ kind: "POINTS", criterion, position: 0, name: "Overall", maxPoints: mark.outOf }],
    judgments,
    feedback: mark.feedback as string,
    status: mark.status,
    version: mark.version,
    createdAt: mark.createdAt,
    updatedAt: mark.updatedAt,
    releasedAt: mark.releasedAt,
    history,
  };
}

function generationAwareIndex(index: IndexDescriptionInfo): boolean {
  return (
    index.unique === true &&
    Object.keys(index.key).length === 4 &&
    index.key.learner === 1 &&
    index.key.item === 1 &&
    index.key.evidence === 1 &&
    index.key.generation === 1
  );
}

function assessmentIdentityIndex(index: IndexDescriptionInfo): boolean {
  return (
    Object.keys(index.key).length === 3 &&
    index.key.learner === 1 &&
    index.key.item === 1 &&
    index.key.evidence === 1
  );
}

async function dropIfPresent(database: Db, name: string): Promise<void> {
  if (await database.listCollections({ name }, { nameOnly: true }).hasNext())
    await database.collection(name).drop();
}

export const sharedGradingLifecycle: Migration = {
  id: "20260915T000200-shared-grading-lifecycle",
  description: "Move competency and point grades onto one evidence-scoped assessment lifecycle.",
  async up(database) {
    const itemCollection = database.collection<StoredDocument>("itemizing.assessmentItems");
    const assessmentCollection = database.collection<StoredDocument>("grading.assessments");
    const configurationCollection = database.collection<StoredDocument>("grading.configurations");
    const markCollection = database.collection<StoredDocument>("grading.marks");
    const errors: string[] = [];

    // Build the complete plan first. A blocked migration must leave both the
    // source collections and every destination document untouched.
    const [rawItems, configurations, assessments, marks, standards] = await Promise.all([
      itemCollection.find({}).toArray(),
      configurationCollection.find({}).toArray(),
      assessmentCollection.find({}).toArray(),
      markCollection.find({}).toArray(),
      database.collection<StoredDocument>("standardSetting.standards").find({}).toArray(),
    ]);
    const configurationByItem = new Map(configurations.map((row) => [row._id, row]));
    const rawItemById = new Map(rawItems.map((row) => [row._id, row]));
    for (const configuration of configurations) {
      if (!rawItemById.has(configuration._id))
        errors.push(`configuration ${configuration._id} has no assessment item`);
    }
    const normalizedItems = new Map<string, NormalizedItem>();
    for (const row of rawItems) {
      const normalized = normalizeItem(row, configurationByItem.get(row._id), errors);
      if (normalized) normalizedItems.set(row._id, normalized);
    }
    const criterionOwners = new Map<string, string>();
    for (const item of normalizedItems.values()) {
      for (const criterion of item.criteria) {
        const owner = criterionOwners.get(criterion.criterion);
        if (owner !== undefined && owner !== item._id)
          errors.push(
            `criterion ${criterion.criterion} is retained by both item ${owner} and item ${item._id}`,
          );
        else criterionOwners.set(criterion.criterion, item._id);
      }
    }

    const competencyPlans: {
      id: string;
      set: Record<string, unknown>;
      unset: Record<string, "">;
    }[] = [];
    for (const assessment of assessments) {
      if (
        typeof assessment.learner !== "string" ||
        typeof assessment.item !== "string" ||
        typeof assessment.evidence !== "string"
      ) {
        errors.push(`assessment ${assessment._id} has an invalid learner/item/evidence identity`);
        continue;
      }
      if (assessment.method !== undefined) {
        if (!completeAssessment(assessment))
          errors.push(
            `assessment ${assessment._id} has a method but an incomplete frozen snapshot`,
          );
        continue;
      }
      const plan = convertCompetencyAssessment(assessment, normalizedItems, standards, errors);
      if (plan) competencyPlans.push({ id: assessment._id, ...plan });
    }

    const convertedMarks = marks
      .map((mark) => convertMark(mark, errors))
      .filter((mark): mark is PointAssessment => mark !== null);
    const assessmentIds = new Map(assessments.map((assessment) => [assessment._id, assessment]));
    const assessmentsByIdentity = new Map<string, StoredDocument[]>();
    for (const assessment of assessments) {
      if (
        typeof assessment.learner !== "string" ||
        typeof assessment.item !== "string" ||
        typeof assessment.evidence !== "string"
      )
        continue;
      const key = identity(assessment);
      const rows = assessmentsByIdentity.get(key);
      if (rows) rows.push(assessment);
      else assessmentsByIdentity.set(key, [assessment]);
    }
    for (const rows of assessmentsByIdentity.values()) {
      if (rows.length > 1)
        errors.push(
          `assessment identity collision among records ${rows.map((row) => row._id).join(", ")}`,
        );
    }
    const marksByIdentity = new Map<string, StoredDocument[]>();
    for (const mark of marks) {
      if (
        typeof mark.learner !== "string" ||
        typeof mark.item !== "string" ||
        typeof mark.evidence !== "string"
      )
        continue;
      const key = identity(mark);
      const rows = marksByIdentity.get(key);
      if (rows) rows.push(mark);
      else marksByIdentity.set(key, [mark]);
    }
    for (const rows of marksByIdentity.values()) {
      if (rows.length > 1)
        errors.push(
          `assessment identity collision among marks ${rows.map((row) => row._id).join(", ")}`,
        );
    }

    const convertedMarkById = new Map(convertedMarks.map((mark) => [mark._id, mark]));
    for (const mark of marks) {
      if (
        typeof mark.learner !== "string" ||
        typeof mark.item !== "string" ||
        typeof mark.evidence !== "string"
      )
        continue;
      const sameIdentity = assessmentsByIdentity.get(identity(mark))?.[0];
      if (sameIdentity === undefined || sameIdentity._id === mark._id) continue;
      const converted = convertedMarkById.get(mark._id);
      if (converted === undefined || !isDeepStrictEqual(sameIdentity, converted))
        errors.push(
          `mark ${mark._id} collides with assessment ${sameIdentity._id} for the same learner/item/evidence`,
        );
    }

    const pointPlans: PointAssessment[] = [];
    for (const converted of convertedMarks) {
      if (!normalizedItems.has(converted.item)) {
        errors.push(`mark ${converted._id} has no assessment item`);
        continue;
      }
      const sameId = assessmentIds.get(converted._id);
      const sameIdentity = assessmentsByIdentity.get(identity(converted))?.[0];
      if (sameId !== undefined) {
        if (!isDeepStrictEqual(sameId, converted))
          errors.push(`mark ${converted._id} collides with a different assessment id`);
        continue;
      }
      if (sameIdentity !== undefined) {
        continue;
      }
      pointPlans.push(converted);
    }

    if (errors.length > 0)
      return {
        summary: "blocked",
        blocked:
          `Shared grading cannot be migrated without guessing or losing an assessment. ` +
          `No items, assessments, marks, or configurations were changed. Repair the following ` +
          `stored data and restart:\n- ${errors.join("\n- ")}`,
      };

    let itemCount = 0;
    for (const item of normalizedItems.values()) {
      const before = rawItemById.get(item._id)!;
      if (
        before.method === item.method &&
        before.revision === item.revision &&
        isDeepStrictEqual(before.criteria, item.criteria)
      )
        continue;
      await itemCollection.updateOne(
        { _id: item._id },
        { $set: { method: item.method, revision: item.revision, criteria: item.criteria } },
      );
      itemCount++;
    }
    for (const plan of competencyPlans)
      await assessmentCollection.updateOne(
        { _id: plan.id, method: { $exists: false } },
        { $set: plan.set, $unset: plan.unset },
      );
    for (const assessment of pointPlans) await assessmentCollection.insertOne(assessment);

    // The sources are recovery evidence until every destination write above has
    // succeeded. Dropping marks first also leaves a retry with configuration
    // data if shutdown happens between the two drops.
    await dropIfPresent(database, "grading.marks");
    await dropIfPresent(database, "grading.configurations");

    if (
      await database.listCollections({ name: "grading.assessments" }, { nameOnly: true }).hasNext()
    ) {
      for (const index of await assessmentCollection.listIndexes().toArray()) {
        if (
          index.name &&
          (generationAwareIndex(index) || (assessmentIdentityIndex(index) && !index.unique))
        )
          await assessmentCollection.dropIndex(index.name);
      }
    }
    await assessmentCollection.createIndex({ learner: 1, item: 1, evidence: 1 }, { unique: true });

    return {
      summary:
        `Normalized ${itemCount} item setup(s); converted ${competencyPlans.length} competency ` +
        `assessment(s); imported ${pointPlans.length} point assessment(s).`,
    };
  },
};
