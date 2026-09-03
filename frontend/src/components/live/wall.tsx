"use client";

import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  Answer,
  Card,
  CarriesTo,
  Count,
  faceCards,
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

/** How many faint cards stand at the top of the tray for answers still being written. */
const GHOSTS_SHOWN = 3;

/** How many unsorted cards the tray lists, newest first, before the rest fall off its bottom. */
const TRAY_SHOWN = 16;

/** How many of a context group's words a chip carries before the rest are a count. */
const CONTEXT_SHOWN = 3;

/** The gap beside a projected pile, the rows it lays out in, and the columns it may take. */
const PROJECTED_GAP = 28;
const PROJECTED_ROWS = 3;
const PROJECTED_COLUMNS = 8;

/** The least a pile stands on the projector: across, down, and packed down. */
const PROJECTED_LEAST = 190;
const PROJECTED_ROW = 150;
const PROJECTED_PACKED = 104;

/**
 * How the projector lays piles out: the columns that hold them in three rows,
 * each pile an even share of the wall but never narrower than it can be read,
 * so a narrow projector takes fewer columns and more rows. Two rows or more
 * share the height between them; one row stands tall and leaves the rest.
 */
function projected(count: number) {
  const columns = Math.min(
    PROJECTED_COLUMNS,
    Math.max(3, Math.ceil(count / PROJECTED_ROWS)),
  );
  const rows = Math.ceil(count / columns);
  const share = `calc((100cqw - ${(columns - 1) * PROJECTED_GAP}px) / ${columns})`;
  const packed = rows > 2;
  return {
    packed,
    fill: rows > 1,
    columns: `repeat(auto-fill, minmax(min(100%, max(${PROJECTED_LEAST}px, ${share})), 1fr))`,
    // Rows take their content's height above a floor, so a face with a lid
    // and three cards never runs past its box; a wall with more rows than fit
    // scrolls.
    rows: `minmax(${rows > 1 ? (packed ? PROJECTED_PACKED : PROJECTED_ROW) : PROJECTED_LEAST}px, max-content)`,
  };
}

/** The newest cards first, as many as the tray lists; the count above says the rest. */
function newest(cards: WallCard[], shown: number): WallCard[] {
  return cards.slice(-shown).reverse();
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
  /** The wall this round took from: it names the groups carried in, and the cards under a bar. */
  sourceWall?: WallShape | null;
  /** The piles scroll under the question rather than run off the screen. */
  scroll?: boolean;
  /** What stands where the piles will, while a wall that no hand sorts has none. */
  empty?: React.ReactNode;
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
  empty,
  edits,
  className,
}: WallProps) {
  const [naming, setNaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const reduced = useReducedMotion() ?? false;
  const { shown, settled, edit, landed } = useStagedWall(wall, {
    instant: reduced,
  });
  const seen = shown ?? wall;

  // A hand edit lands on the wall the hand is looking at as well as on the
  // server, so the snapshot that answers it has nothing left to play.
  const hand: WallEdits | undefined =
    edits === undefined
      ? undefined
      : {
          ...edits,
          moveCard: (card, pile) => {
            edit(placed(card, pile), card);
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
  const piles = useSettledOrder(seen.piles, settled);
  const context = questionOf(seen)?.context ?? [];
  const writing = seen.open ? Math.max(0, seen.begun - seen.handedIn) : 0;
  const vote = choicesOf(seen).length > 0;
  /** The round this wall's carried groups and choices came out of. */
  const from = sourceWall?.number ?? null;
  const editable = hand !== undefined;
  const canDrag = hand !== undefined;
  const grid = projected(piles.length);
  const tray = newest(unsorted, TRAY_SHOWN);
  // The tray keeps its column while a round is open; once the round has
  // closed and nothing is unsorted the piles take the whole width. The phone
  // counts the tray on its own page instead.
  const trayShown = !phone && (unsorted.length > 0 || writing > 0 || seen.open);

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
                  <div className="flex flex-col gap-1.5">
                    {/* The groups carried in are named by the round they come
                        from: a name that also stands on this wall below is
                        never read as this round's own. */}
                    {from === null ? null : (
                      <span
                        className={cn(
                          "flex items-center gap-2 text-muted-foreground",
                          big ? "text-xl" : "text-sm",
                        )}
                      >
                        from
                        <RoundToken
                          number={from}
                          title={sourceWall?.title}
                          size={big ? "lg" : "md"}
                        />
                      </span>
                    )}
                    <div className={cn("flex flex-wrap gap-2", big && "gap-3")}>
                      {context.map((group) => {
                        const values = distinctValues(group.cards);
                        const held = values.length - CONTEXT_SHOWN;
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
                              className={cn(
                                "flex min-w-0 items-baseline gap-1.5 text-muted-foreground",
                                big ? "text-lg" : "text-xs",
                              )}
                            >
                              <span dir="auto" className="truncate">
                                {values.slice(0, CONTEXT_SHOWN).join(" · ")}
                              </span>
                              {held <= 0 ? null : (
                                <span className="flex-none font-mono">
                                  and {held} more
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
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
              {/* The one figure the room reads, with the noun it counts. */}
              <span className="flex flex-none flex-col gap-1.5">
                <Figure
                  value={seen.handedIn}
                  of={seen.begun}
                  size={big ? "lg" : "md"}
                />
                <span
                  className={cn(
                    "text-muted-foreground leading-none",
                    big ? "text-xl" : "text-sm",
                  )}
                >
                  handed in
                </span>
              </span>
            </header>
          )}

          {vote ? (
            <VoteBars
              wall={seen}
              sourceWall={sourceWall ?? null}
              carriesTo={carriesTo}
              onPick={hand?.togglePick}
              big={big}
              scroll={scroll}
            />
          ) : (
            <>
              <div
                className={cn(
                  "grid gap-6",
                  trayShown &&
                    (big
                      ? "sm:grid-cols-[minmax(15rem,1fr)_minmax(0,3.4fr)]"
                      : "sm:grid-cols-[minmax(13.5rem,1fr)_minmax(0,2.4fr)]"),
                  big && "gap-10",
                  // On the projector the two columns share the height the wall
                  // has left, and each clips inside it.
                  scroll && "min-h-0 flex-1 grid-rows-[minmax(0,1fr)]",
                )}
              >
                {trayShown ? (
                  <Tray
                    cards={tray}
                    count={unsorted.length}
                    writing={writing}
                    big={big}
                    scroll={scroll}
                    dragging={dragging}
                    onDragStart={
                      canDrag ? (one) => setDragging(one) : undefined
                    }
                    onDragEnd={canDrag ? () => setDragging(null) : undefined}
                    onDrop={editable ? (card) => hand.toTray(card) : undefined}
                  />
                ) : null}
                {piles.length === 0 && !editable && empty !== undefined ? (
                  <div className="flex min-h-0 items-center justify-center">
                    {empty}
                  </div>
                ) : (
                  <PileGrid big={big} phone={phone} grid={grid} scroll={scroll}>
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
                          follow={scroll}
                          landed={landed}
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
                )}
              </div>
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

/**
 * The tray as a column: the count of everything unsorted, the answers still
 * being written as faint cards, then the newest card at the top and the
 * oldest falling off the bottom under a fade. A card placed from here travels
 * across into its pile.
 */
function Tray({
  cards,
  count,
  writing,
  big,
  scroll,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  cards: WallCard[];
  count: number;
  writing: number;
  big: boolean;
  scroll: boolean;
  dragging: string | null;
  onDragStart?: (card: string) => void;
  onDragEnd?: () => void;
  onDrop?: (card: string) => void;
}) {
  const { ref, over } = useOverflow(true);
  const editable = onDrop !== undefined;
  return (
    <motion.div
      layout
      transition={PILE_MOVE}
      onDragOver={editable ? (event) => event.preventDefault() : undefined}
      onDrop={
        editable
          ? (event) => {
              event.preventDefault();
              const card = event.dataTransfer.getData("text/plain");
              if (card !== "") onDrop(card);
            }
          : undefined
      }
      className={cn(
        "flex min-h-0 flex-col rounded-[10px] border border-input border-dashed",
        big
          ? "gap-3 rounded-[14px] border-foreground/50 p-[18px]"
          : "gap-2 p-3",
        // The column holds as much as the piles beside it, not more.
        scroll
          ? "self-stretch"
          : big
            ? "max-h-[640px]"
            : "max-h-60 sm:max-h-[560px]",
      )}
    >
      <div
        className={cn(
          "flex flex-none items-baseline justify-between gap-3 px-0.5 text-muted-foreground",
          big ? "text-xl" : "text-sm",
        )}
      >
        Tray
        <Count
          value={count}
          className={cn(
            "font-mono text-foreground tabular-nums",
            big ? "text-[34px]" : "text-lg",
          )}
        />
      </div>
      <div
        ref={ref}
        className={cn(
          "flex min-h-0 flex-col items-start",
          big ? "gap-3" : "gap-2",
          // What the column cannot hold fades out, rather than stopping on a cut.
          over &&
            "[mask-image:linear-gradient(to_bottom,#000_calc(100%_-_56px),transparent)]",
        )}
      >
        {/* The faint cards are answers on their way, not blanks; they stand
            where those answers will land. */}
        {writing === 0 ? null : (
          <span
            className={cn(
              "flex flex-none flex-wrap items-center gap-2 pb-1 font-mono text-muted-foreground",
              big ? "gap-2.5 text-xl" : "text-xs",
            )}
          >
            {Array.from(
              { length: Math.min(writing, GHOSTS_SHOWN) },
              (_, index) => (
                <GhostCard key={index} big={big} />
              ),
            )}
            still writing
          </span>
        )}
        <AnimatePresence initial={false}>
          {cards.map((card) => (
            <Card
              key={card.card}
              card={card}
              big={big}
              draggable={onDragStart !== undefined}
              still={dragging === card.card}
              onDragStart={(one) => onDragStart?.(one.card)}
              onDragEnd={onDragEnd}
              className="max-w-full"
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/**
 * The piles by count, re-sorted only when the wall has nothing left to play:
 * a pile that moves while cards are still landing crosses the others for no
 * reason the room can follow. A pile that opens mid-play takes the end; one
 * that closes leaves.
 */
function useSettledOrder<Pile extends { pile: string; count: number }>(
  piles: Pile[],
  settled: boolean,
): Pile[] {
  const [order, setOrder] = useState<string[]>([]);
  let next: string[];
  if (settled) {
    next = pilesByCount(piles).map((pile) => pile.pile);
  } else {
    const present = new Set(piles.map((pile) => pile.pile));
    const kept = order.filter((pile) => present.has(pile));
    const known = new Set(kept);
    next = [
      ...kept,
      ...piles.filter((pile) => !known.has(pile.pile)).map((pile) => pile.pile),
    ];
  }
  // The order is state carried from the last render, brought up to date here.
  if (
    next.length !== order.length ||
    next.some((id, index) => id !== order[index])
  ) {
    setOrder(next);
  }
  const byId = new Map(piles.map((pile) => [pile.pile, pile]));
  return next.flatMap((id) => {
    const pile = byId.get(id);
    return pile === undefined ? [] : [pile];
  });
}

function PileGrid({
  big,
  phone,
  grid,
  scroll,
  children,
}: {
  big: boolean;
  phone: boolean;
  /** How the projector lays its piles out, read against the wall's own width. */
  grid: ReturnType<typeof projected>;
  scroll: boolean;
  children: React.ReactNode;
}) {
  const { ref, over } = useOverflow(scroll);
  return (
    // The projector's piles take their share of the column's width, which
    // the column has to be asked for.
    <div
      style={big ? { containerType: "inline-size" } : undefined}
      className={cn("flex min-w-0 flex-col", scroll && "min-h-0")}
    >
      <div
        ref={ref}
        style={
          big
            ? { gridTemplateColumns: grid.columns, gridAutoRows: grid.rows }
            : undefined
        }
        className={cn(
          "grid gap-x-[18px] gap-y-[22px] pb-3",
          big
            ? "gap-x-7 gap-y-[34px]"
            : phone
              ? "grid-cols-2 gap-x-3 gap-y-4"
              : "grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] content-start",
          // Rows that share the wall take the height they are given; a lone row
          // of piles stands at the top of it.
          big && !grid.fill && "content-start",
          // The disc a picked pile carries hangs above the first row.
          scroll && "min-h-0 overflow-y-auto pt-5",
          // What the box cannot hold fades out, rather than stopping on a cut.
          over &&
            "[mask-image:linear-gradient(to_bottom,#000_calc(100%_-_56px),transparent)]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Whether a box holds more than it shows, watched as the wall fills it. */
function useOverflow(watch: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const box = ref.current;
    if (!watch || box === null) return;
    const read = () => setOver(box.scrollHeight - box.clientHeight > 1);
    read();
    // The box is watched with the piles inside it: neither the wall growing a
    // row nor the screen changing shape leaves the fade behind.
    const watcher = new ResizeObserver(read);
    watcher.observe(box);
    for (const pile of box.children) watcher.observe(pile);
    return () => watcher.disconnect();
  });

  return { ref, over };
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
  scroll,
}: {
  wall: WallShape;
  sourceWall: WallShape | null;
  carriesTo?: number;
  onPick?: (pile: string) => void;
  big: boolean;
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
    };
  });
  const most = Math.max(1, ...rows.map((row) => row.count));
  const side = big && rows.length <= 3;
  const from = sourceWall?.number ?? null;

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        // The disc a picked choice carries hangs above its card.
        scroll && "min-h-0 overflow-y-auto pt-5 pb-3",
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
            <span className="relative z-10 inline-flex flex-none">
              <Spread
                name={row.choice}
                count={row.count}
                cards={row.cards}
                big={big}
              />
            </span>
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
              label={`${row.choice}, ${voteWords(row.count)}`}
              picked={picked}
              onTap={tap}
              className={cn(
                // A projected card carries a hairline the back row can see.
                big && "border-foreground/50",
                side && "flex-1 gap-4 p-0 pb-4",
              )}
            >
              {picked && carriesTo !== undefined ? (
                <CarriesTo number={carriesTo} big={big} />
              ) : null}
              {side ? (
                <>
                  <span
                    dir="auto"
                    className="flex flex-1 items-center justify-center break-words px-6 py-[30px] text-center font-display font-semibold text-4xl"
                  >
                    {row.choice}
                  </span>
                  {/* The bar takes the width the row has left, so it still
                      reads as a tally on a narrow screen. */}
                  <span className="flex items-center gap-3 px-4">
                    <span className="min-w-[2ch] flex-none">{count}</span>
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
      {/* What each choice was made of, on the wall it came from — named by
          that round, since a choice and its cards share a name. */}
      {sourceWall === null || !side ? null : (
        <div className="flex flex-col gap-3">
          {from === null ? null : (
            <span className="flex items-center gap-2 text-muted-foreground text-xl">
              from
              <RoundToken number={from} title={sourceWall.title} size="lg" />
            </span>
          )}
          <div className="flex gap-8">
            {rows.map((row) => (
              <div key={row.choice} className="flex min-w-0 flex-1 flex-col">
                {row.cards.length === 0 ? null : (
                  <div className="flex flex-col gap-1.5 rounded-[14px] border border-foreground/40 border-dashed px-[22px] py-4 text-muted-foreground text-xl leading-[1.35]">
                    {faceCards(row.cards, false).map((card) => (
                      <Answer
                        key={card.card}
                        value={card.value}
                        className="line-clamp-1"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A choice's tally, as a screen reader reads it beside the name. */
function voteWords(count: number): string {
  return count === 1 ? "1 vote" : `${count} votes`;
}

/** One choice, standing and picked exactly as a pile does. */
function VoteRow({
  label,
  picked,
  onTap,
  className,
  children,
}: {
  /** The choice and its tally, for a reader who cannot see the bar. */
  label: string;
  picked: boolean;
  onTap?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      layout="position"
      transition={PILE_MOVE}
      className={cn(
        "relative flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3",
        picked && "outline outline-2 outline-primary -outline-offset-2",
        onTap !== undefined && "cursor-pointer hover:border-foreground/40",
        className,
      )}
    >
      {onTap === undefined ? null : (
        <button
          type="button"
          aria-pressed={picked}
          aria-label={label}
          onClick={onTap}
          className="absolute inset-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      )}
      {children}
    </motion.div>
  );
}

export type { WallCard };
