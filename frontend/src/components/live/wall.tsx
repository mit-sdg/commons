"use client";

import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Flights, measure, useFlights } from "@/components/live/flights";
import {
  Answer,
  Card,
  CarriesTo,
  Count,
  faceCards,
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
  type WallCard,
  type Wall as WallShape,
} from "@/components/live/rounds";
import { Spread, SpreadButton, SpreadPanel } from "@/components/live/spread";
import {
  dropped,
  type Move,
  merged,
  PILE_MOVE,
  placed,
  useStagedWall,
} from "@/components/live/wall-motion";
import { cn } from "@/lib/utils";

/** How many unsorted cards stand on the shelf; the rest are clipped under its fade. */
const SHELF_SHOWN = 18;

/** How many of a context group's words a chip carries before the rest are a count. */
const CONTEXT_SHOWN = 3;

/** The shelf's cards, oldest first: the tray as the shown wall has it. */
export function shelfOf(cards: WallCard[]): WallCard[] {
  return cards.filter((card) => card.pile === null);
}

/**
 * The slots the piles stand in. A pile takes the next free slot when it opens
 * and gives it up when it closes, and keeps it for the life of the round, so
 * a card never lands on a face that is moving. A closed round re-sorts by
 * count, once, which is the wall the room reads for the pick.
 */
export function slotted<Pile extends { pile: string; count: number }>(
  piles: Pile[],
  slots: string[],
  open: boolean,
): { slots: string[]; piles: Pile[] } {
  const present = new Set(piles.map((pile) => pile.pile));
  const kept = slots.filter((pile) => present.has(pile));
  const known = new Set(kept);
  const next = [
    ...kept,
    ...piles.filter((pile) => !known.has(pile.pile)).map((pile) => pile.pile),
  ];
  if (!open) return { slots: next, piles: pilesByCount(piles) };
  const byId = new Map(piles.map((pile) => [pile.pile, pile]));
  return {
    slots: next,
    piles: next.flatMap((id) => {
      const pile = byId.get(id);
      return pile === undefined ? [] : [pile];
    }),
  };
}

export interface WallEdits {
  moveCard: (card: string, pile: string) => void;
  toTray: (card: string) => void;
  openPile: (card: string, name: string) => void;
  /** Tapping a pile toggles whether it carries into the next round. */
  togglePick?: (pile: string) => void;
  /** Tapping a choice nobody chose opens its empty pile and carries that. */
  pickChoice?: (choice: string) => void;
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
  /**
   * Where the shelf of unsorted cards stands: under the question, or in a
   * bottom row beside `foot` — the join code, on a projector — so the piles
   * take the middle of the screen whole.
   */
  shelfAt?: "top" | "bottom";
  foot?: React.ReactNode;
  /** What stands where the piles will, while a wall that no hand sorts has none. */
  empty?: React.ReactNode;
  edits?: WallEdits;
  className?: string;
}

/**
 * The wall: the question, the figure, the shelf of unsorted cards, and the
 * piles as stacks in fixed slots. One component serves the dashboard, the
 * projector, and the phone after hand-in; only the size of a cell and what it
 * lets a hand do differ.
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
  shelfAt = "top",
  foot,
  empty,
  edits,
  className,
}: WallProps) {
  const [naming, setNaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  // The pile in focus, if one is: the rest of the wall gives way to its cards.
  const [spread, setSpread] = useState<string | null>(null);
  const reduced = useReducedMotion() ?? false;
  const root = useRef<HTMLElement | null>(null);
  const { flights, flying, lit, launch } = useFlights();
  // A card leaving the tray for a pile is measured where it stands the instant
  // before the move shows, and flies in the layer over the wall.
  const onMove = useCallback(
    (move: Move, standing: WallShape) => {
      if (move.kind !== "place" || root.current === null) return;
      const card = standing.cards.find((one) => one.card === move.card);
      if (card === undefined) return;
      const boxes = measure(root.current, move.card, move.pile);
      if (boxes !== null) launch({ card, pile: move.pile, ...boxes });
    },
    [launch],
  );
  const { shown, edit, landed } = useStagedWall(wall, {
    instant: reduced,
    onMove,
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

  const shelf = shelfOf(seen.cards);
  const piles = useSlots(seen.piles, seen.open);
  const spreading = piles.find((pile) => pile.pile === spread) ?? null;
  const context = questionOf(seen)?.context ?? [];
  const writing = seen.open ? Math.max(0, seen.begun - seen.handedIn) : 0;
  const vote = choicesOf(seen).length > 0;
  /** The round this wall's carried groups and choices came out of. */
  const from = sourceWall?.number ?? null;
  const editable = hand !== undefined;
  const canDrag = hand !== undefined;
  // The shelf stands under the question while a round is open; once the round
  // has closed and nothing is unsorted the piles take the wall. The phone
  // counts the tray on its own page instead.
  const shelfShown = !phone && (shelf.length > 0 || writing > 0 || seen.open);
  // A projector with a third row of piles keeps every pile on screen, smaller.
  const dense = big && piles.length > 8;

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

  const shelfRow = (
    <Shelf
      cards={shelf}
      writing={writing}
      big={big}
      bottom={shelfAt === "bottom"}
      dragging={dragging}
      onDragStart={canDrag ? (one) => setDragging(one) : undefined}
      onDragEnd={canDrag ? () => setDragging(null) : undefined}
      onDrop={editable ? (card) => hand.toTray(card) : undefined}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <section
          ref={root}
          className={cn(
            "relative flex min-h-0 flex-col gap-5 rounded-2xl border border-border bg-card",
            big
              ? "gap-9 border-0 bg-transparent p-0"
              : phone
                ? "gap-4 border-0 bg-transparent p-0"
                : "border-0 bg-transparent px-0 pt-5 pb-6 sm:border sm:bg-card sm:px-7 sm:pt-6 sm:pb-8",
            className,
          )}
        >
          {vote ? null : <Flights flights={flights} big={big} />}
          {phone ? null : (
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
              <div className="flex min-w-0 flex-col gap-2.5">
                {eyebrow === undefined ? null : (
                  <span
                    className={cn(
                      "font-display text-muted-foreground leading-none",
                      big ? "text-xl" : "text-sm",
                    )}
                  >
                    {eyebrow}
                  </span>
                )}
                {seen.number === null ? (
                  <span
                    className={cn(
                      "truncate font-display font-semibold leading-none",
                      big ? "text-[44px]" : "text-3xl",
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
                  // One row: the round the groups came from, then the groups,
                  // the row cut under a fade rather than wrapping into the
                  // prompt's room. The groups carried in are named by the
                  // round they come from: a name that also stands on this wall
                  // below is never read as this round's own.
                  <div
                    className={cn(
                      "flex min-w-0 items-center overflow-hidden [mask-image:linear-gradient(to_right,#000_calc(100%_-_48px),transparent)]",
                      big ? "gap-3" : "gap-2",
                    )}
                  >
                    {from === null ? null : (
                      <span
                        className={cn(
                          "flex flex-none items-center gap-2 text-muted-foreground",
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
                    <>
                      {context.map((group) => {
                        const values = distinctValues(group.cards);
                        const held = values.length - CONTEXT_SHOWN;
                        return (
                          <div
                            key={group.name}
                            className={cn(
                              "flex min-w-0 flex-none flex-col gap-0.5 rounded-lg border border-border bg-card",
                              big
                                ? "max-w-[360px] px-4 py-2"
                                : "max-w-[240px] px-3 py-1.5",
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
                                <span className="flex-none">
                                  and {held} more
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </>
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
              {/* The one figure the room reads, with the noun it counts.
                  It is read whole when it moves, never a number on its own. */}
              <span
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="flex flex-none flex-col gap-1.5"
              >
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
              onPickChoice={hand?.pickChoice}
              big={big}
              scroll={scroll}
            />
          ) : (
            <>
              {shelfShown && shelfAt === "top" ? shelfRow : null}
              {piles.length === 0 && !editable && empty !== undefined ? (
                <div
                  className={cn(
                    "flex min-h-0 items-center justify-center",
                    scroll && "flex-1",
                  )}
                >
                  {empty}
                </div>
              ) : (
                <PileGrid
                  big={big}
                  dense={dense}
                  phone={phone}
                  scroll={scroll}
                  spread={
                    spreading === null
                      ? undefined
                      : (className) => (
                          <Spread
                            key="spread"
                            name={spreading.name}
                            cards={cardsIn(seen.cards, spreading.pile)}
                            big={big}
                            phone={phone}
                            onClose={() => setSpread(null)}
                            className={className}
                          />
                        )
                  }
                >
                  {[
                    // In focus, the pile stands alone with its cards beside it.
                    ...(spreading === null ? piles : [spreading]).map(
                      (pile) => {
                        // A card in the air is on no face yet, and not counted.
                        const cards = cardsIn(seen.cards, pile.pile).filter(
                          (card) => !flying.has(card.card),
                        );
                        return (
                          <Pile
                            key={pile.pile}
                            id={pile.pile}
                            name={pile.name}
                            count={cards.length}
                            description={pile.description}
                            cards={cards}
                            lit={lit.has(pile.pile)}
                            picked={isPicked(pile)}
                            carriesTo={carriesTo}
                            big={big}
                            dense={dense}
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
                            onSpread={() =>
                              setSpread((open) =>
                                open === pile.pile ? null : pile.pile,
                              )
                            }
                            spread={spread === pile.pile}
                            onRename={
                              editable && hand.renamePile !== undefined
                                ? (next) => hand.renamePile?.(pile.pile, next)
                                : undefined
                            }
                            onMergeIn={
                              editable && hand.mergePile !== undefined
                                ? (folded) =>
                                    hand.mergePile?.(folded, pile.pile)
                                : undefined
                            }
                            onSummarize={
                              hand?.summarize === undefined
                                ? undefined
                                : () => hand.summarize?.(pile.pile)
                            }
                            phone={phone}
                          />
                        );
                      },
                    ),
                    ...(editable && spreading === null
                      ? [
                          <NewPile
                            key="new-pile"
                            big={big}
                            phone={phone}
                            onDrop={openPile}
                          />,
                        ]
                      : []),
                  ]}
                </PileGrid>
              )}
            </>
          )}

          {/* The bottom row: the shelf, when it stands there, with the foot
              at its right; the foot alone once nothing is unsorted. */}
          {shelfAt === "bottom" &&
          (foot !== undefined || (!vote && shelfShown)) ? (
            <div className="grid flex-none grid-cols-[minmax(0,1fr)_auto] items-center gap-9">
              {!vote && shelfShown ? shelfRow : <span />}
              {foot === undefined ? null : (
                <div className="flex-none">{foot}</div>
              )}
            </div>
          ) : null}

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
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </form>
          ) : null}
        </section>
      </LayoutGroup>
    </MotionConfig>
  );
}

/**
 * The shelf: one row, one card tall — two lines tall on a projector, where an
 * answer is read from the back of the room. The count of everything unsorted
 * at the left, the newest cards at the right with the oldest clipped under
 * the fade, and one chip for the answers still being written. A card dropped
 * on the shelf goes back to the tray. A card that flies to a pile leaves the
 * row at once, and the row closes over its place as the card goes.
 */
function Shelf({
  cards,
  writing,
  big,
  bottom = false,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  cards: WallCard[];
  writing: number;
  big: boolean;
  /** The shelf stands in the bottom row, so its rule is above it. */
  bottom?: boolean;
  dragging: string | null;
  onDragStart?: (card: string) => void;
  onDragEnd?: () => void;
  onDrop?: (card: string) => void;
}) {
  const editable = onDrop !== undefined;
  return (
    <div
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
        "grid flex-none grid-cols-[auto_minmax(0,1fr)_auto] items-center border-border",
        bottom ? "border-t" : "border-b",
        big ? "h-[112px] gap-7 px-1.5" : "h-[52px] gap-4 pr-1 pl-0.5",
      )}
    >
      <span
        className={cn(
          "flex items-baseline gap-2 whitespace-nowrap text-muted-foreground",
          big ? "gap-3 text-xl" : "text-sm",
        )}
      >
        <Count
          value={cards.length}
          className={cn(
            "font-mono text-foreground tabular-nums",
            big ? "text-[38px]" : "text-[22px]",
          )}
        />{" "}
        unsorted
      </span>
      {/* The row fills from the right, so the newest card is always in the
          same place and what the row cannot hold falls off its left edge. */}
      <div
        data-shelf
        className={cn(
          "flex min-w-0 items-center justify-end overflow-hidden",
          big
            ? "gap-3 [mask-image:linear-gradient(to_right,transparent,#000_120px)]"
            : "gap-2 [mask-image:linear-gradient(to_right,transparent,#000_72px)]",
        )}
      >
        {cards.slice(-SHELF_SHOWN).map((card) => (
          <span
            key={card.card}
            className={cn(
              "flex flex-none",
              big ? "max-w-[30rem]" : "max-w-[18rem]",
            )}
          >
            <Card
              card={card}
              big={big}
              lines={big ? 2 : 1}
              still={dragging === card.card}
              draggable={onDragStart !== undefined}
              onDragStart={(one) => onDragStart?.(one.card)}
              onDragEnd={onDragEnd}
            />
          </span>
        ))}
      </div>
      {/* The answers on their way are one chip, not a row of empty boxes. */}
      {writing === 0 ? null : (
        <span
          className={cn(
            "whitespace-nowrap rounded-full border border-input border-dashed font-mono text-muted-foreground",
            big ? "px-[18px] py-2 text-xl" : "px-2.5 py-1 text-xs",
          )}
        >
          {writing} writing
        </span>
      )}
    </div>
  );
}

/** The piles in their slots, the slots carried from the last render. */
function useSlots<Pile extends { pile: string; count: number }>(
  piles: Pile[],
  open: boolean,
): Pile[] {
  const [slots, setSlots] = useState<string[]>([]);
  const next = slotted(piles, slots, open);
  if (
    next.slots.length !== slots.length ||
    next.slots.some((id, index) => id !== slots[index])
  ) {
    setSlots(next.slots);
  }
  return next.piles;
}

function PileGrid({
  big,
  dense,
  phone,
  scroll,
  spread,
  children,
}: {
  big: boolean;
  /** Three rows on a projector: tighter rows, so every pile stays on screen. */
  dense: boolean;
  phone: boolean;
  scroll: boolean;
  /**
   * The cards of the pile in focus, drawn beside it when the grid has the
   * columns and under it when it has two. The pile itself is the first cell.
   */
  spread?: (className: string) => React.ReactNode;
  children: React.ReactNode[];
}) {
  const { ref, edges, columns } = useOverflow(scroll);
  return (
    // The cell is fixed per surface, so a face never paints past it and the
    // piles take the whole width however many there are. The dashboard takes
    // its fourth column from the width the wall itself has, which is a column
    // of the page, not the screen.
    <div
      className={cn(
        "flex min-w-0 flex-col",
        scroll && "min-h-0 flex-1",
        !big && !phone && "@container",
      )}
    >
      <div
        ref={ref}
        className={cn(
          "grid min-w-0 content-start gap-x-[18px] gap-y-[22px] pb-3",
          big
            ? dense
              ? "grid-cols-4 gap-x-8 gap-y-6"
              : "grid-cols-4 gap-x-8 gap-y-[34px]"
            : phone
              ? "grid-cols-2 gap-x-3 gap-y-4"
              : "grid-cols-2 @min-[34rem]:grid-cols-3 @min-[56rem]:grid-cols-4",
          // The disc a picked pile carries hangs above the first row.
          scroll && "min-h-0 flex-1 overflow-y-auto pt-5",
          // What the box cannot hold fades out, rather than stopping on a cut.
          fading(edges),
        )}
      >
        <AnimatePresence initial={false}>
          {children}
          {spread === undefined
            ? null
            : spread(columns > 2 ? "col-[2/-1]" : "col-span-full")}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Which edges a box holds more past, watched as the wall fills it. */
interface Edges {
  top: boolean;
  bottom: boolean;
}

/** How many columns the grid lays out, read off the grid itself. */
function columnsOf(box: HTMLElement): number {
  const columns = getComputedStyle(box)
    .gridTemplateColumns.split(" ")
    .filter((track) => track !== "").length;
  return Math.max(1, columns);
}

function useOverflow(watch: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState<Edges>({ top: false, bottom: false });
  const [columns, setColumns] = useState(4);

  useEffect(() => {
    const box = ref.current;
    if (box === null) return;
    const read = () => {
      setColumns(columnsOf(box));
      if (!watch) return;
      setEdges((current) => {
        const top = box.scrollTop > 1;
        const bottom = box.scrollHeight - box.clientHeight - box.scrollTop > 1;
        return current.top === top && current.bottom === bottom
          ? current
          : { top, bottom };
      });
    };
    read();
    // The box is watched with the piles inside it: neither the wall growing a
    // row nor the screen changing shape leaves the fade behind, and scrolling
    // moves it to whichever edge still holds more.
    const watcher = new ResizeObserver(read);
    watcher.observe(box);
    for (const pile of box.children) watcher.observe(pile);
    box.addEventListener("scroll", read, { passive: true });
    return () => {
      watcher.disconnect();
      box.removeEventListener("scroll", read);
    };
  });

  return { ref, edges, columns };
}

/**
 * The fade at an edge a box holds more past: at the bottom while more is
 * below, at the top once a row has been scrolled off it. A cut row is never a
 * hard edge, so the room can tell there is more that way.
 */
function fading(edges: Edges): string | false {
  if (edges.top && edges.bottom)
    return "[mask-image:linear-gradient(to_bottom,transparent,#000_56px,#000_calc(100%_-_56px),transparent)]";
  if (edges.top)
    return "[mask-image:linear-gradient(to_bottom,transparent,#000_56px)]";
  if (edges.bottom)
    return "[mask-image:linear-gradient(to_bottom,#000_calc(100%_-_56px),transparent)]";
  return false;
}

/**
 * A vote round: every choice with its count and a bar, in the order the
 * question offers them, and a choice nobody chose at nothing. Each row is the
 * ballot pile of that name, so it is picked and carried like any other pile;
 * a choice nobody chose has no pile yet, and tapping it opens one.
 */
function VoteBars({
  wall,
  sourceWall,
  carriesTo,
  onPick,
  onPickChoice,
  big,
  scroll,
}: {
  wall: WallShape;
  sourceWall: WallShape | null;
  carriesTo?: number;
  onPick?: (pile: string) => void;
  /** A row with no pile yet: the choice is named rather than a pile. */
  onPickChoice?: (choice: string) => void;
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
  // The choice unfolded in place, if one is.
  const [spread, setSpread] = useState<string | null>(null);
  const spreading = rows.find((row) => row.choice === spread) ?? null;
  const panel =
    spreading === null ? null : (
      <SpreadPanel
        key="spread"
        name={spreading.choice}
        count={spreading.count}
        cards={spreading.cards}
        big={big}
        onClose={() => setSpread(null)}
      />
    );

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        // The disc a picked choice carries hangs above its card.
        scroll && "min-h-0 flex-1 overflow-y-auto pt-5 pb-3",
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
            pile === null
              ? onPickChoice === undefined
                ? undefined
                : () => onPickChoice(row.choice)
              : onPick === undefined
                ? undefined
                : () => onPick(pile.pile);
          const word =
            row.cards.length === 0 ? null : (
              <span className="relative z-10 inline-flex flex-none">
                <SpreadButton
                  name={row.choice}
                  open={spread === row.choice}
                  onClick={() =>
                    setSpread((open) =>
                      open === row.choice ? null : row.choice,
                    )
                  }
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
            <Fragment key={row.choice}>
              <VoteRow
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
                      {word}
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
                        {word}
                      </span>
                    </span>
                    {bar}
                  </>
                )}
              </VoteRow>
              {!side && spread === row.choice ? panel : null}
            </Fragment>
          );
        })}
      </div>
      {side ? panel : null}
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
                  <div className="flex flex-col gap-1.5 rounded-xl border border-foreground/40 border-dashed px-[22px] py-4 text-muted-foreground text-xl leading-[1.35]">
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
