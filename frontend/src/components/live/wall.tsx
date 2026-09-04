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
import { Spread } from "@/components/live/spread";
import {
  dropped,
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

/** One place on the shelf: the card, and whether it has already flown to a pile. */
export interface ShelfCard {
  card: WallCard;
  flown: boolean;
}

/**
 * The shelf's places, oldest first. Between waves it is the tray itself. While
 * a wave plays it is the tray as the wave found it, in that order, so a card
 * that has flown keeps its place until the wave ends; cards that arrived
 * mid-wave stand after them, and a card that has left the wall is gone.
 */
export function shelfOf(
  cards: WallCard[],
  holding: string[] | null,
): ShelfCard[] {
  const tray = cards.filter((card) => card.pile === null);
  if (holding === null) return tray.map((card) => ({ card, flown: false }));
  const byId = new Map(cards.map((card) => [card.card, card]));
  const held = new Set(holding);
  return [
    ...holding.flatMap((id) => {
      const card = byId.get(id);
      return card === undefined ? [] : [{ card, flown: card.pile !== null }];
    }),
    ...tray
      .filter((card) => !held.has(card.card))
      .map((card) => ({ card, flown: false })),
  ];
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
  empty,
  edits,
  className,
}: WallProps) {
  const [naming, setNaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const reduced = useReducedMotion() ?? false;
  const { shown, holding, edit, landed } = useStagedWall(wall, {
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

  const shelf = shelfOf(seen.cards, holding);
  const piles = useSlots(seen.piles, seen.open);
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
                                <span className="flex-none">
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
              big={big}
              scroll={scroll}
            />
          ) : (
            <>
              {shelfShown ? (
                <Shelf
                  cards={shelf}
                  writing={writing}
                  big={big}
                  dragging={dragging}
                  onDragStart={canDrag ? (one) => setDragging(one) : undefined}
                  onDragEnd={canDrag ? () => setDragging(null) : undefined}
                  onDrop={editable ? (card) => hand.toTray(card) : undefined}
                />
              ) : null}
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
                <PileGrid big={big} phone={phone} scroll={scroll}>
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
                  {editable ? (
                    <NewPile big={big} phone={phone} onDrop={openPile} />
                  ) : null}
                </PileGrid>
              )}
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
 * The shelf: one row under the question, one card tall. The count of
 * everything unsorted at the left, the newest cards at the right with the
 * oldest clipped under the fade, and one chip for the answers still being
 * written. A card dropped on the shelf goes back to the tray.
 *
 * A card that has flown to a pile leaves an invisible chip of itself, so the
 * places do not move while the wave plays; when it ends the row compacts once.
 */
function Shelf({
  cards,
  writing,
  big,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  cards: ShelfCard[];
  writing: number;
  big: boolean;
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
        "grid flex-none grid-cols-[auto_minmax(0,1fr)_auto] items-center border-border border-b",
        big ? "h-[78px] gap-7 px-1.5" : "h-[52px] gap-4 pr-1 pl-0.5",
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
        className={cn(
          "flex min-w-0 items-center justify-end overflow-hidden",
          big
            ? "gap-3 [mask-image:linear-gradient(to_right,transparent,#000_120px)]"
            : "gap-2 [mask-image:linear-gradient(to_right,transparent,#000_72px)]",
        )}
      >
        {cards.slice(-SHELF_SHOWN).map(({ card, flown }) => (
          // A card that has flown stands on as itself, unseen: the same box in
          // the same place, so the row does not close over it until the wave
          // ends. It flies by its own identity, which the unseen one drops.
          <span
            key={card.card}
            className={cn(
              "flex flex-none",
              big ? "max-w-[26rem]" : "max-w-[18rem]",
            )}
          >
            <Card
              card={card}
              big={big}
              oneLine
              still={flown || dragging === card.card}
              draggable={!flown && onDragStart !== undefined}
              onDragStart={(one) => onDragStart?.(one.card)}
              onDragEnd={onDragEnd}
              className={flown ? "invisible" : undefined}
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
  phone,
  scroll,
  children,
}: {
  big: boolean;
  phone: boolean;
  scroll: boolean;
  children: React.ReactNode;
}) {
  const { ref, edges } = useOverflow(scroll);
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
            ? "grid-cols-4 gap-x-8 gap-y-[34px]"
            : phone
              ? "grid-cols-2 gap-x-3 gap-y-4"
              : "grid-cols-2 @min-[34rem]:grid-cols-3 @min-[56rem]:grid-cols-4",
          // The disc a picked pile carries hangs above the first row.
          scroll && "min-h-0 flex-1 overflow-y-auto pt-5",
          // What the box cannot hold fades out, rather than stopping on a cut.
          fading(edges),
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Which edges a box holds more past, watched as the wall fills it. */
interface Edges {
  top: boolean;
  bottom: boolean;
}

function useOverflow(watch: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState<Edges>({ top: false, bottom: false });

  useEffect(() => {
    const box = ref.current;
    if (!watch || box === null) return;
    const read = () =>
      setEdges((current) => {
        const top = box.scrollTop > 1;
        const bottom = box.scrollHeight - box.clientHeight - box.scrollTop > 1;
        return current.top === top && current.bottom === bottom
          ? current
          : { top, bottom };
      });
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

  return { ref, edges };
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
