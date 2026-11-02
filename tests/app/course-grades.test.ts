import { createCommonsFixture } from "../support/fixtures.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import type { CoursePolicy } from "../../src/computations/course-grades.ts";
import { gradePoliciesForCourseManagers } from "../../src/migrations/20261102T000100-grade-policies-for-course-managers.ts";

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

function guide(): CoursePolicy {
  return {
    ratings: { DEFICIENT: 1, EMERGENT: 2, COMPETENT: 3, EXPERT: 4 },
    missing: 0,
    late: "missing",
    skillWeights: {},
    groups: [{ key: "g", name: "Personal", weight: 100, combine: "average", rows: [] }],
    attendance: [],
    gradeSet: "letters",
    lines: {
      letters: [
        { grade: "A", at: 3.4 },
        { grade: "B", at: 2.8 },
        { grade: "C", at: 2.2 },
        { grade: "D", at: 1.6 },
      ],
      plusMinus: [{ grade: "A", at: 3.6 }],
    },
  };
}

interface Card {
  status: string;
  average: number | null;
  letter: string | null;
  groups: { rows: { title: string; value: number | null }[] }[] | null;
}

describe("course grades", () => {
  let edge: Edge;
  const cookies: Record<string, string> = {};
  const users: Record<string, string> = {};
  let exercise = "";
  const call = async (who: string, path: string, body: Body = {}) =>
    (await (await post(edge, path, body, cookies[who])).json()) as Body;
  const mine = async (who: string) =>
    (await call(who, "/course-grades/mine")).courseGrade as { state: string; card: Card | null };

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

  /** Hands in and releases one rating for a student on the exercise. */
  async function rate(student: string, rating: string) {
    const concepts = edge.application.concepts;
    const at = new Date(past(3));
    const { submission } = await concepts.Submitting.submit({
      assignment: exercise,
      submitter: users[student]!,
      artifact: `${student}-work`,
      at,
    });
    const recorded = await concepts.Grading.record({
      learner: users[student]!,
      item: exercise,
      evidence: submission,
      grader: users.manager!,
      method: "COMPETENCY",
      setupRevision: 1,
      criteria: [
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
      ],
      at,
    });
    const saved = await concepts.Grading.save({
      ...recorded,
      grader: users.manager!,
      judgments: [{ kind: "COMPETENCY", criterion: "framing", rating, feedback: "" }],
      feedback: "",
      at,
    });
    return concepts.Grading.release({ ...saved, grader: users.manager!, at });
  }

  beforeAll(async () => {
    edge = (await createCommonsFixture()).edge;
    await person("manager", ["course:manage", "grade", "grade-policies"]);
    await person("grader", ["grade"]);
    await person("tara", ["grade"], true);
    await person("ana", [], true);
    await person("ben", [], true);
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
    for (const student of ["ana", "ben", "tara"])
      await concepts.Assigning.assign({ assignment: exercise, assignee: users[student]!, at });
    await rate("ana", "EXPERT");
    await rate("ben", "DEFICIENT");
    await edge.application.whenIdle();
  });

  const policy = () => {
    const spec = guide();
    spec.groups[0]!.rows = [{ key: "e1", type: "assignment", assignment: exercise, weight: 1 }];
    return spec;
  };

  test("a grader enrolled as a student is refused the class's grades; a grader reads but can't change them", async () => {
    expect(await call("tara", "/course-grades/read")).toEqual({ error: "FORBIDDEN" });
    expect(await call("tara", "/grades/gradebook")).toEqual({ error: "FORBIDDEN" });
    expect(await call("grader", "/grades/gradebook")).toHaveProperty("gradebook");
    const read = (await call("grader", "/course-grades/read")) as {
      page: { inputs: { students: unknown[] } };
    };
    expect(read.page.inputs.students).toHaveLength(3);
    expect(
      await call("grader", "/course-grades/create", { name: "Mine", specification: policy() }),
    ).toEqual({
      error: "FORBIDDEN",
    });
    for (const [path, body] of [
      ["/course-grades/override", { student: users.ana, value: "A", reason: "r", policy: "p" }],
      [
        "/course-grades/release",
        { dueBy: past(0), breakdown: true, letter: true, includeOverrides: true, release: [] },
      ],
      ["/grades/export", {}],
    ] as const)
      expect(await call("grader", path, body)).toEqual({ error: "FORBIDDEN" });
  });

  test("a save from an older version is refused, and a malformed policy never saves", async () => {
    const created = await call("manager", "/course-grades/create", {
      name: "Draft",
      specification: policy(),
    });
    expect(created).toMatchObject({ version: 1 });
    expect(
      await call("manager", "/course-grades/save", {
        policy: created.policy,
        version: 1,
        specification: policy(),
      }),
    ).toMatchObject({ version: 2 });
    expect(
      await call("manager", "/course-grades/save", {
        policy: created.policy,
        version: 1,
        specification: policy(),
      }),
    ).toEqual({ error: "CONFLICT" });
    expect(
      await call("manager", "/course-grades/save", {
        policy: created.policy,
        version: 2,
        specification: { ...policy(), late: "never" },
      }),
    ).toEqual({ error: "INVALID_REQUEST" });
    await call("manager", "/course-grades/remove", { policy: created.policy });
  });

  test("a release holds students below C, and a student reads only their own current copy", async () => {
    const settings = { dueBy: past(0), breakdown: true, letter: true, includeOverrides: true };
    expect(await mine("ana")).toEqual({ state: "none", card: null });
    expect(await call("manager", "/course-grades/release", { ...settings, release: [] })).toEqual({
      error: "CONFLICT",
    });
    const { policy: guideId } = await call("manager", "/course-grades/create", {
      name: "Course guide",
      specification: policy(),
    });
    await call("manager", "/course-grades/mark-final", { policy: guideId });
    expect(
      await call("manager", "/course-grades/release", { ...settings, release: [] }),
    ).toHaveProperty("release");
    const ana = await mine("ana");
    expect(ana.state).toBe("released");
    expect(ana.card).toMatchObject({ status: "released", average: 4, letter: "A" });
    expect(ana.card!.groups![0]!.rows).toEqual([
      { title: "Exercise 1", value: 4, points: null, note: null },
    ]);
    expect((await mine("ben")).card).toMatchObject({ status: "held", average: null });
    expect(JSON.stringify(ana)).not.toContain(users.ben!);

    // A later policy edit leaves what students saw unchanged.
    const edited = policy();
    edited.ratings.EXPERT = 3.5;
    await call("manager", "/course-grades/save", {
      policy: guideId,
      version: 1,
      specification: edited,
    });
    expect((await mine("ana")).card!.average).toBe(4);
    // Students reach no policy, version, or other copy by id.
    expect(await call("ana", "/course-grades/policy", { policy: guideId })).toEqual({
      error: "FORBIDDEN",
    });
    expect(await call("ana", "/course-grades/version", { policy: guideId, version: 1 })).toEqual({
      error: "FORBIDDEN",
    });
    expect(await call("ana", "/course-grades/read")).toEqual({ error: "FORBIDDEN" });

    // Update this student replaces one copy; a new release replaces every copy.
    expect(
      await call("manager", "/course-grades/update-student", {
        student: users.ben,
        reason: "Looked at it",
      }),
    ).toHaveProperty("update");
    expect((await mine("ben")).card).toMatchObject({ status: "released", average: 1, letter: "F" });
    expect(
      await call("manager", "/course-grades/update-student", {
        student: users.ben,
        reason: "Again",
      }),
    ).toHaveProperty("update");
    expect((await mine("ben")).card!.status).toBe("released");
    await call("manager", "/course-grades/release", { ...settings, release: [] });
    expect((await mine("ana")).card!.average).toBe(3.5);
    expect((await mine("ben")).card!.status).toBe("held");

    // Hiding shows the withdrawn line.
    await call("manager", "/course-grades/hide");
    expect(await mine("ana")).toEqual({ state: "withdrawn", card: null });
    expect(
      await call("manager", "/course-grades/update-student", { student: users.ana, reason: "r" }),
    ).toEqual({
      error: "CONFLICT",
    });

    const history = (await call("manager", "/course-grades/read")) as {
      page: { releases: { open: boolean; release: { held: Record<string, string[]> } }[] };
    };
    expect(history.page.releases.map((release) => release.open)).toEqual([false, false]);
    expect(Object.keys(history.page.releases[0]!.release.held).sort()).toEqual(
      [users.ben!, users.tara!].sort(),
    );
    expect(JSON.stringify(history.page.releases)).not.toContain('"inputs"');
  });

  test("an override records the grade it replaced, worked out on the server", async () => {
    const { policy: other } = await call("manager", "/course-grades/create", {
      name: "Override check",
      specification: policy(),
    });
    expect(
      await call("manager", "/course-grades/override", {
        student: users.ben,
        value: "C",
        reason: "Strong late work",
        policy: other,
        replaced: "A",
      }),
    ).toEqual({ student: users.ben, value: "C", reason: "Strong late work", replaced: "F" });
    expect(
      await call("manager", "/course-grades/override", {
        student: users.ben,
        value: "C",
        reason: " ",
        policy: other,
      }),
    ).toEqual({ error: "INVALID_REQUEST" });
    const csv = (await call("manager", "/grades/export")).csv as string;
    expect(csv.split("\r\n")[0]).toBe(
      "Student name,Email,Section,Personal,Average,Grade,Policy grade,Reason,Lectures attended,Lectures,Policy,Version,As of",
    );
    expect(csv).toContain("ben,ben@example.edu,,1,1,C,F,Strong late work,0,0,Course guide,2,");
    await call("manager", "/course-grades/clear-override", { student: users.ben });
    expect((await call("manager", "/grades/export")).csv).toContain(
      "ben,ben@example.edu,,1,1,F,F,,0,0",
    );
  });
});

test("the migration gives grade-policies to every role that manages the course", async () => {
  const db = await testDb();
  const roles = db.collection("roling.roles");
  await roles.insertMany([
    { _id: "manager" as never, name: "Manager", capabilities: ["course:manage", "grade"], seq: 1 },
    { _id: "ta" as never, name: "TA", capabilities: ["grade"], seq: 2 },
  ]);
  await gradePoliciesForCourseManagers.up(db);
  await gradePoliciesForCourseManagers.up(db);
  expect(
    await roles
      .find()
      .sort({ seq: 1 })
      .map((role) => role.capabilities)
      .toArray(),
  ).toEqual([["course:manage", "grade", "grade-policies"], ["grade"]]);
});
