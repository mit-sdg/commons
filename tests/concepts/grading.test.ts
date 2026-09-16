import { afterAll, expect, test } from "vite-plus/test";
import {
  type CompetencyCriterion,
  type Judgment,
  type PointCriterion,
  MongoGradingConcept,
} from "../../src/concepts/grading/grading.mongo.ts";
import { GradeIncomplete, InvalidJudgments } from "../../src/concepts/grading/errors.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

const at = new Date("2026-09-15T00:00:00Z");
const actor = { grader: "elena", at };
const competencyCriteria: CompetencyCriterion[] = [
  {
    kind: "COMPETENCY",
    criterion: "argument",
    position: 0,
    basis: "argument-v1",
    standard: "argument-standard",
    number: 1,
    name: "Argumentation",
    description: "Build a supported claim.",
    deficient: "No claim",
    emergent: "A partial claim",
    competent: "A supported claim",
    expert: "A nuanced supported claim",
    referenceUrl: "https://example.edu/argument",
  },
  {
    kind: "COMPETENCY",
    criterion: "evidence",
    position: 1,
    basis: "evidence-v1",
    standard: "evidence-standard",
    number: 1,
    name: "Evidence",
    description: "Use relevant evidence.",
    deficient: "No evidence",
    emergent: "Some evidence",
    competent: "Relevant evidence",
    expert: "Compelling evidence",
    referenceUrl: "",
  },
];
const competencyJudgments: Judgment[] = [
  {
    kind: "COMPETENCY",
    criterion: "argument",
    rating: "COMPETENT",
    feedback: "Connected reasoning.",
  },
  {
    kind: "COMPETENCY",
    criterion: "evidence",
    rating: "NOT_ASSESSED",
    feedback: "Outside this review.",
  },
];
const pointCriteria: PointCriterion[] = [
  { kind: "POINTS", criterion: "analysis", position: 0, name: "Analysis", maxPoints: 6 },
  { kind: "POINTS", criterion: "style", position: 1, name: "Style", maxPoints: 4 },
];

async function start(
  grading: MongoGradingConcept,
  options: {
    evidence?: string;
    method?: "COMPETENCY" | "POINTS";
    criteria?: CompetencyCriterion[] | PointCriterion[];
    setupRevision?: number;
  } = {},
) {
  const method = options.method ?? "COMPETENCY";
  const { grade, version } = await grading.record({
    learner: "maya",
    item: "paper",
    evidence: options.evidence ?? "attempt-1",
    grader: actor.grader,
    method,
    setupRevision: options.setupRevision ?? 1,
    criteria: options.criteria ?? (method === "POINTS" ? pointCriteria : competencyCriteria),
    at,
  });
  return { grade, version };
}

test("separate attempts have independent correction histories and immutable snapshots", async () => {
  const grading = new MongoGradingConcept(await testDb());
  let first = await start(grading);
  first = await grading.save({
    ...first,
    ...actor,
    judgments: competencyJudgments,
    feedback: "First release",
  });
  first = await grading.release({ ...first, ...actor });
  first = await grading.retract({ ...first, ...actor });
  first = await grading.save({
    ...first,
    ...actor,
    judgments: competencyJudgments.map((judgment) =>
      judgment.kind === "COMPETENCY" && judgment.criterion === "argument"
        ? { ...judgment, rating: "EXPERT" }
        : judgment,
    ),
    feedback: "Corrected",
  });
  first = await grading.release({ ...first, ...actor });
  const second = await start(grading, { evidence: "attempt-2", setupRevision: 9 });

  const firstRow = (await grading._getGrade({ grade: first.grade }))[0]!;
  expect(firstRow.history).toHaveLength(2);
  expect(firstRow.history[0]).toMatchObject({ feedback: "First release", status: "RELEASED" });
  expect(firstRow.history[0]!.judgments[0]).toMatchObject({ rating: "COMPETENT" });
  expect(firstRow.judgments[0]).toMatchObject({ rating: "EXPERT" });
  expect(firstRow.setupRevision).toBe(1);
  expect(firstRow.criteria).toEqual(competencyCriteria);
  expect(second.grade).not.toBe(first.grade);
  expect(await grading._getGradesForLearner({ learner: "maya" })).toHaveLength(2);
});

test("point drafts distinguish blank from zero and derive stable decimal totals", async () => {
  const grading = new MongoGradingConcept(await testDb());
  let grade = await start(grading, { method: "POINTS" });
  grade = await grading.save({
    ...grade,
    ...actor,
    judgments: [{ kind: "POINTS", criterion: "analysis", score: 0 }],
    feedback: "Analysis may be revised.",
  });
  expect((await grading._getGrade({ grade: grade.grade }))[0]).toMatchObject({
    score: 0,
    outOf: 10,
    scored: false,
  });
  await expect(grading.release({ ...grade, ...actor })).rejects.toBeInstanceOf(GradeIncomplete);

  grade = await grading.save({
    ...grade,
    ...actor,
    judgments: [
      { kind: "POINTS", criterion: "analysis", score: 5.75 },
      { kind: "POINTS", criterion: "style", score: 4 },
    ],
    feedback: "Complete",
  });
  expect((await grading._getGrade({ grade: grade.grade }))[0]).toMatchObject({
    score: 9.75,
    outOf: 10,
    scored: true,
  });
  grade = await grading.release({ ...grade, ...actor });
  expect((await grading._getGrade({ grade: grade.grade }))[0]!.history[0]).toMatchObject({
    score: 9.75,
    outOf: 10,
    scored: true,
  });
});

test("invalid point values, totals, and snapshot definitions are rejected", async () => {
  const grading = new MongoGradingConcept(await testDb());
  const grade = await start(grading, { method: "POINTS" });
  for (const score of [-1, 6.01, Number.NaN, Number.POSITIVE_INFINITY])
    await expect(
      grading.save({
        ...grade,
        ...actor,
        judgments: [{ kind: "POINTS", criterion: "analysis", score }],
        feedback: "",
      }),
    ).rejects.toBeInstanceOf(InvalidJudgments);

  for (const criteria of [
    [{ ...pointCriteria[0]!, maxPoints: 0 }],
    [{ ...pointCriteria[0]!, maxPoints: Number.POSITIVE_INFINITY }],
    [
      { ...pointCriteria[0]!, maxPoints: Number.MAX_VALUE },
      { ...pointCriteria[1]!, maxPoints: Number.MAX_VALUE },
    ],
  ])
    await expect(
      start(grading, {
        evidence: crypto.randomUUID(),
        method: "POINTS",
        criteria,
      }),
    ).rejects.toBeInstanceOf(InvalidJudgments);
});

test("excusal masks private draft values and restoration recovers them", async () => {
  const grading = new MongoGradingConcept(await testDb());
  let grade = await start(grading, { method: "POINTS" });
  grade = await grading.save({
    ...grade,
    ...actor,
    judgments: [
      { kind: "POINTS", criterion: "analysis", score: 5 },
      { kind: "POINTS", criterion: "style", score: 3 },
    ],
    feedback: "Private draft",
  });
  grade = await grading.excuse({ ...grade, ...actor, feedback: "No submission required." });
  const excused = (await grading._getGrade({ grade: grade.grade }))[0]!;
  expect(excused).toMatchObject({
    status: "EXCUSED",
    judgments: [],
    feedback: "No submission required.",
    score: 0,
    outOf: 10,
    scored: false,
  });
  expect(excused.history[0]).toMatchObject({ status: "EXCUSED", judgments: [], scored: false });

  grade = await grading.restoreExcused({ ...grade, ...actor });
  expect((await grading._getGrade({ grade: grade.grade }))[0]).toMatchObject({
    status: "DRAFT",
    judgments: [
      { kind: "POINTS", criterion: "analysis", score: 5 },
      { kind: "POINTS", criterion: "style", score: 3 },
    ],
    feedback: "Private draft",
    score: 8,
    scored: true,
  });
});

test("concurrent starts are idempotent and version checks prevent lost writes", async () => {
  const grading = new MongoGradingConcept(await testDb());
  const starts = await Promise.all(Array.from({ length: 8 }, () => start(grading)));
  expect(new Set(starts.map(({ grade }) => grade)).size).toBe(1);
  const outcomes = await Promise.allSettled([
    grading.save({ ...starts[0]!, ...actor, judgments: competencyJudgments, feedback: "A" }),
    grading.save({ ...starts[0]!, ...actor, judgments: competencyJudgments, feedback: "B" }),
  ]);
  expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
  expect((await grading._getGrade({ grade: starts[0]!.grade }))[0]!.version).toBe(2);
});

test("empty-evidence excusals are distinct records and cannot be released as grades", async () => {
  const grading = new MongoGradingConcept(await testDb());
  let assignment = await start(grading, { evidence: "", criteria: [] });
  await expect(grading.release({ ...assignment, ...actor })).rejects.toBeInstanceOf(
    GradeIncomplete,
  );
  assignment = await grading.excuse({ ...assignment, ...actor, feedback: "Excused assignment" });
  const attempt = await start(grading, { evidence: "attempt-1" });
  expect(attempt.grade).not.toBe(assignment.grade);
  expect(await grading._getGradesForItem({ item: "paper" })).toHaveLength(2);
});

test("bulk release returns confirmed, skipped, and uncertain outcomes", async () => {
  const grading = new MongoGradingConcept(await testDb());
  const complete = await grading.save({
    ...(await start(grading, { evidence: "complete" })),
    ...actor,
    judgments: competencyJudgments,
    feedback: "Ready",
  });
  const uncertain = await grading.save({
    ...(await start(grading, { evidence: "uncertain" })),
    ...actor,
    judgments: competencyJudgments,
    feedback: "Maybe committed",
  });
  await start(grading, { evidence: "incomplete" });

  const release = grading.release.bind(grading);
  grading.release = async (input) => {
    if (input.grade === uncertain.grade) throw new Error("injected write uncertainty");
    return release(input);
  };
  const result = await grading.releaseItem({ item: "paper", ...actor });
  expect(result.released).toEqual([{ grade: complete.grade, learner: "maya" }]);
  expect(result.skipped).toEqual([{ grade: expect.any(String), reason: "INCOMPLETE" }]);
  expect(result.unconfirmed).toEqual([{ grade: uncertain.grade, reason: "OUTCOME_UNKNOWN" }]);
});

test("fractional criteria have decimal totals in drafts and retained releases", async () => {
  const grading = new MongoGradingConcept(await testDb());
  let grade = await start(grading, {
    method: "POINTS",
    criteria: pointCriteria.map((criterion, index) => ({
      ...criterion,
      maxPoints: index === 0 ? 0.1 : 0.2,
    })),
  });
  grade = await grading.save({
    ...grade,
    ...actor,
    judgments: [
      { kind: "POINTS", criterion: "analysis", score: 0.1 },
      { kind: "POINTS", criterion: "style", score: 0.2 },
    ],
    feedback: "Full credit",
  });
  expect((await grading._getGrade(grade))[0]).toMatchObject({ score: 0.3, outOf: 0.3 });
  grade = await grading.release({ ...grade, ...actor });
  grade = await grading.retract({ ...grade, ...actor });
  grade = await grading.save({
    ...grade,
    ...actor,
    judgments: [
      { kind: "POINTS", criterion: "analysis", score: 0.1 },
      { kind: "POINTS", criterion: "style", score: 0.1 },
    ],
    feedback: "Corrected",
  });
  await grading.release({ ...grade, ...actor });
  const row = (await grading._getGrade(grade))[0]!;
  expect(row).toMatchObject({ score: 0.2, outOf: 0.3 });
  expect(row.history.map(({ score, outOf }) => ({ score, outOf }))).toEqual([
    { score: 0.3, outOf: 0.3 },
    { score: 0.2, outOf: 0.3 },
  ]);
});
