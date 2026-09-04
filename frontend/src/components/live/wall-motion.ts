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
/** How far the shown wall may trail the server before its wave hurries. */
export const MAX_LAG_MS = 9_000;
/** How long before its first card a pile opens, so the card is seen to fly into it. */
export const OPEN_AHEAD_MS = 200;

export interface Timed {
  move: Move;
  /** Milliseconds from the wave's start. */
  at: number;
}

/**
 * When each of a snapshot's moves plays, from the wave's start. Landings go
 * one at a time, a gap apart — arrivals first, then the cards leaving the
 * tray, newest first, since the newest are the cards the shelf shows and the
 * room should see each one go — at the same pace whether the snapshot
 * brought two cards or forty; a
 * wave that would trail the server by more than the lag allows is squeezed to
 * fit it. A pile opens a beat before the first card that lands in it, so the
 * room sees the card fly into a pile that is there to take it; a pile no card
 * lands in opens at once. What leaves or closes goes after the last landing.
 */
export function schedule(moves: Move[]): Timed[] {
  const landings = [
    ...moves.filter((move) => move.kind === "arrive"),
    ...moves.filter((move) => move.kind === "place").reverse(),
    ...moves.filter((move) => move.kind === "return"),
  ];
  const afterwards = moves.filter(
    (move) => move.kind === "leave" || move.kind === "close",
  );
  const gaps = landings.map((move) =>
    move.kind === "arrive" ? ARRIVAL_GAP_MS : LANDING_GAP_MS,
  );
  const span = gaps.slice(0, -1).reduce((sum, gap) => sum + gap, 0);
  const squeeze = span > MAX_LAG_MS ? MAX_LAG_MS / span : 1;
  const times: number[] = [];
  let at = 0;
  landings.forEach((_, index) => {
    times.push(Math.round(at));
    at += (gaps[index] ?? 0) * squeeze;
  });
  const last = times[times.length - 1] ?? 0;
  const firstLanding = new Map<string, number>();
  landings.forEach((move, index) => {
    if (move.kind !== "place" || firstLanding.has(move.pile)) return;
    firstLanding.set(move.pile, times[index] ?? 0);
  });
  const opens = moves.flatMap((move) => {
    if (move.kind !== "open") return [];
    const first = firstLanding.get(move.pile);
    return [
      {
        move,
        at: first === undefined ? 0 : Math.max(0, first - OPEN_AHEAD_MS),
      },
    ];
  });
  return [
    ...opens,
    ...landings.map((move, index) => ({ move, at: times[index] ?? 0 })),
    ...afterwards.map((move) => ({ move, at: last })),
  ];
}

/**
 * The wall to draw. `wall` is the latest snapshot; `shown` trails it by one
 * wave: a snapshot's moves are scheduled from the moment it arrives and each
 * plays at its time, so every card is seen to land, one at a time. A card
 * that leaves the tray leaves it at once, so the tray closes over its place
 * as the card flies, and a pile's count ticks as each card lands. A snapshot
 * that arrives mid-wave reschedules what is left from the wall as shown. `edit`
 * changes the shown wall at once — a hand move already seen by the person who
 * made it — and the snapshot that follows finds nothing left to play for it.
 * With `instant`, or before the first snapshot, the shown wall is the target.
 */
export function useStagedWall<Wall extends Staged>(
  wall: Wall | null,
  { instant = false }: { instant?: boolean } = {},
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
  // The shown wall as the timers last left it, read when the next one fires.
  const current = useRef<Wall | null>(wall);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  // The order cards landed in, so a pile's face shows what arrived last.
  const landings = useRef(new Map<string, number>());
  const stamp = useCallback((card: string) => {
    landings.current.set(card, landings.current.size + 1);
  }, []);

  const show = useCallback((next: Wall | null) => {
    current.current = next;
    setShown(next);
  }, []);

  const clear = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current.clear();
  }, []);

  /** `from` is the wall the wave has played, which by default is the shown one. */
  const finish = useCallback(
    (next: Wall, from: Wall | null = current.current) => {
      setSettled(true);
      show(from === null ? next : adopt(from, next));
    },
    [show],
  );

  // Every move is played off the clock, so the snapshot that arrives never
  // changes the wall in the render that took it.
  const start = useCallback(() => {
    const next = target.current;
    if (next === null) {
      setSettled(true);
      show(null);
      return;
    }
    const was = current.current;
    if (was === null || instant) {
      finish(next);
      return;
    }
    const moves = diff(was, next);
    if (moves.length === 0) {
      finish(next);
      return;
    }
    setSettled(false);
    const timed = schedule(moves);
    const times = [...new Set(timed.map((entry) => entry.at))].sort(
      (a, b) => a - b,
    );
    const lastTime = times[times.length - 1];
    for (const at of times) {
      const due = timed
        .filter((entry) => entry.at === at)
        .map((entry) => entry.move);
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        const goal = target.current;
        const standing = current.current;
        if (goal === null || standing === null) return;
        let played = standing;
        for (const move of due) {
          played = apply(played, goal, move);
          if (move.kind === "arrive" || move.kind === "place") stamp(move.card);
        }
        if (at === lastTime) {
          finish(goal, played);
        } else {
          show(played);
        }
      }, at);
      timers.current.add(timer);
    }
  }, [instant, finish, show, stamp]);

  useEffect(() => {
    target.current = wall;
    clear();
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      start();
    }, 0);
    timers.current.add(timer);
  }, [wall, clear, start]);

  useEffect(() => clear, [clear]);

  const edit = useCallback(
    (change: (wall: Wall) => Wall, card?: string) => {
      const standing = current.current;
      if (standing !== null) show(change(standing));
      if (target.current !== null) target.current = change(target.current);
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
