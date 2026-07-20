import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "./errors.ts";
import { caughtError, stopTestDb, testDb } from "../testing.ts";
import { MongoNotingConcept } from "./noting.mongo.ts";
import { NotingConcept } from "./noting.ts";

type Noting = NotingConcept | MongoNotingConcept;

const floors: [string, () => Promise<Noting>][] = [
  ["in memory", async () => new NotingConcept()],
  ["on MongoDB", async () => new MongoNotingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

const T0 = new Date("2026-03-01T00:00:00Z");
const T1 = new Date("2026-03-02T00:00:00Z");
const T2 = new Date("2026-03-03T00:00:00Z");
const T3 = new Date("2026-03-04T00:00:00Z");
const FOLLOW = new Date("2026-03-10T00:00:00Z");

const staffNote = (c: Noting, learner = "ana", followUpAt: Date | null = null) =>
  c.write({
    author: "okafor",
    learner,
    body: "missed the meeting",
    visibility: "STAFF_ONLY",
    tags: [],
    followUpAt,
    at: T0,
  });

const shownNote = (c: Noting, learner = "ana") =>
  c.write({
    author: "okafor",
    learner,
    body: "strong project work",
    visibility: "LEARNER_VISIBLE",
    tags: ["praise"],
    followUpAt: null,
    at: T0,
  });

for (const [floor, make] of floors) {
  describe(`Noting ${floor}`, () => {
    test("write refuses a visibility the concept does not know", async () => {
      const c = await make();
      expect(
        await refusal(() =>
          c.write({
            author: "okafor",
            learner: "ana",
            body: "x",
            visibility: "PUBLIC",
            tags: [],
            followUpAt: null,
            at: T0,
          }),
        ),
      ).toBeInstanceOf(refusalErrors.InvalidVisibility);
    });

    test("write opens the note; a staff note is not disclosed, a learner-visible one is", async () => {
      const c = await make();
      const { note } = await staffNote(c);
      expect(await c._getNote({ note })).toEqual([
        {
          note,
          author: "okafor",
          learner: "ana",
          body: "missed the meeting",
          visibility: "STAFF_ONLY",
          status: "OPEN",
          createdAt: T0,
          updatedAt: null,
          followUpAt: null,
          acknowledgedAt: null,
          tags: [],
        },
      ]);
      const shown = await shownNote(c);
      expect((await c._getNote({ note: shown.note }))[0]?.visibility).toBe("LEARNER_VISIBLE");
    });

    test("a note moves from open to resolved to archived and back to open", async () => {
      const c = await make();
      const { note } = await staffNote(c);
      expect((await c._getNote({ note }))[0]?.status).toBe("OPEN");

      expect(await c.resolve({ note, at: T1 })).toEqual({ note });
      expect((await c._getNote({ note }))[0]?.status).toBe("RESOLVED");

      expect(await c.archive({ note, at: T2 })).toEqual({ note });
      expect((await c._getNote({ note }))[0]?.status).toBe("ARCHIVED");

      expect(await c.restore({ note, at: T3 })).toEqual({ note });
      expect((await c._getNote({ note }))[0]?.status).toBe("OPEN");
      expect((await c._getNote({ note }))[0]?.updatedAt).toEqual(T3);
    });

    test("revise updates body, tags, follow-up, disclosure and stamps updatedAt", async () => {
      const c = await make();
      const { note } = await staffNote(c);
      expect(
        await c.revise({
          note,
          body: "meeting rescheduled",
          visibility: "LEARNER_VISIBLE",
          tags: ["scheduling"],
          followUpAt: FOLLOW,
          at: T1,
        }),
      ).toEqual({ note });
      const row = (await c._getNote({ note }))[0];
      expect(row?.body).toBe("meeting rescheduled");
      expect(row?.tags).toEqual(["scheduling"]);
      expect(row?.followUpAt).toEqual(FOLLOW);
      expect(row?.visibility).toBe("LEARNER_VISIBLE");
      expect(row?.updatedAt).toEqual(T1);
    });

    test("revise refuses: no such note, not open, unknown visibility", async () => {
      const c = await make();
      expect(
        await refusal(() =>
          c.revise({
            note: "ghost",
            body: "x",
            visibility: "STAFF_ONLY",
            tags: [],
            followUpAt: null,
            at: T1,
          }),
        ),
      ).toBeInstanceOf(refusalErrors.NoteNotFound);

      const { note } = await staffNote(c);
      await c.resolve({ note, at: T1 });
      expect(
        await refusal(() =>
          c.revise({
            note,
            body: "x",
            visibility: "STAFF_ONLY",
            tags: [],
            followUpAt: null,
            at: T2,
          }),
        ),
      ).toBeInstanceOf(refusalErrors.NoteNotOpen);

      const open = await staffNote(c);
      expect(
        await refusal(() =>
          c.revise({
            note: open.note,
            body: "x",
            visibility: "NONSENSE",
            tags: [],
            followUpAt: null,
            at: T2,
          }),
        ),
      ).toBeInstanceOf(refusalErrors.InvalidVisibility);
    });

    test("resolve refuses: no such note, not open", async () => {
      const c = await make();
      expect(await refusal(() => c.resolve({ note: "ghost", at: T1 }))).toBeInstanceOf(
        refusalErrors.NoteNotFound,
      );
      const { note } = await staffNote(c);
      await c.resolve({ note, at: T1 });
      expect(await refusal(() => c.resolve({ note, at: T2 }))).toBeInstanceOf(
        refusalErrors.NoteNotOpen,
      );
    });

    test("archive refuses an unknown or unresolved note", async () => {
      const c = await make();
      expect(await refusal(() => c.archive({ note: "ghost", at: T1 }))).toBeInstanceOf(
        refusalErrors.NoteNotFound,
      );
      const { note } = await staffNote(c);
      expect(await refusal(() => c.archive({ note, at: T1 }))).toBeInstanceOf(
        refusalErrors.NoteNotResolved,
      );
    });

    test("restore refuses: no such note, an open note cannot be restored", async () => {
      const c = await make();
      expect(await refusal(() => c.restore({ note: "ghost", at: T1 }))).toBeInstanceOf(
        refusalErrors.NoteNotFound,
      );
      const { note } = await staffNote(c);
      expect(await refusal(() => c.restore({ note, at: T1 }))).toBeInstanceOf(
        refusalErrors.NoteNotRestorable,
      );
    });

    test("acknowledge refuses: no such note, not shown, wrong learner", async () => {
      const c = await make();
      expect(
        await refusal(() => c.acknowledge({ note: "ghost", learner: "ana", at: T1 })),
      ).toBeInstanceOf(refusalErrors.NoteNotFound);

      const staff = await staffNote(c);
      expect(
        await refusal(() => c.acknowledge({ note: staff.note, learner: "ana", at: T1 })),
      ).toBeInstanceOf(refusalErrors.NoteNotLearnerVisible);

      const shown = await shownNote(c);
      expect(
        await refusal(() => c.acknowledge({ note: shown.note, learner: "ben", at: T1 })),
      ).toBeInstanceOf(refusalErrors.NoteNotOwner);
    });

    test("acknowledge records the receipt for the note's learner", async () => {
      const c = await make();
      const { note } = await shownNote(c);
      expect(await c.acknowledge({ note, learner: "ana", at: T1 })).toEqual({ note });
      expect((await c._getNote({ note }))[0]?.acknowledgedAt).toEqual(T1);
    });

    test("a disclosed archived note can be acknowledged", async () => {
      const c = await make();
      const { note } = await shownNote(c);
      await c.resolve({ note, at: T1 });
      await c.archive({ note, at: T2 });
      expect((await c._getNote({ note }))[0]?.status).toBe("ARCHIVED");
      expect(await c.acknowledge({ note, learner: "ana", at: T3 })).toEqual({ note });
      expect((await c._getNote({ note }))[0]?.acknowledgedAt).toEqual(T3);
    });

    test("changing a note to staff-only retains acknowledgedAt", async () => {
      const c = await make();
      const { note } = await shownNote(c);
      await c.acknowledge({ note, learner: "ana", at: T1 });
      await c.revise({
        note,
        body: "now among staff",
        visibility: "STAFF_ONLY",
        tags: [],
        followUpAt: null,
        at: T2,
      });
      const row = (await c._getNote({ note }))[0];
      expect(row?.visibility).toBe("STAFF_ONLY");
      expect(row?.acknowledgedAt).toEqual(T1);
    });

    test("re-acknowledge refreshes the receipt to the newer moment", async () => {
      const c = await make();
      const { note } = await shownNote(c);
      await c.acknowledge({ note, learner: "ana", at: T1 });
      await c.acknowledge({ note, learner: "ana", at: T3 });
      expect((await c._getNote({ note }))[0]?.acknowledgedAt).toEqual(T3);
    });

    test("_getActiveNotesFor returns OPEN and RESOLVED any-visibility rows in creation order", async () => {
      const c = await make();
      const first = await staffNote(c, "ana");
      const second = await shownNote(c, "ana");
      const third = await staffNote(c, "ana");
      await c.write({
        author: "okafor",
        learner: "ben",
        body: "other learner",
        visibility: "STAFF_ONLY",
        tags: [],
        followUpAt: null,
        at: T0,
      });
      await c.resolve({ note: second.note, at: T1 });
      await c.resolve({ note: third.note, at: T1 });
      await c.archive({ note: third.note, at: T2 });

      const rows = await c._getActiveNotesFor({ learner: "ana" });
      expect(rows.map((r) => r.note)).toEqual([first.note, second.note]);
      expect(rows.map((r) => r.status)).toEqual(["OPEN", "RESOLVED"]);
      expect(rows[1]?.visibility).toBe("LEARNER_VISIBLE");
    });

    test("_getShownTo excludes STAFF_ONLY and ARCHIVED, carries no visibility key, creation order", async () => {
      const c = await make();
      await staffNote(c, "ana");
      const shown = await shownNote(c, "ana");
      const shownResolved = await c.write({
        author: "okafor",
        learner: "ana",
        body: "resolved but shown",
        visibility: "LEARNER_VISIBLE",
        tags: [],
        followUpAt: null,
        at: T0,
      });
      const shownArchived = await c.write({
        author: "okafor",
        learner: "ana",
        body: "archived shown",
        visibility: "LEARNER_VISIBLE",
        tags: [],
        followUpAt: null,
        at: T0,
      });
      await c.resolve({ note: shownResolved.note, at: T1 });
      await c.resolve({ note: shownArchived.note, at: T1 });
      await c.archive({ note: shownArchived.note, at: T2 });

      const rows = await c._getShownTo({ learner: "ana" });
      expect(rows.map((r) => r.note)).toEqual([shown.note, shownResolved.note]);
      for (const row of rows) {
        expect("visibility" in row).toBe(false);
      }
    });

    test("_getByAuthor lists the author's notes with visibility string and status, creation order", async () => {
      const c = await make();
      const a = await staffNote(c, "ana");
      const b = await shownNote(c, "ben");
      await c.write({
        author: "smith",
        learner: "cai",
        body: "different author",
        visibility: "STAFF_ONLY",
        tags: [],
        followUpAt: null,
        at: T0,
      });
      await c.resolve({ note: a.note, at: T1 });

      expect(await c._getByAuthor({ author: "okafor" })).toEqual([
        {
          note: a.note,
          learner: "ana",
          status: "RESOLVED",
          visibility: "STAFF_ONLY",
          createdAt: T0,
        },
        {
          note: b.note,
          learner: "ben",
          status: "OPEN",
          visibility: "LEARNER_VISIBLE",
          createdAt: T0,
        },
      ]);
    });

    test("_getOpenFollowUpsBefore returns OPEN notes with a non-null followUpAt at or before the cutoff", async () => {
      const c = await make();
      const due = await staffNote(c, "ana", FOLLOW);
      await staffNote(c, "ana", null);
      const later = await staffNote(c, "ben", new Date("2026-04-01T00:00:00Z"));
      const resolvedDue = await staffNote(c, "cai", FOLLOW);
      await c.resolve({ note: resolvedDue.note, at: T1 });

      const rows = await c._getOpenFollowUpsBefore({ before: FOLLOW });
      expect(rows.map((r) => r.note)).toEqual([due.note]);
      expect(rows[0]).toEqual({
        note: due.note,
        author: "okafor",
        learner: "ana",
        body: "missed the meeting",
        followUpAt: FOLLOW,
        createdAt: T0,
      });
      void later;
    });

    test("a null followUpAt is returned unchanged", async () => {
      const c = await make();
      const { note } = await shownNote(c);
      expect((await c._getNote({ note }))[0]?.followUpAt).toBeNull();
      await c.revise({
        note,
        body: "still no follow-up",
        visibility: "LEARNER_VISIBLE",
        tags: [],
        followUpAt: null,
        at: T1,
      });
      expect((await c._getNote({ note }))[0]?.followUpAt).toBeNull();
    });
  });
}
