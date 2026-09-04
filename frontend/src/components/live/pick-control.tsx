"use client";

import { useEffect, useRef, useState } from "react";
import { pilesByCount } from "@/components/live/rounds";
import { cn } from "@/lib/utils";

/** Which piles of the shown wall carry into the round that takes from it. */
export type PickMode = "top" | "all" | "hand";

/** The mode a wall is picked in, which a reload keeps. */
const PICK_KEY = "commons-live-pick:";

const TOP_FRESH = 4;
const TOP_LEAST = 1;
const TOP_MOST = 9;

/** The control names its segments, and the number belongs to Top. */
const PICK_LABEL = "pick-mode";

/** A pile as the pick reads it: which one it is, and how full. */
interface PickPile {
  pile: string;
  count: number;
}

interface PickChoice {
  mode: PickMode;
  top: number;
}

const FRESH: PickChoice = { mode: "top", top: TOP_FRESH };

/**
 * The pick as the dashboard holds it: the mode, the number Top carries, and
 * the tap that takes the pick into hand. Top and All are maintained — every
 * time the wall moves under them, the whole set is sent again — until another
 * hand picks: a set this page did not send is someone else's pick, and the
 * page follows it into By hand rather than fighting over the wall.
 *
 * The mode and the set this page sent belong to the wall in hand, so a newly
 * closed round starts in Top with its own set instead of reading the round
 * before it as another hand.
 */
export function usePick({
  run,
  round,
  piles,
  picked,
  live,
  onPick,
}: {
  run: string;
  /** The shown wall's round, which the mode and the sent set belong to. */
  round: string | null;
  /** The shown wall's piles, in the order the wall opened them. */
  piles: PickPile[];
  /** The piles picked as the screen has them. */
  picked: string[];
  /** Whether the shown wall carries into a round that is still to open. */
  live: boolean;
  onPick: (piles: string[]) => void;
}): {
  mode: PickMode;
  top: number;
  setMode: (mode: PickMode) => void;
  setTop: (top: number) => void;
  tap: (pile: string) => void;
} {
  /** Nothing is maintained until the browser has been asked what it holds. */
  const [choice, setChoice] = useState<PickChoice | null>(null);
  const held = choice ?? FRESH;
  const send = useRef(onPick);
  /** The last set this page sent, so a set that differs is another hand's. */
  const sent = useRef<string[] | null>(null);

  useEffect(() => {
    send.current = onPick;
  });

  useEffect(() => {
    // The wall in hand is a fresh pick: what the page sent for the round
    // before it says nothing about this one.
    sent.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the mode is what the browser holds, which only a read can say
    setChoice(round === null ? null : recallPick(run, round));
  }, [run, round]);

  const wanted =
    choice === null || !live || choice.mode === "hand"
      ? null
      : setOf(choice, piles);

  useEffect(() => {
    if (wanted === null || same(wanted, picked)) return;
    if (sent.current !== null && !same(sent.current, picked)) {
      choose({ ...held, mode: "hand" });
      return;
    }
    sent.current = wanted;
    send.current(wanted);
  });

  function choose(next: PickChoice) {
    setChoice(next);
    if (round !== null) rememberPick(run, round, next);
  }

  return {
    mode: held.mode,
    top: held.top,
    setMode: (mode) => choose({ ...held, mode }),
    setTop: (top) => choose({ ...held, top }),
    tap: (pile) => {
      if (held.mode !== "hand") choose({ ...held, mode: "hand" });
      const next = picked.includes(pile)
        ? picked.filter((one) => one !== pile)
        : [...picked, pile];
      sent.current = next;
      send.current(next);
    },
  };
}

/** The three ways to pick, in one control. */
export function PickControl({
  mode,
  top,
  onMode,
  onTop,
}: {
  mode: PickMode;
  top: number;
  onMode: (mode: PickMode) => void;
  onTop: (top: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span id={PICK_LABEL} className="text-sm">
        Pick
      </span>
      <span className="ml-auto flex flex-none items-center gap-1.5">
        <span
          role="group"
          aria-labelledby={PICK_LABEL}
          className="flex items-center gap-0.5 rounded-md border border-input p-0.5"
        >
          <Segment on={mode === "top"} onClick={() => onMode("top")}>
            Top
          </Segment>
          <Segment on={mode === "all"} onClick={() => onMode("all")}>
            All
          </Segment>
          <Segment on={mode === "hand"} onClick={() => onMode("hand")}>
            By hand
          </Segment>
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={TOP_LEAST}
          max={TOP_MOST}
          value={String(top)}
          aria-label="Top piles"
          // The number belongs to Top, so it takes nothing in the modes
          // that ignore it.
          disabled={mode !== "top"}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const typed = Number(event.currentTarget.value.trim());
            if (Number.isInteger(typed)) onTop(clamp(typed));
          }}
          className="h-8 w-9 rounded-md border border-input bg-card text-center font-mono text-xs [appearance:textfield] disabled:cursor-default disabled:text-muted-foreground [&::-webkit-inner-spin-button]:appearance-none"
        />
        {/* The number counts piles, so the word it counts stands beside it;
            the box says it to a reader on its own. */}
        <span aria-hidden="true" className="text-muted-foreground text-xs">
          piles
        </span>
      </span>
    </div>
  );
}

function Segment({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-7 whitespace-nowrap rounded-[5px] px-2 text-xs transition-colors",
        on
          ? "bg-foreground font-medium text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** The set a maintained mode stands for: the fullest piles, or every one. */
function setOf(choice: PickChoice, piles: PickPile[]): string[] {
  const carried =
    choice.mode === "all" ? piles : pilesByCount(piles).slice(0, choice.top);
  return carried.map((pile) => pile.pile);
}

/** Two picks are the same pick whatever order they are read in. */
function same(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const there = new Set(right);
  return left.every((one) => there.has(one));
}

function clamp(top: number): number {
  return Math.min(TOP_MOST, Math.max(TOP_LEAST, top));
}

function recallPick(run: string, round: string): PickChoice {
  try {
    const stored = window.sessionStorage.getItem(keyOf(run, round));
    if (stored === null) return FRESH;
    const [word, count] = stored.split(":");
    const top = Number(count);
    return {
      mode: word === "all" || word === "hand" ? word : "top",
      top: Number.isInteger(top) ? clamp(top) : TOP_FRESH,
    };
  } catch {
    return FRESH;
  }
}

function keyOf(run: string, round: string): string {
  return `${PICK_KEY}${run}:${round}`;
}

function rememberPick(run: string, round: string, choice: PickChoice): void {
  try {
    window.sessionStorage.setItem(
      keyOf(run, round),
      `${choice.mode}:${choice.top}`,
    );
  } catch {
    // A browser that refuses storage still picks; it just starts each load fresh.
  }
}
