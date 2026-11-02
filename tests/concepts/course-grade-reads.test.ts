import { afterAll, describe, expect, test } from "vite-plus/test";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoAssigningConcept } from "../../src/concepts/assigning/assigning.mongo.ts";
import { MongoBankingConcept } from "../../src/concepts/banking/banking.mongo.ts";
import { MongoGradingConcept } from "../../src/concepts/grading/grading.mongo.ts";
import { MongoProfilingConcept } from "../../src/concepts/profiling/profiling.mongo.ts";
import { MongoPublishingConcept } from "../../src/concepts/publishing/publishing.mongo.ts";
import { MongoRespondingConcept } from "../../src/concepts/responding/responding.mongo.ts";
import { MongoRosteringConcept } from "../../src/concepts/rostering/rostering.mongo.ts";
import { MongoSubmittingConcept } from "../../src/concepts/submitting/submitting.mongo.ts";

afterAll(stopTestDb);

const at = new Date("2026-10-01T15:00:00Z");
const later = new Date("2026-10-02T15:00:00Z");

/** Each class-wide read answers one list, so a computation can read the whole class at once. */
describe("class-wide reads for course grades", () => {
  test("Submitting answers every attempt, withdrawn ones too, earliest first", async () => {
    const c = new MongoSubmittingConcept(await testDb());
    const second = await c.submit({
      assignment: "p1",
      submitter: "ana",
      artifact: "a2",
      at: later,
    });
    const first = await c.submit({ assignment: "p1", submitter: "ben", artifact: "a1", at });
    await c.withdraw({ submission: first.submission });
    const { attempts } = await c._allAttempts();
    expect(attempts.map((row) => [row.submission, row.submitter, row.status])).toEqual([
      [first.submission, "ben", "WITHDRAWN"],
      [second.submission, "ana", "SUBMITTED"],
    ]);
  });

  test("Banking answers standing uses only", async () => {
    const c = new MongoBankingConcept(await testDb());
    await c.setTerms({ allowance: 5, perItemLimit: 3, unitHours: 24 });
    await c.apply({ learner: "ana", item: "p1", days: 2, at });
    await c.apply({ learner: "ana", item: "p2", days: 1, at });
    await c.cancel({ learner: "ana", item: "p2" });
    expect(await c._standingUses()).toEqual({ uses: [{ learner: "ana", item: "p1", days: 2 }] });
  });

  test("Rostering and Profiling answer students and names as lists", async () => {
    const db = await testDb();
    const roster = new MongoRosteringConcept(db);
    await roster.enrol({ email: "ana@example.edu", kind: "STUDENT", section: null, user: "ana" });
    await roster.enrol({ email: "ta@example.edu", kind: "STAFF", section: null, user: "ta" });
    const { section } = await roster.createSection({
      name: "R01",
      location: "",
      meetingPattern: "",
    });
    expect(await roster._sectionList()).toEqual({
      sections: [{ section: (section as unknown as { _id: string })._id, name: "R01" }],
    });
    expect(await roster._activeStudentList()).toEqual({
      students: [{ user: "ana", section: null, email: "ana@example.edu" }],
    });
    const profiles = new MongoProfilingConcept(db);
    await profiles.createProfile({ user: "ana", displayName: "Ana Ruiz" });
    expect(await profiles._namesOf({ users: ["missing", "ana", "ana"] })).toEqual({
      names: [{ user: "ana", displayName: "Ana Ruiz" }],
    });
  });

  test("Publishing answers editions and parts among a list, from the whole index", async () => {
    const db = await testDb();
    const c = new MongoPublishingConcept(db);
    const { edition: run } = await c.publish({ author: "lee", material: "relay", at });
    const { edition: round } = await c.publishWithin({
      whole: run,
      author: "lee",
      material: "leg",
      at,
    });
    expect(await c._editionsAmong({ editions: [run, "missing"] })).toEqual({
      editions: [{ edition: run, whole: null, openedAt: at }],
    });
    expect(await c._partsAmong({ wholes: [run, round] })).toEqual({
      parts: [{ whole: run, edition: round }],
    });
    const keys = (await db.collection("publishing.editions").indexes()).map((index) => index.key);
    expect(keys).toContainEqual({ whole: 1 });
  });

  test("a second Publishing instance keeps its editions apart", async () => {
    const db = await testDb();
    const live = new MongoPublishingConcept(db);
    const grades = new MongoPublishingConcept(db, "CourseGradePublishing");
    await grades.publish({ author: "dj", material: "course-grades", at });
    expect(await live._openEditions()).toEqual([]);
    expect(await grades._latestFor({ material: "missing" })).toEqual([]);
    const { edition: second } = await grades.publish({ author: "dj", material: "ana", at: later });
    await grades.close({ edition: second, at: later });
    expect(await grades._latestFor({ material: "ana" })).toEqual([
      { edition: second, open: false, openedAt: later },
    ]);
    expect(await db.collection("courseGradePublishing.editions").countDocuments()).toBe(2);
  });

  test("Responding answers each subject's participants once, from the subject index", async () => {
    const db = await testDb();
    const c = new MongoRespondingConcept(db);
    await c.begin({ participant: "ana", subject: "r1", at });
    await c.begin({ participant: "ben", subject: "r1", at });
    await c.begin({ participant: "ana", subject: "r2", at });
    await c.begin({ participant: "cy", subject: "other", at });
    expect(await c._participationAmong({ subjects: ["r2", "r1"] })).toEqual({
      participation: [
        { subject: "r1", participant: "ana" },
        { subject: "r1", participant: "ben" },
        { subject: "r2", participant: "ana" },
      ],
    });
    const keys = (await db.collection("responding.responses").indexes()).map((index) => index.key);
    expect(keys).toContainEqual({ subject: 1, participant: 1 });
  });

  test("Assigning answers published and archived assignments and every release", async () => {
    const c = new MongoAssigningConcept(await testDb());
    const draft = {
      author: "dj",
      instructions: "",
      kind: "EXERCISE",
      availableAt: "2026-09-01T00:00:00.000Z",
      dueAt: "2026-09-15T04:00:00.000Z",
      closeAt: "2026-12-31T04:00:00.000Z",
      acceptsSubmissions: true,
      audience: "EVERYONE" as const,
      targets: [] as string[],
      at,
    };
    const { assignment } = await c.createDraft({ ...draft, title: "Exercise 1" });
    await c.createDraft({ ...draft, title: "Still a draft" });
    await c.publish({ assignment, at });
    await c.assign({ assignment, assignee: "ana", at });
    await c.setDueOverride({ assignment, assignee: "ana", dueAt: "2026-09-17T04:00:00.000Z" });
    expect(await c._courseAssignments()).toEqual({
      assignments: [
        {
          assignment,
          title: "Exercise 1",
          kind: "EXERCISE",
          dueAt: "2026-09-15T04:00:00.000Z",
          status: "PUBLISHED",
          acceptsSubmissions: true,
        },
      ],
    });
    expect(await c._courseReleases()).toEqual({
      releases: [{ assignment, assignee: "ana", dueOverride: "2026-09-17T04:00:00.000Z" }],
    });
  });

  test("Grading answers ratings without rubric text, and judgments only once released", async () => {
    const c = new MongoGradingConcept(await testDb());
    expect(await c._courseRatings()).toEqual({ ratings: [] });
    const criteria = [
      {
        kind: "COMPETENCY" as const,
        criterion: "framing",
        position: 0,
        basis: "framing-v1",
        standard: "pf",
        number: 1,
        name: "Problem framing",
        description: "Frame the problem.",
        deficient: "d",
        emergent: "e",
        competent: "c",
        expert: "x",
        referenceUrl: "",
      },
    ];
    const open = async (learner: string, when = at) =>
      c.record({
        learner,
        item: "p1",
        evidence: `${learner}-1`,
        grader: "ta",
        method: "COMPETENCY",
        setupRevision: 1,
        criteria,
        at: when,
      });
    const judgments = [
      { kind: "COMPETENCY" as const, criterion: "framing", rating: "EXPERT", feedback: "Sharp." },
    ];
    const opened = await open("ana");
    const released = await c.save({ ...opened, grader: "ta", judgments, feedback: "Good", at });
    await c.release({ ...released, grader: "ta", at });
    const drafted = await open("ben", later);
    await c.save({ ...drafted, grader: "ta", judgments, feedback: "Draft", at });
    const { ratings } = await c._courseRatings();
    expect(ratings.map((row) => [row.learner, row.status, row.judgments])).toEqual([
      ["ana", "RELEASED", [{ criterion: "framing", rating: "EXPERT", score: null }]],
      ["ben", "DRAFT", []],
    ]);
    expect(ratings[0]!.criteria).toEqual([
      {
        criterion: "framing",
        kind: "COMPETENCY",
        standard: "pf",
        name: "Problem framing",
        maxPoints: 0,
      },
    ]);
    expect(JSON.stringify(ratings)).not.toContain("Sharp.");
  });
});
