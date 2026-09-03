"use client";

import { useState } from "react";
import { Card, GhostCard, NewPile, Pile } from "@/components/live/pile";
import { Figure, RoundToken } from "@/components/live/round-token";
import {
  cardsIn,
  choicesOf,
  isPicked,
  pilesByCount,
  promptOf,
  trayOf,
  type WallCard,
  type Wall as WallShape,
} from "@/components/live/rounds";
import { cn } from "@/lib/utils";

/** How many faint cards stand in the tray for answers still being written. */
const GHOSTS_SHOWN = 5;

/** How many unsorted cards the tray shows before the rest become a count. */
const TRAY_SHOWN = { big: 24, wide: 14, phone: 8 };

/** The widest a pile stands on the projector, the gap beside it, and the rows that fit. */
const PROJECTED_PILE = 520;
const PROJECTED_GAP = 28;
const PROJECTED_ROWS = 3;

/** How the projector lays piles out: enough columns to hold them, packed past two rows. */
function projected(count: number) {
  const columns = Math.min(6, Math.max(3, Math.ceil(count / PROJECTED_ROWS)));
  return { columns, packed: Math.ceil(count / columns) > 2 };
}

/**
 * The cards the tray shows — the newest, and the holder's own among them —
 * and how many are left over.
 */
function trayShown(cards: WallCard[], shown: number) {
  if (cards.length <= shown) return { tray: cards, held: 0 };
  const own = cards.filter((card) => card.mine).slice(0, shown);
  const others = cards.filter((card) => !card.mine);
  const room = shown - own.length;
  return {
    tray: [...own, ...others.slice(others.length - room)],
    held: cards.length - shown,
  };
}

export interface WallEdits {
  moveCard: (card: string, pile: string) => void;
  toTray: (card: string) => void;
  openPile: (card: string, name: string) => void;
  /** Tapping a pile toggles whether it carries into the next round. */
  togglePick?: (pile: string) => void;
  renamePile?: (pile: string, name: string) => void;
  mergePile?: (pile: string, into: string) => void;
  summarize?: (pile: string) => void;
}

/**
 * The wall: the question, the figure, the tray of unsorted cards, and the
 * piles as stacks. One component serves the dashboard, the projector, and the
 * phone after hand-in; only its size and what it lets a hand do differ.
 */
export function Wall({
  wall,
  big = false,
  phone = false,
  named = big,
  eyebrow,
  carriesTo,
  sourceWall,
  edits,
  className,
}: {
  wall: WallShape;
  big?: boolean;
  phone?: boolean;
  named?: boolean;
  /** The relay's title, small above the round token. */
  eyebrow?: string;
  /** The number of the round picked piles carry into, when one takes from this wall. */
  carriesTo?: number;
  /** The wall a vote round took its choices from; its piles stand faded beneath the bars. */
  sourceWall?: WallShape | null;
  edits?: WallEdits;
  className?: string;
}) {
  const [naming, setNaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const unsorted = trayOf(wall.cards);
  const piles = pilesByCount(wall.piles);
  const writing = wall.open ? Math.max(0, wall.begun - wall.handedIn) : 0;
  const vote = choicesOf(wall).length > 0;
  const editable = edits !== undefined && wall.open;
  const canDrag = edits !== undefined;
  const grid = projected(piles.length);
  const shown = big
    ? TRAY_SHOWN.big
    : phone
      ? TRAY_SHOWN.phone
      : TRAY_SHOWN.wide;
  const { tray, held } = trayShown(unsorted, shown);
  const trayEmpty = tray.length === 0 && writing === 0;

  function openPile(card: string) {
    setNaming(card);
    setName("");
  }

  function commitPile() {
    if (naming === null || edits === undefined) return;
    const trimmed = name.trim();
    if (trimmed !== "") edits.openPile(naming, trimmed);
    setNaming(null);
  }

  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-2xl border border-border bg-card",
        big
          ? "gap-9 border-0 bg-transparent p-0"
          : phone
            ? "gap-4 border-0 bg-transparent p-0"
            : "border-0 bg-transparent px-0 pt-5 pb-6 sm:border sm:bg-card sm:px-7 sm:pt-6 sm:pb-8",
        className,
      )}
    >
      {phone ? null : (
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="flex min-w-0 flex-col gap-2.5">
            {eyebrow === undefined ? null : (
              <span
                className={cn(
                  "font-display text-muted-foreground leading-none",
                  big ? "text-[22px]" : "text-sm",
                )}
              >
                {eyebrow}
              </span>
            )}
            {wall.number === null ? (
              <span
                className={cn(
                  "truncate font-display font-semibold leading-none",
                  big ? "text-[44px]" : "text-[28px]",
                )}
              >
                {wall.title}
              </span>
            ) : named ? (
              <RoundToken
                number={wall.number}
                title={wall.title}
                standing={wall.open ? "open" : "done"}
                size={big ? "xl" : "md"}
                className="min-w-0"
              />
            ) : null}
            <p
              dir="auto"
              className={cn(
                "font-display leading-[1.25]",
                big ? "text-[44px] leading-[1.2]" : "text-2xl",
                wall.open ? undefined : "text-muted-foreground",
              )}
            >
              {promptOf(wall)}
            </p>
          </div>
          <Figure
            value={wall.handedIn}
            of={wall.begun}
            size={big ? "lg" : "md"}
            className="flex-none"
          />
        </header>
      )}

      {vote ? (
        <VoteBars
          wall={wall}
          sourceWall={sourceWall ?? null}
          big={big}
          phone={phone}
        />
      ) : (
        <>
          {trayEmpty && !editable ? null : (
            <div
              onDragOver={
                editable ? (event) => event.preventDefault() : undefined
              }
              onDrop={
                editable
                  ? (event) => {
                      event.preventDefault();
                      const card = event.dataTransfer.getData("text/plain");
                      if (card !== "") edits.toTray(card);
                    }
                  : undefined
              }
              className={cn(
                "flex flex-none flex-wrap items-center gap-2 rounded-[10px] border border-input border-dashed",
                big
                  ? "min-h-[72px] gap-3 rounded-[14px] p-4"
                  : phone
                    ? "min-h-11 p-2"
                    : "min-h-14 p-3",
                trayEmpty && "min-h-9 p-2",
              )}
            >
              {tray.map((card) => (
                <Card
                  key={card.card}
                  card={card}
                  big={big}
                  draggable={canDrag}
                  className={
                    big
                      ? "max-w-[420px]"
                      : phone
                        ? "px-2 py-1 text-[13px]"
                        : "max-w-[320px]"
                  }
                />
              ))}
              {held === 0 ? null : (
                <span
                  className={cn(
                    "font-mono text-muted-foreground",
                    big ? "text-2xl" : phone ? "text-[13px]" : "text-[15px]",
                  )}
                >
                  and {held} more
                </span>
              )}
              {Array.from(
                { length: Math.min(writing, GHOSTS_SHOWN) },
                (_, index) => (
                  <GhostCard key={index} big={big} />
                ),
              )}
            </div>
          )}

          <PileGrid big={big} phone={phone} columns={grid.columns}>
            {piles.map((pile) => (
              <Pile
                key={pile.pile}
                id={pile.pile}
                name={pile.name}
                count={pile.count}
                description={pile.description}
                cards={cardsIn(wall.cards, pile.pile)}
                picked={isPicked(pile)}
                carriesTo={carriesTo}
                big={big}
                packed={grid.packed}
                onDrop={
                  editable
                    ? (card) => edits.moveCard(card, pile.pile)
                    : undefined
                }
                onTap={
                  edits?.togglePick === undefined
                    ? undefined
                    : () => edits.togglePick?.(pile.pile)
                }
                onRename={
                  editable && edits.renamePile !== undefined
                    ? (next) => edits.renamePile?.(pile.pile, next)
                    : undefined
                }
                onMergeIn={
                  editable && edits.mergePile !== undefined
                    ? (dropped) => edits.mergePile?.(dropped, pile.pile)
                    : undefined
                }
                onSummarize={
                  edits?.summarize === undefined
                    ? undefined
                    : () => edits.summarize?.(pile.pile)
                }
                phone={phone}
              />
            ))}
            {editable ? <NewPile big={big} onDrop={openPile} /> : null}
          </PileGrid>
        </>
      )}

      {naming !== null ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            commitPile();
          }}
          className="flex items-center gap-2"
        >
          <input
            // biome-ignore lint/a11y/noAutofocus: the name is being typed the moment it appears.
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitPile}
            placeholder="Name the pile"
            aria-label="Name the pile"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </form>
      ) : null}
    </section>
  );
}

function PileGrid({
  big,
  phone,
  columns,
  children,
}: {
  big: boolean;
  phone: boolean;
  /** How many piles stand to a row on the projector. */
  columns: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={
        big
          ? {
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              maxWidth: columns * (PROJECTED_PILE + PROJECTED_GAP),
            }
          : undefined
      }
      className={cn(
        "grid gap-x-[18px] gap-y-[22px] pb-3",
        big
          ? "flex-1 content-start grid-cols-2 gap-x-7 gap-y-[34px] lg:grid-cols-3"
          : phone
            ? "grid-cols-2 gap-x-3 gap-y-4"
            : "grid-cols-2 sm:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

/**
 * A vote round: each choice with its count and a bar, and under it the pile
 * the choice came from — its name and its top cards, the vote being the figure.
 */
function VoteBars({
  wall,
  sourceWall,
  big,
  phone,
}: {
  wall: WallShape;
  sourceWall: WallShape | null;
  big: boolean;
  phone: boolean;
}) {
  const choices = choicesOf(wall);
  const counts = new Map<string, number>(choices.map((choice) => [choice, 0]));
  for (const card of wall.cards) {
    if (counts.has(card.value))
      counts.set(card.value, (counts.get(card.value) ?? 0) + 1);
  }
  const most = Math.max(1, ...counts.values());
  const row = cn("flex gap-4", big ? "gap-8" : "flex-col sm:flex-row");
  return (
    <div className="flex flex-col gap-6">
      <div className={row}>
        {choices.map((choice) => {
          const count = counts.get(choice) ?? 0;
          return (
            <div key={choice} className="flex min-w-0 flex-1 flex-col gap-3">
              <span
                dir="auto"
                className={cn(
                  "flex flex-1 items-center justify-center break-words rounded-xl border border-border bg-card text-center",
                  big ? "px-6 py-[30px] text-4xl" : "px-4 py-4 text-lg",
                )}
              >
                {choice}
              </span>
              <span className="flex items-center gap-4">
                <span
                  className={cn(
                    "flex-none font-mono tabular-nums",
                    big ? "w-20 text-3xl" : "w-[46px] text-lg",
                  )}
                >
                  {count}
                </span>
                <span className="min-w-0 flex-1">
                  <i
                    className={cn(
                      "block rounded-sm bg-primary",
                      big ? "h-3.5" : "h-2",
                    )}
                    style={{ width: `${Math.round((count / most) * 100)}%` }}
                  />
                </span>
              </span>
            </div>
          );
        })}
      </div>
      {sourceWall === null ? null : (
        <div className={row}>
          {choices.map((choice) => {
            const source = sourceWall.piles.find(
              (pile) => pile.name === choice,
            );
            return (
              <div key={choice} className="flex min-w-0 flex-1 flex-col">
                {source === undefined ? null : (
                  <Pile
                    name={source.name}
                    count={source.count}
                    description={source.description}
                    cards={cardsIn(sourceWall.cards, source.pile)}
                    faded
                    counted={false}
                    big={big}
                    packed={big}
                    phone={phone}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { WallCard };
