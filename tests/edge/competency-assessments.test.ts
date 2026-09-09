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
