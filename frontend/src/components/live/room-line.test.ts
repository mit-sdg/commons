import { describe, expect, test } from "bun:test";
import { ROOM_WAIT_MS, roomLine, seenOpen } from "./room-line";

const SETTLED = ROOM_WAIT_MS;

describe("what the dashboard says about the room", () => {
  test("counts the devices here before a round opens", () => {
    expect(roomLine({ here: 40, onOpenRound: 0 }, null, 0)).toBe("40 here");
    expect(roomLine({ here: 1, onOpenRound: 0 }, null, 0)).toBe("1 here");
  });

  test("keeps the count while every device here has the open round", () => {
    expect(roomLine({ here: 40, onOpenRound: 40 }, 2, SETTLED)).toBe("40 here");
  });

  test("says how many here do not have the open round yet", () => {
    expect(roomLine({ here: 40, onOpenRound: 38 }, 2, SETTLED)).toBe(
      "40 here, 2 don’t have round 2 yet",
    );
    expect(roomLine({ here: 40, onOpenRound: 0 }, 1, SETTLED)).toBe(
      "40 here, 40 don’t have round 1 yet",
    );
  });

  test("says one device missing in the singular", () => {
    expect(roomLine({ here: 40, onOpenRound: 39 }, 3, SETTLED)).toBe(
      "40 here, 1 doesn’t have round 3 yet",
    );
  });

  test("never counts more on the round than are here", () => {
    expect(roomLine({ here: 3, onOpenRound: 5 }, 2, SETTLED)).toBe("3 here");
  });

  test("says nobody is here as a count", () => {
    expect(roomLine({ here: 0, onOpenRound: 0 }, null, 0)).toBe("0 here");
    expect(roomLine({ here: 0, onOpenRound: 0 }, 2, SETTLED)).toBe("0 here");
  });
});

describe("the wait before the room line counts who is not on a round", () => {
  test("gives only the count for the first ten seconds a round is open", () => {
    expect(roomLine({ here: 40, onOpenRound: 0 }, 2, 0)).toBe("40 here");
    expect(roomLine({ here: 40, onOpenRound: 2 }, 2, 9_000)).toBe("40 here");
    expect(roomLine({ here: 40, onOpenRound: 2 }, 2, 9_999)).toBe("40 here");
  });

  test("names who is missing once the round has stood open ten seconds", () => {
    expect(roomLine({ here: 40, onOpenRound: 38 }, 2, 10_000)).toBe(
      "40 here, 2 don’t have round 2 yet",
    );
  });

  test("leaves the count of those here before a round opens", () => {
    expect(roomLine({ here: 40, onOpenRound: 0 }, null, 9_000)).toBe("40 here");
  });

  test("starts when the screen first sees a round open", () => {
    const first = seenOpen(null, "r2", 1_000);
    expect(first).toEqual({ round: "r2", at: 1_000 });
    expect(seenOpen(first, "r2", 4_000)).toBe(first);
  });

  test("starts again for a newly opened round", () => {
    const second = seenOpen({ round: "r2", at: 1_000 }, "r3", 30_000);
    expect(second).toEqual({ round: "r3", at: 30_000 });
    const waited = 35_000 - (second?.at ?? 0);
    expect(roomLine({ here: 40, onOpenRound: 0 }, 3, waited)).toBe("40 here");
  });

  test("forgets the round once none is open", () => {
    expect(seenOpen({ round: "r2", at: 1_000 }, null, 30_000)).toBeNull();
  });
});
