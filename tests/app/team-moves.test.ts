import { afterAll, describe, expect, test } from "vite-plus/test";
import { stopTestDb } from "../../src/concepts/testing.ts";
import { reusableFixture } from "../support/fixtures.ts";
import { assignmentFields, buildTeamClassroom, post } from "../support/team-classroom.ts";

afterAll(stopTestDb);

type Person = { user: string; cookie: string };
type Attempt = {
  submission: string;
  artifacts: string[];
  submittedAt: string;
  number: number;
  status: string;
};
type GradeRow = {
  grade: string;
  learner: string;
  evidence: string;
  grader: string;
  status: string;
  version: number;
  feedback: string;
  judgments: { criterion: string; score: number }[];
};

/** The team classroom with a ten-point setup on the exercise, which each student submits. */
const classroom = reusableFixture(async () => {
  const room = await buildTeamClassroom();
  const setup = (
    await post(
      room.edge,
      "/grades/configure-setup",
      {
        item: room.exercise,
        method: "POINTS",
        revision: 0,
        criteria: [{ kind: "POINTS", name: "Overall", maxPoints: 10, position: 0 }],
      },
      room.dana.cookie,
    )
  ).body as { criteria: { criterion: string }[] };
  return { ...room, criterion: setup.criteria[0].criterion };
});

type Room = Awaited<ReturnType<typeof classroom>>;

/** Record and save one assessment of a student's own attempt, and release it when asked. */
const assess = async (
  room: Room,
  student: Person,
  evidence: string,
  score: number,
  feedback: string,
  released: boolean,
) => {
  const started = (
    await post(
      room.edge,
      "/grades/record",
      { learner: student.user, item: room.exercise, evidence, revision: 1 },
      room.noah.cookie,
    )
  ).body as { grade: string; version: number };
  const saved = (
    await post(
      room.edge,
      "/grades/save",
      {
        grade: started.grade,
        version: started.version,
        judgments: [{ kind: "POINTS", criterion: room.criterion, score }],
        feedback,
      },
      room.noah.cookie,
    )
  ).body as { version: number };
  if (released)
    await post(
      room.edge,
      "/grades/release",
      { grade: started.grade, version: saved.version },
      room.noah.cookie,
    );
  return started.grade;
};

const toEachSection = async (room: Room) => {
  await post(
    room.edge,
    "/assignments/revise",
    {
      ...assignmentFields,
      assignment: room.exercise,
      title: "Exercise 1",
      submittedBy: "SECTION",
    },
    room.dana.cookie,
  );
  await room.edge.application.whenIdle();
};

const move = async (room: Room, as: Person = room.dana) => {
  const answer = await post(
    room.edge,
    "/submissions/move-to-sections",
    { assignment: room.exercise },
    as.cookie,
  );
  await room.edge.application.whenIdle();
  return answer;
};

const attemptsOf = async (room: Room, through: Person) =>
  (
    await post(
      room.edge,
      "/submissions/attempts",
      { assignment: room.exercise, submitter: through.user },
      room.dana.cookie,
    )
  ).body.attempts as Attempt[];

const page = async (room: Room) =>
  (
    await post(
      room.edge,
      "/submissions/for-assignment",
      { assignment: room.exercise },
      room.dana.cookie,
    )
  ).body as {
    unmoved: { student: string; section: string; submission: string }[];
    submissions: { submitter: string; submission: string }[];
  };

const gradesOn = async (room: Room) =>
  (await post(room.edge, "/grades/for-item", { item: room.exercise }, room.dana.cookie)).body
    .grades as GradeRow[];

describe("moving earlier submissions to sections", () => {
  test("each member's attempt becomes the section's, in the order submitted, with its paper, time, and a draft copy of its assessment", async () => {
    const room = await classroom();
    const { edge, noah, sam, maya, ben, leo, first, second, exercise } = room;
    const sams = await room.submit(exercise, sam, "Sam's exercise");
    const mayas = await room.submit(exercise, maya, "Maya's exercise");
    const samsSecond = await room.submit(exercise, sam, "Sam's exercise, revised");
    const bens = await room.submit(exercise, ben, "Ben's exercise");
    const leos = await room.submit(exercise, leo, "Leo's exercise");
    const own = [...(await attemptsOf(room, sam)), ...(await attemptsOf(room, maya))].sort(
      (left, right) => left.submittedAt.localeCompare(right.submittedAt),
    );
    const samsGrade = await assess(room, sam, sams, 8, "Clear argument.", true);
    await toEachSection(room);

    expect((await page(room)).unmoved).toEqual([
      { student: sam.user, section: first, submission: sams },
      { student: maya.user, section: first, submission: mayas },
      { student: sam.user, section: first, submission: samsSecond },
      { student: ben.user, section: second, submission: bens },
    ]);
    expect(await attemptsOf(room, sam)).toEqual([]);

    expect(await move(room)).toMatchObject({ status: 200, body: { assignment: exercise } });

    const moved = await attemptsOf(room, maya);
    expect(moved.map((attempt) => attempt.number)).toEqual([1, 2, 3]);
    expect(moved.map((attempt) => [attempt.artifacts, attempt.submittedAt])).toEqual(
      own.map((attempt) => [attempt.artifacts, attempt.submittedAt]),
    );
    expect((await attemptsOf(room, ben)).map((attempt) => attempt.number)).toEqual([1]);
    expect((await attemptsOf(room, leo)).map((attempt) => attempt.submission)).toEqual([leos]);
    expect((await page(room)).unmoved).toEqual([]);

    const copies = await gradesOn(room);
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({
      learner: first,
      evidence: moved[0].submission,
      grader: noah.user,
      status: "DRAFT",
      feedback: "Clear argument.",
      judgments: [{ criterion: room.criterion, score: 8 }],
    });

    const original = (await post(edge, "/grades/detail", { grade: samsGrade }, noah.cookie)).body
      .assessments as GradeRow[];
    expect(original[0]).toMatchObject({ learner: sam.user, evidence: sams, status: "RELEASED" });
    expect(
      await room.edge.application.concepts.Submitting._getLatest({
        assignment: exercise,
        submitter: sam.user,
      }),
    ).toHaveLength(1);
  });

  test("a second press writes nothing", async () => {
    const room = await classroom();
    const { sam, maya, exercise } = room;
    await assess(room, sam, await room.submit(exercise, sam, "Sam's"), 8, "Clear.", true);
    await room.submit(exercise, maya, "Maya's");
    await toEachSection(room);
    await move(room);
    const attempts = await attemptsOf(room, sam);
    const copies = await gradesOn(room);

    expect(await move(room)).toMatchObject({ status: 200 });

    expect(await attemptsOf(room, sam)).toEqual(attempts);
    expect(await gradesOn(room)).toEqual(copies);
  });

  test("a copy that staff edited is not overwritten", async () => {
    const room = await classroom();
    const { edge, noah, sam, exercise } = room;
    await assess(room, sam, await room.submit(exercise, sam, "Sam's"), 8, "Clear.", true);
    await toEachSection(room);
    await move(room);
    const [copy] = await gradesOn(room);
    const edited = await post(
      edge,
      "/grades/save",
      {
        grade: copy.grade,
        version: copy.version,
        judgments: [{ kind: "POINTS", criterion: room.criterion, score: 5 }],
        feedback: "Regraded for the team.",
      },
      noah.cookie,
    );
    expect(edited.status).toBe(200);

    await move(room);

    expect((await gradesOn(room))[0]).toMatchObject({
      feedback: "Regraded for the team.",
      judgments: [{ score: 5 }],
    });
  });

  test("a copy recorded but never saved is filled on the next press", async () => {
    const room = await classroom();
    const { edge, noah, sam, first, exercise } = room;
    const sams = await room.submit(exercise, sam, "Sam's");
    await assess(room, sam, sams, 8, "Clear.", false);
    await toEachSection(room);
    const concepts = edge.application.concepts;
    const [own] = await concepts.Submitting._getAttempts({
      assignment: exercise,
      submitter: sam.user,
    });
    const { submission } = await concepts.Submitting.submit({
      assignment: exercise,
      submitter: first,
      artifact: own.artifacts[0],
      at: new Date(own.submittedAt),
    });
    const [source] = await concepts.Grading._getGradesForLearner({ learner: sam.user });
    await concepts.Grading.record({
      learner: first,
      item: exercise,
      evidence: submission,
      grader: noah.user,
      method: source.method,
      setupRevision: source.setupRevision,
      criteria: source.criteria,
      at: new Date(),
    });
    expect((await gradesOn(room))[0]).toMatchObject({ version: 1, judgments: [] });

    await move(room);

    expect(await gradesOn(room)).toHaveLength(1);
    expect((await gradesOn(room))[0]).toMatchObject({
      evidence: submission,
      feedback: "Clear.",
      judgments: [{ score: 8 }],
    });
    expect(await attemptsOf(room, sam)).toHaveLength(1);
  });

  test("two members assessed differently leave two draft copies on the section's attempts", async () => {
    const room = await classroom();
    const { sam, maya, first, exercise } = room;
    await assess(room, sam, await room.submit(exercise, sam, "Sam's"), 9, "Strong.", true);
    await assess(room, maya, await room.submit(exercise, maya, "Maya's"), 6, "Thin.", false);
    await toEachSection(room);
    await move(room);

    const [samsCopy, mayasCopy] = await attemptsOf(room, sam);
    const scoreOn = Object.fromEntries(
      (await gradesOn(room)).map((row) => [
        row.evidence,
        [row.learner, row.status, row.judgments[0].score],
      ]),
    );
    expect(scoreOn).toEqual({
      [samsCopy.submission]: [first, "DRAFT", 9],
      [mayasCopy.submission]: [first, "DRAFT", 6],
    });
  });

  test("released copies reach every member", async () => {
    const room = await classroom();
    const { edge, dana, sam, maya, ada, exercise } = room;
    await assess(room, sam, await room.submit(exercise, sam, "Sam's"), 8, "Clear.", true);
    await toEachSection(room);
    await move(room);
    for (const member of [sam, maya, ada])
      expect((await post(edge, "/grades/for-me", {}, member.cookie)).body.grades).toEqual([]);

    expect(await post(edge, "/grades/release-item", { item: exercise }, dana.cookie)).toMatchObject(
      { status: 200 },
    );

    for (const member of [sam, maya, ada]) {
      const mine = (await post(edge, "/grades/for-me", {}, member.cookie)).body
        .grades as GradeRow[];
      expect(mine.map((row) => [row.status, row.feedback])).toEqual([["RELEASED", "Clear."]]);
    }
  });

  test("only course managers move, and an assignment each student submits has nothing to move", async () => {
    const room = await classroom();
    const { edge, dana, noah, sam, exercise } = room;
    const sams = await room.submit(exercise, sam, "Sam's");

    for (const caller of [noah, sam])
      expect(await move(room, caller)).toMatchObject({ status: 403, body: { error: "FORBIDDEN" } });
    expect(
      await post(edge, "/submissions/move-to-sections", { assignment: "missing" }, dana.cookie),
    ).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });

    expect(await move(room)).toMatchObject({ status: 200 });
    expect((await attemptsOf(room, sam)).map((attempt) => attempt.submission)).toEqual([sams]);
    expect((await page(room)).unmoved).toEqual([]);
  });
});
