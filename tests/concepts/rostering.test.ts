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
  externalKey: "ana-1",
  email: "ana@example.edu",
  rosterName: "Ana",
  kind: "STUDENT",
};
const benRow = {
  externalKey: "ben-1",
  email: "ben@example.edu",
  rosterName: "Ben",
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

    test("importSeats creates pending seats and reports a duplicate row as skipped", async () => {
      const rostering = await make();
      const first = await rostering.importSeats({ rows: [anaRow, benRow] });
      expect(first.created).toHaveLength(2);
      expect(first.skipped).toEqual([]);
      expect(first.created[0]).toMatchObject({
        externalKey: "ana-1",
        status: "PENDING",
        section: null,
      });
      const second = await rostering.importSeats({
        rows: [anaRow, { externalKey: "cai-1", email: "cai@example.edu", rosterName: "Cai" }],
      });
      expect(second.created).toHaveLength(1);
      expect(second.created[0]).toMatchObject({ externalKey: "cai-1", kind: "STUDENT" });
      expect(second.skipped).toEqual(["ana-1"]);
      expect(await rostering._getSeatByExternalKey({ externalKey: "ana-1" })).toEqual([
        { seat: first.created[0]._id, email: "ana@example.edu" },
      ]);
      expect(await rostering._getUnclaimedSeats({})).toHaveLength(3);
    });

    test("previewImport names rows from the CSV header", async () => {
      const rostering = await make();
      expect(
        await rostering.previewImport({
          csv: "externalKey,email,rosterName\nana-1,ana@example.edu,Ana",
        }),
      ).toEqual({
        rows: [{ externalKey: "ana-1", email: "ana@example.edu", rosterName: "Ana" }],
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
          rosterName: "Ana",
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
        { user: "ana", seat, section: null, rosterName: "Ana", email: "ana@example.edu" },
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
            externalKey: "ana-1",
            email: "ana@example.edu",
            rosterName: "Ana",
            kind: "STUDENT",
            section: section._id,
            status: "ACTIVE",
          },
        },
      ]);
      expect(await rostering._getSeatDetail({ user: "nobody" })).toEqual([]);
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
