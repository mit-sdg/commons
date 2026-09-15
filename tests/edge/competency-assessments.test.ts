import { afterAll, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

const standardContent = {
  name: "Original rubric",
  description: "Original meaning",
  deficient: "D",
  emergent: "E",
  competent: "C",
  expert: "X",
  referenceUrl: "",
};

async function fixture() {
  const edge = createEdge(mongoImplementations(await testDb()), "http://127.0.0.1");
  const c = edge.application.concepts;
  async function post(path: string, body: unknown, cookie = "") {
    return edge.fetch(
      new Request(`http://127.0.0.1/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(body),
      }),
    );
  }
  async function actor(username: string, student = false) {
    const { user } = await c.Authenticating.register({
      username,
      email: `${username}@example.edu`,
      password: "password123",
    });
    await c.Profiling.createProfile({ user, displayName: username });
    if (student) {
      const seats = await c.Rostering.importSeats({
        rows: [{ email: `${username}@example.edu`, kind: "STUDENT" }],
      });
      await c.Rostering.claimSeat({ seat: seats.created[0]._id, user });
    }
    const login = await post("/auth/login", { username, password: "password123" });
    return { user, cookie: login.headers.get("set-cookie")!.split(";")[0] };
  }
  const staff = await actor("reviewstaff");
  const learner = await actor("reviewlearner", true);
  const at = new Date();
  const { assignment: item } = await c.Assigning.createDraft({
    author: staff.user,
    title: "Historical paper",
    instructions: "Synthetic work",
    kind: "HOMEWORK",
    availableAt: "2020-01-01T00:00:00Z",
    dueAt: "2090-01-01T00:00:00Z",
    closeAt: "2090-02-01T00:00:00Z",
    acceptsSubmissions: true,
    audience: "EVERYONE",
    targets: [],
    at,
  });
  await c.Assigning.publish({ assignment: item, at });
  const standard = await c.StandardSetting.define(standardContent);
  const { criterion } = await c.Itemizing.addCriterion({
    item,
    basis: standard.edition,
    position: 0,
  });
  const evidence = await c.Submitting.submit({
    assignment: item,
    submitter: learner.user,
    artifact: "synthetic-artifact",
    at,
  });
  const grade = await c.Grading.record({
    learner: learner.user,
    item,
    evidence: evidence.submission,
    grader: staff.user,
    criteria: [{ criterion }],
    generation: 0,
    at,
  });
  return { c, post, staff, learner, at, item, criterion, grade };
}

test("assessment incompleteness crosses HTTP as a conflict, not an internal failure", async () => {
  const { post, staff, grade } = await fixture();
  const response = await post("/grades/release", grade, staff.cookie);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: "CONFLICT" });
});

test("a stale competency start cannot return after grading switches away and back", async () => {
  const { c, post, staff, learner, item, grade } = await fixture();
  const evidence = (await c.Grading._getGrade(grade))[0]!.evidence;
  await c.Grading.configure({
    item,
    method: "POINTS",
    maxPoints: 10,
    generation: 0,
    discard: true,
    expectedCount: 1,
  });
  await c.Grading.configure({
    item,
    method: "COMPETENCY",
    maxPoints: 10,
    generation: 1,
    discard: false,
    expectedCount: 0,
  });

  const stale = await post(
    "/grades/record",
    { learner: learner.user, item, evidence, generation: 0 },
    staff.cookie,
  );
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ error: "CONFLICT" });
  expect(await c.Grading._getGradesForItem({ item })).toEqual([]);

  const missing = await post(
    "/grades/record",
    { learner: learner.user, item, evidence },
    staff.cookie,
  );
  expect(missing.status).toBe(400);
});

test("a grading setup confirmation deletes nothing when the reviewed count has changed", async () => {
  const { c, post, staff, learner, item } = await fixture();
  const added = await post(
    "/grades/record",
    { learner: learner.user, item, evidence: "", generation: 0 },
    staff.cookie,
  );
  expect(added.status).toBe(200);
  expect(await c.Grading._getGradesForItem({ item })).toHaveLength(2);

  const staleConfirmation = await post(
    "/grades/configure-method",
    {
      item,
      method: "POINTS",
      maxPoints: 10,
      generation: 0,
      discard: true,
      expectedCount: 1,
    },
    staff.cookie,
  );
  expect(staleConfirmation.status).toBe(409);
  expect(await staleConfirmation.json()).toMatchObject({ error: "CONFLICT" });
  expect(await c.Grading._getConfiguration({ item })).toEqual([
    { item, method: "COMPETENCY", generation: 0, maxPoints: 100 },
  ]);
  expect(await c.Grading._getGradesForItem({ item })).toHaveLength(2);
});

test("points setup, zero grading, release visibility, and maximum reset are enforced over HTTP", async () => {
  const { c, post, staff, learner, item, grade } = await fixture();
  const evidence = (await c.Grading._getGrade(grade))[0]!.evidence;
  const refused = await post(
    "/grades/configure-method",
    { item, method: "POINTS", maxPoints: 10, generation: 0, discard: false },
    staff.cookie,
  );
  expect(refused.status).toBe(409);

  const configured = await post(
    "/grades/configure-method",
    {
      item,
      method: "POINTS",
      maxPoints: 10,
      generation: 0,
      discard: true,
      expectedCount: 1,
    },
    staff.cookie,
  );
  expect(configured.status).toBe(200);
  expect(await configured.json()).toMatchObject({ method: "POINTS", maxPoints: 10, generation: 1 });

  const recorded = await post(
    "/marks/record",
    {
      learner: learner.user,
      item,
      evidence,
      score: 0,
      feedback: "A real zero",
      generation: 1,
      version: 0,
    },
    staff.cookie,
  );
  expect(recorded.status).toBe(200);
  const mark = (await recorded.json()) as { mark: string; version: number };
  expect(await (await post("/marks/for-me", {}, learner.cookie)).json()).toEqual({ marks: [] });

  const released = await post("/marks/release", mark, staff.cookie);
  expect(released.status).toBe(200);
  expect(await (await post("/marks/for-me", {}, learner.cookie)).json()).toMatchObject({
    marks: [{ mark: mark.mark, score: 0, scored: true, outOf: 10, status: "RELEASED" }],
  });

  const resetWithoutConfirmation = await post(
    "/grades/configure-method",
    { item, method: "POINTS", maxPoints: 100, generation: 1, discard: false },
    staff.cookie,
  );
  expect(resetWithoutConfirmation.status).toBe(409);
  const invalidMaximum = await post(
    "/grades/configure-method",
    {
      item,
      method: "POINTS",
      maxPoints: 0,
      generation: 1,
      discard: true,
      expectedCount: 1,
    },
    staff.cookie,
  );
  expect(invalidMaximum.status).toBe(400);
});

test("invalid standard content crosses HTTP as an invalid request", async () => {
  const { post, staff } = await fixture();
  const response = await post(
    "/grades/define-standard",
    { ...standardContent, referenceUrl: "javascript:alert(1)" },
    staff.cookie,
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: "INVALID_REQUEST" });
});

test("historical ownership cannot reveal newly selected criteria on archived work", async () => {
  const { c, post, staff, learner, at, item, criterion, grade } = await fixture();
  const saved = await c.Grading.save({
    ...grade,
    grader: staff.user,
    judgments: [{ criterion, rating: "COMPETENT", feedback: "Released feedback" }],
    feedback: "",
    at,
  });
  await c.Grading.release({ ...saved, grader: staff.user, at });
  await c.Assigning.archive({ assignment: item, at });
  await c.Itemizing.removeCriterion({ criterion });
  const next = await c.StandardSetting.define({
    ...standardContent,
    name: "Unreleased staff-only rubric",
  });
  await c.Itemizing.addCriterion({ item, basis: next.edition, position: 0 });
  const response = await post("/grades/item", { item }, learner.cookie);
  const body = await response.json();
  // Either refuse this current-setup route or return only owned historical definitions.
  expect(JSON.stringify(body)).not.toContain("Unreleased staff-only rubric");
});

test("archived supporting work remains readable only to its assessed learner", async () => {
  const { c, post, staff, learner, at, item, criterion, grade } = await fixture();
  const saved = await c.Grading.save({
    ...grade,
    grader: staff.user,
    judgments: [{ criterion, rating: "COMPETENT", feedback: "Released" }],
    feedback: "",
    at,
  });
  await c.Grading.release({ ...saved, grader: staff.user, at });
  await c.Assigning.archive({ assignment: item, at });
  const response = await post("/assignments/get", { assignment: item }, learner.cookie);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    assignment: { assignment: item, status: "ARCHIVED" },
    canSubmit: false,
  });
  const other = await c.Authenticating.register({
    username: "otherreader",
    email: "otherreader@example.edu",
    password: "password123",
  });
  const seats = await c.Rostering.importSeats({
    rows: [{ email: "otherreader@example.edu", kind: "STUDENT" }],
  });
  await c.Rostering.claimSeat({ seat: seats.created[0]._id, user: other.user });
  const login = await post("/auth/login", { username: "otherreader", password: "password123" });
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  expect(await (await post("/assignments/get", { assignment: item }, cookie)).json()).toEqual({
    assignment: null,
    canSubmit: false,
  });
  expect(
    (
      await post(
        "/assignments/submit",
        { assignment: item, content: "No new work" },
        learner.cookie,
      )
    ).status,
  ).toBe(404);
});

test("an archived assignment remains readable only to the learner with a released point grade", async () => {
  const { c, post, staff, learner, at, item, grade } = await fixture();
  const evidence = (await c.Grading._getGrade(grade))[0]!.evidence;
  await c.Grading.configure({
    item,
    method: "POINTS",
    maxPoints: 10,
    generation: 0,
    discard: true,
    expectedCount: 1,
  });
  const mark = await c.Grading.recordMark({
    learner: learner.user,
    item,
    evidence,
    grader: staff.user,
    score: 8.5,
    feedback: "Released numeric feedback",
    generation: 1,
    version: 0,
    at,
  });
  await c.Grading.releaseMark({ ...mark, at });
  await c.Assigning.archive({ assignment: item, at });

  const owned = await post("/assignments/get", { assignment: item }, learner.cookie);
  expect(owned.status).toBe(200);
  expect(await owned.json()).toMatchObject({
    assignment: { assignment: item, status: "ARCHIVED" },
    canSubmit: false,
  });
  const history = await post("/marks/for-me", {}, learner.cookie);
  expect(await history.json()).toMatchObject({
    marks: [{ item, score: 8.5, outOf: 10, status: "RELEASED" }],
  });

  const other = await c.Authenticating.register({
    username: "othernumericreader",
    email: "othernumericreader@example.edu",
    password: "password123",
  });
  const seats = await c.Rostering.importSeats({
    rows: [{ email: "othernumericreader@example.edu", kind: "STUDENT" }],
  });
  await c.Rostering.claimSeat({ seat: seats.created[0]._id, user: other.user });
  const login = await post("/auth/login", {
    username: "othernumericreader",
    password: "password123",
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  expect(await (await post("/assignments/get", { assignment: item }, cookie)).json()).toEqual({
    assignment: null,
    canSubmit: false,
  });
  expect(
    (
      await post(
        "/assignments/submit",
        { assignment: item, content: "No work after archival" },
        learner.cookie,
      )
    ).status,
  ).toBe(404);
});

test("learner point-grade reads never expose a draft score hidden by excusal", async () => {
  const { c, post, staff, learner, at, item, grade } = await fixture();
  const evidence = (await c.Grading._getGrade(grade))[0]!.evidence;
  await c.Grading.configure({
    item,
    method: "POINTS",
    maxPoints: 10,
    generation: 0,
    discard: true,
    expectedCount: 1,
  });
  let mark = await c.Grading.recordMark({
    learner: learner.user,
    item,
    evidence,
    grader: staff.user,
    score: 6.75,
    feedback: "Private draft score",
    generation: 1,
    version: 0,
    at,
  });
  mark = await c.Grading.excuseMark({
    learner: learner.user,
    item,
    evidence,
    grader: staff.user,
    feedback: "Excused",
    generation: 1,
    mark: mark.mark,
    version: mark.version,
    at,
  });

  const response = await post("/marks/for-me", {}, learner.cookie);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    marks: [{ mark: mark.mark, score: 0, scored: false, status: "EXCUSED" }],
  });
  mark = await c.Grading.restoreExcusedMark({ ...mark, at });
  expect((await c.Grading._getMark(mark))[0]).toMatchObject({
    score: 6.75,
    scored: true,
    status: "DRAFT",
  });
});

test("grading-only staff can read assignment evidence without assignment administration", async () => {
  const { c, post, item, learner, grade } = await fixture();
  const user = await c.Authenticating.register({
    username: "onlygrader",
    email: "onlygrader@example.edu",
    password: "password123",
  });
  const role = await c.Roling.defineRole({ name: "Assessment authority", capabilities: ["grade"] });
  await c.Roling.assign({ user: user.user, role: role.role, context: "commons" });
  const login = await post("/auth/login", { username: "onlygrader", password: "password123" });
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  expect((await post("/assignments/staff-summary", { assignment: item }, cookie)).status).toBe(200);
  expect((await post("/submissions/for-assignment", { assignment: item }, cookie)).status).toBe(
    200,
  );
  expect((await post("/grades/for-item", { item }, cookie)).status).toBe(200);
  expect((await post("/grades/detail", grade, cookie)).status).toBe(200);
  expect((await post("/assignments/archive", { assignment: item }, cookie)).status).toBe(403);
  expect(
    (
      await post(
        "/assignments/set-due-override",
        { assignment: item, assignee: learner.user, dueAt: "2090-01-01T00:00:00Z" },
        cookie,
      )
    ).status,
  ).toBe(403);
});

test("new validation and version refusals retain their public HTTP categories", async () => {
  const { c, post, staff, grade, criterion, item, at } = await fixture();
  const standard = await c.StandardSetting.define(standardContent);
  const requests: [string, unknown, number][] = [
    [
      "/grades/save",
      {
        ...grade,
        version: grade.version + 1,
        judgments: [{ criterion, rating: "NUMERIC", feedback: "" }],
        feedback: "",
      },
      400,
    ],
    ["/grades/add-criterion", { item, basis: standard.edition, position: -1 }, 400],
    [
      "/grades/revise-standard",
      { ...standardContent, standard: "unknown", expectedEdition: standard.edition },
      404,
    ],
    [
      "/grades/revise-standard",
      { ...standardContent, standard: standard.standard, expectedEdition: "stale-edition" },
      409,
    ],
  ];
  await c.Grading.save({ ...grade, grader: staff.user, judgments: [], feedback: "Saved", at });
  requests.push(["/grades/save", { ...grade, judgments: [], feedback: "Stale" }, 409]);
  for (const [path, body, expectedStatus] of requests) {
    const response = await post(path, body, staff.cookie);
    expect(response.status, path).toBe(expectedStatus);
    expect(await response.json()).toEqual({
      error:
        expectedStatus === 400
          ? "INVALID_REQUEST"
          : expectedStatus === 409
            ? "CONFLICT"
            : "NOT_FOUND",
    });
  }
});
