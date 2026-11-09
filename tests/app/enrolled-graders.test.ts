import { createCommonsFixture } from "../support/fixtures.ts";
import { stopTestDb } from "../../src/concepts/testing.ts";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";

type Edge = ReturnType<typeof createEdge>;
type Body = Record<string, unknown>;

afterAll(stopTestDb);

const post = (edge: Edge, path: string, body: unknown, cookie?: string) =>
  edge.fetch(
    new Request(`http://edge/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie !== undefined ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

const past = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const criteria = [
  {
    kind: "COMPETENCY",
    criterion: "framing",
    position: 0,
    basis: "framing-v1",
    standard: "pf",
    number: 1,
    name: "Problem framing",
    description: "",
    deficient: "d",
    emergent: "e",
    competent: "c",
    expert: "x",
    referenceUrl: "",
  },
] as const;
const judgments = [{ kind: "COMPETENCY", criterion: "framing", rating: "COMPETENT", feedback: "" }];

/**
 * Tara holds `grade` and is enrolled. Delegating names her the grader of Ana
 * and Ben on the exercise, and also of her own paper; Cal's paper goes to the
 * grader who is not enrolled.
 */
describe("a grader enrolled as a student", () => {
  let edge: Edge;
  let exercise = "";
  const cookies: Record<string, string> = {};
  const users: Record<string, string> = {};
  const grades: Record<string, { grade: string; version: number }> = {};
  const submissions: Record<string, string> = {};
  const call = async (who: string, path: string, body: Body = {}) =>
    (await (await post(edge, path, body, cookies[who])).json()) as Body;

  async function person(name: string, capabilities: string[], student = false) {
    const concepts = edge.application.concepts;
    const password = `pw-${name}-123`;
    const { user } = await concepts.Authenticating.register({
      username: name,
      password,
      email: `${name}@example.edu`,
    });
    await concepts.Profiling.createProfile({ user, displayName: name });
    if (student)
      await concepts.Rostering.enrol({
        user,
        email: `${name}@example.edu`,
        kind: "STUDENT",
        section: null,
      });
    if (capabilities.length > 0) {
      const { role } = await concepts.Roling.ensureRole({ name: `${name}-role`, capabilities });
      await concepts.Roling.assign({ user, context: "commons", role });
    }
    const login = await post(edge, "/auth/login", { username: name, password });
    cookies[name] = login.headers.get("Set-Cookie")?.split(";")[0] as string;
    users[name] = user;
  }

  beforeAll(async () => {
    edge = (await createCommonsFixture()).edge;
    await person("manager", ["course:manage", "grade", "grade-policies"]);
    await person("grader", ["grade"]);
    await person("tara", ["grade"], true);
    for (const name of ["ana", "ben", "cal"]) await person(name, [], true);
    const concepts = edge.application.concepts;
    const at = new Date(past(30));
    ({ assignment: exercise } = await concepts.Assigning.createDraft({
      author: users.manager!,
      title: "Exercise 1",
      instructions: "",
      kind: "EXERCISE",
      availableAt: past(30),
      dueAt: past(2),
      closeAt: past(-60),
      acceptsSubmissions: true,
      audience: "EVERYONE",
      targets: [],
      at,
    }));
    await concepts.Assigning.publish({ assignment: exercise, at });
    await concepts.Itemizing.ensureItem({ item: exercise, label: "Exercise 1" });
    for (const name of ["ana", "ben", "cal", "tara"]) {
      await concepts.Assigning.assign({ assignment: exercise, assignee: users[name]!, at });
      const { submission } = await concepts.Submitting.submit({
        assignment: exercise,
        submitter: users[name]!,
        artifact: `${name}-work`,
        at: new Date(past(3)),
      });
      submissions[name] = submission;
      grades[name] = await concepts.Grading.record({
        learner: users[name]!,
        item: exercise,
        evidence: submission,
        grader: users.manager!,
        method: "COMPETENCY",
        setupRevision: 1,
        criteria: [...criteria],
        at: new Date(past(1)),
      });
    }
    for (const [subject, delegate] of [
      ["ana", "tara"],
      ["ben", "tara"],
      ["tara", "tara"],
      ["cal", "grader"],
    ] as const)
      await concepts.Delegating.delegate({
        item: exercise,
        subject: users[subject]!,
        delegate: users[delegate]!,
      });
    await edge.application.whenIdle();
  });

  const learners = (rows: unknown, field: string) =>
    (rows as Record<string, string>[]).map((row) => row[field]).sort();
  const named = (...names: string[]) => names.map((name) => users[name]).sort();

  test("reads exactly the two classmates delegated to her", async () => {
    const item = await call("tara", "/grades/for-item", { item: exercise });
    expect(learners(item.grades, "learner")).toEqual(named("ana", "ben"));

    const handedIn = await call("tara", "/submissions/for-assignment", { assignment: exercise });
    expect(learners(handedIn.assigned, "assignee")).toEqual(named("ana", "ben"));
    expect(learners(handedIn.submissions, "submitter")).toEqual(named("ana", "ben"));

    const delegations = await call("tara", "/delegation/for-item", { item: exercise });
    expect(learners(delegations.delegations, "learner")).toEqual(named("ana", "ben"));

    for (const name of ["ana", "ben"]) {
      expect(await call("tara", "/grades/detail", { grade: grades[name]!.grade })).toHaveProperty(
        "assessments",
      );
      const byLearner = await call("tara", "/grades/for-student", { learner: users[name] });
      expect(learners(byLearner.grades, "learner")).toEqual(named(name));
      const attempts = await call("tara", "/submissions/attempts", {
        assignment: exercise,
        submitter: users[name],
      });
      expect(attempts.attempts).toHaveLength(1);
      const latest = await call("tara", "/submissions/latest", {
        assignment: exercise,
        submitter: users[name],
      });
      expect(latest.submission).toMatchObject({ submission: submissions[name] });
      const bySubmitter = await call("tara", "/submissions/for-student", {
        submitter: users[name],
      });
      expect(bySubmitter.submissions).toHaveLength(1);
      expect(
        await call("tara", "/submissions/artifact", {
          assignment: exercise,
          submitter: users[name],
          artifact: `${name}-work`,
        }),
      ).not.toEqual({ error: "NOT_FOUND" });
    }
  });

  test("grades exactly the two classmates delegated to her", async () => {
    for (const name of ["ana", "ben"]) {
      const saved = await call("tara", "/grades/save", {
        ...grades[name],
        judgments,
        feedback: "",
      });
      expect(saved).toHaveProperty("version");
      const released = await call("tara", "/grades/release", {
        grade: grades[name]!.grade,
        version: saved.version,
      });
      expect(released).toHaveProperty("version");
      const retracted = await call("tara", "/grades/retract", {
        grade: grades[name]!.grade,
        version: released.version,
      });
      expect(retracted).toHaveProperty("version");
      grades[name] = { grade: grades[name]!.grade, version: retracted.version as number };
      expect(
        await call("tara", "/grades/record", {
          learner: users[name],
          item: exercise,
          evidence: submissions[name],
          revision: 1,
        }),
      ).toMatchObject({ grade: grades[name]!.grade });
    }
  });

  test("is refused a third classmate's paper and her own", async () => {
    for (const name of ["cal", "tara"]) {
      const { grade, version } = grades[name]!;
      expect(await call("tara", "/grades/detail", { grade })).toEqual({ error: "NOT_FOUND" });
      for (const path of [
        "/grades/release",
        "/grades/retract",
        "/grades/restore-excused",
        "/grades/discard",
      ])
        expect(await call("tara", path, { grade, version })).toEqual({ error: "NOT_FOUND" });
      expect(
        await call("tara", "/grades/save", { grade, version, judgments, feedback: "" }),
      ).toEqual({ error: "NOT_FOUND" });
      expect(await call("tara", "/grades/excuse", { grade, version, feedback: "" })).toEqual({
        error: "NOT_FOUND",
      });
      expect(
        await call("tara", "/grades/record", {
          learner: users[name],
          item: exercise,
          evidence: submissions[name],
          revision: 1,
        }),
      ).toEqual({ error: "NOT_FOUND" });
      const byLearner = await call("tara", "/grades/for-student", { learner: users[name] });
      expect(byLearner.grades).toEqual([]);
    }
    for (const path of ["/submissions/attempts", "/submissions/latest"])
      expect(await call("tara", path, { assignment: exercise, submitter: users.cal })).toEqual({
        error: "NOT_FOUND",
      });
    expect(await call("tara", "/submissions/for-student", { submitter: users.cal })).toEqual({
      submissions: [],
    });
    expect(
      await call("tara", "/submissions/artifact", {
        assignment: exercise,
        submitter: users.cal,
        artifact: "cal-work",
      }),
    ).toEqual({ error: "NOT_FOUND" });
  });

  test("still reads her own work as a student", async () => {
    const attempts = await call("tara", "/submissions/attempts", {
      assignment: exercise,
      submitter: users.tara,
    });
    expect(attempts.attempts).toHaveLength(1);
    expect(await call("tara", "/grades/for-me")).toHaveProperty("grades");
  });

  test("is refused the class: course grades, the gradebook, the download, attendance, and changing who grades whom", async () => {
    for (const [path, body] of [
      ["/course-grades/read", {}],
      ["/grades/gradebook", {}],
      ["/grades/export", {}],
      ["/live/lectures/attendance", {}],
      ["/grades/release-item", { item: exercise }],
      ["/delegation/set", { item: exercise, learner: users.cal, grader: users.tara }],
      ["/delegation/clear", { item: exercise, learner: users.cal }],
      [
        "/delegation/spread",
        { item: exercise, learners: [users.cal], graders: [users.tara], replace: true },
      ],
      ["/delegation/clear-item", { item: exercise }],
    ] as const)
      expect(await call("tara", path, body)).toEqual({ error: "FORBIDDEN" });
  });

  test("a grader who is not enrolled is unchanged", async () => {
    const item = await call("grader", "/grades/for-item", { item: exercise });
    expect(learners(item.grades, "learner")).toEqual(named("ana", "ben", "cal", "tara"));
    const handedIn = await call("grader", "/submissions/for-assignment", { assignment: exercise });
    expect(learners(handedIn.submissions, "submitter")).toEqual(named("ana", "ben", "cal", "tara"));
    const delegations = await call("grader", "/delegation/for-item", { item: exercise });
    expect(delegations.delegations).toHaveLength(4);
    for (const name of ["ana", "tara"])
      expect(await call("grader", "/grades/detail", { grade: grades[name]!.grade })).toHaveProperty(
        "assessments",
      );
    const saved = await call("grader", "/grades/save", {
      ...grades.cal,
      judgments,
      feedback: "",
    });
    expect(saved).toHaveProperty("version");
    expect(await call("grader", "/grades/gradebook")).toHaveProperty("gradebook");
    expect(await call("grader", "/live/lectures/attendance")).toHaveProperty("students");
  });
});
