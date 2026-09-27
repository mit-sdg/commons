import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { MongoAttendingConcept } from "../../src/concepts/attending/attending.mongo.ts";
import { NotAttending } from "../../src/concepts/attending/errors.ts";
import { attending as attendingRegistration } from "../../src/concepts/attending/registry.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

const start = new Date("2026-03-03T09:00:00Z");

function after(seconds: number): Date {
  return new Date(start.getTime() + seconds * 1000);
}

describe("Attending on MongoDB", () => {
  test("attend adds the attendee with what it holds", async () => {
    const attending = new MongoAttendingConcept(await testDb());
    expect(
      await attending.attend({ gathering: "quiz", attendee: "sam", holding: "", at: start }),
    ).toEqual({ attendee: "sam" });
    expect(await attending._present({ gathering: "quiz", since: start })).toEqual([
      { attendee: "sam", holding: "", heardAt: start },
    ]);
    expect(await attending._present({ gathering: "other", since: start })).toEqual([]);
  });

  test("a second attend inside twenty seconds with the same holding writes nothing", async () => {
    const attending = new MongoAttendingConcept(await testDb());
    await attending.attend({ gathering: "quiz", attendee: "sam", holding: "r1", at: start });
    await attending.attend({ gathering: "quiz", attendee: "sam", holding: "r1", at: after(3) });
    await attending.attend({
      gathering: "quiz",
      attendee: "sam",
      holding: "r1",
      at: after(19.999),
    });
    expect(await attending._present({ gathering: "quiz", since: start })).toEqual([
      { attendee: "sam", holding: "r1", heardAt: start },
    ]);
  });

  test("a changed holding inside the grain writes at once", async () => {
    const attending = new MongoAttendingConcept(await testDb());
    await attending.attend({ gathering: "quiz", attendee: "sam", holding: "", at: start });
    await attending.attend({ gathering: "quiz", attendee: "sam", holding: "r2", at: after(5) });
    expect(await attending._present({ gathering: "quiz", since: start })).toEqual([
      { attendee: "sam", holding: "r2", heardAt: after(5) },
    ]);
  });

  test("attend after the grain moves heardAt", async () => {
    const attending = new MongoAttendingConcept(await testDb());
    await attending.attend({ gathering: "quiz", attendee: "sam", holding: "r1", at: start });
    await attending.attend({ gathering: "quiz", attendee: "sam", holding: "r1", at: after(20) });
    expect(await attending._present({ gathering: "quiz", since: start })).toEqual([
      { attendee: "sam", holding: "r1", heardAt: after(20) },
    ]);
  });

  test("a check-in older than the one recorded keeps the newer holding", async () => {
    const attending = new MongoAttendingConcept(await testDb());
    await attending.attend({ gathering: "quiz", attendee: "sam", holding: "r2", at: after(10) });
    await attending.attend({ gathering: "quiz", attendee: "sam", holding: "r1", at: after(4) });
    await attending.attend({ gathering: "quiz", attendee: "sam", holding: "r1", at: after(10) });
    expect(await attending._present({ gathering: "quiz", since: start })).toEqual([
      { attendee: "sam", holding: "r2", heardAt: after(10) },
    ]);
  });

  test("leave removes the attendance, and a second leave refuses", async () => {
    const attending = new MongoAttendingConcept(await testDb());
    await attending.attend({ gathering: "quiz", attendee: "sam", holding: "r1", at: start });
    await attending.attend({ gathering: "other", attendee: "sam", holding: "", at: start });
    expect(await attending.leave({ gathering: "quiz", attendee: "sam" })).toEqual({
      attendee: "sam",
    });
    expect(await attending._present({ gathering: "quiz", since: start })).toEqual([]);
    expect(await attending._present({ gathering: "other", since: start })).toHaveLength(1);

    const err = await caughtError(() => attending.leave({ gathering: "quiz", attendee: "sam" }));
    expect(err).toBeInstanceOf(NotAttending);
    expect(err.message).toBe("This participant is not here.");
  });

  test("_present answers only attendances heard at or after since, in attendee order", async () => {
    const attending = new MongoAttendingConcept(await testDb());
    await attending.attend({ gathering: "quiz", attendee: "priya", holding: "", at: after(0) });
    await attending.attend({ gathering: "quiz", attendee: "zoe", holding: "r2", at: after(40) });
    await attending.attend({ gathering: "quiz", attendee: "ada", holding: "r2", at: after(60) });
    expect(await attending._present({ gathering: "quiz", since: after(40) })).toEqual([
      { attendee: "ada", holding: "r2", heardAt: after(60) },
      { attendee: "zoe", holding: "r2", heardAt: after(40) },
    ]);
    expect(await attending._present({ gathering: "quiz", since: after(61) })).toEqual([]);
  });

  test("concurrent attends from one attendee leave one attendance holding the newest", async () => {
    const attending = new MongoAttendingConcept(await testDb());
    const seconds = [7, 2, 9, 0, 5, 3, 8, 1, 6, 4];
    await Promise.all(
      seconds.map((second) =>
        attending.attend({
          gathering: "quiz",
          attendee: "sam",
          holding: `r${second}`,
          at: after(second),
        }),
      ),
    );
    expect(await attending._present({ gathering: "quiz", since: start })).toEqual([
      { attendee: "sam", holding: "r9", heardAt: after(9) },
    ]);
  });

  test("the attendance expires a day after heardAt", async () => {
    const db = await testDb();
    const attending = new MongoAttendingConcept(db);
    await attending.attend({ gathering: "quiz", attendee: "sam", holding: "", at: start });
    const indexes = await db.collection("attending.attendances").indexes();
    expect(indexes).toContainEqual(
      expect.objectContaining({ key: { heardAt: 1 }, expireAfterSeconds: 86_400 }),
    );
    expect(indexes).toContainEqual(
      expect.objectContaining({ key: { gathering: 1, attendee: 1 }, unique: true }),
    );
  });
});

describe("Attending shared by processes on one MongoDB database", () => {
  test("instances racing check-ins keep one attendance per attendee", async () => {
    const db = await testDb();
    const instances = Array.from({ length: 4 }, () => new MongoAttendingConcept(db));
    const attendees = ["ada", "priya", "sam"];
    await Promise.all(
      instances.flatMap((attending, index) =>
        attendees.map((attendee) =>
          attending.attend({ gathering: "quiz", attendee, holding: `r${index}`, at: after(index) }),
        ),
      ),
    );
    const present = await instances[0]._present({ gathering: "quiz", since: start });
    expect(present).toEqual(
      attendees.map((attendee) => ({ attendee, holding: "r3", heardAt: after(3) })),
    );
    expect(await db.collection("attending.attendances").countDocuments()).toBe(3);
  });

  test("an assembled engine answers a second leave with the refusal", async () => {
    const db = await testDb();
    const app = assemble({
      conceptSet: conceptSet({ Attending: attendingRegistration }),
      composition: {},
      instances: { Attending: new MongoAttendingConcept(db) },
    });
    await app.concepts.Attending.attend({
      gathering: "quiz",
      attendee: "sam",
      holding: "",
      at: start,
    });
    expect(await app.concepts.Attending.leave({ gathering: "quiz", attendee: "sam" })).toEqual({
      attendee: "sam",
    });
    expect(
      await app.concepts.Attending.leave({ gathering: "quiz", attendee: "sam" }),
    ).toMatchObject({ error: "NOT_ATTENDING", detail: "This participant is not here." });
  });
});
