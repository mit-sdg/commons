import { afterAll, expect, test } from "vite-plus/test";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";
import { MongoGradingConcept } from "../../src/concepts/grading/grading.mongo.ts";
import {
  GradeConflict,
  GradeIncomplete,
  GradingRecordsExist,
  InvalidGradingConfiguration,
  InvalidMark,
  InvalidJudgments,
  MarkConflict,
} from "../../src/concepts/grading/errors.ts";
import { gradingModes } from "../../src/migrations/20260915T000100-grading-modes.ts";
afterAll(stopTestDb);
const at = new Date("2026-09-09T00:00:00Z");
const actor = { grader: "elena", at };
const start = (c: MongoGradingConcept, evidence = "attempt-1") =>
  c.record({
    learner: "maya",
    item: "paper",
    evidence,
    criteria: [{ criterion: "argument" }, { criterion: "evidence" }],
    generation: 0,
    ...actor,
  });
const judgments = [
  { criterion: "argument", rating: "COMPETENT", feedback: "Connected reasoning." },
  { criterion: "evidence", rating: "NOT_ASSESSED", feedback: "Outside this review." },
];
test("distinct attempts remain separate; corrections preserve immutable releases", async () => {
  const c = new MongoGradingConcept(await testDb());
  let g = await start(c);
  g = await c.save({ ...g, ...actor, judgments, feedback: "First" });
  g = await c.release({ ...g, ...actor });
  await expect(c.save({ ...g, ...actor, judgments, feedback: "No" })).rejects.toBeInstanceOf(
    GradeConflict,
  );
  g = await c.retract({ ...g, ...actor });
  g = await c.save({
    ...g,
    ...actor,
    judgments: [{ ...judgments[0], rating: "EMERGENT" }, judgments[1]],
    feedback: "Corrected",
  });
  g = await c.release({ ...g, ...actor });
  const row = (await c._getGrade(g))[0]!;
  expect(row.history).toHaveLength(2);
  expect(row.history[0].judgments[0].rating).toBe("COMPETENT");
  expect(row.judgments[0].rating).toBe("EMERGENT");
  await start(c, "attempt-2");
  expect(await c._getGradesForLearner({ learner: "maya" })).toHaveLength(2);
});
test("concurrent start is idempotent and concurrent edits cannot lose a write", async () => {
  const c = new MongoGradingConcept(await testDb());
  const starts = await Promise.all(Array.from({ length: 8 }, () => start(c)));
  expect(new Set(starts.map((g) => g.grade)).size).toBe(1);
  const results = await Promise.allSettled([
    c.save({ ...starts[0], ...actor, judgments, feedback: "A" }),
    c.save({ ...starts[0], ...actor, judgments, feedback: "B" }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await c._getGrade(starts[0]))[0]?.version).toBe(2);
});
test("release races cannot publish a half-edited assessment", async () => {
  const c = new MongoGradingConcept(await testDb());
  let g = await start(c);
  g = await c.save({ ...g, ...actor, judgments, feedback: "Original" });
  const outcomes = await Promise.allSettled([
    c.release({ ...g, ...actor }),
    c.save({ ...g, ...actor, judgments: [], feedback: "Incomplete" }),
  ]);
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const row = (await c._getGrade(g))[0]!;
  if (row.status === "RELEASED") {
    expect(row.judgments).toHaveLength(2);
    expect(row.history[0].feedback).toBe("Original");
  } else {
    expect(row.status).toBe("DRAFT");
    expect(row.history).toEqual([]);
  }
});
test("release requires complete dispositions and rejects foreign or duplicate judgments", async () => {
  const c = new MongoGradingConcept(await testDb());
  const g = await start(c);
  await expect(c.release({ ...g, ...actor })).rejects.toBeInstanceOf(GradeIncomplete);
  for (const bad of [
    [{ ...judgments[0], criterion: "other" }],
    [judgments[0], judgments[0]],
    [{ ...judgments[0], rating: "100" }],
  ])
    await expect(c.save({ ...g, ...actor, judgments: bad, feedback: "" })).rejects.toBeInstanceOf(
      InvalidJudgments,
    );
  const blank = await start(c, "");
  await expect(c.release({ ...blank, ...actor })).rejects.toBeInstanceOf(GradeIncomplete);
});
test("excusal has a correction path and bulk release reports incomplete drafts", async () => {
  const c = new MongoGradingConcept(await testDb());
  let g = await start(c);
  g = await c.save({ ...g, ...actor, judgments, feedback: "" });
  g = await c.excuse({ ...g, ...actor, feedback: "Excused" });
  expect((await c._getGrade(g))[0]?.judgments).toEqual([]);
  g = await c.restoreExcused({ ...g, ...actor });
  await start(c, "attempt-2");
  const result = await c.releaseItem({ item: "paper", generation: 0, ...actor });
  expect(result.released).toHaveLength(1);
  expect(result.skipped).toHaveLength(1);
  expect((await c._getGrade(g))[0]?.history.map((h) => h.status)).toEqual(["EXCUSED", "RELEASED"]);
});

test("bulk release preserves confirmed outcomes and distinguishes uncertain writes", async () => {
  for (const committedBeforeFault of [false, true]) {
    const c = new MongoGradingConcept(await testDb());
    const drafts: { grade: string; version: number }[] = [];
    for (const evidence of ["first", "uncertain", "last"]) {
      const g = await start(c, evidence);
      drafts.push(await c.save({ ...g, ...actor, judgments, feedback: evidence }));
    }
    const release = c.release.bind(c);
    c.release = async (input) => {
      if (input.grade === drafts[1]!.grade) {
        if (committedBeforeFault) await release(input);
        throw new Error("Injected persistence failure or lost acknowledgement");
      }
      return release(input);
    };
    const result = await c.releaseItem({ item: "paper", generation: 0, ...actor });
    expect(result.released.map((r) => r.grade)).toEqual([drafts[0]!.grade, drafts[2]!.grade]);
    expect(result.skipped).toEqual([]);
    expect(result.unconfirmed).toEqual([{ grade: drafts[1]!.grade, reason: "OUTCOME_UNKNOWN" }]);
    c.release = release;
    const retry = await c.releaseItem({ item: "paper", generation: 0, ...actor });
    expect(retry.released).toHaveLength(committedBeforeFault ? 0 : 1);
    for (const g of drafts) expect((await c._getGrade(g))[0]!.history).toHaveLength(1);
  }
});

test("bulk point release preserves confirmed outcomes across an unexpected write failure", async () => {
  const c = new MongoGradingConcept(await testDb());
  await c.configure({
    item: "quiz",
    method: "POINTS",
    maxPoints: 10,
    generation: 0,
    discard: false,
    expectedCount: 0,
  });
  const drafts: { mark: string; version: number }[] = [];
  for (const [learner, score] of [
    ["maya", 8],
    ["noah", 7],
    ["olivia", 9],
  ] as const)
    drafts.push(
      await c.recordMark({
        learner,
        item: "quiz",
        evidence: `${learner}-attempt`,
        grader: "elena",
        score,
        feedback: "",
        generation: 1,
        version: 0,
        at,
      }),
    );

  type UpdateOne = (filter: { _id?: string }, update: object) => Promise<{ modifiedCount: number }>;
  const internals = c as unknown as { marks: { updateOne: UpdateOne } };
  const updateOne = internals.marks.updateOne.bind(internals.marks);
  internals.marks.updateOne = async (filter, update) => {
    if (filter._id === drafts[1]!.mark) throw new Error("injected release failure");
    return updateOne(filter, update);
  };
  const result = await c.releaseMarks({ item: "quiz", generation: 1, at });
  expect(result.released.map((entry) => entry.mark).sort()).toEqual(
    [drafts[0]!.mark, drafts[2]!.mark].sort(),
  );
  expect(result.skipped).toEqual([]);
  expect(result.unconfirmed).toEqual([{ mark: drafts[1]!.mark, reason: "OUTCOME_UNKNOWN" }]);

  internals.marks.updateOne = updateOne;
  const retry = await c.releaseMarks({ item: "quiz", generation: 1, at });
  expect(retry.released).toEqual([{ mark: drafts[1]!.mark, learner: "noah" }]);
  expect(retry.unconfirmed).toEqual([]);
  expect((await c._getMarksForItem({ item: "quiz" })).map((mark) => mark.status)).toEqual([
    "RELEASED",
    "RELEASED",
    "RELEASED",
  ]);
});

test("points grades preserve zero, decimals, maximum, and their recorded denominator", async () => {
  const c = new MongoGradingConcept(await testDb());
  const setup = await c.configure({
    item: "quiz",
    method: "POINTS",
    maxPoints: 10,
    generation: 0,
    discard: false,
    expectedCount: 0,
  });
  expect(setup).toMatchObject({ method: "POINTS", maxPoints: 10, generation: 1 });

  let mark = await c.recordMark({
    learner: "maya",
    item: "quiz",
    evidence: "attempt-1",
    grader: "elena",
    score: 0,
    feedback: "A submitted zero is still graded.",
    generation: 1,
    version: 0,
    at,
  });
  expect((await c._getMark(mark))[0]).toMatchObject({ score: 0, scored: true, outOf: 10 });
  mark = await c.recordMark({
    learner: "maya",
    item: "quiz",
    evidence: "attempt-1",
    grader: "elena",
    score: 7.25,
    feedback: "Decimal score",
    generation: 1,
    version: mark.version,
    at,
  });
  expect((await c._getMark(mark))[0]).toMatchObject({ score: 7.25, outOf: 10 });
  mark = await c.excuseMark({
    learner: "maya",
    item: "quiz",
    evidence: "attempt-1",
    grader: "elena",
    feedback: "Excused after review",
    generation: 1,
    mark: mark.mark,
    version: mark.version,
    at,
  });
  expect((await c._getMark(mark))[0]).toMatchObject({
    score: 0,
    scored: false,
    status: "EXCUSED",
  });
  mark = await c.restoreExcusedMark({ ...mark, at });
  expect((await c._getMark(mark))[0]).toMatchObject({
    score: 7.25,
    scored: true,
    status: "DRAFT",
  });

  await expect(
    c.configure({
      item: "quiz",
      method: "POINTS",
      maxPoints: 100,
      generation: 1,
      discard: false,
      expectedCount: 0,
    }),
  ).rejects.toBeInstanceOf(GradingRecordsExist);
  expect((await c._getMark(mark))[0]).toMatchObject({ score: 7.25, outOf: 10 });

  const changed = await c.configure({
    item: "quiz",
    method: "POINTS",
    maxPoints: 100,
    generation: 1,
    discard: true,
    expectedCount: 1,
  });
  expect(changed).toMatchObject({ maxPoints: 100, generation: 2, discarded: 1 });
  expect(await c._getMark(mark)).toEqual([]);
});

test("points grading rejects invalid configuration and scores without coercion", async () => {
  const c = new MongoGradingConcept(await testDb());
  for (const maximum of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    await expect(
      c.configure({
        item: "quiz",
        method: "POINTS",
        maxPoints: maximum,
        generation: 0,
        discard: false,
        expectedCount: 0,
      }),
    ).rejects.toBeInstanceOf(InvalidGradingConfiguration);

  await c.configure({
    item: "quiz",
    method: "POINTS",
    maxPoints: 8,
    generation: 0,
    discard: false,
    expectedCount: 0,
  });
  for (const score of [-0.1, 8.1, Number.NaN, Number.POSITIVE_INFINITY])
    await expect(
      c.recordMark({
        learner: "maya",
        item: "quiz",
        evidence: "attempt-1",
        grader: "elena",
        score,
        feedback: "",
        generation: 1,
        version: 0,
        at,
      }),
    ).rejects.toBeInstanceOf(InvalidMark);

  const maximum = await c.recordMark({
    learner: "maya",
    item: "quiz",
    evidence: "attempt-1",
    grader: "elena",
    score: 8,
    feedback: "",
    generation: 1,
    version: 0,
    at,
  });
  await c.releaseMark({ ...maximum, at });
  expect((await c._getMark(maximum))[0]).toMatchObject({ score: 8, outOf: 8, status: "RELEASED" });
});

test("a stale request cannot resurrect a grade after switching away and back", async () => {
  const c = new MongoGradingConcept(await testDb());
  await c.configure({
    item: "quiz",
    method: "POINTS",
    maxPoints: 10,
    generation: 0,
    discard: false,
    expectedCount: 0,
  });
  const old = await c.recordMark({
    learner: "maya",
    item: "quiz",
    evidence: "attempt-1",
    grader: "elena",
    score: 8,
    feedback: "",
    generation: 1,
    version: 0,
    at,
  });
  await c.configure({
    item: "quiz",
    method: "COMPETENCY",
    maxPoints: 10,
    generation: 1,
    discard: true,
    expectedCount: 1,
  });
  await c.configure({
    item: "quiz",
    method: "POINTS",
    maxPoints: 10,
    generation: 2,
    discard: false,
    expectedCount: 0,
  });

  await expect(
    c.recordMark({
      learner: "maya",
      item: "quiz",
      evidence: "attempt-1",
      grader: "elena",
      score: 9,
      feedback: "stale",
      generation: 1,
      version: old.version,
      at,
    }),
  ).rejects.toBeInstanceOf(MarkConflict);
  expect(await c._getMark(old)).toEqual([]);
  expect(await c._getMarksForItem({ item: "quiz" })).toEqual([]);
});

test("legacy uniqueness and an interrupted cleanup leave a retryable grading setup", async () => {
  const db = await testDb();
  const records = db.collection<{
    _id: string;
    generation?: number;
    [field: string]: unknown;
  }>("grading.assessments");
  await records.createIndex({ learner: 1, item: 1, evidence: 1 }, { unique: true });
  await records.insertOne({
    _id: "old-grade",
    learner: "maya",
    item: "paper",
    evidence: "attempt-1",
    grader: "elena",
    criteria: [{ criterion: "argument" }],
    judgments: [],
    feedback: "Keep me until cleanup succeeds.",
    status: "DRAFT",
    version: 1,
    createdAt: at,
    updatedAt: at,
    releasedAt: null,
    history: [],
  });

  await gradingModes.up(db);
  const indexes = await records.indexes();
  expect(
    indexes.some(
      (index) =>
        index.unique === true &&
        Object.keys(index.key ?? {}).join(",") === "learner,item,evidence,generation",
    ),
  ).toBe(true);
  expect((await records.findOne({ _id: "old-grade" }))?.generation).toBe(0);

  const c = new MongoGradingConcept(db);
  type DeleteMany = (filter: object) => Promise<{ deletedCount: number }>;
  const internals = c as unknown as { records: { deleteMany: DeleteMany } };
  const deleteMany = internals.records.deleteMany.bind(internals.records);
  internals.records.deleteMany = async () => {
    throw new Error("injected delete failure");
  };
  await expect(
    c.configure({
      item: "paper",
      method: "POINTS",
      maxPoints: 10,
      generation: 0,
      discard: true,
      expectedCount: 1,
    }),
  ).rejects.toThrow("injected delete failure");
  expect(await c._getConfiguration({ item: "paper" })).toEqual([
    { item: "paper", method: "COMPETENCY", generation: 0, maxPoints: 100 },
  ]);
  expect(await c._getGrade({ grade: "old-grade" })).toHaveLength(1);

  internals.records.deleteMany = deleteMany;
  await c.configure({
    item: "paper",
    method: "POINTS",
    maxPoints: 10,
    generation: 0,
    discard: true,
    expectedCount: 1,
  });
  await c.configure({
    item: "paper",
    method: "COMPETENCY",
    maxPoints: 10,
    generation: 1,
    discard: false,
    expectedCount: 0,
  });
  const reassessed = await c.record({
    learner: "maya",
    item: "paper",
    evidence: "attempt-1",
    grader: "elena",
    criteria: [{ criterion: "argument" }],
    generation: 2,
    at,
  });
  expect(reassessed.version).toBe(1);
  expect((await c._getGrade(reassessed))[0]?.grade).toBe(reassessed.grade);
});
