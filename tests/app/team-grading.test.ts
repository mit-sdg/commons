import { afterAll, describe, expect, test } from "vite-plus/test";
import { stopTestDb } from "../../src/concepts/testing.ts";
import { reusableFixture } from "../support/fixtures.ts";
import { assignmentFields, buildTeamClassroom, post } from "../support/team-classroom.ts";

afterAll(stopTestDb);

type Person = { user: string; cookie: string };
type GradeRow = { grade: string; learner: string; item: string; status: string; score: number };

/** The team classroom with a ten-point setup on both assignments. */
const classroom = reusableFixture(async () => {
  const room = await buildTeamClassroom();
  const criterion: Record<string, string> = {};
  for (const item of [room.project, room.exercise]) {
    const setup = (
      await post(
        room.edge,
        "/grades/configure-setup",
        {
          item,
          method: "POINTS",
          revision: 0,
          criteria: [{ kind: "POINTS", name: "Overall", maxPoints: 10, position: 0 }],
        },
        room.dana.cookie,
      )
    ).body as { criteria: { criterion: string }[] };
    criterion[item] = setup.criteria[0].criterion;
  }
  return { ...room, criterion };
});

type Room = Awaited<ReturnType<typeof classroom>>;

const record = (room: Room, item: string, through: Person, evidence: string, as: Person) =>
  post(
    room.edge,
    "/grades/record",
    { learner: through.user, item, evidence, revision: 1 },
    as.cookie,
  );

/** Record, save, and release one assessment, addressed through one student. */
const release = async (
  room: Room,
  item: string,
  through: Person,
  evidence: string,
  score: number,
  as: Person = room.noah,
) => {
  const started = (await record(room, item, through, evidence, as)).body as {
    grade: string;
    version: number;
  };
  const saved = (
    await post(
      room.edge,
      "/grades/save",
      {
        grade: started.grade,
        version: started.version,
        judgments: [{ kind: "POINTS", criterion: room.criterion[item], score }],
        feedback: "Well argued.",
      },
      as.cookie,
    )
  ).body as { version: number };
  const released = await post(
    room.edge,
    "/grades/release",
    { grade: started.grade, version: saved.version },
    as.cookie,
  );
  expect(released.status).toBe(200);
  return started.grade;
};

const gradesForMe = async (room: Room, student: Person) =>
  ((await post(room.edge, "/grades/for-me", {}, student.cookie)).body.grades as GradeRow[]).map(
    (row) => [row.item, row.grade, row.score],
  );

const detail = (room: Room, grade: string, as: Person) =>
  post(room.edge, "/grades/detail", { grade }, as.cookie);

describe("grading an assignment submitted by each section", () => {
  test("one assessment is recorded for the section, whichever member the grader names", async () => {
    const room = await classroom();
    const { edge, noah, sam, maya, ada, first, project } = room;
    const evidence = await room.submit(project, sam, "Our project");

    const started = (await record(room, project, maya, evidence, noah)).body;
    expect(started).toHaveProperty("grade");
    for (const member of [sam, ada])
      expect((await record(room, project, member, evidence, noah)).body).toEqual(started);

    const rows = (await post(edge, "/grades/for-item", { item: project }, noah.cookie)).body
      .grades as GradeRow[];
    expect(rows.map((row) => [row.learner, row.grade])).toEqual([[first, started.grade]]);
  });

  test("one release reaches every member, and nobody outside the section", async () => {
    const room = await classroom();
    const { edge, dana, noah, sam, maya, ada, ben, leo, project } = room;
    const evidence = await room.submit(project, sam, "Our project");
    const grade = await release(room, project, maya, evidence, 9);

    for (const member of [sam, maya, ada]) {
      expect(await gradesForMe(room, member)).toEqual([[project, grade, 9]]);
      expect((await detail(room, grade, member)).status).toBe(200);
    }
    for (const outsider of [ben, leo]) {
      expect(await gradesForMe(room, outsider)).toEqual([]);
      expect(await detail(room, grade, outsider)).toMatchObject({
        status: 404,
        body: { error: "NOT_FOUND" },
      });
    }

    const byStudent = (await post(edge, "/grades/for-student", { learner: ada.user }, noah.cookie))
      .body.grades as GradeRow[];
    expect(byStudent.map((row) => row.grade)).toEqual([grade]);
    const gradebook = (await post(edge, "/grades/gradebook", {}, dana.cookie)).body.gradebook as {
      learners: { user: string; grades: GradeRow[] }[];
    };
    const inBook = Object.fromEntries(
      gradebook.learners.map((row) => [row.user, row.grades.map((entry) => entry.grade)]),
    );
    expect(inBook[sam.user]).toEqual([grade]);
    expect(inBook[maya.user]).toEqual([grade]);
    expect(inBook[ben.user]).toEqual([]);
  });

  test("a student moved after a release reads the new section's assessment, not the old one", async () => {
    const room = await classroom();
    const { edge, dana, sam, ben, first, project } = room;
    const tidepool = await release(
      room,
      project,
      sam,
      await room.submit(project, sam, "Tidepool"),
      9,
    );
    const lantern = await release(
      room,
      project,
      ben,
      await room.submit(project, ben, "Lantern"),
      6,
    );
    expect(await gradesForMe(room, ben)).toEqual([[project, lantern, 6]]);

    await post(
      edge,
      "/roster/move-section",
      { seat: await room.seatOf(ben.user), section: first },
      dana.cookie,
    );
    await edge.application.whenIdle();

    expect(await gradesForMe(room, ben)).toEqual([[project, tidepool, 9]]);
    expect((await detail(room, tidepool, ben)).status).toBe(200);
    expect((await detail(room, lantern, ben)).status).toBe(404);
  });

  test("a student in no section is assessed alone", async () => {
    const room = await classroom();
    const { edge, noah, sam, leo, project } = room;
    const grade = await release(room, project, leo, await room.submit(project, leo, "Solo"), 7);

    expect(await gradesForMe(room, leo)).toEqual([[project, grade, 7]]);
    expect(await gradesForMe(room, sam)).toEqual([]);
    const rows = (await post(edge, "/grades/for-item", { item: project }, noah.cookie)).body
      .grades as GradeRow[];
    expect(rows.map((row) => row.learner)).toEqual([leo.user]);
  });

  test("an attempt of another section is not evidence for this one", async () => {
    const room = await classroom();
    const { noah, sam, ben, project } = room;
    const lantern = await room.submit(project, ben, "Lantern");

    expect(await record(room, project, sam, lantern, noah)).toMatchObject({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
  });
});

describe("delegating an assignment submitted by each section", () => {
  const delegations = async (room: Room, as: Person = room.dana) =>
    (
      (await post(room.edge, "/delegation/for-item", { item: room.project }, as.cookie)).body
        .delegations as { learner: string; grader: string }[]
    ).map((row) => [row.learner, row.grader]);

  test("a grader is named for the section through any member, and cleared through any member", async () => {
    const room = await classroom();
    const { edge, dana, noah, maya, ada, first, project } = room;

    expect(
      await post(
        edge,
        "/delegation/set",
        { item: project, learner: maya.user, grader: noah.user },
        dana.cookie,
      ),
    ).toMatchObject({ status: 200 });
    expect(await delegations(room)).toEqual([[first, noah.user]]);

    expect(
      await post(edge, "/delegation/clear", { item: project, learner: ada.user }, dana.cookie),
    ).toMatchObject({ status: 200 });
    expect(await delegations(room)).toEqual([]);
  });

  test("spreading the class names each section once and a student in no section alone", async () => {
    const room = await classroom();
    const { edge, dana, noah, sam, maya, ada, ben, priya, leo, first, second, project } = room;

    const spread = await post(
      edge,
      "/delegation/spread",
      {
        item: project,
        learners: [sam.user, maya.user, ada.user, ben.user, priya.user, leo.user],
        graders: [noah.user],
        replace: false,
      },
      dana.cookie,
    );
    expect(spread.status).toBe(200);
    expect(await delegations(room)).toEqual([
      [first, noah.user],
      [second, noah.user],
      [leo.user, noah.user],
    ]);
  });

  test("a grader who is a student grades another section when named, and never their own", async () => {
    const room = await classroom();
    const { edge, dana, sam, maya, ben, priya, leo, first, project } = room;
    const tidepool = await room.submit(project, sam, "Tidepool");
    const lantern = await room.submit(project, ben, "Lantern");
    for (const member of [sam, ben])
      await post(
        edge,
        "/delegation/set",
        { item: project, learner: member.user, grader: priya.user },
        dana.cookie,
      );

    const attempts = (through: Person) =>
      post(
        edge,
        "/submissions/attempts",
        { assignment: project, submitter: through.user },
        priya.cookie,
      );
    expect((await attempts(maya)).status).toBe(200);
    expect((await record(room, project, maya, tidepool, priya)).body).toHaveProperty("grade");

    expect(await attempts(ben)).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    expect(await record(room, project, ben, lantern, priya)).toMatchObject({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
    expect(await attempts(leo)).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });

    const rows = (await post(edge, "/grades/for-item", { item: project }, priya.cookie)).body
      .grades as GradeRow[];
    expect(rows.map((row) => row.learner)).toEqual([first]);
    const page = (
      await post(edge, "/submissions/for-assignment", { assignment: project }, priya.cookie)
    ).body as { assigned: { assignee: string }[]; submissions: { submitter: string }[] };
    expect(page.assigned.map((row) => row.assignee).sort()).toEqual(
      [sam.user, maya.user, room.ada.user].sort(),
    );
    expect(page.submissions.map((row) => row.submitter)).toEqual([first]);
    expect(await delegations(room, priya)).toEqual([[first, priya.user]]);
  });
});

describe("an assignment changed to each section after it was graded", () => {
  test("the staff lists leave out a member's own earlier work, which stays stored", async () => {
    const room = await classroom();
    const { edge, dana, noah, sam, leo, exercise } = room;
    const own = await room.submit(exercise, sam, "Sam's own exercise");
    const solo = await room.submit(exercise, leo, "Leo's own exercise");
    const grade = await release(room, exercise, sam, own, 8);
    await post(
      edge,
      "/delegation/set",
      { item: exercise, learner: sam.user, grader: noah.user },
      dana.cookie,
    );
    expect(await gradesForMe(room, sam)).toEqual([[exercise, grade, 8]]);

    await post(
      edge,
      "/assignments/revise",
      { ...assignmentFields, assignment: exercise, title: "Exercise 1", submittedBy: "SECTION" },
      dana.cookie,
    );
    await edge.application.whenIdle();

    expect(await gradesForMe(room, sam)).toEqual([]);
    expect((await detail(room, grade, sam)).status).toBe(404);
    expect((await detail(room, grade, noah)).status).toBe(200);
    const rows = (await post(edge, "/grades/for-item", { item: exercise }, noah.cookie)).body
      .grades as GradeRow[];
    expect(rows).toEqual([]);
    const page = (
      await post(edge, "/submissions/for-assignment", { assignment: exercise }, noah.cookie)
    ).body as { submissions: { submitter: string; submission: string }[] };
    expect(page.submissions.map((row) => [row.submitter, row.submission])).toEqual([
      [leo.user, solo],
    ]);
    expect(
      (await post(edge, "/delegation/for-item", { item: exercise }, dana.cookie)).body.delegations,
    ).toEqual([]);
  });
});

describe("grading an assignment submitted by each student", () => {
  test("keeps each student's assessment their own, whatever their section", async () => {
    const room = await classroom();
    const { edge, noah, sam, maya, exercise } = room;
    const grade = await release(room, exercise, sam, await room.submit(exercise, sam, "Sam's"), 8);

    expect(await gradesForMe(room, sam)).toEqual([[exercise, grade, 8]]);
    expect(await gradesForMe(room, maya)).toEqual([]);
    expect((await detail(room, grade, maya)).status).toBe(404);
    const rows = (await post(edge, "/grades/for-item", { item: exercise }, noah.cookie)).body
      .grades as GradeRow[];
    expect(rows.map((row) => row.learner)).toEqual([sam.user]);
  });
});
