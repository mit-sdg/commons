"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The wall as the room sees it lags the wall as the server holds it, on
 * purpose: a snapshot arrives every few seconds with many cards moved at
 * once, and the screen plays those moves one at a time so each card is seen
 * to land. Only the end state matters. A snapshot that arrives while moves
 * are still playing replaces the target, so the queue never replays history
 * it has already been overtaken on.
 */

interface StagedCard {
  card: string;
  pile: string | null;
}

interface StagedPile {
  pile: string;
  count: number;
}

export interface Staged {
  cards: StagedCard[];
  piles: StagedPile[];
}

export type Move =
  | { kind: "open"; pile: string }
  | { kind: "arrive"; card: string }
  | { kind: "place"; card: string; pile: string }
  | { kind: "return"; card: string }
  | { kind: "leave"; card: string }
  | { kind: "close"; pile: string };

/** The moves that take the shown wall to the target, in the order they play. */
export function diff<Wall extends Staged>(shown: Wall, target: Wall): Move[] {
  const shownCards = new Map(shown.cards.map((card) => [card.card, card]));
  const targetCards = new Map(target.cards.map((card) => [card.card, card]));
  const shownPiles = new Set(shown.piles.map((pile) => pile.pile));
  const targetPiles = new Set(target.piles.map((pile) => pile.pile));

  const opens: Move[] = target.piles
    .filter((pile) => !shownPiles.has(pile.pile))
    .map((pile) => ({ kind: "open", pile: pile.pile }));
  const arrivals: Move[] = target.cards
    .filter((card) => !shownCards.has(card.card))
    .map((card) => ({ kind: "arrive", card: card.card }));
  const places: Move[] = target.cards.flatMap((card) => {
    const was = shownCards.get(card.card);
    // A card that arrives lands where the target has it, so it is not also placed.
    if (was === undefined || was.pile === card.pile) return [];
    return card.pile === null
      ? [{ kind: "return", card: card.card } as Move]
      : [{ kind: "place", card: card.card, pile: card.pile } as Move];
  });
  const leaves: Move[] = shown.cards
    .filter((card) => !targetCards.has(card.card))
    .map((card) => ({ kind: "leave", card: card.card }));
  const closes: Move[] = shown.piles
    .filter((pile) => !targetPiles.has(pile.pile))
    .map((pile) => ({ kind: "close", pile: pile.pile }));
  return [...opens, ...arrivals, ...places, ...leaves, ...closes];
}

/**
 * The shown wall after one move: every field of the target, with the cards
 * and piles as they stand after that move alone. Pile counts follow the
 * cards shown in them, never the target's counts, so a count never runs ahead
 * of the card it counts.
 */
export function apply<Wall extends Staged>(
  shown: Wall,
  target: Wall,
  move: Move,
): Wall {
  const targetCard = new Map(target.cards.map((card) => [card.card, card]));
  const targetPile = new Map(target.piles.map((pile) => [pile.pile, pile]));
  let cards = shown.cards.map((card) => ({
    ...(targetCard.get(card.card) ?? card),
    pile: card.pile,
  }));
  let piles = shown.piles.map((pile) => ({
    ...(targetPile.get(pile.pile) ?? pile),
  }));
  switch (move.kind) {
    case "open": {
      const opened = targetPile.get(move.pile);
      if (opened !== undefined) piles = [...piles, { ...opened }];
      break;
    }
    case "arrive": {
      const arrived = targetCard.get(move.card);
      if (arrived !== undefined) cards = [...cards, { ...arrived }];
      break;
    }
    case "place":
      cards = cards.map((card) =>
        card.card === move.card ? { ...card, pile: move.pile } : card,
      );
      break;
    case "return":
      cards = cards.map((card) =>
        card.card === move.card ? { ...card, pile: null } : card,
      );
      break;
    case "leave":
      cards = cards.filter((card) => card.card !== move.card);
      break;
    case "close":
      piles = piles.filter((pile) => pile.pile !== move.pile);
      break;
  }
  return { ...target, cards, piles: counted(piles, cards) };
}

function counted<Pile extends StagedPile>(
  piles: Pile[],
  cards: StagedCard[],
): Pile[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    if (card.pile !== null)
      counts.set(card.pile, (counts.get(card.pile) ?? 0) + 1);
  }
  return piles.map((pile) => ({ ...pile, count: counts.get(pile.pile) ?? 0 }));
}

/** The wall with these cards and piles, every pile counted from the cards. */
export function withCards<Wall extends Staged>(
  wall: Wall,
  cards: Wall["cards"],
  piles: Wall["piles"] = wall.piles,
): Wall {
  return { ...wall, cards, piles: counted(piles, cards) };
}

/**
 * The three hand edits as changes to the shown wall, so a drag lands under the
 * hand that made it and the snapshot that follows has nothing left to play.
 * Opening a pile only takes the card off the tray: the pile's identity is the
 * server's to mint, and the snapshot brings it with the card already in it.
 */
export const placed =
  (card: string, pile: string | null) =>
  <Wall extends Staged>(wall: Wall): Wall =>
    withCards(
      wall,
      wall.cards.map((one) => (one.card === card ? { ...one, pile } : one)),
    );

export const dropped =
  (card: string) =>
  <Wall extends Staged>(wall: Wall): Wall =>
    withCards(
      wall,
      wall.cards.filter((one) => one.card !== card),
    );

export const merged =
  (pile: string, into: string) =>
  <Wall extends Staged>(wall: Wall): Wall =>
    withCards(
      wall,
      wall.cards.map((one) =>
        one.pile === pile ? { ...one, pile: into } : one,
      ),
      wall.piles.filter((one) => one.pile !== pile),
    );

/**
 * The wall when nothing is left to move: the target whole — a pile's new name,
 * its lid, the pick on it — with the cards as they stand.
 */
export function adopt<Wall extends Staged>(shown: Wall, target: Wall): Wall {
  const targetCard = new Map(target.cards.map((card) => [card.card, card]));
  const cards = shown.cards.map((card) => ({
    ...(targetCard.get(card.card) ?? card),
    pile: card.pile,
  }));
  return withCards(target, cards);
}

/** How a card moves when it is placed, and how a pile settles when one opens. */
export const CARD_MOVE = {
  type: "spring",
  stiffness: 300,
  damping: 28,
  mass: 0.8,
} as const;

export const PILE_MOVE = {
  type: "spring",
  stiffness: 220,
  damping: 30,
  mass: 1,
} as const;

const STEP_MS = 380;

/**
 * How many steps a snapshot's moves are spread over at most, so the shown
 * wall reaches the server's inside one poll however many cards arrived: a
 * few moves play one at a time, a room's worth play several to a step.
 */
export const STEPS_TO_SETTLE = 6;

/**
 * The moves one step plays, fixed when a snapshot arrives from what it has to
 * play, so the whole diff settles within STEPS_TO_SETTLE. Read afresh each
 * step it would shrink with the remainder and a burst would trail off for
 * many times as long.
 */
export function movesPerStep(pending: number): number {
  return Math.max(1, Math.ceil(pending / STEPS_TO_SETTLE));
}

/**
 * The wall to draw. `wall` is the latest snapshot; `shown` trails it by a
 * step's worth of moves at a time until the two agree, never more than about
 * one poll behind. `edit` changes the shown wall at once — a hand move
 * already seen by the person who made it — and the snapshot that follows
 * finds nothing left to play for it. With `instant`, or before the first
 * snapshot, the shown wall is the target.
 */
export function useStagedWall<Wall extends Staged>(
  wall: Wall | null,
  {
    instant = false,
    step = STEP_MS,
  }: { instant?: boolean; step?: number } = {},
): {
  shown: Wall | null;
  settled: boolean;
  edit: (change: (wall: Wall) => Wall) => void;
} {
  const [shown, setShown] = useState<Wall | null>(wall);
  const [settled, setSettled] = useState(true);
  const target = useRef<Wall | null>(wall);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The step's quota, set from the first diff against each new target.
  const quota = useRef(0);

  useEffect(() => {
    target.current = wall;
    quota.current = 0;

    // Every move is played off the clock, so the snapshot that arrives never
    // changes the wall in the render that took it.
    function play() {
      timer.current = null;
      setShown((current) => {
        const next = target.current;
        if (next === null) return null;
        if (current === null || instant) return next;
        const moves = diff(current, next);
        if (quota.current === 0) quota.current = movesPerStep(moves.length);
        const playing = quota.current;
        setSettled(moves.length <= playing);
        if (moves.length === 0) return adopt(current, next);
        if (moves.length > playing && timer.current === null) {
          timer.current = setTimeout(play, step);
        }
        let played = current;
        for (const move of moves.slice(0, playing))
          played = apply(played, next, move);
        return played;
      });
    }

    if (timer.current === null) timer.current = setTimeout(play, 0);
  }, [wall, instant, step]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      // The slot is cleared with the timer: a mount that follows this one
      // reads it to decide whether a step is already coming, and a stale id
      // left standing would stop the wall from ever moving again.
      timer.current = null;
    },
    [],
  );

  const edit = useCallback((change: (wall: Wall) => Wall) => {
    setShown((current) => (current === null ? current : change(current)));
    if (target.current !== null) target.current = change(target.current);
  }, []);

  return {
    shown: instant ? wall : shown,
    settled: instant ? true : settled,
    edit,
  };
}
