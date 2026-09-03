"use client";

import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { useState } from "react";
import {
  Card,
  CarriesTo,
  Count,
  GhostCard,
  NewPile,
  Pile,
} from "@/components/live/pile";
import { Figure, RoundToken } from "@/components/live/round-token";
import {
  cardsIn,
  choicesOf,
  distinctValues,
  isPicked,
  pilesByCount,
  promptOf,
  questionOf,
  trayOf,
  type WallCard,
  type Wall as WallShape,
} from "@/components/live/rounds";
import { Spread } from "@/components/live/spread";
import {
  dropped,
  merged,
  PILE_MOVE,
  placed,
  useStagedWall,
} from "@/components/live/wall-motion";
import { cn } from "@/lib/utils";

/** How many faint cards stand in the tray for answers still being written. */
const GHOSTS_SHOWN = 5;

/** How many unsorted cards the projector shows before the rest become a count. */
const TRAY_SHOWN = 24;

/** How many of a context group's words a chip carries before the rest are a count. */
const CONTEXT_SHOWN = 3;

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

interface WallProps {
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
  /** The piles scroll under the question rather than run off the screen. */
  scroll?: boolean;
  edits?: WallEdits;
  className?: string;
}

/**
 * The wall: the question, the figure, the tray of unsorted cards, and the
 * piles as stacks. One component serves the dashboard, the projector, and the
 * phone after hand-in; only its size and what it lets a hand do differ.
 *
 * Each round's wall is staged on its own, so opening a round or turning back
 * to an earlier one paints at once instead of replaying its sorting.
 */
export function Wall(props: WallProps) {
  return <StagedWall key={props.wall.round} {...props} />;
}

function StagedWall({
  wall,
  big = false,
  phone = false,
  named = big,
  eyebrow,
  carriesTo,
  sourceWall,
  scroll = false,
  edits,
  className,
}: WallProps) {
  const [naming, setNaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const reduced = useReducedMotion() ?? false;
  const { shown, edit } = useStagedWall(wall, { instant: reduced });
  const seen = shown ?? wall;

  // A hand edit lands on the wall the hand is looking at as well as on the
  // server, so the snapshot that answers it has nothing left to play.
  const hand: WallEdits | undefined =
    edits === undefined
      ? undefined
      : {
          ...edits,
          moveCard: (card, pile) => {
            edit(placed(card, pile));
            edits.moveCard(card, pile);
          },
          toTray: (card) => {
            edit(placed(card, null));
            edits.toTray(card);
          },
          // The new pile's identity is the server's to mint: the card leaves
          // the tray now and the snapshot brings the pile with it inside.
          openPile: (card, pileName) => {
            edit(dropped(card));
            edits.openPile(card, pileName);
          },
          mergePile:
            edits.mergePile === undefined
              ? undefined
              : (pile, into) => {
                  edit(merged(pile, into));
                  edits.mergePile?.(pile, into);
                },
        };

  const unsorted = trayOf(seen.cards);
  const piles = pilesByCount(seen.piles);
  const context = questionOf(seen)?.context ?? [];
  const writing = seen.open ? Math.max(0, seen.begun - seen.handedIn) : 0;
  const vote = choicesOf(seen).length > 0;
  const editable = hand !== undefined;
  const canDrag = hand !== undefined;
  const grid = projected(piles.length);
  const { tray, held } = big
    ? trayShown(unsorted, TRAY_SHOWN)
    : { tray: unsorted, held: 0 };
  const trayEmpty = tray.length === 0 && writing === 0;

  function openPile(card: string) {
    setNaming(card);
    setName("");
  }

  function commitPile() {
    if (naming === null || hand === undefined) return;
    const trimmed = name.trim();
    if (trimmed !== "") hand.openPile(naming, trimmed);
    setNaming(null);
  }

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <section
          className={cn(
            "flex min-h-0 flex-col gap-5 rounded-2xl border border-border bg-card",
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
                {seen.number === null ? (
                  <span
                    className={cn(
                      "truncate font-display font-semibold leading-none",
                      big ? "text-[44px]" : "text-[28px]",
                    )}
                  >
                    {seen.title}
                  </span>
                ) : named ? (
                  <RoundToken
                    number={seen.number}
                    title={seen.title}
                    standing={seen.open ? "open" : "done"}
                    size={big ? "xl" : "md"}
                    className="min-w-0"
                  />
                ) : null}
                {context.length === 0 ? null : (
                  <div className={cn("flex flex-wrap gap-2", big && "gap-3")}>
                    {context.map((group) => {
                      const values = distinctValues(group.cards);
                      return (
                        <div
                          key={group.name}
                          className={cn(
                            "flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-card",
                            big
                              ? "max-w-[420px] px-4 py-2.5"
                              : "max-w-[260px] px-3 py-1.5",
                          )}
                        >
                          <span
                            dir="auto"
                            className={cn(
                              "truncate font-medium",
                              big ? "text-xl" : "text-sm",
                            )}
                          >
                            {group.name}
                          </span>
                          <span
                            dir="auto"
                            className={cn(
                              "truncate text-muted-foreground",
                              big ? "text-lg" : "text-xs",
                            )}
                          >
                            {values.slice(0, CONTEXT_SHOWN).join(" · ")}
                            {values.length > CONTEXT_SHOWN
                              ? ` +${values.length - CONTEXT_SHOWN}`
                              : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p
                  dir="auto"
                  className={cn(
                    "font-display leading-[1.25]",
                    big ? "text-[44px] leading-[1.2]" : "text-2xl",
                  )}
                >
                  {promptOf(seen)}
                </p>
              </div>
              <Figure
                value={seen.handedIn}
                of={seen.begun}
                size={big ? "lg" : "md"}
                className="flex-none"
              />
            </header>
          )}

          {vote ? (
            <VoteBars
              wall={seen}
              sourceWall={sourceWall ?? null}
              carriesTo={carriesTo}
              onPick={hand?.togglePick}
              big={big}
              phone={phone}
              scroll={scroll}
            />
          ) : (
            <>
              {trayEmpty && !editable ? null : (
                <motion.div
                  layout
                  transition={PILE_MOVE}
                  onDragOver={
                    editable ? (event) => event.preventDefault() : undefined
                  }
                  onDrop={
                    editable
                      ? (event) => {
                          event.preventDefault();
                          const card = event.dataTransfer.getData("text/plain");
                          if (card !== "") hand.toTray(card);
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
                  <AnimatePresence initial={false}>
                    {tray.map((card) => (
                      <Card
                        key={card.card}
                        card={card}
                        big={big}
                        draggable={canDrag}
                        still={dragging === card.card}
                        onDragStart={(one) => setDragging(one.card)}
                        onDragEnd={() => setDragging(null)}
                        className={
                          big
                            ? "max-w-[420px]"
                            : phone
                              ? "px-2 py-1 text-[13px]"
                              : "max-w-[320px]"
                        }
                      />
                    ))}
                  </AnimatePresence>
                  {held === 0 ? null : (
                    <span className="font-mono text-2xl text-muted-foreground">
                      and {held} more
                    </span>
                  )}
                  {Array.from(
                    { length: Math.min(writing, GHOSTS_SHOWN) },
                    (_, index) => (
                      <GhostCard key={index} big={big} />
                    ),
                  )}
                </motion.div>
              )}

              <PileGrid
                big={big}
                phone={phone}
                columns={grid.columns}
                scroll={scroll}
              >
                <AnimatePresence initial={false}>
                  {piles.map((pile) => (
                    <Pile
                      key={pile.pile}
                      id={pile.pile}
                      name={pile.name}
                      count={pile.count}
                      description={pile.description}
                      cards={cardsIn(seen.cards, pile.pile)}
                      picked={isPicked(pile)}
                      carriesTo={carriesTo}
                      big={big}
                      packed={grid.packed}
                      onDrop={
                        editable
                          ? (card) => hand.moveCard(card, pile.pile)
                          : undefined
                      }
                      onTap={
                        hand?.togglePick === undefined
                          ? undefined
                          : () => hand.togglePick?.(pile.pile)
                      }
                      onRename={
                        editable && hand.renamePile !== undefined
                          ? (next) => hand.renamePile?.(pile.pile, next)
                          : undefined
                      }
                      onMergeIn={
                        editable && hand.mergePile !== undefined
                          ? (folded) => hand.mergePile?.(folded, pile.pile)
                          : undefined
                      }
                      onSummarize={
                        hand?.summarize === undefined
                          ? undefined
                          : () => hand.summarize?.(pile.pile)
                      }
                      phone={phone}
                    />
                  ))}
                </AnimatePresence>
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
      </LayoutGroup>
    </MotionConfig>
  );
}

function PileGrid({
  big,
  phone,
  columns,
  scroll,
  children,
}: {
  big: boolean;
  phone: boolean;
  /** How many piles stand to a row on the projector. */
  columns: number;
  scroll: boolean;
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
        scroll && "min-h-0 overflow-y-auto",
      )}
    >
      {children}
    </div>
  );
}

/**
 * A vote round: every choice with its count and a bar, in the order the
 * question offers them, and a choice nobody chose at nothing. Each row is the
 * ballot pile of that name, so it is picked and carried like any other pile.
 */
function VoteBars({
  wall,
  sourceWall,
  carriesTo,
  onPick,
  big,
  phone,
  scroll,
}: {
  wall: WallShape;
  sourceWall: WallShape | null;
  carriesTo?: number;
  onPick?: (pile: string) => void;
  big: boolean;
  phone: boolean;
  scroll: boolean;
}) {
  const rows = choicesOf(wall).map((choice) => {
    const pile = wall.piles.find((one) => one.name === choice) ?? null;
    const source = sourceWall?.piles.find((one) => one.name === choice) ?? null;
    return {
      choice,
      pile,
      count:
        pile === null
          ? wall.cards.filter((card) => card.value === choice).length
          : pile.count,
      // A ballot only repeats the choice, so the spread of a row reads the
      // cards the choice was made of, on the wall it came from.
      cards:
        source === null || sourceWall === null
          ? []
          : cardsIn(sourceWall.cards, source.pile),
      source,
    };
  });
  const most = Math.max(1, ...rows.map((row) => row.count));
  const side = big && rows.length <= 3;

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        scroll && "min-h-0 overflow-y-auto pb-3",
      )}
    >
      <div
        className={cn(
          side ? "flex gap-8" : "flex flex-col",
          !side && (big ? "gap-4" : "gap-2.5"),
        )}
      >
        {rows.map((row) => {
          const picked = row.pile !== null && isPicked(row.pile);
          const pile = row.pile;
          const tap =
            onPick === undefined || pile === null
              ? undefined
              : () => onPick(pile.pile);
          const spread = (
            <Spread
              name={row.choice}
              count={row.count}
              cards={row.cards}
              big={big}
            />
          );
          const count = (
            <Count
              value={row.count}
              className={cn(
                "flex-none font-mono tabular-nums",
                big ? "text-3xl" : "text-lg",
              )}
            />
          );
          const bar = (
            <span className={cn("block min-w-0", side ? "flex-1" : "w-full")}>
              <i
                className={cn(
                  "block rounded-sm bg-primary transition-[width] duration-500 ease-out",
                  big ? "h-3.5" : "h-2",
                )}
                style={{ width: `${Math.round((row.count / most) * 100)}%` }}
              />
            </span>
          );
          return (
            <VoteRow
              key={row.choice}
              picked={picked}
              onTap={tap}
              className={side ? "flex-1 gap-4 p-0 pb-4" : undefined}
            >
              {picked && carriesTo !== undefined ? (
                <CarriesTo number={carriesTo} big={big} />
              ) : null}
              {side ? (
                <>
                  <span
                    dir="auto"
                    className="flex flex-1 items-center justify-center break-words px-6 py-[30px] text-center text-4xl"
                  >
                    {row.choice}
                  </span>
                  <span className="flex items-center gap-4 px-4">
                    <span className="w-20">{count}</span>
                    {bar}
                    {spread}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-baseline gap-3">
                    <span
                      dir="auto"
                      className={cn(
                        "min-w-0 flex-1 break-words font-display font-semibold leading-[1.2]",
                        big ? "text-3xl" : "text-lg",
                      )}
                    >
                      {row.choice}
                    </span>
                    <span className="flex flex-none items-center gap-1">
                      {count}
                      {spread}
                    </span>
                  </span>
                  {bar}
                </>
              )}
            </VoteRow>
          );
        })}
      </div>
      {sourceWall === null || !side ? null : (
        <div className="flex gap-8">
          <AnimatePresence initial={false}>
            {rows.map((row) => (
              <div key={row.choice} className="flex min-w-0 flex-1 flex-col">
                {row.source === null ? null : (
                  <Pile
                    name={row.source.name}
                    count={row.source.count}
                    description={row.source.description}
                    cards={row.cards}
                    faded
                    counted={false}
                    big={big}
                    packed
                    phone={phone}
                  />
                )}
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/** One choice, standing and picked exactly as a pile does. */
function VoteRow({
  picked,
  onTap,
  className,
  children,
}: {
  picked: boolean;
  onTap?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      layout="position"
      transition={PILE_MOVE}
      role={onTap === undefined ? undefined : "button"}
      tabIndex={onTap === undefined ? undefined : 0}
      onClick={onTap}
      onKeyDown={
        onTap === undefined
          ? undefined
          : (event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onTap();
            }
      }
      className={cn(
        "relative flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3",
        picked && "outline outline-2 outline-primary -outline-offset-2",
        onTap !== undefined && "cursor-pointer hover:border-foreground/40",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export type { WallCard };
