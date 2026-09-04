import { describe, expect, test } from "bun:test";
import type { WallCard } from "@/components/live/rounds";
import { shelfOf, slotted } from "./wall";

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

describe("the places on the shelf", () => {
  const wall = [
    card("a", null),
    card("b", "p1"),
    card("c", null),
    card("d", null),
  ];

  test("between waves it is the tray, oldest first", () => {
    expect(shelfOf(wall, null).map((place) => place.card.card)).toEqual([
      "a",
      "c",
      "d",
    ]);
    expect(shelfOf(wall, null).every((place) => !place.flown)).toBe(true);
  });

  test("a card that has flown keeps its place, and the wave's late arrivals follow", () => {
    const places = shelfOf(wall, ["a", "b", "c"]);
    expect(places.map((place) => [place.card.card, place.flown])).toEqual([
      ["a", false],
      ["b", true],
      ["c", false],
      ["d", false],
    ]);
  });

  test("a card that has left the wall leaves no place behind", () => {
    expect(
      shelfOf(wall, ["a", "gone"]).map((place) => place.card.card),
    ).toEqual(["a", "c", "d"]);
  });
});
