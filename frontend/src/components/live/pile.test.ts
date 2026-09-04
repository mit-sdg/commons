import { describe, expect, test } from "bun:test";
import type { WallCard } from "@/components/live/rounds";
import { faceCards } from "./pile";

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
