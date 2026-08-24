import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/rostering/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoRosteringConcept } from "../../src/concepts/rostering/rostering.mongo.ts";

const floors: [string, () => Promise<MongoRosteringConcept>][] = [
  ["on MongoDB", async () => new MongoRosteringConcept(await testDb())],
];

afterAll(stopTestDb);

type RefusalClass = abstract new (...args: never[]) => Error;

const expectRefusal = async (fn: () => unknown, Refusal: RefusalClass) => {
  expect(await caughtError(fn)).toBeInstanceOf(Refusal);
};

const anaRow = {
  email: "ana@example.edu",
  kind: "STUDENT",
};
const benRow = {
  email: "ben@example.edu",
  kind: "STUDENT",
};

for (const [floor, make] of floors) {
  describe(`Rostering ${floor}`, () => {
    test("configureClass configures once; a second configuration is refused", async () => {
      const rostering = await make();
      const { class: theClass } = await rostering.configureClass({
        code: "6.104",
        title: "Software Design",
        term: "Fall 2026",
        timezone: "America/New_York",
      });
      expect(theClass.code).toBe("6.104");
      expect(await rostering._getClass({})).toEqual([
        {
          detail: {
            code: "6.104",
            title: "Software Design",
            term: "Fall 2026",
            timezone: "America/New_York",
            status: "ACTIVE",
          },
        },
      ]);
      await expectRefusal(
        () =>
          rostering.configureClass({
            code: "6.104",
            title: "Software Design",
            term: "Fall 2026",
            timezone: "America/New_York",
          }),
        refusalErrors.ClassAlreadyConfigured,
      );
    });

    test("updateClass revises the configured class", async () => {
      const rostering = await make();
      await rostering.configureClass({
        code: "6.104",
        title: "Software Desgin",
        term: "Fall 2026",
        timezone: "America/New_York",
      });
      const { class: revised } = await rostering.updateClass({
        code: "6.1040",
        title: "Software Design",
        term: "Fall 2026",
        timezone: "America/Los_Angeles",
      });
      expect(revised).toMatchObject({
        code: "6.1040",
        title: "Software Design",
        term: "Fall 2026",
        timezone: "America/Los_Angeles",
        status: "ACTIVE",
      });
      expect(await rostering._getClass({})).toEqual([
        {
          detail: {
            code: "6.1040",
            title: "Software Design",
            term: "Fall 2026",
            timezone: "America/Los_Angeles",
            status: "ACTIVE",
          },
        },
      ]);
      // Revision leaves exactly one class; configuring again is still refused.
      await expectRefusal(
        () =>
          rostering.configureClass({
            code: "6.1040",
            title: "Software Design",
            term: "Fall 2026",
            timezone: "America/Los_Angeles",
          }),
        refusalErrors.ClassAlreadyConfigured,
      );
    });

    test("updateClass refuses before the class is configured", async () => {
      const rostering = await make();
      expect(await rostering._getClass({})).toEqual([]);
      await expectRefusal(
        () =>
          rostering.updateClass({
            code: "6.104",
            title: "Software Design",
            term: "Fall 2026",
            timezone: "America/New_York",
          }),
        refusalErrors.ClassNotConfigured,
      );
      expect(await rostering._getClass({})).toEqual([]);
    });

    test("removeSeat deletes a pending seat and frees its address", async () => {
      const rostering = await make();
      const { created } = await rostering.importSeats({ rows: [anaRow] });
      const seat = created[0]._id;
      const result = await rostering.removeSeat({ seat });
      expect(result.email).toBe("ana@example.edu");
      expect(result.seat).toMatchObject({ _id: seat, email: "ana@example.edu" });
      expect(await rostering._getUnclaimedSeats({})).toEqual([]);
      expect(await rostering._getSeatByEmail({ email: "ana@example.edu" })).toEqual([]);
      expect(await rostering._getPendingSeatByEmail({ email: "ana@example.edu" })).toEqual([]);

      // The address carries no seat, so importing it again creates a fresh one.
      const again = await rostering.importSeats({ rows: [anaRow] });
      expect(again.skipped).toEqual([]);
      expect(again.created).toHaveLength(1);
      expect(again.created[0]._id).not.toBe(seat);
    });

    test("removeSeat deletes an active seat, freeing the address to enrol again", async () => {
      const rostering = await make();
      const { seat } = await rostering.enrol({
        email: "ana@example.edu",
        kind: "STUDENT",
        section: null,
        user: "ana",
      });
      expect(await rostering.removeSeat({ seat: seat._id })).toMatchObject({
        email: "ana@example.edu",
      });
      expect(await rostering._getActiveMembers({})).toEqual([]);
      expect(await rostering._getSeatByUser({ user: "ana" })).toEqual([]);
      expect(await rostering._isActiveStudent({ user: "ana" })).toEqual({ active: false });

      const fresh = await rostering.enrol({
        email: "Ana@Example.edu",
        kind: "STUDENT",
        section: null,
        user: "ana",
      });
      expect(fresh.seat._id).not.toBe(seat._id);
      expect(fresh.seat).toMatchObject({ status: "ACTIVE", email: "ana@example.edu" });
    });

    test("removeSeat deletes a dropped seat", async () => {
      const rostering = await make();
      const { created } = await rostering.importSeats({ rows: [anaRow] });
      const seat = created[0]._id;
      await rostering.claimSeat({ seat, user: "ana" });
      await rostering.dropSeat({ seat });
      expect(await rostering._getDroppedSeats({})).toHaveLength(1);
      const result = await rostering.removeSeat({ seat });
      expect(result).toEqual({
        seat: {
          _id: seat,
          email: "ana@example.edu",
          kind: "STUDENT",
          section: null,
          status: "DROPPED",
          user: "ana",
        },
        email: "ana@example.edu",
      });
      expect(await rostering._getDroppedSeats({})).toEqual([]);
      expect(await rostering._getSeatDetail({ user: "ana" })).toEqual([]);
    });

    test("removeSeat leaves other seats alone and refuses an unknown or already removed seat", async () => {
      const rostering = await make();
      const { created } = await rostering.importSeats({ rows: [anaRow, benRow] });
      await expectRefusal(
        () => rostering.removeSeat({ seat: "no-such-seat" }),
        refusalErrors.SeatNotFound,
      );
      await rostering.removeSeat({ seat: created[0]._id });
      await expectRefusal(
        () => rostering.removeSeat({ seat: created[0]._id }),
        refusalErrors.SeatNotFound,
      );
      expect(await rostering._getUnclaimedSeats({})).toEqual([
        {
          seat: created[1]._id,
          email: "ben@example.edu",
          kind: "STUDENT",
          section: null,
          displayName: "",
        },
      ]);
    });

    test("createSection creates; updateSection updates; an unknown section is refused", async () => {
      const rostering = await make();
      const { section } = await rostering.createSection({
        name: "A",
        location: "26-100",
        meetingPattern: "MWF 10",
      });
      const updated = await rostering.updateSection({
        section: section._id,
        name: "A",
        location: "32-123",
        meetingPattern: "MWF 11",
      });
      expect(updated.section).toMatchObject({ location: "32-123", meetingPattern: "MWF 11" });
      expect(await rostering._getSections({})).toHaveLength(1);
      await expectRefusal(
        () =>
          rostering.updateSection({
            section: "no-such-section",
            name: "B",
            location: "x",
            meetingPattern: "y",
          }),
        refusalErrors.SectionNotFound,
      );
    });

    test("importSeats creates pending seats and reports a repeated address as skipped", async () => {
      const rostering = await make();
      const first = await rostering.importSeats({ rows: [anaRow, benRow] });
      expect(first.created).toHaveLength(2);
      expect(first.skipped).toEqual([]);
      expect(first.created[0]).toMatchObject({
        email: "ana@example.edu",
        status: "PENDING",
        section: null,
      });
      const second = await rostering.importSeats({
        rows: [anaRow, { email: "cai@example.edu" }],
      });
      expect(second.created).toHaveLength(1);
      expect(second.created[0]).toMatchObject({ email: "cai@example.edu", kind: "STUDENT" });
      expect(second.skipped).toEqual(["ana@example.edu"]);
      expect(await rostering._getSeatByEmail({ email: "ana@example.edu" })).toEqual([
        { seat: first.created[0]._id, email: "ana@example.edu" },
      ]);
      expect(await rostering._getUnclaimedSeats({})).toHaveLength(3);
    });

    test("importSeats matches an address regardless of the case it arrives in", async () => {
      const rostering = await make();
      await rostering.importSeats({ rows: [anaRow] });
      const again = await rostering.importSeats({ rows: [{ email: "Ana@Example.edu" }] });
      expect(again.created).toEqual([]);
      expect(again.skipped).toEqual(["ana@example.edu"]);
    });

    test("importSeats skips a row carrying no address", async () => {
      const rostering = await make();
      const result = await rostering.importSeats({ rows: [{ kind: "STUDENT" }] });
      expect(result.created).toEqual([]);
      expect(result.skipped).toEqual([""]);
    });

    test("enrol seats somebody who already has an account", async () => {
      const rostering = await make();
      const result = await rostering.enrol({
        email: "cai@example.edu",
        kind: "STAFF",
        section: null,
        user: "cai",
      });
      expect(result).toMatchObject({ kind: "STAFF", user: "cai" });
      expect(result.seat).toMatchObject({ status: "ACTIVE", email: "cai@example.edu" });
      expect(await rostering._getSeatByUser({ user: "cai" })).toEqual([
        {
          seat: result.seat._id,
          user: "cai",
          email: "cai@example.edu",
          kind: "STAFF",
          section: null,
          status: "ACTIVE",
        },
      ]);
    });

    test("enrol claims a seat already waiting for that address", async () => {
      const rostering = await make();
      const { created } = await rostering.importSeats({ rows: [anaRow] });
      const result = await rostering.enrol({
        email: "ana@example.edu",
        kind: "STUDENT",
        section: null,
        user: "ana",
      });
      expect(result.seat._id).toBe(created[0]._id);
      expect(result.seat).toMatchObject({ status: "ACTIVE", user: "ana" });
      expect(await rostering._getUnclaimedSeats({})).toEqual([]);
    });

    test("enrol refuses an address already actively seated, and an already-seated person", async () => {
      const rostering = await make();
      await rostering.enrol({
        email: "ana@example.edu",
        kind: "STUDENT",
        section: null,
        user: "ana",
      });
      await expectRefusal(
        () =>
          rostering.enrol({
            email: "ana@example.edu",
            kind: "STUDENT",
            section: null,
            user: "someone-else",
          }),
        refusalErrors.SeatAlreadyExists,
      );
      await rostering.enrol({
        email: "cai@example.edu",
        kind: "STUDENT",
        section: null,
        user: "cai",
      });
      await expectRefusal(
        () =>
          rostering.enrol({
            email: "dan@example.edu",
            kind: "STUDENT",
            section: null,
            user: "cai",
          }),
        refusalErrors.SeatAlreadyActive,
      );
    });

    test("previewImport names rows from the CSV header", async () => {
      const rostering = await make();
      expect(
        await rostering.previewImport({
          csv: "email,kind\nana@example.edu,STUDENT",
        }),
      ).toEqual({
        rows: [{ email: "ana@example.edu", kind: "STUDENT" }],
      });
    });

    test("claimSeat activates a pending seat for its holder", async () => {
      const rostering = await make();
      const { created } = await rostering.importSeats({ rows: [anaRow] });
      const result = await rostering.claimSeat({ seat: created[0]._id, user: "ana" });
      expect(result).toMatchObject({ kind: "STUDENT", user: "ana", section: null });
      expect(result.seat).toMatchObject({ status: "ACTIVE", user: "ana" });
      expect(await rostering._isActiveStudent({ user: "ana" })).toEqual({ active: true });
    });

    test("claimSeat refuses unknown, non-pending, and second-seat claims", async () => {
      const rostering = await make();
      const { created } = await rostering.importSeats({ rows: [anaRow, benRow] });
      await expectRefusal(
        () => rostering.claimSeat({ seat: "no-such-seat", user: "ana" }),
        refusalErrors.SeatNotFound,
      );
      await rostering.claimSeat({ seat: created[0]._id, user: "ana" });
      await expectRefusal(
        () => rostering.claimSeat({ seat: created[0]._id, user: "dan" }),
        refusalErrors.SeatNotPending,
      );
      await expectRefusal(
        () => rostering.claimSeat({ seat: created[1]._id, user: "ana" }),
        refusalErrors.SeatAlreadyActive,
      );
    });

    test("dropSeat drops an active seat and refuses otherwise", async () => {
      const rostering = await make();
      const { created } = await rostering.importSeats({ rows: [anaRow] });
      const seat = created[0]._id;
      await expectRefusal(
        () => rostering.dropSeat({ seat: "no-such-seat" }),
        refusalErrors.SeatNotFound,
      );
      await expectRefusal(() => rostering.dropSeat({ seat }), refusalErrors.SeatNotActive);
      await rostering.claimSeat({ seat, user: "ana" });
      const result = await rostering.dropSeat({ seat });
      expect(result).toMatchObject({ kind: "STUDENT", user: "ana" });
      expect(result.seat).toMatchObject({ status: "DROPPED" });
      expect(await rostering._getActiveMembers({})).toEqual([]);
      expect(await rostering._getDroppedSeats({})).toEqual([
        {
          user: "ana",
          seat,
          kind: "STUDENT",
          section: null,
          email: "ana@example.edu",
        },
      ]);
    });

    test("reinstateSeat reactivates a dropped seat and refuses otherwise", async () => {
      const rostering = await make();
      const { created } = await rostering.importSeats({ rows: [anaRow, benRow] });
      const seat = created[0]._id;
      await expectRefusal(
        () => rostering.reinstateSeat({ seat: "no-such-seat" }),
        refusalErrors.SeatNotFound,
      );
      await expectRefusal(() => rostering.reinstateSeat({ seat }), refusalErrors.SeatNotDropped);
      await rostering.claimSeat({ seat, user: "ana" });
      await rostering.dropSeat({ seat });
      const result = await rostering.reinstateSeat({ seat });
      expect(result).toMatchObject({ kind: "STUDENT", user: "ana", section: null });
      expect(result.seat).toMatchObject({ status: "ACTIVE" });
      expect(await rostering._getActiveStudents({})).toEqual([
        { user: "ana", seat, section: null, email: "ana@example.edu" },
      ]);
      await rostering.dropSeat({ seat });
      await rostering.claimSeat({ seat: created[1]._id, user: "ana" });
      await expectRefusal(() => rostering.reinstateSeat({ seat }), refusalErrors.SeatAlreadyActive);
    });

    test("_getSeatDetail returns the complete seat for a holder and no row for an unheld user", async () => {
      const rostering = await make();
      const { section } = await rostering.createSection({
        name: "A",
        location: "26-100",
        meetingPattern: "MWF 10",
      });
      const { created } = await rostering.importSeats({ rows: [anaRow] });
      const seat = created[0]._id;
      expect(await rostering._getSeatDetail({ user: "ana" })).toEqual([]);
      await rostering.claimSeat({ seat, user: "ana" });
      await rostering.moveSection({ seat, section: section._id });
      expect(await rostering._getSeatDetail({ user: "ana" })).toEqual([
        {
          detail: {
            seat,
            user: "ana",
            email: "ana@example.edu",
            kind: "STUDENT",
            section: section._id,
            status: "ACTIVE",
          },
        },
      ]);
      expect(await rostering._getSeatDetail({ user: "nobody" })).toEqual([]);
    });

    test("seat queries prefer the active seat, then the newest held seat", async () => {
      const rostering = await make();
      const { created } = await rostering.importSeats({ rows: [anaRow, benRow] });
      const first = created[0]._id;
      const second = created[1]._id;

      await rostering.claimSeat({ seat: first, user: "ana" });
      await rostering.dropSeat({ seat: first });
      await rostering.claimSeat({ seat: second, user: "ana" });

      expect(await rostering._getSeatByUser({ user: "ana" })).toEqual([
        expect.objectContaining({ seat: second, status: "ACTIVE" }),
      ]);
      expect(await rostering._getSeatDetail({ user: "ana" })).toEqual([
        { detail: expect.objectContaining({ seat: second, status: "ACTIVE" }) },
      ]);

      await rostering.dropSeat({ seat: second });
      expect(await rostering._getSeatByUser({ user: "ana" })).toEqual([
        expect.objectContaining({ seat: second, status: "DROPPED" }),
      ]);
    });

    test("importSeats keeps a row's display name and leaves a nameless row without one", async () => {
      const rostering = await make();
      const { created } = await rostering.importSeats({
        rows: [{ ...benRow, displayName: "Ben Ortiz" }, anaRow],
      });
      expect(created).toHaveLength(2);
      expect(await rostering._getUnclaimedSeats({})).toEqual([
        {
          seat: created[0]._id,
          email: "ben@example.edu",
          kind: "STUDENT",
          section: null,
          displayName: "Ben Ortiz",
        },
        {
          seat: created[1]._id,
          email: "ana@example.edu",
          kind: "STUDENT",
          section: null,
          displayName: "",
        },
      ]);
      expect(await rostering._getPendingSeatByEmail({ email: "Ben@Example.edu" })).toEqual([
        { seat: created[0]._id, email: "ben@example.edu", displayName: "Ben Ortiz" },
      ]);
      expect(await rostering._getPendingSeatByEmail({ email: "ana@example.edu" })).toEqual([
        { seat: created[1]._id, email: "ana@example.edu", displayName: "" },
      ]);
    });

    test("a repeated row corrects the name of a still-pending seat and is still skipped", async () => {
      const rostering = await make();
      const { created } = await rostering.importSeats({
        rows: [{ ...benRow, displayName: "Ben Ortiz" }],
      });
      const seat = created[0]._id;
      const again = await rostering.importSeats({
        rows: [{ ...benRow, displayName: "Benjamin Ortiz" }],
      });
      // Refreshing the name creates nothing, so the row is reported as skipped.
      expect(again.created).toEqual([]);
      expect(again.skipped).toEqual(["ben@example.edu"]);
      expect(await rostering._getPendingSeatByEmail({ email: "ben@example.edu" })).toEqual([
        { seat, email: "ben@example.edu", displayName: "Benjamin Ortiz" },
      ]);
    });

    test("a repeated row carrying no name leaves a stored name alone", async () => {
      const rostering = await make();
      await rostering.importSeats({ rows: [{ ...benRow, displayName: "Ben Ortiz" }] });
      await rostering.importSeats({ rows: [benRow, { ...benRow, displayName: "" }] });
      expect(await rostering._getPendingSeatByEmail({ email: "ben@example.edu" })).toEqual([
        expect.objectContaining({ displayName: "Ben Ortiz" }),
      ]);
    });

    test("within one import the seat comes from the first row and the last name wins", async () => {
      const rostering = await make();
      const { section } = await rostering.createSection({
        name: "A",
        location: "26-100",
        meetingPattern: "MWF 10",
      });
      const result = await rostering.importSeats({
        rows: [
          { email: "ben@example.edu", kind: "STAFF", section: section._id, displayName: "Ben O." },
          { email: "Ben@Example.edu", kind: "STUDENT", displayName: "Benjamin Ortiz" },
        ],
      });
      expect(result.created).toHaveLength(1);
      expect(result.skipped).toEqual(["ben@example.edu"]);
      // The first row made the seat, so its kind and section stand.
      expect(await rostering._getUnclaimedSeats({})).toEqual([
        {
          seat: result.created[0]._id,
          email: "ben@example.edu",
          kind: "STAFF",
          section: section._id,
          displayName: "Benjamin Ortiz",
        },
      ]);
    });

    test("a later row never writes the name of a seat somebody already holds", async () => {
      const rostering = await make();
      const { created } = await rostering.importSeats({
        rows: [{ ...benRow, displayName: "Ben Ortiz" }],
      });
      const seat = created[0]._id;
      await rostering.claimSeat({ seat, user: "ben" });
      const again = await rostering.importSeats({
        rows: [{ ...benRow, displayName: "Somebody Else" }],
      });
      expect(again.created).toEqual([]);
      expect(again.skipped).toEqual(["ben@example.edu"]);
      // The seat is held, so no read answers a name for it at all.
      expect(await rostering._getPendingSeatByEmail({ email: "ben@example.edu" })).toEqual([]);
      expect(await rostering._getUnclaimedSeats({})).toEqual([]);
      // Dropping the seat does not put it back within reach of an import either.
      await rostering.dropSeat({ seat });
      const third = await rostering.importSeats({
        rows: [{ ...benRow, displayName: "Somebody Else" }],
      });
      expect(third.created).toEqual([]);
      expect(await rostering._getUnclaimedSeats({})).toEqual([]);
    });

    test("only _getUnclaimedSeats and _getPendingSeatByEmail answer a display name", async () => {
      const rostering = await make();
      const { created } = await rostering.importSeats({
        rows: [{ ...benRow, displayName: "Ben Ortiz" }],
      });
      const seat = created[0]._id;
      // While the seat waits, exactly two reads carry the name.
      expect(await rostering._getUnclaimedSeats({})).toEqual([
        expect.objectContaining({ displayName: "Ben Ortiz" }),
      ]);
      expect(await rostering._getPendingSeatByEmail({ email: "ben@example.edu" })).toEqual([
        expect.objectContaining({ displayName: "Ben Ortiz" }),
      ]);
      // No other read carries it, pending or held.
      expect(await rostering._getSeatByEmail({ email: "ben@example.edu" })).toEqual([
        { seat, email: "ben@example.edu" },
      ]);
      expect(created[0]).not.toHaveProperty("displayName");

      await rostering.claimSeat({ seat, user: "ben" });
      expect(await rostering._getSeatByUser({ user: "ben" })).toEqual([
        {
          seat,
          user: "ben",
          email: "ben@example.edu",
          kind: "STUDENT",
          section: null,
          status: "ACTIVE",
        },
      ]);
      expect(await rostering._getSeatDetail({ user: "ben" })).toEqual([
        {
          detail: {
            seat,
            user: "ben",
            email: "ben@example.edu",
            kind: "STUDENT",
            section: null,
            status: "ACTIVE",
          },
        },
      ]);
      expect(await rostering._getActiveMembers({})).toEqual([
        {
          user: "ben",
          seat,
          kind: "STUDENT",
          section: null,
          email: "ben@example.edu",
        },
      ]);
      expect(await rostering._getActiveStudents({})).toEqual([
        { user: "ben", seat, section: null, email: "ben@example.edu" },
      ]);
      await rostering.dropSeat({ seat });
      expect(await rostering._getDroppedSeats({})).toEqual([
        {
          user: "ben",
          seat,
          kind: "STUDENT",
          section: null,
          email: "ben@example.edu",
        },
      ]);
    });

    test("previewImport carries a display-name column through to importSeats", async () => {
      const rostering = await make();
      const { rows } = await rostering.previewImport({
        csv: "email,kind,displayName\nben@example.edu,STUDENT,Ben Ortiz\nana@example.edu,STUDENT,",
      });
      expect(rows).toEqual([
        { email: "ben@example.edu", kind: "STUDENT", displayName: "Ben Ortiz" },
        { email: "ana@example.edu", kind: "STUDENT", displayName: "" },
      ]);
      await rostering.importSeats({ rows });
      expect(await rostering._getUnclaimedSeats({})).toEqual([
        expect.objectContaining({ email: "ben@example.edu", displayName: "Ben Ortiz" }),
        expect.objectContaining({ email: "ana@example.edu", displayName: "" }),
      ]);
    });

    test("moveSection reassigns a seat's section and refuses an unknown seat", async () => {
      const rostering = await make();
      const { section } = await rostering.createSection({
        name: "A",
        location: "26-100",
        meetingPattern: "MWF 10",
      });
      const { created } = await rostering.importSeats({ rows: [anaRow] });
      const moved = await rostering.moveSection({ seat: created[0]._id, section: section._id });
      expect(moved.seat).toMatchObject({ section: section._id });
      await expectRefusal(
        () => rostering.moveSection({ seat: "no-such-seat", section: section._id }),
        refusalErrors.SeatNotFound,
      );
    });
  });
}
