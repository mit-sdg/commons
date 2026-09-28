import { describe, expect, test } from "bun:test";
import {
  afterWallRead,
  kindOf,
  lastClosedWall,
  openEntryOf,
  type RelayRun,
  roundOnScreen,
  standingInRun,
} from "./rounds";

const round = (
  rest: Partial<{
    kind: string;
    choices: string[];
    parts: string[];
    takes: { use: string }[];
  }> = {},
) => ({ kind: "", choices: [], parts: [], takes: [], ...rest });

describe("the kind a round is", () => {
  test("is the word the leg holds, whatever the round was written with", () => {
    expect(kindOf(round({ kind: "vote", parts: ["a noun"] }))).toBe("vote");
    expect(kindOf(round({ kind: "write", choices: ["Warm"] }))).toBe("write");
    expect(kindOf(round({ kind: "list" }))).toBe("list");
  });

  test("is read off the round when the leg holds no word", () => {
    expect(kindOf(round({ choices: ["Warm", "Cool"] }))).toBe("vote");
    expect(kindOf(round({ parts: ["a noun", "a verb"] }))).toBe("list");
    expect(kindOf(round())).toBe("write");
  });

  test("is read off what the round takes when the leg holds no word", () => {
    expect(kindOf(round({ takes: [{ use: "choices" }] }))).toBe("vote");
    expect(kindOf(round({ takes: [{ use: "parts" }] }))).toBe("list");
    expect(kindOf(round({ takes: [{ use: "context" }] }))).toBe("write");
  });

  test("is read off the round when the leg holds a word that names no kind", () => {
    expect(kindOf(round({ kind: "poll", choices: ["Warm"] }))).toBe("vote");
  });
});

/** A phone's face read while round 2 opens: its rounds are read after its open round. */
const FACE = {
  openRound: null as string | null,
  rounds: [
    { number: 1, round: "r1", open: false },
    { number: 2, round: "r2", open: true },
    { number: 3, round: null, open: null },
  ],
};

describe("the round a phone shows open", () => {
  test("is the one the run names open", () => {
    expect(openEntryOf({ ...FACE, openRound: "r2" })?.number).toBe(2);
  });

  test("is none on a torn read that shows a round open by its flag alone", () => {
    expect(openEntryOf(FACE)).toBeNull();
  });
});

describe("the round a phone has on its screen for the room", () => {
  const phone = {
    round: "r2",
    runOpen: true,
    inHand: "r2",
    joined: true,
    handedIn: false,
  };

  test("is the open round once its join is answered", () => {
    expect(roundOnScreen(phone)).toBe("r2");
  });

  test("is the open round once its hand-in stands", () => {
    expect(roundOnScreen({ ...phone, joined: false, handedIn: true })).toBe(
      "r2",
    );
  });

  test("is none while the round is still opening on the phone", () => {
    expect(roundOnScreen({ ...phone, joined: false })).toBe("");
  });

  test("is none on the state the round before left behind", () => {
    expect(roundOnScreen({ ...phone, inHand: "r1", handedIn: true })).toBe("");
  });

  test("is none with no round open or the run closed", () => {
    expect(roundOnScreen({ ...phone, round: null })).toBe("");
    expect(roundOnScreen({ ...phone, runOpen: false })).toBe("");
  });
});

describe("how a round of a run stands", () => {
  test("is still to come on a torn read, as it stood before it opened", () => {
    expect(FACE.rounds.map((round) => standingInRun(FACE, round))).toEqual([
      "done",
      "next",
      "next",
    ]);
  });

  test("is open when the run names it, whatever its flag says", () => {
    expect(
      standingInRun({ openRound: "r2" }, { round: "r2", open: false }),
    ).toBe("open");
  });

  test("is still to come while the run names it opening, whatever its flag says", () => {
    expect(
      standingInRun(
        { openRound: null, opening: "r2" },
        { round: "r2", open: false },
      ),
    ).toBe("next");
  });

  test("is done once it has closed and the run names it neither", () => {
    expect(standingInRun(FACE, { round: "r1", open: false })).toBe("done");
  });
});

/** Round 1 closed with its wall, round 2 closed while it was still opening, round 3 opening. */
const CLOSED = {
  openRound: null,
  opening: "r3",
  rounds: [
    {
      round: "r1",
      figure: { open: false, closedAt: "2026-09-23T10:00:00.000Z" },
    },
    {
      round: "r2",
      figure: { open: false, closedAt: "2026-09-23T10:05:00.000Z" },
    },
    { round: "r3", figure: { open: true, closedAt: null } },
  ],
} as unknown as RelayRun;

describe("the closed round whose wall stands", () => {
  test("is the one closed last", () => {
    expect(lastClosedWall(CLOSED, new Set())).toBe("r2");
  });

  test("passes over a round read to have no wall", () => {
    expect(lastClosedWall(CLOSED, new Set(["r2"]))).toBe("r1");
    expect(lastClosedWall(CLOSED, new Set(["r1", "r2"]))).toBeNull();
  });

  test("is never the round opening, whatever its figure says", () => {
    const torn = {
      ...CLOSED,
      rounds: CLOSED.rounds.map((one) =>
        one.round === "r3"
          ? {
              ...one,
              figure: { open: false, closedAt: "2026-09-23T10:09:00.000Z" },
            }
          : one,
      ),
    } as RelayRun;
    expect(lastClosedWall(torn, new Set())).toBe("r2");
  });
});

describe("the rounds read to have no wall", () => {
  const none = new Set<string>();

  test("take a round whose read answered none", () => {
    expect([...afterWallRead(none, "r2", { wall: null })]).toEqual(["r2"]);
  });

  test("let a round go once its read answers a wall", () => {
    expect([...afterWallRead(new Set(["r2"]), "r2", { wall: {} })]).toEqual([]);
  });

  test("stay the same set while nothing is read or nothing changes", () => {
    expect(afterWallRead(none, "r2", null)).toBe(none);
    expect(afterWallRead(none, null, { wall: null })).toBe(none);
    expect(afterWallRead(none, "r1", { wall: {} })).toBe(none);
    const held = new Set(["r2"]);
    expect(afterWallRead(held, "r2", { wall: null })).toBe(held);
  });
});
