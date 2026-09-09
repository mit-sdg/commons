import { afterAll, expect, test } from "vite-plus/test";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";
import { MongoGradingConcept } from "../../src/concepts/grading/grading.mongo.ts";
import {
  GradeConflict,
  GradeIncomplete,
  InvalidJudgments,
} from "../../src/concepts/grading/errors.ts";
afterAll(stopTestDb);
const at = new Date("2026-09-09T00:00:00Z");
const actor = { grader: "elena", at };
const start = (c: MongoGradingConcept, evidence = "attempt-1") =>
  c.record({
    learner: "maya",
    item: "paper",
    evidence,
    criteria: [{ criterion: "argument" }, { criterion: "evidence" }],
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
  const result = await c.releaseItem({ item: "paper", ...actor });
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
    const result = await c.releaseItem({ item: "paper", ...actor });
    expect(result.released.map((r) => r.grade)).toEqual([drafts[0]!.grade, drafts[2]!.grade]);
    expect(result.skipped).toEqual([]);
    expect(result.unconfirmed).toEqual([{ grade: drafts[1]!.grade, reason: "OUTCOME_UNKNOWN" }]);
    c.release = release;
    const retry = await c.releaseItem({ item: "paper", ...actor });
    expect(retry.released).toHaveLength(committedBeforeFault ? 0 : 1);
    for (const g of drafts) expect((await c._getGrade(g))[0]!.history).toHaveLength(1);
  }
});
