"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The wall as the room sees it lags the wall as the server holds it, on
 * purpose: a snapshot arrives every few seconds with many cards moved at
 * once, and the screen plays those moves one at a time so each card is seen
 * to land, on one belt that outlives snapshots: a snapshot that arrives while
 * moves are still playing adds its moves to the end and leaves the cadence
 * alone. Only the end state matters.
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
  duration: 0.85,
  bounce: 0.18,
} as const;

export const PILE_MOVE = {
  type: "spring",
  stiffness: 220,
  damping: 30,
  mass: 1,
} as const;

/**
 * How far apart cards land when the wall keeps pace: a card leaving the tray
 * for a pile, and a card arriving on the tray. A room can follow one card at
 * a time at this pace; a wave is never faster than this unless it has to be.
 */
export const LANDING_GAP_MS = 320;
export const ARRIVAL_GAP_MS = 120;
/** How long a pile stands empty after it opens, before its first card lands. */
export const BIRTH_GAP_MS = 600;
/** How far the shown wall may trail the server before its moves hurry. */
export const MAX_LAG_MS = 9_000;
/** How long a card is in the air between the tray and a pile's face. */
export const FLIGHT_MS = 900;

/** How long the wall waits after each kind of move before the next one plays. */
export const GAP_MS: Record<Move["kind"], number> = {
  open: BIRTH_GAP_MS,
  arrive: ARRIVAL_GAP_MS,
  place: LANDING_GAP_MS,
  return: LANDING_GAP_MS,
  leave: 0,
  close: 0,
};

/**
 * A snapshot's moves in the order they join the belt: arrivals first; then
 * the cards leaving the tray, newest first, since the newest are the cards the
 * shelf shows and the room should see each one go, each pile opening just
 * before the first card that lands in it; a pile no card lands in opens
 * first; returns after; what leaves or closes goes last.
 */
export function ordered(moves: Move[]): Move[] {
  const opens = new Map(
    moves.flatMap((move) => (move.kind === "open" ? [[move.pile, move]] : [])),
  );
  const places = moves.filter((move) => move.kind === "place").reverse();
  const landings: Move[] = [];
  for (const move of places) {
    if (move.kind !== "place") continue;
    const open = opens.get(move.pile);
    if (open !== undefined) {
      landings.push(open);
      opens.delete(move.pile);
    }
    landings.push(move);
  }
  return [
    ...opens.values(),
    ...moves.filter((move) => move.kind === "arrive"),
    ...landings,
    ...moves.filter((move) => move.kind === "return"),
    ...moves.filter((move) => move.kind === "leave"),
    ...moves.filter((move) => move.kind === "close"),
  ];
}

/** How long the moves on the belt would take at full pace. */
export function span(belt: Move[]): number {
  return belt.reduce((sum, move) => sum + GAP_MS[move.kind], 0);
}

/**
 * The gap after the belt's first move. The belt keeps the full pace until
 * what is on it would trail the server by more than the lag allows; then
 * every gap shrinks by the same share, and grows back as the belt drains.
 */
export function gapAfter(belt: Move[]): number {
  const head = belt[0];
  if (head === undefined) return 0;
  const whole = span(belt);
  const squeeze = whole > MAX_LAG_MS ? MAX_LAG_MS / whole : 1;
  return Math.round(GAP_MS[head.kind] * squeeze);
}

export interface Timed {
  move: Move;
  /** Milliseconds from the belt's start. */
  at: number;
}

/** When each move on a belt plays if nothing more joins it. */
export function timeline(belt: Move[]): Timed[] {
  const timed: Timed[] = [];
  let at = 0;
  belt.forEach((move, index) => {
    timed.push({ move, at });
    at += gapAfter(belt.slice(index));
  });
  return timed;
}

/**
 * The wall to draw. `wall` is the latest snapshot; `shown` trails it by the
 * moves still on the belt. The belt is one queue that outlives snapshots: a
 * snapshot appends the moves that take the wall the belt will reach to the
 * wall the server holds, and never resets the clock, so mid-wave a poll
 * neither restarts the cadence nor lands two cards at once. `onMove` is told
 * each move the instant before it is shown. `edit` changes the shown wall at
 * once — a hand move already seen by the person who made it — and the
 * snapshot that follows finds nothing left to play for it. With `instant`,
 * or before the first snapshot, the shown wall is the target.
 */
export function useStagedWall<Wall extends Staged>(
  wall: Wall | null,
  {
    instant = false,
    onMove,
  }: { instant?: boolean; onMove?: (move: Move, shown: Wall) => void } = {},
): {
  shown: Wall | null;
  settled: boolean;
  /** Changes the shown wall at once; `card` names the card the hand just placed. */
  edit: (change: (wall: Wall) => Wall, card?: string) => void;
  /** When each card last landed on the shown wall, later landings higher. */
  landed: (card: string) => number;
} {
  const [shown, setShown] = useState<Wall | null>(wall);
  const [settled, setSettled] = useState(true);
  const target = useRef<Wall | null>(wall);
  // The wall the belt reaches once everything on it has played.
  const reached = useRef<Wall | null>(wall);
  // The shown wall as the belt last left it, read when the next move plays.
  const current = useRef<Wall | null>(wall);
  const belt = useRef<Move[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const told = useRef(onMove);
  useEffect(() => {
    told.current = onMove;
  });
  // The order cards landed in, so a pile's face shows what arrived last.
  const landings = useRef(new Map<string, number>());
  const stamp = useCallback((card: string) => {
    landings.current.set(card, landings.current.size + 1);
  }, []);

  const show = useCallback((next: Wall | null) => {
    current.current = next;
    setShown(next);
  }, []);

  const finish = useCallback(() => {
    timer.current = null;
    const goal = target.current;
    const standing = current.current;
    setSettled(true);
    show(goal === null || standing === null ? goal : adopt(standing, goal));
  }, [show]);

  // One move plays, then the belt waits its gap before the next; the belt
  // stops only when it is empty.
  const pump = useCallback(
    function pump() {
      timer.current = null;
      const move = belt.current.shift();
      const goal = target.current;
      const standing = current.current;
      if (move === undefined || goal === null || standing === null) {
        finish();
        return;
      }
      told.current?.(move, standing);
      const played = apply(standing, goal, move);
      if (move.kind === "arrive" || move.kind === "place") stamp(move.card);
      show(played);
      if (belt.current.length === 0) {
        finish();
        return;
      }
      timer.current = setTimeout(pump, gapAfter([move, ...belt.current]));
    },
    [finish, show, stamp],
  );

  // Every move is played off the clock, so the snapshot that arrives never
  // changes the wall in the render that took it.
  useEffect(() => {
    target.current = wall;
    const from = reached.current;
    reached.current = wall;
    if (wall === null || from === null || instant) {
      belt.current = [];
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(finish, 0);
      return;
    }
    const moves = ordered(diff(from, wall));
    if (moves.length === 0) {
      if (timer.current === null) timer.current = setTimeout(finish, 0);
      return;
    }
    setSettled(false);
    belt.current.push(...moves);
    if (timer.current === null) timer.current = setTimeout(pump, 0);
  }, [wall, instant, finish, pump]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );

  const edit = useCallback(
    (change: (wall: Wall) => Wall, card?: string) => {
      const standing = current.current;
      if (standing !== null) show(change(standing));
      if (target.current !== null) target.current = change(target.current);
      if (reached.current !== null) reached.current = change(reached.current);
      if (card !== undefined) stamp(card);
    },
    [show, stamp],
  );

  const landed = useCallback(
    (card: string) => landings.current.get(card) ?? 0,
    [],
  );

  return {
    shown: instant ? wall : shown,
    settled: instant ? true : settled,
    edit,
    landed,
  };
}
