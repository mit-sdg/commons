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
  eyebrow,
  carriesTo,
  sourceWall,
  edits,
  className,
}: {
  wall: WallShape;
  big?: boolean;
  phone?: boolean;
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
  const tray = trayOf(wall.cards);
  const piles = pilesByCount(wall.piles);
  const writing = Math.max(0, wall.begun - wall.handedIn);
  const vote = choicesOf(wall).length > 0;
  const editable = edits !== undefined && wall.open;
  const canDrag = edits !== undefined;

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
            : "px-7 pt-6 pb-8",
        className,
      )}
    >
      {phone ? null : (
        <header className="flex items-start justify-between gap-8">
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
            <span className="flex items-center gap-3">
              {wall.number === null ? (
                <span
                  className={cn(
                    "font-display font-semibold leading-none",
                    big ? "text-[44px]" : "text-[28px]",
                  )}
                >
                  {wall.title}
                </span>
              ) : (
                <RoundToken
                  number={wall.number}
                  title={wall.title}
                  standing={wall.open ? "open" : "done"}
                  size={big ? "xl" : "lg"}
                />
              )}
              {wall.open ? null : <span className="eyebrow">Closed</span>}
            </span>
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
        <>
          <VoteBars wall={wall} big={big} />
          {sourceWall === undefined || sourceWall === null ? null : (
            <PileGrid big={big} phone={phone} dense>
              {pilesByCount(sourceWall.piles).map((pile) => (
                <Pile
                  key={pile.pile}
                  name={pile.name}
                  count={pile.count}
                  description={pile.description}
                  cards={cardsIn(sourceWall.cards, pile.pile)}
                  faded
                  big={big}
                />
              ))}
            </PileGrid>
          )}
        </>
      ) : (
        <>
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
              "flex flex-wrap items-center gap-2 rounded-[10px] border border-input border-dashed",
              big
                ? "min-h-[72px] gap-3 rounded-[14px] p-4"
                : phone
                  ? "min-h-11 p-2"
                  : "min-h-14 p-3",
            )}
          >
            {tray.map((card) => (
              <Card
                key={card.card}
                card={card}
                big={big}
                draggable={canDrag}
                className={phone ? "px-2 py-1 text-[13px]" : undefined}
              />
            ))}
            {Array.from(
              { length: Math.min(writing, GHOSTS_SHOWN) },
              (_, index) => (
                <GhostCard key={index} big={big} />
              ),
            )}
          </div>

          <PileGrid big={big} phone={phone}>
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
                className={phone ? "min-h-24 px-3.5 pt-3 pb-2.5" : undefined}
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
  dense = false,
  children,
}: {
  big: boolean;
  phone: boolean;
  /** The source piles under a vote round stand closer together, five to a row. */
  dense?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid gap-x-[18px] gap-y-[22px] pb-3",
        big
          ? "grid-cols-3 gap-x-7 gap-y-[34px]"
          : phone
            ? "grid-cols-2 gap-x-3 gap-y-4"
            : "grid-cols-2 sm:grid-cols-3",
        dense && big && "grid-cols-5 gap-x-6",
      )}
    >
      {children}
    </div>
  );
}

/** A vote round: each choice with its count and a bar. */
function VoteBars({ wall, big }: { wall: WallShape; big: boolean }) {
  const choices = choicesOf(wall);
  const counts = new Map<string, number>(choices.map((choice) => [choice, 0]));
  for (const card of wall.cards) {
    if (counts.has(card.value))
      counts.set(card.value, (counts.get(card.value) ?? 0) + 1);
  }
  const most = Math.max(1, ...counts.values());
  return (
    <div className={cn("flex gap-4", big ? "gap-8" : "flex-col sm:flex-row")}>
      {choices.map((choice) => {
        const count = counts.get(choice) ?? 0;
        return (
          <div key={choice} className="flex flex-1 flex-col gap-3">
            <span
              className={cn(
                "flex items-center justify-center rounded-xl border border-border bg-card text-center",
                big ? "px-6 py-[30px] text-4xl" : "px-4 py-4 text-lg",
              )}
            >
              {choice}
            </span>
            <span className="flex items-center gap-4">
              <span
                className={cn(
                  "min-w-[46px] font-mono tabular-nums",
                  big ? "text-3xl" : "text-lg",
                )}
              >
                {count}
              </span>
              <span className="flex-1">
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
  );
}

export type { WallCard };
