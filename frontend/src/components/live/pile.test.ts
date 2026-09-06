import { describe, expect, test } from "bun:test";
import type { WallCard } from "@/components/live/rounds";
import { cardCopy, elsewhere, faceCards } from "./pile";

const card = (value: string, mine = false): WallCard =>
  ({
    card: value,
    value,
    mine,
    model: false,
    part: "",
    pile: "p1",
  }) as WallCard;

const names = (cards: WallCard[]) => cards.map((one) => one.value);

describe("the cards a pile shows on its face", () => {
  test("shows the three that landed last, the newest at the top", () => {
    const cards = [card("a"), card("b"), card("c"), card("d"), card("e")];
    expect(names(faceCards(cards, false))).toEqual(["e", "d", "c"]);
  });

  test("shows every card of a pile that holds fewer than three", () => {
    expect(names(faceCards([card("a"), card("b")], false))).toEqual(["b", "a"]);
    expect(faceCards([], false)).toEqual([]);
  });

  test("promotes the holder's own card, then fills with the newest", () => {
    const cards = [card("a"), card("mine", true), card("c"), card("d")];
    expect(names(faceCards(cards, true))).toEqual(["mine", "d", "c"]);
  });

  test("shows the cards that landed last when the wall says when they landed", () => {
    const cards = [card("a"), card("b"), card("c"), card("d")];
    const landedAt: Record<string, number> = { a: 4, c: 3 };
    expect(names(faceCards(cards, false, (id) => landedAt[id] ?? 0))).toEqual([
      "a",
      "c",
      "d",
    ]);
  });

  test("leaves the holder's own cards out where they are nobody's", () => {
    const cards = [card("a"), card("mine", true), card("c")];
    expect(names(faceCards(cards, false))).toEqual(["c", "mine", "a"]);
  });
});

describe("the piles a menu offers", () => {
  const piles = [
    { pile: "p1", name: "Pace" },
    { pile: "p2", name: "Examples" },
    { pile: "p3", name: "Notation" },
  ];
  const ids = <Pile extends { pile: string }>(offered: Pile[]) =>
    offered.map((one) => one.pile);

  test("a card is not offered the pile it is already in", () => {
    expect(ids(elsewhere(piles, "p2"))).toEqual(["p1", "p3"]);
  });

  test("a card in the tray is offered every pile", () => {
    expect(ids(elsewhere(piles, null))).toEqual(["p1", "p2", "p3"]);
  });

  test("a pile does not fold into itself", () => {
    expect(ids(elsewhere(piles, "p1"))).toEqual(["p2", "p3"]);
    expect(elsewhere([{ pile: "p1", name: "Pace" }], "p1")).toEqual([]);
  });
});

describe("the copy a card floats over itself", () => {
  const chip = { left: 40, top: 120, width: 180, room: 900 };

  test("a card nothing is on floats nothing", () => {
    expect(cardCopy(null, false)).toBeNull();
  });

  test("a card under the pointer or holding the focus floats its answer", () => {
    expect(cardCopy(chip, false)).toEqual({
      left: 40,
      top: 120,
      minWidth: 180,
      maxWidth: 352,
    });
  });

  test("a card in the air floats nothing", () => {
    expect(cardCopy(chip, true)).toBeNull();
  });

  test("the copy is no wider than the screen has left of the chip", () => {
    expect(cardCopy({ ...chip, room: 240 }, false)?.maxWidth).toBe(228);
  });

  test("a chip wider than the room it stands in keeps its own width", () => {
    expect(cardCopy({ ...chip, room: 60 }, false)?.maxWidth).toBe(180);
  });
});
