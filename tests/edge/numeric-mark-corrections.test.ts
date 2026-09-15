import { afterAll, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

afterAll(stopTestDb);

interface Actor {
  user: string;
  cookie: string;
}

interface GradeRef {
  grade: string;
  version: number;
  method?: "COMPETENCY" | "POINTS";
}

interface PointCriterion {
  kind: "POINTS";
  criterion: string;
  position: number;
  name: string;
  maxPoints: number;
}

interface GradeRelease {
  revision: number;
  grader: string;
  status: "RELEASED" | "EXCUSED";
  judgments: { kind: "POINTS"; criterion: string; score: number }[];
  feedback: string;
  releasedAt: string;
  score: number;
  outOf: number;
  scored: boolean;
}

interface GradeRow {
  grade: string;
  learner: string;
  item: string;
  evidence: string;
  grader: string;
  method: "POINTS";
  setupRevision: number;
  criteria: PointCriterion[];
  judgments: { kind: "POINTS"; criterion: string; score: number }[];
  feedback: string;
  status: "DRAFT" | "RELEASED" | "EXCUSED";
  version: number;
  score: number;
  outOf: number;
  scored: boolean;
  history: GradeRelease[];
}

async function body<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function fixture(name: string) {
  const edge = createEdge(mongoImplementations(await testDb()), "http://127.0.0.1");
  const concepts = edge.application.concepts;
  async function post(path: string, input: unknown, cookie = "") {
    return edge.fetch(
      new Request(`http://127.0.0.1/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(input),
      }),
    );
  }
  async function actor(role: string, student = false): Promise<Actor> {
    const username = `${name}-${role}`;
    const email = `${username}@example.edu`;
    const { user } = await concepts.Authenticating.register({
      username,
      email,
      password: "password123",
    });
    await concepts.Profiling.createProfile({ user, displayName: username });
    if (student) {
      const seats = await concepts.Rostering.importSeats({ rows: [{ email, kind: "STUDENT" }] });
      await concepts.Rostering.claimSeat({ seat: seats.created[0]._id, user });
    }
    const login = await post("/auth/login", { username, password: "password123" });
    return { user, cookie: login.headers.get("set-cookie")!.split(";")[0]! };
  }

  const staff = await actor("staff");
  const learner = await actor("learner", true);
  const other = await actor("other", true);
  const at = new Date();
  const { assignment: item } = await concepts.Assigning.createDraft({
    author: staff.user,
    title: `Numeric assessment ${name}`,
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
  await concepts.Assigning.publish({ assignment: item, at });

  const configuredResponse = await post(
    "/grades/configure-setup",
    {
      item,
      method: "POINTS",
      revision: 0,
      criteria: [{ kind: "POINTS", name: "Overall", maxPoints: 10, position: 0 }],
    },
    staff.cookie,
  );
  expect(configuredResponse.status).toBe(200);
  const setup = await body<{
    item: string;
    method: "POINTS";
    revision: number;
    maxPoints: number;
    criteria: PointCriterion[];
  }>(configuredResponse);
  expect(setup).toMatchObject({ item, method: "POINTS", revision: 1, maxPoints: 10 });
  expect(setup.criteria).toHaveLength(1);

  const evidence = await concepts.Submitting.submit({
    assignment: item,
    submitter: learner.user,
    artifact: `${name}-learner-work-1`,
    at,
  });
  const otherEvidence = await concepts.Submitting.submit({
    assignment: item,
    submitter: other.user,
    artifact: `${name}-other-work`,
    at,
  });
  return {
    concepts,
    post,
    staff,
    learner,
    other,
    item,
    revision: setup.revision,
    criterion: setup.criteria[0]!.criterion,
    evidence: evidence.submission,
    otherEvidence: otherEvidence.submission,
    at,
  };
}

async function record(
  post: (path: string, input: unknown, cookie?: string) => Promise<Response>,
  staff: Actor,
  input: { learner: string; item: string; evidence: string; revision: number },
): Promise<GradeRef> {
  const response = await post("/grades/record", input, staff.cookie);
  expect(response.status).toBe(200);
  const grade = await body<GradeRef>(response);
  expect(grade.method).toBe("POINTS");
  return grade;
}

async function save(
  post: (path: string, input: unknown, cookie?: string) => Promise<Response>,
  staff: Actor,
  grade: GradeRef,
  criterion: string,
  score: number,
  feedback: string,
): Promise<GradeRef> {
  const response = await post(
    "/grades/save",
    {
      grade: grade.grade,
      version: grade.version,
      judgments: [{ kind: "POINTS", criterion, score }],
      feedback,
    },
    staff.cookie,
  );
  expect(response.status).toBe(200);
  return body<GradeRef>(response);
}

async function release(
  post: (path: string, input: unknown, cookie?: string) => Promise<Response>,
  staff: Actor,
  grade: GradeRef,
): Promise<GradeRef> {
  const response = await post("/grades/release", grade, staff.cookie);
  expect(response.status).toBe(200);
  return body<GradeRef>(response);
}

test("an archived assessment reopens, corrects, and rereleases its frozen denominator and history", async () => {
  const { post, staff, learner, other, item, revision, criterion, evidence, otherEvidence } =
    await fixture("archived-correction");
  let grade = await record(post, staff, { learner: learner.user, item, evidence, revision });
  grade = await save(post, staff, grade, criterion, 8, "Initial score");
  grade = await release(post, staff, grade);

  expect(
    await body<{ grades: GradeRow[] }>(await post("/grades/for-me", {}, learner.cookie)),
  ).toMatchObject({
    grades: [{ grade: grade.grade, score: 8, outOf: 10, scored: true, status: "RELEASED" }],
  });

  const changedSetup = await post(
    "/grades/configure-setup",
    {
      item,
      method: "POINTS",
      revision,
      criteria: [{ kind: "POINTS", name: "Overall", maxPoints: 100, position: 0 }],
    },
    staff.cookie,
  );
  expect(changedSetup.status).toBe(200);
  expect(await body<unknown>(changedSetup)).toMatchObject({
    item,
    method: "POINTS",
    revision: 2,
    maxPoints: 100,
  });
  expect((await post("/assignments/archive", { assignment: item }, staff.cookie)).status).toBe(200);

  const reopened = await post(
    "/grades/record",
    { learner: learner.user, item, evidence, revision: 0 },
    staff.cookie,
  );
  expect(reopened.status).toBe(200);
  expect(await body<GradeRef>(reopened)).toEqual({ ...grade, method: "POINTS" });

  const rejectedNew = await post(
    "/grades/record",
    { learner: other.user, item, evidence: otherEvidence, revision: 2 },
    staff.cookie,
  );
  expect(rejectedNew.status).toBe(404);
  expect(await body<unknown>(rejectedNew)).toEqual({ error: "NOT_FOUND" });

  const retracted = await post("/grades/retract", grade, staff.cookie);
  expect(retracted.status).toBe(200);
  grade = await body<GradeRef>(retracted);
  expect(await body<unknown>(await post("/grades/for-me", {}, learner.cookie))).toEqual({
    grades: [],
  });

  grade = await save(post, staff, grade, criterion, 9, "Corrected after archival");
  grade = await release(post, staff, grade);
  const detailResponse = await post("/grades/detail", { grade: grade.grade }, staff.cookie);
  expect(detailResponse.status).toBe(200);
  const detail = await body<{ assessments: GradeRow[] }>(detailResponse);
  expect(detail.assessments).toHaveLength(1);
  expect(detail.assessments[0]).toMatchObject({
    grade: grade.grade,
    learner: learner.user,
    item,
    evidence,
    grader: staff.user,
    method: "POINTS",
    setupRevision: 1,
    criteria: [{ kind: "POINTS", criterion, name: "Overall", maxPoints: 10, position: 0 }],
    judgments: [{ kind: "POINTS", criterion, score: 9 }],
    feedback: "Corrected after archival",
    status: "RELEASED",
    score: 9,
    outOf: 10,
    scored: true,
    history: [
      {
        revision: 1,
        grader: staff.user,
        status: "RELEASED",
        judgments: [{ kind: "POINTS", criterion, score: 8 }],
        feedback: "Initial score",
        score: 8,
        outOf: 10,
        scored: true,
      },
      {
        revision: 2,
        grader: staff.user,
        status: "RELEASED",
        judgments: [{ kind: "POINTS", criterion, score: 9 }],
        feedback: "Corrected after archival",
        score: 9,
        outOf: 10,
        scored: true,
      },
    ],
  });
  expect(detail.assessments[0]!.history[0]!.releasedAt).toBeTruthy();
  expect(detail.assessments[0]!.history[1]!.releasedAt).toBeTruthy();

  expect(await body<unknown>(await post("/grades/for-me", {}, other.cookie))).toEqual({
    grades: [],
  });
  const hidden = await post("/grades/detail", { grade: grade.grade }, other.cookie);
  expect(hidden.status).toBe(404);
  expect(await body<unknown>(hidden)).toEqual({ error: "NOT_FOUND" });
});

test("separate submission attempts create separate assessment identities", async () => {
  const { concepts, post, staff, learner, item, revision, criterion, evidence, at } =
    await fixture("separate-attempts");
  const second = await concepts.Submitting.submit({
    assignment: item,
    submitter: learner.user,
    artifact: "second-attempt-work",
    at,
  });
  let firstGrade = await record(post, staff, { learner: learner.user, item, evidence, revision });
  let secondGrade = await record(post, staff, {
    learner: learner.user,
    item,
    evidence: second.submission,
    revision,
  });
  expect(firstGrade.grade).not.toBe(secondGrade.grade);
  firstGrade = await save(post, staff, firstGrade, criterion, 6, "First attempt");
  secondGrade = await save(post, staff, secondGrade, criterion, 9, "Second attempt");
  firstGrade = await release(post, staff, firstGrade);
  secondGrade = await release(post, staff, secondGrade);

  const response = await post("/grades/for-item", { item }, staff.cookie);
  expect(response.status).toBe(200);
  const rows = (await body<{ grades: GradeRow[] }>(response)).grades;
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.grade === firstGrade.grade)).toMatchObject({
    evidence,
    score: 6,
    history: [{ revision: 1 }],
  });
  expect(rows.find((row) => row.grade === secondGrade.grade)).toMatchObject({
    evidence: second.submission,
    score: 9,
    history: [{ revision: 1 }],
  });
});

test("blank and explicit zero differ while learner reads expose only their released assessments", async () => {
  const {
    concepts,
    post,
    staff,
    learner,
    other,
    item,
    revision,
    criterion,
    evidence,
    otherEvidence,
    at,
  } = await fixture("zero-and-privacy");
  let zero = await record(post, staff, { learner: learner.user, item, evidence, revision });

  const blankDetail = await body<{ assessments: GradeRow[] }>(
    await post("/grades/detail", { grade: zero.grade }, staff.cookie),
  );
  expect(blankDetail.assessments[0]).toMatchObject({
    judgments: [],
    score: 0,
    outOf: 10,
    scored: false,
    status: "DRAFT",
  });
  const blankRelease = await post("/grades/release", zero, staff.cookie);
  expect(blankRelease.status).toBe(409);
  expect(await body<unknown>(blankRelease)).toEqual({ error: "CONFLICT" });

  zero = await save(post, staff, zero, criterion, 0, "A submitted zero");
  const zeroDetail = await body<{ assessments: GradeRow[] }>(
    await post("/grades/detail", { grade: zero.grade }, staff.cookie),
  );
  expect(zeroDetail.assessments[0]).toMatchObject({
    judgments: [{ kind: "POINTS", criterion, score: 0 }],
    score: 0,
    outOf: 10,
    scored: true,
    status: "DRAFT",
  });
  zero = await release(post, staff, zero);

  let otherGrade = await record(post, staff, {
    learner: other.user,
    item,
    evidence: otherEvidence,
    revision,
  });
  otherGrade = await save(post, staff, otherGrade, criterion, 7, "Other learner");
  otherGrade = await release(post, staff, otherGrade);

  const second = await concepts.Submitting.submit({
    assignment: item,
    submitter: learner.user,
    artifact: "private-draft-attempt",
    at,
  });
  let privateDraft = await record(post, staff, {
    learner: learner.user,
    item,
    evidence: second.submission,
    revision,
  });
  privateDraft = await save(post, staff, privateDraft, criterion, 5, "Still private");

  const own = await body<{ grades: GradeRow[] }>(await post("/grades/for-me", {}, learner.cookie));
  expect(own.grades).toHaveLength(1);
  expect(own.grades[0]).toMatchObject({
    grade: zero.grade,
    learner: learner.user,
    grader: staff.user,
    score: 0,
    scored: true,
    status: "RELEASED",
  });
  expect(own.grades.some(({ grade }) => grade === privateDraft.grade)).toBe(false);
  expect(own.grades.some(({ grade }) => grade === otherGrade.grade)).toBe(false);

  const others = await body<{ grades: GradeRow[] }>(await post("/grades/for-me", {}, other.cookie));
  expect(others.grades).toHaveLength(1);
  expect(others.grades[0]).toMatchObject({
    grade: otherGrade.grade,
    learner: other.user,
    score: 7,
    status: "RELEASED",
  });
  expect((await post("/grades/detail", { grade: privateDraft.grade }, learner.cookie)).status).toBe(
    404,
  );
});

test("new creation rejects evidence owned by another learner without creating or rebinding a grade", async () => {
  const { post, staff, learner, item, revision, otherEvidence } =
    await fixture("cross-student-evidence");
  const rejected = await post(
    "/grades/record",
    { learner: learner.user, item, evidence: otherEvidence, revision },
    staff.cookie,
  );
  expect(rejected.status).toBe(404);
  expect(await body<unknown>(rejected)).toEqual({ error: "NOT_FOUND" });

  const itemGrades = await post("/grades/for-item", { item }, staff.cookie);
  expect(itemGrades.status).toBe(200);
  expect(await body<unknown>(itemGrades)).toEqual({ grades: [] });
});
