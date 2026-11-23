import { afterAll, describe, expect, test } from "vite-plus/test";
import { stopTestDb } from "../../src/concepts/testing.ts";
import {
  type CourseGradeInputs,
  type CoursePolicy,
  courseGrades,
} from "../../src/computations/course-grades.ts";
import { reusableFixture } from "../support/fixtures.ts";
import { assignmentFields, buildTeamClassroom, post } from "../support/team-classroom.ts";

afterAll(stopTestDb);

const classroom = reusableFixture(buildTeamClassroom);

type Room = Awaited<ReturnType<typeof classroom>>;
type Person = { user: string; cookie: string };

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

/** Late days of five a student, at most five an assignment, a day of 24 hours. */
const configureLateDays = async (room: Room) => {
  await post(
    room.edge,
    "/late-days/configure-policy",
    { defaultDays: 5, unitHours: 24, maxDaysPerItem: 5 },
    room.dana.cookie,
  );
  await room.edge.application.whenIdle();
};

const usesOf = async (room: Room, student: Person) =>
  (
    (await post(room.edge, "/late-days/list", {}, student.cookie)).body.uses as {
      item: string;
      days: number;
      status: string;
    }[]
  ).map((use) => [use.item, use.days, use.status]);

/** A published assignment due two days ago, submitted by each student until revised. */
const publishLab = async (room: Room) => {
  const fields = { ...assignmentFields, title: "Lab", dueAt: daysFromNow(-2) };
  const lab = String(
    (
      await post(
        room.edge,
        "/assignments/create-draft",
        { ...fields, submittedBy: "STUDENT" },
        room.dana.cookie,
      )
    ).body.assignment,
  );
  await post(room.edge, "/assignments/publish", { assignment: lab }, room.dana.cookie);
  await room.edge.application.whenIdle();
  const switchToSections = async () => {
    await post(
      room.edge,
      "/assignments/revise",
      { ...fields, assignment: lab, submittedBy: "SECTION" },
      room.dana.cookie,
    );
    await room.edge.application.whenIdle();
  };
  return { lab, switchToSections };
};

const dueOverrideOf = async (room: Room, assignment: string, student: Person) =>
  (
    (await post(room.edge, "/assignments/for-me", {}, student.cookie)).body.assignments as {
      assignment: string;
      dueOverride: string | null;
    }[]
  ).find((row) => row.assignment === assignment)?.dueOverride;

const setDueOverride = async (room: Room, assignment: string, assignee: string, dueAt: string) => {
  const result = await post(
    room.edge,
    "/assignments/set-due-override",
    { assignment, assignee, dueAt },
    room.dana.cookie,
  );
  await room.edge.application.whenIdle();
  return result;
};

const clearDueOverride = async (room: Room, assignment: string, assignee: string) => {
  const result = await post(
    room.edge,
    "/assignments/clear-due-override",
    { assignment, assignee },
    room.dana.cookie,
  );
  await room.edge.application.whenIdle();
  return result;
};

/** Records and releases one rating of an attempt, under whoever the work belongs to. */
const releaseRating = async (
  room: Room,
  {
    learner,
    item,
    evidence,
    rating,
  }: { learner: string; item: string; evidence: string; rating: string },
) => {
  const { Grading } = room.edge.application.concepts;
  const grader = room.noah.user;
  const at = new Date();
  const recorded = await Grading.record({
    learner,
    item,
    evidence,
    grader,
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
  const saved = await Grading.save({
    ...recorded,
    grader,
    judgments: [{ kind: "COMPETENCY", criterion: "framing", rating, feedback: "" }],
    feedback: "",
    at,
  });
  await Grading.release({ ...saved, grader, at });
  await room.edge.application.whenIdle();
};

const courseGradeInputs = async (room: Room) =>
  (
    (await post(room.edge, "/course-grades/read", {}, room.dana.cookie)).body.page as {
      inputs: CourseGradeInputs;
    }
  ).inputs;

function onePolicy(assignment: string): CoursePolicy {
  return {
    ratings: { DEFICIENT: 1, EMERGENT: 2, COMPETENT: 3, EXPERT: 4 },
    missing: 0,
    late: "missing",
    skillWeights: {},
    groups: [
      {
        key: "g",
        name: "Work",
        weight: 100,
        combine: "average",
        rows: [{ key: "r", type: "assignment", assignment, weight: 1 }],
      },
    ],
    attendance: [],
    gradeSet: "letters",
    lines: { letters: [{ grade: "A", at: 3.4 }], plusMinus: [{ grade: "A", at: 3.6 }] },
  };
}

/** Each student's work on one assignment under a policy that reads only it. */
const workOn = (inputs: CourseGradeInputs, assignment: string, at: Date) =>
  Object.fromEntries(
    courseGrades(onePolicy(assignment), inputs, at, at).map((grade) => [
      grade.student,
      { status: grade.work[assignment]!.status, value: grade.work[assignment]!.value },
    ]),
  );

describe("late days on an assignment submitted by each section", () => {
  test("a member's apply and change, and a staff change, are refused and write nothing", async () => {
    const room = await classroom();
    const { edge, dana, sam, project } = room;
    await configureLateDays(room);

    for (const path of ["/late-days/apply", "/late-days/change"]) {
      const refused = await post(edge, path, { assignment: project, days: 1 }, sam.cookie);
      expect(refused).toMatchObject({ status: 409, body: { error: "CONFLICT" } });
    }
    const staff = await post(
      edge,
      "/late-days/staff-change",
      { learner: sam.user, assignment: project, days: 1 },
      dana.cookie,
    );
    expect(staff).toMatchObject({ status: 409, body: { error: "CONFLICT" } });
    await edge.application.whenIdle();
    expect(await usesOf(room, sam)).toEqual([]);
  });

  test("the same calls on an assignment submitted by each student behave as before", async () => {
    const room = await classroom();
    const { edge, dana, sam, exercise } = room;
    await configureLateDays(room);

    expect(
      await post(edge, "/late-days/apply", { assignment: exercise, days: 1 }, sam.cookie),
    ).toMatchObject({ status: 200 });
    expect(
      await post(edge, "/late-days/change", { assignment: exercise, days: 2 }, sam.cookie),
    ).toMatchObject({ status: 200 });
    expect(
      await post(
        edge,
        "/late-days/staff-change",
        { learner: sam.user, assignment: exercise, days: 3 },
        dana.cookie,
      ),
    ).toMatchObject({ status: 200 });
    await edge.application.whenIdle();
    expect(await usesOf(room, sam)).toEqual([[exercise, 3, "APPLIED"]]);
  });

  test("days that stood before the switch can still be canceled, and lateness and course grades ignore them", async () => {
    const room = await classroom();
    const { edge, dana, sam, maya, ada, first } = room;
    await configureLateDays(room);
    const { lab, switchToSections } = await publishLab(room);
    for (const student of [sam, maya])
      await post(edge, "/late-days/apply", { assignment: lab, days: 3 }, student.cookie);
    await edge.application.whenIdle();
    await switchToSections();

    expect(
      await post(edge, "/late-days/change", { assignment: lab, days: 4 }, sam.cookie),
    ).toMatchObject({ status: 409, body: { error: "CONFLICT" } });

    const submission = await room.submit(lab, sam, "Our lab");
    await releaseRating(room, {
      learner: first,
      item: lab,
      evidence: submission,
      rating: "EXPERT",
    });
    const inputs = await courseGradeInputs(room);
    expect(inputs.uses.filter((use) => use.item === lab)).toHaveLength(2);
    const work = workOn(inputs, lab, new Date());
    for (const student of [sam, maya, ada])
      expect(work[student.user]).toEqual({ status: "late", value: 0 });

    expect(await post(edge, "/late-days/cancel", { assignment: lab }, sam.cookie)).toMatchObject({
      status: 200,
    });
    expect(
      await post(
        edge,
        "/late-days/staff-cancel",
        { learner: maya.user, assignment: lab },
        dana.cookie,
      ),
    ).toMatchObject({ status: 200 });
    await edge.application.whenIdle();
    expect(await usesOf(room, sam)).toEqual([[lab, 3, "CANCELED"]]);
    expect(await usesOf(room, maya)).toEqual([[lab, 3, "CANCELED"]]);
  });
});

describe("a due override for a section", () => {
  test("set through one member, every current member reads it, and clearing through any member clears it", async () => {
    const room = await classroom();
    const { sam, maya, ada, ben, leo, project } = room;
    const extended = daysFromNow(30);

    expect(await setDueOverride(room, project, maya.user, extended)).toMatchObject({
      status: 200,
    });
    for (const member of [sam, maya, ada]) {
      expect(await dueOverrideOf(room, project, member)).toBe(extended);
      const stored = await room.edge.application.concepts.Assigning._getAssigned({
        assignee: member.user,
      });
      expect(stored.find((release) => release.assignment === project)?.dueOverride).toBe(extended);
    }
    expect(await dueOverrideOf(room, project, ben)).toBeNull();
    expect(await dueOverrideOf(room, project, leo)).toBeNull();

    const inputs = await courseGradeInputs(room);
    const overrideOf = (student: Person) =>
      inputs.releases.find(
        (release) => release.assignment === project && release.assignee === student.user,
      )?.dueOverride;
    for (const member of [sam, maya, ada]) expect(overrideOf(member)).toBe(extended);
    expect(overrideOf(ben)).toBeNull();

    expect(await clearDueOverride(room, project, ada.user)).toMatchObject({ status: 200 });
    for (const member of [sam, maya, ada])
      expect(await dueOverrideOf(room, project, member)).toBeNull();
  });

  test("the member with the latest override decides the section's due date", async () => {
    const room = await classroom();
    const { edge, sam, maya, ada, project } = room;
    const sooner = daysFromNow(10);
    const later = daysFromNow(20);
    await setDueOverride(room, project, sam.user, sooner);
    await edge.application.concepts.Assigning.setDueOverride({
      assignment: project,
      assignee: ada.user,
      dueAt: later,
    });
    await edge.application.whenIdle();

    for (const member of [sam, maya, ada])
      expect(await dueOverrideOf(room, project, member)).toBe(later);
    const inputs = await courseGradeInputs(room);
    expect(
      inputs.releases
        .filter((release) => release.assignment === project)
        .filter((release) => [sam, maya, ada].some((member) => member.user === release.assignee))
        .map((release) => release.dueOverride),
    ).toEqual([later, later, later]);
  });

  test("a student in no section, and any student on an assignment submitted by each student, keep their own", async () => {
    const room = await classroom();
    const { sam, maya, leo, project, exercise } = room;
    const extended = daysFromNow(30);

    await setDueOverride(room, project, leo.user, extended);
    expect(await dueOverrideOf(room, project, leo)).toBe(extended);
    expect(await dueOverrideOf(room, project, sam)).toBeNull();

    await setDueOverride(room, exercise, sam.user, extended);
    expect(await dueOverrideOf(room, exercise, sam)).toBe(extended);
    expect(await dueOverrideOf(room, exercise, maya)).toBeNull();
    await clearDueOverride(room, exercise, maya.user);
    expect(await dueOverrideOf(room, exercise, sam)).toBe(extended);
  });
});

describe("course grades on an assignment submitted by each section", () => {
  test("one released grade counts for every current member, a moved student counts the new section's, and a student in no section counts their own", async () => {
    const room = await classroom();
    const { edge, dana, sam, maya, ada, ben, leo, priya, first, second, project } = room;
    const afterDue = new Date(Date.parse(assignmentFields.dueAt) + 86_400_000);

    const tidepool = await room.submit(project, sam, "Tidepool's project");
    const before = workOn(await courseGradeInputs(room), project, afterDue);
    for (const member of [sam, maya, ada]) expect(before[member.user]!.status).toBe("ungraded");
    expect(before[ben.user]!.status).toBe("missing");

    const lantern = await room.submit(project, priya, "Lantern's project");
    const own = await room.submit(project, leo, "Leo's project");
    await releaseRating(room, {
      learner: first,
      item: project,
      evidence: tidepool,
      rating: "EXPERT",
    });
    await releaseRating(room, {
      learner: second,
      item: project,
      evidence: lantern,
      rating: "DEFICIENT",
    });
    await releaseRating(room, {
      learner: leo.user,
      item: project,
      evidence: own,
      rating: "COMPETENT",
    });

    const graded = workOn(await courseGradeInputs(room), project, afterDue);
    for (const member of [sam, maya, ada])
      expect(graded[member.user]).toEqual({ status: "rated", value: 4 });
    expect(graded[ben.user]).toEqual({ status: "rated", value: 1 });
    expect(graded[leo.user]).toEqual({ status: "rated", value: 3 });

    await post(
      edge,
      "/roster/move-section",
      { seat: await room.seatOf(ben.user), section: first },
      dana.cookie,
    );
    await edge.application.whenIdle();
    const moved = workOn(await courseGradeInputs(room), project, afterDue);
    expect(moved[ben.user]).toEqual({ status: "rated", value: 4 });
    expect(moved[priya.user]).toEqual({ status: "rated", value: 1 });
  });
});
