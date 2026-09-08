import { describe, expect, test } from "bun:test";
import type { WallCard } from "@/components/live/rounds";
import { cardWords, roomFigures, shelfOf, slotted, trashShown } from "./wall";

const card = (value: string, pile: string | null): WallCard =>
  ({
    card: value,
    value,
    pile,
    mine: false,
    model: false,
    part: "",
  }) as WallCard;

const pile = (name: string, count: number) => ({ pile: name, count });
const names = <Pile extends { pile: string }>(piles: Pile[]) =>
  piles.map((one) => one.pile);

describe("the slots the piles stand in", () => {
  test("a pile that opens takes the next free slot while the round is open", () => {
    const first = slotted([pile("p1", 3), pile("p2", 1)], [], true);
    expect(first.slots).toEqual(["p1", "p2"]);
    const second = slotted(
      [pile("p1", 3), pile("p2", 1), pile("p3", 9)],
      first.slots,
      true,
    );
    expect(names(second.piles)).toEqual(["p1", "p2", "p3"]);
  });

  test("a pile keeps its slot however its count moves", () => {
    const { piles } = slotted(
      [pile("p1", 1), pile("p2", 40)],
      ["p1", "p2"],
      true,
    );
    expect(names(piles)).toEqual(["p1", "p2"]);
  });

  test("a pile that closes gives its slot up and the rest keep theirs", () => {
    const { slots, piles } = slotted(
      [pile("p1", 3), pile("p3", 2)],
      ["p1", "p2", "p3"],
      true,
    );
    expect(slots).toEqual(["p1", "p3"]);
    expect(names(piles)).toEqual(["p1", "p3"]);
  });

  test("a closed round sorts by count, fullest first", () => {
    const { piles } = slotted(
      [pile("p1", 1), pile("p2", 9), pile("p3", 4)],
      ["p1", "p2", "p3"],
      false,
    );
    expect(names(piles)).toEqual(["p2", "p3", "p1"]);
  });
});

describe("the cards on the shelf", () => {
  const wall = [
    card("a", null),
    card("b", "p1"),
    card("c", null),
    card("d", null),
  ];

  test("it is the tray, oldest first", () => {
    expect(shelfOf(wall).map((one) => one.card)).toEqual(["a", "c", "d"]);
  });
});

describe("the three figures the room reads off a wall", () => {
  const wall = {
    open: true,
    begun: 20,
    begunByModel: 0,
    handedIn: 12,
    handedInByModel: 0,
  };

  test("an open round counts everyone who has not handed in as writing", () => {
    expect(roomFigures(wall)).toEqual({
      joined: 20,
      writing: 8,
      handedIn: 12,
    });
  });

  test("a closed round has nobody writing", () => {
    expect(roomFigures({ ...wall, open: false })).toEqual({
      joined: 20,
      writing: 0,
      handedIn: 12,
    });
  });

  test("the model's seats are out of every figure", () => {
    expect(
      roomFigures({
        open: true,
        begun: 20,
        begunByModel: 6,
        handedIn: 12,
        handedInByModel: 4,
      }),
    ).toEqual({ joined: 14, writing: 6, handedIn: 8 });
  });

  test("a wall handed in by more than it counts joined leaves nobody writing", () => {
    expect(
      roomFigures({
        open: true,
        begun: 3,
        begunByModel: 3,
        handedIn: 3,
        handedInByModel: 0,
      }),
    ).toEqual({ joined: 0, writing: 0, handedIn: 3 });
  });
});

describe("the card the wall says back after a move", () => {
  test("a short answer is said whole", () => {
    expect(cardWords("more worked examples")).toBe("“more worked examples”");
  });

  test("a long answer is cut after its first words", () => {
    expect(cardWords("one two three four five six seven")).toBe(
      "“one two three four five six…”",
    );
    expect(cardWords("one two three", 2)).toBe("“one two…”");
  });

  test("an answer of nothing but spaces is said as a blank card", () => {
    expect(cardWords("   ")).toBe("a blank card");
  });

  test("the words are said as one line, however they were written", () => {
    expect(cardWords(" pace \n the   lecture ")).toBe("“pace the lecture”");
  });
});

describe("the trash at the foot of the wall", () => {
  test("it stands while a card is in the air", () => {
    expect(trashShown("c1", true)).toBe(true);
  });

  test("nothing in the air, no trash", () => {
    expect(trashShown(null, true)).toBe(false);
  });

  test("a wall no hand can remove from has no trash", () => {
    expect(trashShown("c1", false)).toBe(false);
  });
});
