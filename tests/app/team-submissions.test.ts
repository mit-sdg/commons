import { afterAll, describe, expect, test } from "vite-plus/test";
import { stopTestDb } from "../../src/concepts/testing.ts";
import { reusableFixture } from "../support/fixtures.ts";
import { assignmentFields, buildTeamClassroom, post } from "../support/team-classroom.ts";

afterAll(stopTestDb);

const classroom = reusableFixture(buildTeamClassroom);

type Room = Awaited<ReturnType<typeof classroom>>;
type Person = { user: string; cookie: string };

const attemptsOf = async (room: Room, assignment: string, of: Person, as: Person = of) =>
  (
    (await post(room.edge, "/submissions/attempts", { assignment, submitter: of.user }, as.cookie))
      .body.attempts as { submission: string; number: number; artifacts: string[] }[]
  ).map((attempt) => [attempt.number, attempt.submission]);

const latestOf = async (room: Room, assignment: string, of: Person, as: Person = of) => {
  const latest = (
    await post(room.edge, "/submissions/latest", { assignment, submitter: of.user }, as.cookie)
  ).body.submission as { submission: string } | null;
  return latest === null ? null : latest.submission;
};

const listedFor = async (room: Room, of: Person, as: Person = of) =>
  (
    (await post(room.edge, "/submissions/for-student", { submitter: of.user }, as.cookie)).body
      .submissions as { assignment: string; submission: string }[]
  ).map((row) => [row.assignment, row.submission]);

describe("an assignment submitted by each section", () => {
  test("one member submits and every member reads the same attempts", async () => {
    const room = await classroom();
    const { sam, maya, ada, ben, project } = room;

    const one = await room.submit(project, sam, "Our first draft");
    for (const member of [sam, maya, ada]) {
      expect(await attemptsOf(room, project, member)).toEqual([[1, one]]);
      expect(await latestOf(room, project, member)).toBe(one);
      expect(await listedFor(room, member)).toEqual([[project, one]]);
    }
    expect(await attemptsOf(room, project, ben)).toEqual([]);
    expect(await latestOf(room, project, ben)).toBeNull();
    expect(await listedFor(room, ben)).toEqual([]);

    const two = await room.submit(project, ada, "Our final draft");
    for (const member of [sam, maya, ada]) {
      expect(await attemptsOf(room, project, member)).toEqual([
        [1, one],
        [2, two],
      ]);
      expect(await latestOf(room, project, member)).toBe(two);
    }
  });

  test("a member reads a teammate's paper and learns who handed it in; another section cannot", async () => {
    const room = await classroom();
    const { edge, sam, maya, ben, project } = room;
    await room.submit(project, sam, "Our first draft");
    const attempts = (
      await post(
        edge,
        "/submissions/attempts",
        { assignment: project, submitter: maya.user },
        maya.cookie,
      )
    ).body.attempts as { artifacts: string[] }[];
    const artifact = attempts[0].artifacts[0];

    const paper = await post(
      edge,
      "/submissions/artifact",
      { assignment: project, submitter: maya.user, artifact },
      maya.cookie,
    );
    expect(paper.body.post).toMatchObject({ author: sam.user, content: "Our first draft" });

    expect(
      await post(
        edge,
        "/submissions/artifact",
        { assignment: project, submitter: sam.user, artifact },
        ben.cookie,
      ),
    ).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
  });

  test("a student in no section submits alone", async () => {
    const room = await classroom();
    const { sam, leo, project } = room;
    const own = await room.submit(project, leo, "Leo's project");

    expect(await attemptsOf(room, project, leo)).toEqual([[1, own]]);
    expect(await attemptsOf(room, project, sam)).toEqual([]);
  });

  test("work follows a section's current members", async () => {
    const room = await classroom();
    const { edge, dana, sam, ben, first, project } = room;
    const tidepool = await room.submit(project, sam, "Tidepool's project");
    const lantern = await room.submit(project, ben, "Lantern's project");
    expect(await attemptsOf(room, project, ben)).toEqual([[1, lantern]]);

    await post(
      edge,
      "/roster/move-section",
      { seat: await room.seatOf(ben.user), section: first },
      dana.cookie,
    );
    await edge.application.whenIdle();

    expect(await attemptsOf(room, project, ben)).toEqual([[1, tidepool]]);
    expect(await latestOf(room, project, ben)).toBe(tidepool);
    expect(await listedFor(room, ben)).toEqual([[project, tidepool]]);
  });

  test("staff read the section's attempts through any member, and the list names who submits for each student", async () => {
    const room = await classroom();
    const { edge, dana, noah, sam, maya, leo, first, project } = room;
    const one = await room.submit(project, sam, "Our first draft");
    const own = await room.submit(project, leo, "Leo's project");

    expect(await attemptsOf(room, project, maya, noah)).toEqual([[1, one]]);
    expect(await latestOf(room, project, maya, noah)).toBe(one);
    expect(await listedFor(room, maya, noah)).toEqual([[project, one]]);

    const page = (
      await post(edge, "/submissions/for-assignment", { assignment: project }, dana.cookie)
    ).body as {
      assigned: { assignee: string; submitter: string }[];
      submissions: { submitter: string; submission: string }[];
    };
    const submitterOf = Object.fromEntries(
      page.assigned.map((row) => [row.assignee, row.submitter]),
    );
    expect(submitterOf[sam.user]).toBe(first);
    expect(submitterOf[maya.user]).toBe(first);
    expect(submitterOf[leo.user]).toBe(leo.user);
    expect(page.submissions.map((row) => [row.submitter, row.submission])).toEqual([
      [first, one],
      [leo.user, own],
    ]);
  });

  test("an assignment switched to each section after students submitted reads the section's work only", async () => {
    const room = await classroom();
    const { edge, dana, sam, maya, exercise } = room;
    const own = await room.submit(exercise, sam, "Sam's own exercise");
    expect(await attemptsOf(room, exercise, sam)).toEqual([[1, own]]);

    expect(
      await post(
        edge,
        "/assignments/revise",
        { ...assignmentFields, assignment: exercise, title: "Exercise 1", submittedBy: "SECTION" },
        dana.cookie,
      ),
    ).toMatchObject({ status: 200 });
    await edge.application.whenIdle();

    expect(await attemptsOf(room, exercise, sam)).toEqual([]);
    expect(await listedFor(room, sam)).toEqual([]);
    const shared = await room.submit(exercise, maya, "The team's exercise");
    expect(await attemptsOf(room, exercise, sam)).toEqual([[1, shared]]);
  });
});

describe("an assignment submitted by each student", () => {
  test("keeps each student's attempts their own, whatever their section", async () => {
    const room = await classroom();
    const { edge, dana, noah, sam, maya, exercise } = room;
    const own = await room.submit(exercise, sam, "Sam's exercise");

    expect(await attemptsOf(room, exercise, sam)).toEqual([[1, own]]);
    expect(await attemptsOf(room, exercise, maya)).toEqual([]);
    expect(await latestOf(room, exercise, maya)).toBeNull();
    expect(await attemptsOf(room, exercise, sam, noah)).toEqual([[1, own]]);
    expect(await attemptsOf(room, exercise, maya, noah)).toEqual([]);

    const page = (
      await post(edge, "/submissions/for-assignment", { assignment: exercise }, dana.cookie)
    ).body as { assigned: { assignee: string; submitter: string }[] };
    expect(page.assigned.every((row) => row.submitter === row.assignee)).toBe(true);
  });

  test("revising without saying who submits is refused, so an older form cannot change it", async () => {
    const room = await classroom();
    const { edge, dana, project } = room;
    expect(
      await post(
        edge,
        "/assignments/revise",
        { ...assignmentFields, assignment: project, title: "Final project" },
        dana.cookie,
      ),
    ).toMatchObject({ status: 400 });
    const summary = (
      await post(edge, "/assignments/staff-summary", { assignment: project }, dana.cookie)
    ).body.summary as { submittedBy: string };
    expect(summary.submittedBy).toBe("SECTION");
  });
});
