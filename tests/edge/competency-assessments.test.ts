import { afterAll, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

afterAll(stopTestDb);

interface Actor {
  user: string;
  cookie: string;
}

interface CompetencyCriterion {
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

interface Setup {
  item: string;
  label: string;
  status: "ACTIVE" | "ARCHIVED";
  method: "COMPETENCY" | "POINTS";
  revision: number;
  criteria: CompetencyCriterion[];
  maxPoints: number;
}

interface GradeRef {
  grade: string;
  version: number;
  method: "COMPETENCY" | "POINTS";
}

interface GradeRow {
  grade: string;
  learner: string;
  item: string;
  evidence: string;
  grader: string;
  method: "COMPETENCY" | "POINTS";
  setupRevision: number;
  criteria: CompetencyCriterion[];
  judgments: {
    kind: "COMPETENCY";
    criterion: string;
    rating: string;
    feedback: string;
  }[];
  feedback: string;
  status: "DRAFT" | "RELEASED" | "EXCUSED";
  version: number;
  history: {
    revision: number;
    grader: string;
    status: "RELEASED" | "EXCUSED";
    judgments: GradeRow["judgments"];
    feedback: string;
  }[];
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function fixture(name: string) {
  const edge = createEdge(mongoImplementations(await testDb()), "http://127.0.0.1");
  const { concepts } = edge.application;
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
      await concepts.Rostering.claimSeat({ seat: seats.created[0]!._id, user });
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
    title: `Competency assessment ${name}`,
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
  expect(
    (
      await post(
        "/grades/configure-item",
        { item, label: `Competency assessment ${name}` },
        staff.cookie,
      )
    ).status,
  ).toBe(200);

  const definitions = [
    {
      name: "Argumentation",
      description: "Build a supported claim.",
      deficient: "No claim",
      emergent: "Partial claim",
      competent: "Supported claim",
      expert: "Nuanced claim",
      referenceUrl: "https://example.edu/argument",
    },
    {
      name: "Evidence",
      description: "Use relevant evidence.",
      deficient: "No evidence",
      emergent: "Some evidence",
      competent: "Relevant evidence",
      expert: "Compelling evidence",
      referenceUrl: "",
    },
  ];
  const editions: { standard: string; edition: string }[] = [];
  for (const definition of definitions) {
    const response = await post("/grades/define-standard", definition, staff.cookie);
    expect(response.status).toBe(200);
    editions.push(await json(response));
  }

  const first = await concepts.Submitting.submit({
    assignment: item,
    submitter: learner.user,
    artifact: `${name}-work-1`,
    at,
  });
  const second = await concepts.Submitting.submit({
    assignment: item,
    submitter: learner.user,
    artifact: `${name}-work-2`,
    at,
  });
  const otherAttempt = await concepts.Submitting.submit({
    assignment: item,
    submitter: other.user,
    artifact: `${name}-other-work`,
    at,
  });
  return {
    edge,
    concepts,
    post,
    staff,
    learner,
    other,
    item,
    editions,
    first: first.submission,
    second: second.submission,
    otherAttempt: otherAttempt.submission,
  };
}

async function configure(
  post: (path: string, input: unknown, cookie?: string) => Promise<Response>,
  staff: Actor,
  item: string,
  revision: number,
  criteria: unknown,
) {
  const response = await post(
    "/grades/configure-setup",
    { item, method: "COMPETENCY", revision, criteria },
    staff.cookie,
  );
  return { response, body: await json<Setup | { error: string }>(response) };
}

async function record(
  post: (path: string, input: unknown, cookie?: string) => Promise<Response>,
  staff: Actor,
  input: { learner: string; item: string; evidence: string; revision: number },
) {
  const response = await post("/grades/record", input, staff.cookie);
  return { response, body: await json<GradeRef | { error: string }>(response) };
}

test("atomic setup validates nested input and returns correctly ordered expanded editions", async () => {
  const { post, staff, item, editions } = await fixture("setup-validation");
  const configured = await configure(post, staff, item, 0, [
    { kind: "COMPETENCY", basis: editions[0]!.edition, position: 1 },
    { kind: "COMPETENCY", basis: editions[1]!.edition, position: 0 },
  ]);
  expect(configured.response.status).toBe(200);
  if ("error" in configured.body) throw new Error(configured.body.error);
  expect(configured.body.criteria).toEqual([
    expect.objectContaining({
      basis: editions[1]!.edition,
      position: 0,
      name: "Evidence",
      competent: "Relevant evidence",
    }),
    expect.objectContaining({
      basis: editions[0]!.edition,
      position: 1,
      name: "Argumentation",
      competent: "Supported claim",
    }),
  ]);
  const read = await post("/grades/item", { item }, staff.cookie);
  expect(read.status).toBe(200);
  expect(await json(read)).toEqual(configured.body);

  for (const criteria of [
    [null],
    [{ kind: "COMPETENCY", basis: 42, position: 0 }],
    [{ kind: "COMPETENCY", basis: "missing-edition", position: 0 }],
  ]) {
    const invalid = await configure(post, staff, item, configured.body.revision, criteria);
    expect(invalid.response.status).toBe(400);
  }
  expect(await json(await post("/grades/item", { item }, staff.cookie))).toEqual(configured.body);
});

test("released competency attempts retain snapshots and every correction release", async () => {
  const { post, staff, learner, item, editions, first, second } = await fixture("history");
  const configured = await configure(post, staff, item, 0, [
    { kind: "COMPETENCY", basis: editions[0]!.edition, position: 0 },
  ]);
  if ("error" in configured.body) throw new Error(configured.body.error);
  const criterion = configured.body.criteria[0]!;
  const started = await record(post, staff, {
    learner: learner.user,
    item,
    evidence: first,
    revision: configured.body.revision,
  });
  if ("error" in started.body) throw new Error(started.body.error);
  const save = async (grade: GradeRef, rating: string, feedback: string) => {
    const response = await post(
      "/grades/save",
      {
        grade: grade.grade,
        version: grade.version,
        judgments: [
          {
            kind: "COMPETENCY",
            criterion: criterion.criterion,
            rating,
            feedback: `${feedback} detail`,
          },
        ],
        feedback,
      },
      staff.cookie,
    );
    expect(response.status).toBe(200);
    return {
      ...(await json<Pick<GradeRef, "grade" | "version">>(response)),
      method: "COMPETENCY",
    } as GradeRef;
  };
  const transition = async (path: string, grade: GradeRef) => {
    const response = await post(path, grade, staff.cookie);
    expect(response.status).toBe(200);
    return {
      ...(await json<Pick<GradeRef, "grade" | "version">>(response)),
      method: "COMPETENCY",
    } as GradeRef;
  };

  let grade = await save(started.body, "EMERGENT", "Initial");
  grade = await transition("/grades/release", grade);
  expect(await json(await post("/grades/for-me", {}, learner.cookie))).toMatchObject({
    grades: [{ grade: grade.grade, status: "RELEASED" }],
  });

  const revised = await post(
    "/grades/revise-standard",
    {
      standard: editions[0]!.standard,
      expectedEdition: editions[0]!.edition,
      name: "Argumentation revised",
      description: "New meaning",
      deficient: "New deficient",
      emergent: "New emergent",
      competent: "New competent",
      expert: "New expert",
      referenceUrl: "",
    },
    staff.cookie,
  );
  expect(revised.status).toBe(200);
  const newEdition = await json<{ edition: string }>(revised);
  const changed = await configure(post, staff, item, configured.body.revision, [
    { kind: "COMPETENCY", basis: newEdition.edition, position: 0 },
  ]);
  expect(changed.response.status).toBe(200);
  if ("error" in changed.body) throw new Error(changed.body.error);

  const reopened = await record(post, staff, {
    learner: learner.user,
    item,
    evidence: first,
    revision: 0,
  });
  expect(reopened.response.status).toBe(200);
  expect(reopened.body).toEqual(grade);
  grade = await transition("/grades/retract", grade);
  grade = await save(grade, "EXPERT", "Corrected");
  grade = await transition("/grades/release", grade);

  const oldDetail = await json<{ assessments: GradeRow[] }>(
    await post("/grades/detail", { grade: grade.grade }, staff.cookie),
  );
  expect(oldDetail.assessments[0]).toMatchObject({
    setupRevision: configured.body.revision,
    criteria: [{ name: "Argumentation", emergent: "Partial claim" }],
    judgments: [{ rating: "EXPERT" }],
    history: [{ feedback: "Initial" }, { feedback: "Corrected" }],
  });

  const next = await record(post, staff, {
    learner: learner.user,
    item,
    evidence: second,
    revision: changed.body.revision,
  });
  expect(next.response.status).toBe(200);
  if ("error" in next.body) throw new Error(next.body.error);
  const nextDetail = await json<{ assessments: GradeRow[] }>(
    await post("/grades/detail", { grade: next.body.grade }, staff.cookie),
  );
  expect(nextDetail.assessments[0]).toMatchObject({
    setupRevision: changed.body.revision,
    criteria: [{ name: "Argumentation revised", emergent: "New emergent" }],
    status: "DRAFT",
  });
  expect(next.body.grade).not.toBe(grade.grade);
});

test("stale setup and start writes conflict without changing existing assessments", async () => {
  const { post, staff, learner, item, editions, first, second } = await fixture("conflicts");
  const initial = await configure(post, staff, item, 0, [
    { kind: "COMPETENCY", basis: editions[0]!.edition, position: 0 },
  ]);
  if ("error" in initial.body) throw new Error(initial.body.error);
  const firstGrade = await record(post, staff, {
    learner: learner.user,
    item,
    evidence: first,
    revision: initial.body.revision,
  });
  if ("error" in firstGrade.body) throw new Error(firstGrade.body.error);
  const saved = await post(
    "/grades/save",
    {
      grade: firstGrade.body.grade,
      version: firstGrade.body.version,
      judgments: [
        {
          kind: "COMPETENCY",
          criterion: initial.body.criteria[0]!.criterion,
          rating: "COMPETENT",
          feedback: "Saved before setup edit",
        },
      ],
      feedback: "Keep me",
    },
    staff.cookie,
  );
  expect(saved.status).toBe(200);

  const winner = await configure(post, staff, item, initial.body.revision, [
    { kind: "COMPETENCY", basis: editions[1]!.edition, position: 0 },
  ]);
  expect(winner.response.status).toBe(200);
  const staleSetup = await configure(post, staff, item, initial.body.revision, [
    { kind: "COMPETENCY", basis: editions[0]!.edition, position: 0 },
  ]);
  expect(staleSetup.response.status).toBe(409);
  const staleStart = await record(post, staff, {
    learner: learner.user,
    item,
    evidence: second,
    revision: initial.body.revision,
  });
  expect(staleStart.response.status).toBe(409);
  expect(staleStart.body).toEqual({ error: "CONFLICT" });
  expect(
    await json(await post("/grades/detail", { grade: firstGrade.body.grade }, staff.cookie)),
  ).toMatchObject({ assessments: [{ feedback: "Keep me", setupRevision: initial.body.revision }] });
  expect(
    await json<{ grades: GradeRow[] }>(await post("/grades/for-item", { item }, staff.cookie)),
  ).toMatchObject({ grades: [{ grade: firstGrade.body.grade }] });
});

test("assignment and attempt excusals remain distinct and private", async () => {
  const { post, staff, learner, other, item, editions, first, otherAttempt } =
    await fixture("excusals");
  const setup = await configure(post, staff, item, 0, [
    { kind: "COMPETENCY", basis: editions[0]!.edition, position: 0 },
  ]);
  if ("error" in setup.body) throw new Error(setup.body.error);
  const assignment = await record(post, staff, {
    learner: learner.user,
    item,
    evidence: "",
    revision: setup.body.revision,
  });
  const attempt = await record(post, staff, {
    learner: learner.user,
    item,
    evidence: first,
    revision: setup.body.revision,
  });
  const otherGrade = await record(post, staff, {
    learner: other.user,
    item,
    evidence: otherAttempt,
    revision: setup.body.revision,
  });
  if ("error" in assignment.body || "error" in attempt.body || "error" in otherGrade.body)
    throw new Error("failed to create excusal fixtures");

  const privateSaved = await post(
    "/grades/save",
    {
      grade: attempt.body.grade,
      version: attempt.body.version,
      judgments: [
        {
          kind: "COMPETENCY",
          criterion: setup.body.criteria[0]!.criterion,
          rating: "EXPERT",
          feedback: "private judgment",
        },
      ],
      feedback: "private assessment feedback",
    },
    staff.cookie,
  );
  const privateRef = await json<Pick<GradeRef, "grade" | "version">>(privateSaved);
  const [assignmentExcused, attemptExcused] = await Promise.all([
    post(
      "/grades/excuse",
      {
        grade: assignment.body.grade,
        version: assignment.body.version,
        feedback: "Whole assignment",
      },
      staff.cookie,
    ),
    post(
      "/grades/excuse",
      { grade: privateRef.grade, version: privateRef.version, feedback: "This attempt only" },
      staff.cookie,
    ),
  ]);
  expect(assignmentExcused.status).toBe(200);
  expect(attemptExcused.status).toBe(200);

  const visible = await json<{ grades: GradeRow[] }>(
    await post("/grades/for-me", {}, learner.cookie),
  );
  expect(visible.grades).toHaveLength(2);
  expect(visible.grades).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ evidence: "", status: "EXCUSED", feedback: "Whole assignment" }),
      expect.objectContaining({
        evidence: first,
        status: "EXCUSED",
        feedback: "This attempt only",
      }),
    ]),
  );
  for (const grade of visible.grades) {
    expect(grade.judgments).toEqual([]);
    expect(grade.history.at(-1)?.judgments).toEqual([]);
  }
  expect(await json(await post("/grades/for-me", {}, other.cookie))).toEqual({ grades: [] });
  expect(
    await json(await post("/grades/detail", { grade: attempt.body.grade }, other.cookie)),
  ).toEqual({ error: "NOT_FOUND" });
});
