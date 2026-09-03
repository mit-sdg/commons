"use client";

import {
  AnimatePresence,
  motion,
  useAnimate,
  useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { WallCard } from "@/components/live/rounds";
import { Spread } from "@/components/live/spread";
import { CARD_MOVE, PILE_MOVE } from "@/components/live/wall-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The drag payload that carries a pile, so dropping one on another folds it in. */
const PILE_MIME = "application/x-commons-pile";

/** How many cards a stack shows on its face; the rest are the stack's depth. */
const PEEK = 3;

/** What stands on a card whose answer is nothing but spaces. */
const BLANK = "—";

/** How a pile's face is sized on each surface; a full projector packs its piles. */
const FACES = {
  wide: {
    box: "min-h-[112px] px-4 pt-3.5 pb-3",
    name: "text-lg sm:text-xl",
    count: "text-lg sm:text-[22px]",
    peek: "gap-[3px] text-[13px]",
  },
  phone: {
    box: "min-h-24 px-3.5 pt-3 pb-2.5",
    name: "text-lg",
    count: "text-lg",
    peek: "gap-1 text-sm",
  },
  big: {
    box: "min-h-[150px] rounded-[14px] px-[22px] pt-5 pb-[18px]",
    name: "text-2xl xl:text-[34px]",
    count: "text-[38px]",
    peek: "gap-1.5 text-xl",
  },
  packed: {
    box: "min-h-[104px] rounded-[14px] px-4 pt-4 pb-3.5",
    name: "text-xl",
    count: "text-[28px]",
    peek: "gap-1 text-base",
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
 * One answer as a card: in the tray, on a pile's face, or being dragged. The
 * card keeps its identity as it moves, so it flies from the tray onto the
 * stack it lands in; a card under the hand holds still until the hand lets go.
 */
export function Card({
  card,
  big = false,
  draggable = false,
  still = false,
  onDragStart,
  onDragEnd,
  className,
}: {
  card: WallCard;
  big?: boolean;
  draggable?: boolean;
  /** A card being dragged is not moved by a layout of the wall under it. */
  still?: boolean;
  onDragStart?: (card: WallCard) => void;
  onDragEnd?: () => void;
  className?: string;
}) {
  return (
    <span
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
        layout={!still}
        layoutId={still ? undefined : card.card}
        transition={CARD_MOVE}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.18 } }}
        className={cn(
          "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-border bg-card shadow-[0_1px_0_var(--border)] leading-[1.3]",
          big
            ? "rounded-[10px] px-[18px] py-2.5 text-2xl"
            : "px-3 py-[7px] text-[15px]",
          card.mine && "border-primary bg-primary/5",
          className,
        )}
        title={titleOf(card)}
      >
        <Answer value={card.value} className="line-clamp-3" />
        {card.model ? <ModelTag big={big} /> : null}
        {card.mine ? <YouTag /> : null}
      </motion.span>
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

/** A faint card for an answer still being written. */
export function GhostCard({ big = false }: { big?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block rounded-lg border border-input border-dashed",
        big ? "h-[50px] w-[110px]" : "h-[34px] w-[76px]",
      )}
    />
  );
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
 */
export function faceCards(cards: WallCard[], own: boolean): WallCard[] {
  const mine = own ? cards.filter((card) => card.mine) : [];
  const rest = own ? cards.filter((card) => !card.mine) : cards;
  return [...mine, ...rest.slice(-PEEK).reverse()].slice(0, PEEK);
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
  packed = false,
  phone = false,
  selected = false,
  follow = false,
  onDrop,
  onTap,
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
  /** A projector wall with more piles than two rows draws them smaller. */
  packed?: boolean;
  phone?: boolean;
  selected?: boolean;
  /** A pile in a scrolling wall comes into view as a card lands in it. */
  follow?: boolean;
  onDrop?: (card: string) => void;
  onTap?: () => void;
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
    box.current?.scrollIntoView({
      block: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
  }, [count, follow, reduced]);

  const face = big
    ? packed
      ? FACES.packed
      : FACES.big
    : phone
      ? FACES.phone
      : FACES.wide;
  const depth = count >= 8 ? "deep" : count >= 3 ? "thin" : "flat";
  const peek = faceCards(cards, phone);
  const takesDrop = onDrop !== undefined || onMergeIn !== undefined;
  const picking = onTap !== undefined && naming === null;
  const spread =
    cards.length === 0 ? null : (
      <Spread
        name={name}
        count={count}
        description={description}
        cards={cards}
        big={big}
        phone={phone}
      />
    );
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
  // A name wraps between its words and is cut with a sign; it never breaks
  // inside the one word the room reads the pile by.
  const nameClass = cn(
    "relative z-10 min-w-0 overflow-hidden text-ellipsis break-normal font-display font-semibold leading-[1.15]",
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
      layout="position"
      transition={PILE_MOVE}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
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
        "relative flex flex-col gap-2 rounded-[10px] border border-border bg-card text-left",
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
        flying && "z-10",
        picking && "cursor-pointer hover:border-foreground/40",
        className,
      )}
    >
      {picked && carriesTo !== undefined ? (
        <CarriesTo number={carriesTo} big={big} />
      ) : null}
      {/* Tapping the pile picks it: one button over the face, under the name
          and the controls, so nothing a hand can press is nested in another. */}
      {picking ? (
        <button
          type="button"
          aria-pressed={picked}
          aria-label={`${name}, ${countWords(count)}`}
          onClick={onTap}
          className="absolute inset-0 rounded-[10px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      ) : null}
      {description !== "" ? (
        <p
          className={cn(
            "font-display text-foreground leading-[1.3]",
            big ? (packed ? "text-xl" : "text-2xl") : "text-base",
          )}
        >
          {description}
        </p>
      ) : null}
      <div className="flex items-baseline justify-between gap-2.5">
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
            className="h-7 min-w-0 flex-1 rounded-md border border-primary bg-card px-2 font-display font-semibold text-base"
          />
        )}
        <span className="relative z-10 flex flex-none items-center gap-1">
          <Count
            value={count}
            className={cn("font-mono tabular-nums", face.count)}
          />
          {/* Off the projector the spread stands in the row of controls below,
              where a name has the width it needs and a thumb has its target. */}
          {big ? spread : null}
        </span>
      </div>
      <div
        className={cn(
          "flex flex-col text-muted-foreground leading-[1.35]",
          face.peek,
        )}
      >
        <AnimatePresence initial={false}>
          {peek.map((card) =>
            card.mine ? (
              <Card
                key={card.card}
                card={card}
                className="max-w-full self-start px-2 py-[3px] text-sm"
              />
            ) : (
              <motion.span
                key={card.card}
                layoutId={card.card}
                transition={CARD_MOVE}
                exit={{ opacity: 0 }}
                title={titleOf(card)}
                className="flex min-w-0 items-center gap-1.5"
              >
                <Answer value={card.value} className="line-clamp-1" />
                {card.model ? <ModelTag big={big} /> : null}
              </motion.span>
            ),
          )}
        </AnimatePresence>
      </div>
      {onSummarize === undefined && (big || spread === null) ? null : (
        <div
          className={cn(
            "relative z-10 mt-1 flex items-center gap-2",
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
          {big ? null : spread}
        </div>
      )}
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
  className,
}: {
  onDrop: (card: string) => void;
  big?: boolean;
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
        "flex items-center justify-center rounded-[10px] border border-input border-dashed text-muted-foreground",
        big ? "min-h-[150px] text-xl" : "min-h-[112px] text-sm",
        className,
      )}
    >
      new pile
    </div>
  );
}
