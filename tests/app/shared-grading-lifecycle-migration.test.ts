import type { Collection, Db, Document } from "mongodb";
import { afterAll, expect, test } from "vite-plus/test";
import { stopTestDb, testDb as rawTestDb } from "../../src/concepts/testing.ts";
import { sharedGradingLifecycle as migrationUnderTest } from "../../src/migrations/20260915T000200-shared-grading-lifecycle.ts";

afterAll(stopTestDb);

interface TestDocument extends Document {
  _id: string;
  [field: string]: unknown;
}
type TestDatabase = Omit<Db, "collection"> & {
  collection(name: string): Collection<TestDocument>;
};
const testDb = async (): Promise<TestDatabase> => (await rawTestDb()) as TestDatabase;
const sharedGradingLifecycle = {
  ...migrationUnderTest,
  up: (database: TestDatabase) => migrationUnderTest.up(database as Db),
};

const createdAt = new Date("2026-09-01T12:00:00.000Z");
const updatedAt = new Date("2026-09-02T12:00:00.000Z");
const releasedAt = new Date("2026-09-03T12:00:00.000Z");

const rubric = {
  _id: "standard-argument",
  current: "edition-2",
  editions: [
    {
      edition: "edition-1",
      number: 1,
      name: "Argumentation",
      description: "Connect claims to evidence.",
      deficient: "No identifiable claim.",
      emergent: "Claim with incomplete support.",
      competent: "Evidence supports the claim.",
      expert: "Competing explanations are evaluated.",
      referenceUrl: "https://example.test/argument",
    },
    {
      edition: "edition-2",
      number: 2,
      name: "Argumentation revised",
      description: "The current edition must not replace the frozen first edition.",
      deficient: "D2",
      emergent: "E2",
      competent: "C2",
      expert: "X2",
      referenceUrl: "",
    },
  ],
};

function legacyMark(overrides: Record<string, unknown> = {}) {
  return {
    _id: "mark-release",
    learner: "learner-release",
    item: "quiz",
    evidence: "attempt-release",
    grader: "grader-a",
    score: 0,
    scored: true,
    outOf: 10,
    feedback: "Explicit zero",
    status: "RELEASED",
    version: 7,
    generation: 3,
    createdAt,
    updatedAt,
    releasedAt,
    ...overrides,
  };
}

function importedPointAssessment(mark = legacyMark()) {
  const criterion = `legacy-point:${mark._id}`;
  const judgments = mark.scored ? [{ kind: "POINTS", criterion, score: mark.score }] : [];
  const history =
    mark.status === "DRAFT"
      ? []
      : mark.status === "EXCUSED"
        ? [
            {
              revision: 1,
              grader: mark.grader,
              status: "EXCUSED",
              judgments: [],
              feedback: mark.feedback,
              releasedAt: mark.releasedAt,
              score: 0,
              outOf: mark.outOf,
              scored: false,
            },
          ]
        : [
            {
              revision: 1,
              grader: mark.grader,
              status: "RELEASED",
              judgments,
              feedback: mark.feedback,
              releasedAt: mark.releasedAt,
              score: mark.scored ? mark.score : 0,
              outOf: mark.outOf,
              scored: mark.scored,
            },
          ];
  return {
    _id: mark._id,
    learner: mark.learner,
    item: mark.item,
    evidence: mark.evidence,
    grader: mark.grader,
    method: "POINTS",
    setupRevision: mark.generation ?? 0,
    criteria: [{ kind: "POINTS", criterion, position: 0, name: "Overall", maxPoints: mark.outOf }],
    judgments,
    feedback: mark.feedback,
    status: mark.status,
    version: mark.version,
    createdAt: mark.createdAt,
    updatedAt: mark.updatedAt,
    releasedAt: mark.releasedAt,
    history,
  };
}

test("freezes legacy competency snapshots and full history without losing inactive criteria", async () => {
  const database = await testDb();
  await database.collection("standardSetting.standards").insertOne(rubric);
  await database.collection("itemizing.assessmentItems").insertOne({
    _id: "paper",
    label: "Paper",
    status: "ACTIVE",
    criteria: [
      { criterion: "argument", basis: "edition-1", position: 2, active: true },
      { criterion: "removed", basis: "edition-2", position: 9, active: false },
    ],
  });
  await database.collection("grading.configurations").insertOne({
    _id: "paper",
    method: "COMPETENCY",
    generation: 4,
    maxPoints: 100,
  });
  await database.collection("grading.assessments").insertOne({
    _id: "grade-1",
    learner: "learner-a",
    item: "paper",
    evidence: "submission-a",
    grader: "grader-a",
    generation: 2,
    criteria: [{ criterion: "argument" }],
    judgments: [{ criterion: "argument", rating: "EXPERT", feedback: "Current" }],
    feedback: "Current overall feedback",
    status: "RELEASED",
    version: 8,
    createdAt,
    updatedAt,
    releasedAt,
    history: [
      {
        revision: 1,
        grader: "grader-old",
        status: "EXCUSED",
        judgments: [],
        feedback: "Initially excused",
        releasedAt: new Date("2026-09-01T15:00:00.000Z"),
      },
      {
        revision: 2,
        grader: "grader-a",
        status: "RELEASED",
        judgments: [{ criterion: "argument", rating: "EXPERT", feedback: "Current" }],
        feedback: "Current overall feedback",
        releasedAt,
      },
    ],
  });

  const result = await sharedGradingLifecycle.up(database);
  expect(result).not.toHaveProperty("blocked");
  expect(result.summary).toContain("1 item setup(s)");
  expect(result.summary).toContain("1 competency assessment(s)");

  expect(await database.collection("itemizing.assessmentItems").findOne({ _id: "paper" })).toEqual({
    _id: "paper",
    label: "Paper",
    status: "ACTIVE",
    method: "COMPETENCY",
    revision: 4,
    criteria: [
      {
        criterion: "argument",
        kind: "COMPETENCY",
        basis: "edition-1",
        position: 2,
        active: true,
      },
      {
        criterion: "removed",
        kind: "COMPETENCY",
        basis: "edition-2",
        position: 9,
        active: false,
      },
    ],
  });
  const grade = await database.collection("grading.assessments").findOne({ _id: "grade-1" });
  expect(grade).toMatchObject({
    _id: "grade-1",
    method: "COMPETENCY",
    setupRevision: 2,
    status: "RELEASED",
    version: 8,
    createdAt,
    updatedAt,
    releasedAt,
    criteria: [
      {
        kind: "COMPETENCY",
        criterion: "argument",
        position: 2,
        basis: "edition-1",
        standard: "standard-argument",
        number: 1,
        name: "Argumentation",
        description: "Connect claims to evidence.",
        deficient: "No identifiable claim.",
        emergent: "Claim with incomplete support.",
        competent: "Evidence supports the claim.",
        expert: "Competing explanations are evaluated.",
        referenceUrl: "https://example.test/argument",
      },
    ],
    judgments: [
      {
        kind: "COMPETENCY",
        criterion: "argument",
        rating: "EXPERT",
        feedback: "Current",
      },
    ],
  });
  expect(grade).not.toHaveProperty("generation");
  expect(grade?.history).toEqual([
    {
      revision: 1,
      grader: "grader-old",
      status: "EXCUSED",
      judgments: [],
      feedback: "Initially excused",
      releasedAt: new Date("2026-09-01T15:00:00.000Z"),
      score: 0,
      outOf: 0,
      scored: false,
    },
    {
      revision: 2,
      grader: "grader-a",
      status: "RELEASED",
      judgments: [
        {
          kind: "COMPETENCY",
          criterion: "argument",
          rating: "EXPERT",
          feedback: "Current",
        },
      ],
      feedback: "Current overall feedback",
      releasedAt,
      score: 0,
      outOf: 0,
      scored: false,
    },
  ]);
});

test("imports released, draft, and excused marks with zero, blank, and restorable private state", async () => {
  const database = await testDb();
  await database.collection("itemizing.assessmentItems").insertOne({
    _id: "quiz",
    label: "Quiz",
    status: "ARCHIVED",
    criteria: [{ criterion: "old-skill", basis: "unused", position: 5, active: true }],
  });
  await database.collection("grading.configurations").insertOne({
    _id: "quiz",
    method: "POINTS",
    generation: 3,
    maxPoints: 100,
  });
  const released = legacyMark();
  const draft = legacyMark({
    _id: "mark-draft",
    learner: "learner-draft",
    evidence: "attempt-draft",
    score: 0,
    scored: false,
    feedback: "Blank draft",
    status: "DRAFT",
    version: 2,
    releasedAt: null,
  });
  const excused = legacyMark({
    _id: "mark-excused",
    learner: "learner-excused",
    evidence: "attempt-excused",
    score: 4,
    feedback: "Excused after scoring",
    status: "EXCUSED",
    version: 5,
  });
  await database.collection("grading.marks").insertMany([released, draft, excused]);

  const result = await sharedGradingLifecycle.up(database);
  expect(result.summary).toContain("3 point assessment(s)");
  expect(await database.listCollections({ name: "grading.marks" }).hasNext()).toBe(false);
  expect(await database.listCollections({ name: "grading.configurations" }).hasNext()).toBe(false);

  const item = await database.collection("itemizing.assessmentItems").findOne({ _id: "quiz" });
  expect(item).toMatchObject({ method: "POINTS", revision: 3, status: "ARCHIVED" });
  expect(item?.criteria).toEqual([
    {
      criterion: "old-skill",
      kind: "COMPETENCY",
      basis: "unused",
      position: 5,
      active: false,
    },
    {
      criterion: "legacy-setup-point:quiz",
      kind: "POINTS",
      name: "Overall",
      maxPoints: 100,
      position: 0,
      active: true,
    },
  ]);
  const assessments = database.collection("grading.assessments");
  const releasedGrade = await assessments.findOne({ _id: "mark-release" });
  expect(releasedGrade).toEqual(importedPointAssessment(released));
  expect(releasedGrade?.criteria).toMatchObject([{ maxPoints: 10 }]);
  expect(releasedGrade).not.toHaveProperty("score");
  expect(releasedGrade?.history).toMatchObject([
    { judgments: [{ score: 0 }], score: 0, outOf: 10, scored: true },
  ]);
  expect(await assessments.findOne({ _id: "mark-draft" })).toEqual(importedPointAssessment(draft));
  const excusedGrade = await assessments.findOne({ _id: "mark-excused" });
  expect(excusedGrade).toEqual(importedPointAssessment(excused));
  expect(excusedGrade?.judgments).toMatchObject([{ score: 4 }]);
  expect(excusedGrade?.history).toMatchObject([
    { status: "EXCUSED", judgments: [], score: 0, outOf: 10, scored: false },
  ]);
});

test.each([
  [
    "missing item basis",
    [{ criterion: "other", basis: "edition-1", position: 0, active: true }],
    [rubric],
  ],
  [
    "missing immutable edition",
    [{ criterion: "argument", basis: "missing-edition", position: 0, active: true }],
    [rubric],
  ],
])("blocks %s before changing any source or destination", async (_name, criteria, standards) => {
  const database = await testDb();
  const item = { _id: "paper", label: "Paper", status: "ACTIVE", criteria };
  const configuration = {
    _id: "paper",
    method: "COMPETENCY",
    generation: 1,
    maxPoints: 100,
  };
  const assessment = {
    _id: "grade-bad",
    learner: "learner",
    item: "paper",
    evidence: "submission",
    grader: "grader",
    generation: 1,
    criteria: [{ criterion: "argument" }],
    judgments: [],
    feedback: "",
    status: "DRAFT",
    version: 1,
    createdAt,
    updatedAt,
    releasedAt: null,
    history: [],
  };
  await database.collection("itemizing.assessmentItems").insertOne(item);
  await database.collection("grading.configurations").insertOne(configuration);
  await database.collection("grading.assessments").insertOne(assessment);
  if (standards.length)
    await database.collection("standardSetting.standards").insertMany(standards);

  const result = await sharedGradingLifecycle.up(database);
  expect(result.blocked).toContain("grade-bad");
  expect(await database.collection("itemizing.assessmentItems").findOne()).toEqual(item);
  expect(await database.collection("grading.configurations").findOne()).toEqual(configuration);
  expect(await database.collection("grading.assessments").findOne()).toEqual(assessment);
});

test("blocks identity collisions and invalid denominators with all sources untouched", async () => {
  const database = await testDb();
  const item = {
    _id: "quiz",
    label: "Quiz",
    status: "ACTIVE",
    method: "POINTS",
    revision: 4,
    criteria: [
      {
        criterion: "current-point",
        kind: "POINTS",
        name: "Overall",
        maxPoints: 10,
        position: 0,
        active: true,
      },
    ],
  };
  const existingMark = legacyMark();
  const invalidMark = legacyMark({
    _id: "bad-denominator",
    learner: "another",
    evidence: "another-attempt",
    outOf: 0,
  });
  const conflictingAssessment = {
    ...importedPointAssessment(existingMark),
    _id: "different-grade-id",
    feedback: "An independently existing assessment",
  };
  await database.collection("itemizing.assessmentItems").insertOne(item);
  await database.collection("grading.assessments").insertOne(conflictingAssessment);
  await database.collection("grading.marks").insertMany([existingMark, invalidMark]);

  const result = await sharedGradingLifecycle.up(database);
  expect(result.blocked).toContain("same learner/item/evidence");
  expect(result.blocked).toContain("bad-denominator");
  expect(await database.collection("itemizing.assessmentItems").findOne()).toEqual(item);
  expect(await database.collection("grading.assessments").findOne()).toEqual(conflictingAssessment);
  expect(await database.collection("grading.marks").find({}).toArray()).toEqual([
    existingMark,
    invalidMark,
  ]);
});

test("a retry recognizes an exact point assessment written before source cleanup", async () => {
  const database = await testDb();
  const mark = legacyMark();
  await database.collection("itemizing.assessmentItems").insertOne({
    _id: "quiz",
    label: "Quiz",
    status: "ACTIVE",
    method: "POINTS",
    revision: 3,
    criteria: [
      {
        criterion: "legacy-setup-point:quiz",
        kind: "POINTS",
        name: "Overall",
        maxPoints: 100,
        position: 0,
        active: true,
      },
    ],
  });
  await database.collection("grading.configurations").insertOne({
    _id: "quiz",
    method: "POINTS",
    generation: 3,
    maxPoints: 100,
  });
  await database.collection("grading.marks").insertOne(mark);
  await database.collection("grading.assessments").insertOne(importedPointAssessment(mark));

  const result = await sharedGradingLifecycle.up(database);
  expect(result).not.toHaveProperty("blocked");
  expect(result.summary).toContain("0 point assessment(s)");
  expect(await database.collection("grading.assessments").countDocuments()).toBe(1);
  expect(await database.collection("grading.assessments").findOne()).toEqual(
    importedPointAssessment(mark),
  );
  expect(await database.listCollections({ name: "grading.marks" }).hasNext()).toBe(false);
});

test("reapplication after source cleanup preserves newer point setup and does not duplicate history", async () => {
  const database = await testDb();
  const mark = legacyMark({ score: 8, outOf: 10 });
  await database.collection("itemizing.assessmentItems").insertOne({
    _id: "quiz",
    label: "Quiz",
    status: "ACTIVE",
    criteria: [],
  });
  await database.collection("grading.configurations").insertOne({
    _id: "quiz",
    method: "POINTS",
    generation: 3,
    maxPoints: 10,
  });
  await database.collection("grading.marks").insertOne(mark);
  await database
    .collection("grading.assessments")
    .createIndex({ learner: 1, item: 1, evidence: 1, generation: 1 }, { unique: true });
  await sharedGradingLifecycle.up(database);

  await database.collection("itemizing.assessmentItems").updateOne(
    { _id: "quiz" },
    {
      $set: {
        revision: 4,
        criteria: [
          {
            criterion: "legacy-setup-point:quiz",
            kind: "POINTS",
            name: "Overall",
            maxPoints: 10,
            position: 0,
            active: false,
          },
          {
            criterion: "new-hundred-point-setup",
            kind: "POINTS",
            name: "Overall",
            maxPoints: 100,
            position: 0,
            active: true,
          },
        ],
      },
    },
  );
  const itemBefore = await database.collection("itemizing.assessmentItems").findOne();
  const assessmentBefore = await database.collection("grading.assessments").findOne();

  const result = await sharedGradingLifecycle.up(database);
  expect(result).not.toHaveProperty("blocked");
  expect(result.summary).toContain("Normalized 0 item setup(s)");
  expect(await database.collection("itemizing.assessmentItems").findOne()).toEqual(itemBefore);
  expect(await database.collection("grading.assessments").findOne()).toEqual(assessmentBefore);
  expect(assessmentBefore?.criteria).toMatchObject([{ maxPoints: 10 }]);
  expect(assessmentBefore?.history).toHaveLength(1);

  const indexes = await database.collection("grading.assessments").indexes();
  expect(
    indexes.some(
      (index) =>
        index.unique === true && Object.keys(index.key ?? {}).join(",") === "learner,item,evidence",
    ),
  ).toBe(true);
  expect(indexes.some((index) => Object.hasOwn(index.key ?? {}, "generation"))).toBe(false);
});

test("an assessment id collision blocks rather than overwriting another record", async () => {
  const database = await testDb();
  const mark = legacyMark();
  const other = {
    ...importedPointAssessment({
      ...mark,
      learner: "other-learner",
      evidence: "other-attempt",
    }),
    _id: mark._id,
  };
  await database.collection("itemizing.assessmentItems").insertOne({
    _id: "quiz",
    label: "Quiz",
    status: "ACTIVE",
    method: "POINTS",
    revision: 3,
    criteria: [
      {
        criterion: "point",
        kind: "POINTS",
        name: "Overall",
        maxPoints: 10,
        position: 0,
        active: true,
      },
    ],
  });
  await database.collection("grading.marks").insertOne(mark);
  await database.collection("grading.assessments").insertOne(other);

  const result = await sharedGradingLifecycle.up(database);
  expect(result.blocked).toContain("different assessment id");
  expect(await database.collection("grading.assessments").findOne({ _id: mark._id })).toEqual(
    other,
  );
  expect(await database.collection("grading.marks").findOne({ _id: mark._id })).toEqual(mark);
});
