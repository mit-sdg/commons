"use client";

import { useEffect, useRef, useState } from "react";
import { pilesByCount } from "@/components/live/rounds";
import { cn } from "@/lib/utils";

/** Which piles of the shown wall carry into the round that takes from it. */
export type PickMode = "top" | "all" | "hand";

/** The mode a run is being run in, which a reload keeps. */
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
 */
export function usePick({
  run,
  piles,
  picked,
  live,
  onPick,
}: {
  run: string;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the mode is what the browser holds, which only a read can say
    setChoice(recallPick(run));
  }, [run]);

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
    rememberPick(run, next);
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
      <div
        role="group"
        aria-labelledby={PICK_LABEL}
        className="ml-auto flex flex-none items-center gap-0.5 rounded-md border border-input p-0.5"
      >
        <div
          className={cn(
            "flex h-7 items-center rounded-[5px] transition-colors",
            mode === "top" ? "bg-primary/10" : "hover:bg-accent",
          )}
        >
          <button
            type="button"
            aria-pressed={mode === "top"}
            onClick={() => onMode("top")}
            className={cn(
              "h-7 rounded-[5px] pr-1 pl-2 text-xs",
              mode === "top"
                ? "font-medium text-primary"
                : "text-muted-foreground",
            )}
          >
            Top
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={TOP_LEAST}
            max={TOP_MOST}
            value={String(top)}
            aria-label="Top piles"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              const typed = Number(event.currentTarget.value.trim());
              if (Number.isInteger(typed)) onTop(clamp(typed));
            }}
            className="mr-0.5 h-6 w-7 rounded-[4px] border border-input bg-card text-center font-mono text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <Segment on={mode === "all"} onClick={() => onMode("all")}>
          All
        </Segment>
        <Segment on={mode === "hand"} onClick={() => onMode("hand")}>
          By hand
        </Segment>
      </div>
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
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-accent",
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

function recallPick(run: string): PickChoice {
  try {
    const stored = window.sessionStorage.getItem(PICK_KEY + run);
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

function rememberPick(run: string, choice: PickChoice): void {
  try {
    window.sessionStorage.setItem(
      PICK_KEY + run,
      `${choice.mode}:${choice.top}`,
    );
  } catch {
    // A browser that refuses storage still picks; it just starts each load fresh.
  }
}
