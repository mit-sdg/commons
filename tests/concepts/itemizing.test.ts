import { afterAll, expect, test } from "vite-plus/test";
import { MongoItemizingConcept } from "../../src/concepts/itemizing/itemizing.mongo.ts";
import {
  GradeItemConflict,
  GradeItemNotFound,
  InvalidCriterion,
} from "../../src/concepts/itemizing/errors.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

function point(name: string, maxPoints: number, position: number, criterion?: string) {
  return { kind: "POINTS" as const, criterion, name, maxPoints, position };
}

function competency(basis: string, position: number, criterion?: string) {
  return { kind: "COMPETENCY" as const, criterion, basis, position };
}

function expanded(basis: string, position: number, name: string) {
  return {
    kind: "COMPETENCY" as const,
    criterion: undefined,
    basis,
    position,
    standard: `${basis}-standard`,
    number: 1,
    name,
    description: `${name} description`,
    deficient: `${name} deficient`,
    emergent: `${name} emergent`,
    competent: `${name} competent`,
    expert: `${name} expert`,
    referenceUrl: "",
  };
}

test("whole-setup saves allocate stable identities and use one revision CAS", async () => {
  const itemizing = new MongoItemizingConcept(await testDb());
  await itemizing.configureItem({ item: "paper", label: "Paper" });
  const initial = await itemizing.configureSetup({
    item: "paper",
    method: "POINTS",
    revision: 0,
    criteria: [point("Analysis", 6, 0), point("Style", 4, 1)],
    resolvedCriteria: [],
  });
  expect(initial).toMatchObject({
    gradeItem: "paper",
    method: "POINTS",
    revision: 1,
    maxPoints: 10,
  });
  expect(initial.criteria.map(({ criterion }) => criterion)).toEqual([
    expect.any(String),
    expect.any(String),
  ]);

  const unchanged = await itemizing.configureSetup({
    item: "paper",
    method: "POINTS",
    revision: 1,
    criteria: initial.criteria,
    resolvedCriteria: [],
  });
  expect(unchanged.revision).toBe(1);
  expect(unchanged.criteria).toEqual(initial.criteria);

  const outcomes = await Promise.allSettled([
    itemizing.configureSetup({
      item: "paper",
      method: "POINTS",
      revision: 1,
      criteria: [point("Analysis", 8, 0, initial.criteria[0]!.criterion)],
      resolvedCriteria: [],
    }),
    itemizing.configureSetup({
      item: "paper",
      method: "POINTS",
      revision: 1,
      criteria: [point("Analysis", 20, 0, initial.criteria[0]!.criterion)],
      resolvedCriteria: [],
    }),
  ]);
  expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  const failure = outcomes.find(({ status }) => status === "rejected");
  expect(failure).toMatchObject({ status: "rejected", reason: expect.any(GradeItemConflict) });
});

test("method and maximum edits retain retired identities without exposing them", async () => {
  const db = await testDb();
  const itemizing = new MongoItemizingConcept(db);
  await itemizing.configureItem({ item: "paper", label: "Paper" });
  const points = await itemizing.configureSetup({
    item: "paper",
    method: "POINTS",
    revision: 0,
    criteria: [point("Overall", 10, 0)],
    resolvedCriteria: [],
  });
  const oldCriterion = points.criteria[0]!.criterion;
  const changed = await itemizing.configureSetup({
    item: "paper",
    method: "POINTS",
    revision: 1,
    criteria: [point("Overall", 100, 0, oldCriterion)],
    resolvedCriteria: [],
  });
  expect(changed).toMatchObject({ revision: 2, maxPoints: 100 });
  const competencySetup = await itemizing.configureSetup({
    item: "paper",
    method: "COMPETENCY",
    revision: 2,
    criteria: [competency("edition-1", 0)],
    resolvedCriteria: [expanded("edition-1", 0, "Argumentation")],
  });
  expect(competencySetup).toMatchObject({ method: "COMPETENCY", revision: 3, maxPoints: 0 });
  expect(competencySetup.criteria).toEqual([
    expect.objectContaining({
      kind: "COMPETENCY",
      criterion: expect.any(String),
      basis: "edition-1",
      name: "Argumentation",
    }),
  ]);
  const stored = await db
    .collection<Record<string, unknown> & { _id: string }>("itemizing.assessmentItems")
    .findOne({ _id: "paper" });
  expect(stored?.criteria).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ criterion: oldCriterion, kind: "POINTS", active: false }),
    ]),
  );
  expect((await itemizing._getSetup({ item: "paper" }))[0]!.criteria).toHaveLength(1);
});

test("expanded competency response follows saved positions rather than request array order", async () => {
  const itemizing = new MongoItemizingConcept(await testDb());
  await itemizing.configureItem({ item: "paper", label: "Paper" });
  const setup = await itemizing.configureSetup({
    item: "paper",
    method: "COMPETENCY",
    revision: 0,
    criteria: [competency("edition-a", 1), competency("edition-b", 0)],
    resolvedCriteria: [expanded("edition-a", 1, "A"), expanded("edition-b", 0, "B")],
  });
  expect(setup.criteria).toEqual([
    expect.objectContaining({ basis: "edition-b", position: 0, name: "B" }),
    expect.objectContaining({ basis: "edition-a", position: 1, name: "A" }),
  ]);
});

test("malformed, ambiguous, and nonfinite setups are rejected without mutation", async () => {
  const itemizing = new MongoItemizingConcept(await testDb());
  await itemizing.configureItem({ item: "paper", label: "Paper" });
  for (const criteria of [
    [null],
    [{ kind: "COMPETENCY", basis: 42, position: 0 }],
    [competency("same", 0), competency("same", 1)],
    [point("", 10, 0)],
    [point("Overall", 0, 0)],
    [point("Overall", Number.POSITIVE_INFINITY, 0)],
    [point("A", Number.MAX_VALUE, 0), point("B", Number.MAX_VALUE, 1)],
    [point("A", 1, 0), point("B", 1, 0)],
  ])
    await expect(
      itemizing.configureSetup({
        item: "paper",
        method:
          criteria[0] && (criteria[0] as { kind?: string }).kind === "POINTS"
            ? "POINTS"
            : "COMPETENCY",
        revision: 0,
        criteria: criteria as never,
        resolvedCriteria: [],
      }),
    ).rejects.toBeInstanceOf(InvalidCriterion);
  expect(await itemizing._getSetup({ item: "paper" })).toEqual([
    {
      item: "paper",
      label: "Paper",
      status: "ACTIVE",
      method: "COMPETENCY",
      revision: 0,
      criteria: [],
      maxPoints: 0,
    },
  ]);
});

test("ensure preserves archival and legacy documents use competency revision zero", async () => {
  const db = await testDb();
  await db
    .collection<Record<string, unknown> & { _id: string }>("itemizing.assessmentItems")
    .insertOne({
      _id: "legacy",
      label: "Legacy",
      status: "ACTIVE",
      criteria: [{ criterion: "old", basis: "edition-old", position: 0 }],
    });
  const itemizing = new MongoItemizingConcept(db);
  expect(await itemizing._getSetup({ item: "legacy" })).toEqual([
    {
      item: "legacy",
      label: "Legacy",
      status: "ACTIVE",
      method: "COMPETENCY",
      revision: 0,
      criteria: [
        {
          criterion: "old",
          kind: "COMPETENCY",
          basis: "edition-old",
          position: 0,
        },
      ],
      maxPoints: 0,
    },
  ]);
  await itemizing.archiveItem({ item: "legacy" });
  await itemizing.ensureItem({ item: "legacy", label: "Overwritten" });
  expect((await itemizing._getItem({ item: "legacy" }))[0]).toMatchObject({
    label: "Legacy",
    status: "ARCHIVED",
  });
  await expect(
    itemizing.configureSetup({
      item: "legacy",
      method: "POINTS",
      revision: 0,
      criteria: [point("Overall", 10, 0)],
      resolvedCriteria: [],
    }),
  ).rejects.toBeInstanceOf(GradeItemNotFound);
});

test("fractional maxima agree in setup saves and all setup reads", async () => {
  const itemizing = new MongoItemizingConcept(await testDb());
  await itemizing.configureItem({ item: "paper", label: "Paper" });
  const setup = await itemizing.configureSetup({
    item: "paper",
    method: "POINTS",
    revision: 0,
    criteria: [point("Analysis", 0.1, 0), point("Style", 0.2, 1)],
    resolvedCriteria: [],
  });
  expect(setup.maxPoints).toBe(0.3);
  expect((await itemizing._getSetup({ item: "paper" }))[0]?.maxPoints).toBe(0.3);
  expect((await itemizing._getItem({ item: "paper" }))[0]?.maxPoints).toBe(0.3);
  expect((await itemizing._getItems())[0]?.maxPoints).toBe(0.3);
});
