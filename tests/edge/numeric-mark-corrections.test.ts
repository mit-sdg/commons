import { afterAll, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

afterAll(stopTestDb);

async function fixture(name: string) {
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
  async function actor(role: string, student = false) {
    const username = `${name}-${role}`;
    const email = `${username}@example.edu`;
    const { user } = await c.Authenticating.register({
      username,
      email,
      password: "password123",
    });
    await c.Profiling.createProfile({ user, displayName: username });
    if (student) {
      const seats = await c.Rostering.importSeats({ rows: [{ email, kind: "STUDENT" }] });
      await c.Rostering.claimSeat({ seat: seats.created[0]._id, user });
    }
    const login = await post("/auth/login", { username, password: "password123" });
    return { user, cookie: login.headers.get("set-cookie")!.split(";")[0] };
  }

  const staff = await actor("staff");
  const learner = await actor("learner", true);
  const other = await actor("other", true);
  const at = new Date();
  const { assignment: item } = await c.Assigning.createDraft({
    author: staff.user,
    title: `Numeric correction ${name}`,
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
  await c.Grading.configure({
    item,
    method: "POINTS",
    maxPoints: 10,
    generation: 0,
    discard: true,
    expectedCount: 0,
  });
  const evidence = await c.Submitting.submit({
    assignment: item,
    submitter: learner.user,
    artifact: `${name}-learner-work`,
    at,
  });
  const otherEvidence = await c.Submitting.submit({
    assignment: item,
    submitter: other.user,
    artifact: `${name}-other-work`,
    at,
  });
  return {
    post,
    staff,
    learner,
    other,
    item,
    evidence: evidence.submission,
    otherEvidence: otherEvidence.submission,
  };
}

test("a released archived point grade can be retracted, corrected, and released again", async () => {
  const { post, staff, learner, other, item, evidence } = await fixture("archived-correction");
  const recorded = await post(
    "/marks/record",
    {
      learner: learner.user,
      item,
      evidence,
      score: 8,
      feedback: "Initial score",
      generation: 1,
      version: 0,
    },
    staff.cookie,
  );
  expect(recorded.status).toBe(200);
  let mark = (await recorded.json()) as { mark: string; version: number };
  expect(mark.version).toBe(1);

  const released = await post("/marks/release", mark, staff.cookie);
  expect(released.status).toBe(200);
  mark = (await released.json()) as { mark: string; version: number };
  expect(mark.version).toBe(2);
  expect(await (await post("/marks/for-me", {}, learner.cookie)).json()).toMatchObject({
    marks: [{ mark: mark.mark, score: 8, outOf: 10, status: "RELEASED" }],
  });

  expect((await post("/assignments/archive", { assignment: item }, staff.cookie)).status).toBe(200);
  const retracted = await post("/marks/retract", mark, staff.cookie);
  expect(retracted.status).toBe(200);
  mark = (await retracted.json()) as { mark: string; version: number };
  expect(mark.version).toBe(3);
  expect(await (await post("/marks/for-me", {}, learner.cookie)).json()).toEqual({ marks: [] });

  const corrected = await post(
    "/marks/record",
    {
      learner: learner.user,
      item,
      evidence,
      score: 9,
      feedback: "Corrected after archival",
      generation: 1,
      version: mark.version,
    },
    staff.cookie,
  );
  expect(corrected.status).toBe(200);
  mark = (await corrected.json()) as { mark: string; version: number };
  expect(mark.version).toBe(4);
  expect(await (await post("/marks/for-me", {}, learner.cookie)).json()).toEqual({ marks: [] });

  const rereleased = await post("/marks/release", mark, staff.cookie);
  expect(rereleased.status).toBe(200);
  mark = (await rereleased.json()) as { mark: string; version: number };
  expect(mark.version).toBe(5);
  expect(await (await post("/marks/for-me", {}, learner.cookie)).json()).toMatchObject({
    marks: [{ mark: mark.mark, score: 9, outOf: 10, status: "RELEASED" }],
  });
  expect(await (await post("/marks/for-me", {}, other.cookie)).json()).toEqual({ marks: [] });
});

test("archival still blocks new marks and evidence rebinding", async () => {
  const { post, staff, learner, other, item, evidence, otherEvidence } =
    await fixture("archived-refusals");
  const recorded = await post(
    "/marks/record",
    {
      learner: learner.user,
      item,
      evidence,
      score: 8,
      feedback: "Original",
      generation: 1,
      version: 0,
    },
    staff.cookie,
  );
  let mark = (await recorded.json()) as { mark: string; version: number };
  mark = (await (await post("/marks/release", mark, staff.cookie)).json()) as {
    mark: string;
    version: number;
  };
  expect((await post("/assignments/archive", { assignment: item }, staff.cookie)).status).toBe(200);
  mark = (await (await post("/marks/retract", mark, staff.cookie)).json()) as {
    mark: string;
    version: number;
  };

  const rebound = await post(
    "/marks/record",
    {
      learner: learner.user,
      item,
      evidence: otherEvidence,
      score: 9,
      feedback: "Wrong learner's evidence",
      generation: 1,
      version: mark.version,
    },
    staff.cookie,
  );
  expect(rebound.status).toBe(404);

  const wronglyExcused = await post(
    "/marks/excuse",
    {
      learner: learner.user,
      item,
      evidence: otherEvidence,
      feedback: "Wrong learner's evidence",
      generation: 1,
      mark: mark.mark,
      version: mark.version,
    },
    staff.cookie,
  );
  expect(wronglyExcused.status).toBe(404);

  const created = await post(
    "/marks/record",
    {
      learner: other.user,
      item,
      evidence: otherEvidence,
      score: 7,
      feedback: "Too late",
      generation: 1,
      version: 0,
    },
    staff.cookie,
  );
  expect(created.status).toBe(404);
  const staffView = await post("/marks/for-item", { item }, staff.cookie);
  expect(await staffView.json()).toMatchObject({
    marks: [{ mark: mark.mark, learner: learner.user, evidence, score: 8, status: "DRAFT" }],
  });

  const excused = await post(
    "/marks/excuse",
    {
      learner: learner.user,
      item,
      evidence,
      feedback: "Excused after archival",
      generation: 1,
      mark: mark.mark,
      version: mark.version,
    },
    staff.cookie,
  );
  expect(excused.status).toBe(200);
  mark = (await excused.json()) as { mark: string; version: number };
  expect((await post("/marks/restore-excused", mark, staff.cookie)).status).toBe(200);
});

test("an empty-evidence excusal cannot become a numeric score through correction", async () => {
  const { post, staff, learner, item } = await fixture("empty-excusal");
  const excused = await post(
    "/marks/excuse",
    {
      learner: learner.user,
      item,
      evidence: "",
      feedback: "No submission required",
      generation: 1,
      mark: "",
      version: 0,
    },
    staff.cookie,
  );
  expect(excused.status).toBe(200);
  let mark = (await excused.json()) as { mark: string; version: number };
  expect((await post("/assignments/archive", { assignment: item }, staff.cookie)).status).toBe(200);

  const restored = await post("/marks/restore-excused", mark, staff.cookie);
  expect(restored.status).toBe(200);
  mark = (await restored.json()) as { mark: string; version: number };
  const scoredWithoutWork = await post(
    "/marks/record",
    {
      learner: learner.user,
      item,
      evidence: "",
      score: 9,
      feedback: "Unsupported score",
      generation: 1,
      version: mark.version,
    },
    staff.cookie,
  );
  expect(scoredWithoutWork.status).toBe(404);

  const reexcused = await post(
    "/marks/excuse",
    {
      learner: learner.user,
      item,
      evidence: "",
      feedback: "Still excused",
      generation: 1,
      mark: mark.mark,
      version: mark.version,
    },
    staff.cookie,
  );
  expect(reexcused.status).toBe(200);
  mark = (await reexcused.json()) as { mark: string; version: number };
  expect(mark.version).toBe(3);
  expect((await post("/marks/restore-excused", mark, staff.cookie)).status).toBe(200);
});
