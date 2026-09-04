"use client";

import {
  AnimatePresence,
  motion,
  useAnimate,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { WallCard } from "@/components/live/rounds";
import { SpreadButton } from "@/components/live/spread";
import { CARD_MOVE, PILE_MOVE } from "@/components/live/wall-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The drag payload that carries a pile, so dropping one on another folds it in. */
const PILE_MIME = "application/x-commons-pile";

/** How many cards a stack shows on its face; the rest are the stack's depth. */
const PEEK = 3;

/** How long after a card lands the wall scrolls to its pile: the pile's spring. */
const FOLLOW_AFTER_MS = 450;

/** What stands on a card whose answer is nothing but spaces. */
const BLANK = "—";

/**
 * A pile opening, in three beats: the empty cell's outline, then the name it
 * was opened under, then the count, standing at nothing. The three are over
 * before the pile's first card is in the air, so the card lands on a pile that
 * is already still.
 */
const BIRTH: { cell: Variants; part: Variants } = {
  cell: {
    hidden: { opacity: 0 },
    born: {
      opacity: 1,
      transition: {
        duration: 0.18,
        ease: "easeOut",
        delayChildren: 0.2,
        staggerChildren: 0.2,
      },
    },
  },
  part: {
    hidden: { opacity: 0 },
    born: { opacity: 1, transition: { duration: 0.18, ease: "easeOut" } },
  },
};

/**
 * How a pile's face is sized on each surface. The box is a fixed cell — the
 * name line, the count, three face lines and the controls row — and nothing
 * inside it is ever taller, so a face never paints past it.
 */
const FACES = {
  wide: {
    box: "h-[196px] px-4 pt-3.5 pb-3",
    name: "text-xl sm:text-[22px]",
    count: "text-xl sm:text-2xl",
    peek: "gap-1 text-sm",
  },
  phone: {
    box: "h-[188px] px-3.5 pt-3 pb-2.5",
    name: "text-lg",
    count: "text-xl",
    peek: "gap-1 text-sm",
  },
  big: {
    box: "h-[196px] rounded-xl px-5 pt-4 pb-4 xl:h-[216px] 2xl:h-[256px] 2xl:px-6 2xl:pt-[22px] 2xl:pb-5",
    name: "text-2xl xl:text-[28px] 2xl:text-[32px]",
    count: "text-3xl xl:text-4xl 2xl:text-[40px]",
    peek: "gap-1.5 text-lg xl:text-xl 2xl:text-[23px]",
  },
  // A projector with a third row of piles: every pile stays on the screen,
  // a little smaller, rather than the wall scrolling under the room.
  dense: {
    box: "h-[160px] rounded-xl px-5 pt-3.5 pb-3.5",
    name: "text-[22px] 2xl:text-2xl",
    count: "text-3xl 2xl:text-[32px]",
    peek: "gap-1 text-lg 2xl:text-xl",
  },
};

export function ModelTag({ big = false }: { big?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center rounded-sm border border-border px-1 font-mono text-muted-foreground uppercase leading-[1.6]",
        big ? "text-xs" : "text-[11px]",
      )}
    >
      model
    </span>
  );
}

export function YouTag() {
  return (
    <span className="inline-flex flex-none items-center rounded-sm bg-primary px-1 font-mono text-[11px] text-primary-foreground uppercase leading-[1.6]">
      you
    </span>
  );
}

/**
 * One answer as a card: in the tray, on a pile's face, or being dragged. A
 * card that leaves the tray for a pile is drawn crossing the wall by the
 * flight layer; here it only lays out, so the row closes over its place as
 * its neighbours slide. A card under the hand holds still until the hand lets go.
 */
export function Card({
  card,
  big = false,
  draggable = false,
  still = false,
  oneLine = false,
  lines = oneLine ? 1 : 3,
  onDragStart,
  onDragEnd,
  className,
}: {
  card: WallCard;
  big?: boolean;
  draggable?: boolean;
  /** A card being dragged is not moved by a layout of the wall under it. */
  still?: boolean;
  /** A card in a row one card tall is cut after its first line. */
  oneLine?: boolean;
  /** How many lines of the answer the card shows before it is cut. */
  lines?: 1 | 2 | 3;
  onDragStart?: (card: WallCard) => void;
  onDragEnd?: () => void;
  className?: string;
}) {
  return (
    <span
      data-card={card.card}
      draggable={draggable}
      onDragStart={
        draggable
          ? (event) => {
              event.dataTransfer.setData("text/plain", card.card);
              event.dataTransfer.effectAllowed = "move";
              onDragStart?.(card);
            }
          : undefined
      }
      onDragEnd={draggable ? onDragEnd : undefined}
      className={cn(
        "inline-flex min-w-0 max-w-full",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <motion.span
        layout={still ? false : "position"}
        transition={CARD_MOVE}
        // A new card is set down: it comes in a little large and settles flat.
        initial={{ opacity: 0, y: 10, scale: 1.04 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.18 } }}
        className="inline-flex min-w-0 max-w-full"
      >
        <CardBody card={card} big={big} lines={lines} className={className} />
      </motion.span>
    </span>
  );
}

/** The card itself: its answer, its tags, its border — what flies and what stands. */
export function CardBody({
  card,
  big = false,
  lines = 3,
  className,
}: {
  card: WallCard;
  big?: boolean;
  lines?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-border bg-card shadow-[0_1px_0_var(--border)] leading-[1.3]",
        big ? "px-[18px] py-2.5 text-2xl" : "px-3 py-[7px] text-sm",
        card.mine && "border-primary bg-primary/5",
        className,
      )}
      title={titleOf(card)}
    >
      <Answer
        value={card.value}
        className={
          lines === 1
            ? "line-clamp-1"
            : lines === 2
              ? "line-clamp-2"
              : "line-clamp-3"
        }
      />
      {card.model ? <ModelTag big={big} /> : null}
      {card.mine ? <YouTag /> : null}
    </span>
  );
}

/** An answer as it reads on a card: wrapped, cut after its lines, never nothing. */
export function Answer({
  value,
  className,
}: {
  value: string;
  className: string;
}) {
  const blank = value.trim() === "";
  return (
    <span
      dir="auto"
      className={cn(
        "min-w-0 break-words",
        className,
        blank && "text-muted-foreground/60",
      )}
    >
      {blank ? BLANK : value}
    </span>
  );
}

/** The whole answer, with the part it answers, for a card that had to be cut. */
function titleOf(card: WallCard): string | undefined {
  if (card.value.trim() === "") return undefined;
  return card.part === "" ? card.value : `${card.part} · ${card.value}`;
}

/** A count that pulses as it ticks, and stands still the first time it is read. */
export function Count({
  value,
  className,
}: {
  value: number;
  className: string;
}) {
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const read = useRef(value);

  useEffect(() => {
    if (read.current === value) return;
    read.current = value;
    if (scope.current === null) return;
    void animate(
      scope.current,
      { scale: [1.22, 1] },
      { duration: 0.26, ease: "easeOut" },
    );
  }, [value, animate, scope]);

  return (
    <span ref={scope} className={className}>
      {value}
    </span>
  );
}

/**
 * The three cards a stack shows on its face: the holder's own first, then the
 * cards that landed last, so a room watching a pile fill sees them arrive.
 * `landed` ranks a card by when it last landed on the shown wall; without it
 * the wall's own order stands in. `most` is how many lines the cell leaves.
 */
export function faceCards(
  cards: WallCard[],
  own: boolean,
  landed: (card: string) => number = () => 0,
  most: number = PEEK,
): WallCard[] {
  const mine = own ? cards.filter((card) => card.mine) : [];
  const rest = own ? cards.filter((card) => !card.mine) : cards;
  const byLanding = rest
    .map((card, index) => ({ card, rank: landed(card.card), index }))
    .sort((left, right) => right.rank - left.rank || right.index - left.index)
    .map((entry) => entry.card);
  return [...mine, ...byLanding].slice(0, most);
}

/** A pile's count, as a screen reader reads it beside the name. */
function countWords(count: number): string {
  return count === 1 ? "1 card" : `${count} cards`;
}

/**
 * A pile as a stack: its name, its count, and the top three cards. The stack's
 * depth follows its count; a picked pile carries the number of the round it
 * goes to. Dropping a card on it moves the card in.
 */
export function Pile({
  id,
  name,
  count,
  cards,
  description = "",
  picked = false,
  carriesTo,
  big = false,
  dense = false,
  phone = false,
  selected = false,
  follow = false,
  lit = false,
  landed,
  onDrop,
  onTap,
  onSpread,
  spread = false,
  onRename,
  onMergeIn,
  onSummarize,
  className,
}: {
  /** The pile's own identity, carried when its name is dragged onto another pile. */
  id?: string;
  name: string;
  count: number;
  cards: WallCard[];
  description?: string;
  picked?: boolean;
  /** The number of the round the pile carries into, shown on a picked pile. */
  carriesTo?: number;
  big?: boolean;
  /** A projector wall of three rows: the cell is smaller so every pile stays on screen. */
  dense?: boolean;
  phone?: boolean;
  selected?: boolean;
  /** A pile in a scrolling wall comes into view as a card lands in it. */
  follow?: boolean;
  /** A card has just landed: the pile lights for a moment, so the room sees where it went. */
  lit?: boolean;
  /** When a card last landed on the shown wall, so the face shows the latest. */
  landed?: (card: string) => number;
  onDrop?: (card: string) => void;
  onTap?: () => void;
  /** Unfolds every card of the pile in place; on a projector the face itself does it. */
  onSpread?: () => void;
  /** Whether this pile stands unfolded. */
  spread?: boolean;
  onRename?: (name: string) => void;
  /** A pile dropped on this one folds into it, every card moving with it. */
  onMergeIn?: (pile: string) => void;
  onSummarize?: () => void;
  className?: string;
}) {
  const [naming, setNaming] = useState<string | null>(null);
  // A pile crossing the wall is drawn over the piles that have settled, so a
  // move never reads as one card torn in half by another.
  const [flying, setFlying] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const counted = useRef(count);
  const reduced = useReducedMotion() ?? false;

  useEffect(() => {
    const grew = count > counted.current;
    counted.current = count;
    if (!follow || !grew) return;
    // The pile may move as its count re-sorts it; the wall follows it to
    // where it settles, once the spring has carried it there.
    const timer = setTimeout(
      () =>
        box.current?.scrollIntoView({
          block: "nearest",
          behavior: reduced ? "auto" : "smooth",
        }),
      reduced ? 0 : FOLLOW_AFTER_MS,
    );
    return () => clearTimeout(timer);
  }, [count, follow, reduced]);
  const face = big
    ? dense
      ? FACES.dense
      : FACES.big
    : phone
      ? FACES.phone
      : FACES.wide;
  const depth = count >= 8 ? "deep" : count >= 3 ? "thin" : "flat";
  // A pile the model has summed up shows one card under the sentence: the lid
  // is what the pile says, and the cell holds one or the other, not both.
  // In focus the pile is the header of its own cards, so the face reads no
  // line the columns beside it read.
  const peek = spread
    ? []
    : faceCards(cards, phone, landed, description === "" ? PEEK : 1);
  const takesDrop = onDrop !== undefined || onMergeIn !== undefined;
  // On a wall a hand sorts, a card on the face is dragged off it: back to the
  // tray, onto another pile, or onto the new pile, with the same payload a
  // card in the tray carries. Once picking is on, the whole face is the pick
  // button.
  const canDragCards = onDrop !== undefined && onTap === undefined;
  const takeCard = (event: React.DragEvent, card: string) => {
    event.stopPropagation();
    event.dataTransfer.setData("text/plain", card);
    event.dataTransfer.effectAllowed = "move";
  };
  const picking = onTap !== undefined && naming === null;
  const spreadable = onSpread !== undefined && cards.length > 0;
  // What a tap on the face does: picks, once picking is on; on a projector,
  // where nothing else is tapped, it unfolds the pile.
  const faceTap = picking ? onTap : big && spreadable ? onSpread : undefined;
  // A name that carries its pile into another one is dragged by its name.
  const drag = {
    draggable: onMergeIn !== undefined && id !== undefined,
    onDragStart:
      id === undefined
        ? undefined
        : (event: React.DragEvent) => {
            event.stopPropagation();
            event.dataTransfer.setData(PILE_MIME, id);
            event.dataTransfer.effectAllowed = "move";
          },
  };
  // A name wraps between its words over two lines and is cut with a sign; it
  // never breaks inside the one word the room reads the pile by, and it takes
  // the width the count leaves rather than giving first. The cell holds two
  // name lines and the face's lines whole, so a line is never cut in half.
  const nameClass = cn(
    "relative z-10 line-clamp-2 min-w-0 flex-1 break-normal font-display font-semibold leading-[1.15]",
    face.name,
    onMergeIn !== undefined && "cursor-grab active:cursor-grabbing",
  );

  function commitName() {
    if (naming === null) return;
    const trimmed = naming.trim();
    setNaming(null);
    if (trimmed !== "" && trimmed !== name) onRename?.(trimmed);
  }

  return (
    <motion.div
      ref={box}
      // A pile crossing another passes over it when it holds more cards.
      style={flying ? { zIndex: 10 + count } : undefined}
      layout="position"
      transition={PILE_MOVE}
      variants={BIRTH.cell}
      initial="hidden"
      animate="born"
      exit={{ opacity: 0, scale: 0.94 }}
      onLayoutAnimationStart={() => setFlying(true)}
      onLayoutAnimationComplete={() => setFlying(false)}
      onDragOver={takesDrop ? (event) => event.preventDefault() : undefined}
      onDrop={
        takesDrop
          ? (event) => {
              event.preventDefault();
              const dropped = event.dataTransfer.getData(PILE_MIME);
              if (dropped !== "") {
                if (dropped !== id) onMergeIn?.(dropped);
                return;
              }
              const card = event.dataTransfer.getData("text/plain");
              if (card !== "") onDrop?.(card);
            }
          : undefined
      }
      className={cn(
        "relative rounded-lg border border-border bg-card text-left",
        face.box,
        // A projector is read from the back of the room, where the hairline
        // that holds a card together on a laptop has gone.
        big && "border-foreground/50",
        depth === "deep" &&
          "shadow-[0_5px_0_-2px_var(--card),0_6px_0_-2px_var(--border),0_11px_0_-5px_var(--card),0_12px_0_-5px_var(--border)]",
        depth === "thin" &&
          "shadow-[0_5px_0_-2px_var(--card),0_6px_0_-2px_var(--border)]",
        (picked || selected) &&
          "outline outline-2 outline-primary -outline-offset-2",
        spread && "border-foreground/60",
        lit &&
          "border-primary/70 shadow-[0_0_0_3px_var(--primary)] transition-shadow duration-300",
        faceTap !== undefined && "cursor-pointer hover:border-foreground/40",
        className,
      )}
    >
      {picked && carriesTo !== undefined ? (
        <CarriesTo number={carriesTo} big={big} />
      ) : null}
      {/* Tapping the pile picks it, or spreads it: one button over the face,
          under the name and the controls, so nothing a hand can press is
          nested in another. */}
      {faceTap !== undefined ? (
        <button
          type="button"
          aria-pressed={picking ? picked : undefined}
          aria-expanded={picking ? undefined : spread}
          aria-label={
            picking ? `${name}, ${countWords(count)}` : `Spread ${name}`
          }
          onClick={faceTap}
          className="absolute inset-0 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      ) : null}
      {/* The cell's column: everything the face holds, clipped inside the
          cell, so a name of any length and a lid of any length leave the
          piles beside this one exactly where they stand. */}
      <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
        {description !== "" ? (
          <p
            className={cn(
              "line-clamp-1 flex-none font-display text-foreground leading-[1.3]",
              big ? "text-xl 2xl:text-2xl" : "text-base",
            )}
          >
            {description}
          </p>
        ) : null}
        <div className="flex flex-none items-baseline justify-between gap-2.5">
          {/* The name is the second beat of a birth, and the count the third. */}
          <motion.span
            variants={BIRTH.part}
            className="flex min-w-0 flex-1 items-baseline"
          >
            {naming === null ? (
              onRename === undefined ? (
                <span dir="auto" className={nameClass} {...drag}>
                  {name}
                </span>
              ) : (
                <button
                  type="button"
                  dir="auto"
                  aria-label={`Rename ${name}`}
                  onClick={() => setNaming(name)}
                  className={cn(nameClass, "text-left")}
                  {...drag}
                >
                  {name}
                </button>
              )
            ) : (
              <input
                // biome-ignore lint/a11y/noAutofocus: the name is being typed the moment it appears.
                autoFocus
                value={naming}
                aria-label="Name the pile"
                onChange={(event) => setNaming(event.target.value)}
                onBlur={commitName}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitName();
                  if (event.key === "Escape") setNaming(null);
                }}
                className="h-7 min-w-0 flex-1 rounded-md border border-primary bg-card px-2 font-display font-semibold text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            )}
          </motion.span>
          <motion.span
            variants={BIRTH.part}
            className="relative z-10 flex flex-none items-center gap-1"
          >
            <Count
              value={count}
              className={cn("font-mono tabular-nums", face.count)}
            />
          </motion.span>
        </div>
        {/* The face's cards are a list, so a reader takes them one at a time
            under the pile's name and count rather than as one run of words.
            The list holds the room the cell has left, and a card the room cuts
            fades out the way the rest of the wall says there is more. */}
        <div
          role="list"
          data-face={id}
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden text-muted-foreground leading-[1.35] [mask-image:linear-gradient(to_bottom,#000_calc(100%_-_14px),transparent)]",
            // The mask paints the list over the face's button; while the face is one, it wins.
            faceTap !== undefined && "pointer-events-none",
            face.peek,
          )}
        >
          <AnimatePresence initial={false}>
            {peek.map((card) =>
              card.mine ? (
                <span
                  key={card.card}
                  role="listitem"
                  className="flex min-w-0 max-w-full"
                >
                  <Card
                    card={card}
                    draggable={canDragCards}
                    oneLine
                    className={cn(
                      "max-w-full self-start px-2 py-[3px] text-sm",
                      canDragCards && "relative z-10",
                    )}
                  />
                </span>
              ) : (
                // A card that has just landed settles into its line as the
                // lines already on the face make room.
                <motion.span
                  key={card.card}
                  role="listitem"
                  data-card={card.card}
                  draggable={canDragCards}
                  // Motion keeps `onDragStart` for its own gesture, so the card
                  // lays out its payload on the way down instead.
                  onDragStartCapture={
                    canDragCards
                      ? (event: React.DragEvent) => takeCard(event, card.card)
                      : undefined
                  }
                  layout="position"
                  transition={PILE_MOVE}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  title={titleOf(card)}
                  className={cn(
                    "flex min-w-0 items-center gap-1.5",
                    canDragCards &&
                      "relative z-10 cursor-grab active:cursor-grabbing",
                  )}
                >
                  <Answer value={card.value} className="line-clamp-1" />
                  {card.model ? <ModelTag big={big} /> : null}
                </motion.span>
              ),
            )}
          </AnimatePresence>
        </div>
        {onSummarize === undefined && (big || !spreadable) ? null : (
          <div
            className={cn(
              "relative z-10 mt-auto flex flex-none items-center gap-2 pt-1",
              onSummarize === undefined ? "justify-end" : "justify-between",
            )}
          >
            {onSummarize === undefined ? null : (
              <Button
                type="button"
                variant="outline"
                size={phone ? "sm" : "xs"}
                className="max-sm:h-9 max-sm:px-3"
                aria-label={`Summarize ${name}`}
                onClick={onSummarize}
              >
                Summarize
              </Button>
            )}
            {big || !spreadable ? null : (
              <SpreadButton
                name={name}
                open={spread}
                phone={phone}
                onClick={() => onSpread?.()}
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** The number of the round a picked pile carries into. */
export function CarriesTo({
  number,
  big = false,
}: {
  number: number;
  big?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={`carries into round ${number}`}
      className={cn(
        "absolute flex items-center justify-center rounded-full border-2 border-card bg-primary font-mono text-primary-foreground",
        big
          ? "-top-4 right-[18px] size-9 text-lg"
          : "-top-3 right-3 size-6 text-xs",
      )}
    >
      {number}
    </span>
  );
}

/** The dashed place a card is dropped to open a new pile. */
export function NewPile({
  onDrop,
  big = false,
  phone = false,
  className,
}: {
  onDrop: (card: string) => void;
  big?: boolean;
  phone?: boolean;
  className?: string;
}) {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const card = event.dataTransfer.getData("text/plain");
        if (card !== "") onDrop(card);
      }}
      className={cn(
        "flex items-center justify-center rounded-lg border border-input border-dashed text-muted-foreground",
        big
          ? "h-[196px] rounded-xl text-xl xl:h-[216px] 2xl:h-[256px] 2xl:text-2xl"
          : phone
            ? "h-[188px] text-sm"
            : "h-[196px] text-sm",
        className,
      )}
    >
      new pile
    </div>
  );
}
