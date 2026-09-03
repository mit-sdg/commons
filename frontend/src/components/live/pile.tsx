"use client";

import { useState } from "react";
import type { WallCard } from "@/components/live/rounds";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The drag payload that carries a pile, so dropping one on another folds it in. */
const PILE_MIME = "application/x-commons-pile";

/** How many cards a stack shows on its face; the rest are the stack's depth. */
const PEEK = 3;

/** What stands on a card whose answer is nothing but spaces. */
const BLANK = "\u2014";

/** How a pile's face is sized on each surface; a full projector packs its piles. */
const FACES = {
  wide: {
    box: "min-h-[112px] px-4 pt-3.5 pb-3",
    name: "text-lg sm:text-xl",
    count: "text-lg sm:text-[22px]",
    rest: "text-[11px] sm:text-[13px]",
    peek: "gap-[3px] text-[13px]",
  },
  phone: {
    box: "min-h-24 px-3.5 pt-3 pb-2.5",
    name: "text-lg",
    count: "text-lg",
    rest: "text-[11px]",
    peek: "gap-[3px] text-xs",
  },
  big: {
    box: "min-h-[150px] rounded-[14px] px-[22px] pt-5 pb-[18px]",
    name: "text-2xl xl:text-[34px]",
    count: "text-[38px]",
    rest: "text-xl",
    peek: "gap-1.5 text-xl",
  },
  packed: {
    box: "min-h-[104px] rounded-[14px] px-4 pt-4 pb-3.5",
    name: "text-xl",
    count: "text-[28px]",
    rest: "text-sm",
    peek: "gap-1 text-base",
  },
};

export function ModelTag({ big = false }: { big?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center rounded-sm border border-border px-1 font-mono text-muted-foreground uppercase leading-[1.6]",
        big ? "text-xs" : "text-[9px]",
      )}
    >
      model
    </span>
  );
}

export function YouTag() {
  return (
    <span className="inline-flex flex-none items-center rounded-sm bg-primary px-1 font-mono text-[9px] text-primary-foreground uppercase leading-[1.6]">
      you
    </span>
  );
}

/** One answer as a card: in the tray, on a pile's face, or being dragged. */
export function Card({
  card,
  big = false,
  draggable = false,
  onDragStart,
  className,
}: {
  card: WallCard;
  big?: boolean;
  draggable?: boolean;
  onDragStart?: (card: WallCard) => void;
  className?: string;
}) {
  return (
    <span
      draggable={draggable}
      onDragStart={
        onDragStart === undefined
          ? undefined
          : (event) => {
              event.dataTransfer.setData("text/plain", card.card);
              event.dataTransfer.effectAllowed = "move";
              onDragStart(card);
            }
      }
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-border bg-card shadow-[0_1px_0_var(--border)] leading-[1.3]",
        big
          ? "rounded-[10px] px-[18px] py-2.5 text-2xl"
          : "px-3 py-[7px] text-[15px]",
        card.mine && "border-primary bg-primary/5",
        draggable && "cursor-grab active:cursor-grabbing",
        className,
      )}
      title={titleOf(card)}
    >
      <Answer value={card.value} className="line-clamp-3" />
      {card.model ? <ModelTag big={big} /> : null}
      {card.mine ? <YouTag /> : null}
    </span>
  );
}

/** An answer as it reads on a card: wrapped, cut after its lines, never nothing. */
function Answer({ value, className }: { value: string; className: string }) {
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
  return card.part === "" ? card.value : `${card.part} \u00b7 ${card.value}`;
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
  faded = false,
  counted = true,
  big = false,
  packed = false,
  phone = false,
  selected = false,
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
  faded?: boolean;
  /** A pile standing under a vote round shows what it holds, not how many. */
  counted?: boolean;
  big?: boolean;
  /** A projector wall with more piles than two rows draws them smaller. */
  packed?: boolean;
  phone?: boolean;
  selected?: boolean;
  onDrop?: (card: string) => void;
  onTap?: () => void;
  onRename?: (name: string) => void;
  /** A pile dropped on this one folds into it, every card moving with it. */
  onMergeIn?: (pile: string) => void;
  onSummarize?: () => void;
  className?: string;
}) {
  const [naming, setNaming] = useState<string | null>(null);
  const face = big
    ? packed
      ? FACES.packed
      : FACES.big
    : phone
      ? FACES.phone
      : FACES.wide;
  const depth = count >= 8 ? "deep" : count >= 3 ? "thin" : "flat";
  const mine = phone ? cards.filter((card) => card.mine) : [];
  const peek = (
    mine.length === 0 ? cards : [...mine, ...cards.filter((card) => !card.mine)]
  ).slice(0, PEEK);
  const rest = Math.max(0, count - peek.length);
  const takesDrop = onDrop !== undefined || onMergeIn !== undefined;
  const interactive = onTap !== undefined && naming === null;
  const Tag = interactive ? "button" : "div";

  function commitName() {
    if (naming === null) return;
    const trimmed = naming.trim();
    setNaming(null);
    if (trimmed !== "" && trimmed !== name) onRename?.(trimmed);
  }

  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={interactive ? onTap : undefined}
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
        depth === "deep" &&
          "shadow-[0_5px_0_-2px_var(--card),0_6px_0_-2px_var(--border),0_11px_0_-5px_var(--card),0_12px_0_-5px_var(--border)]",
        depth === "thin" &&
          "shadow-[0_5px_0_-2px_var(--card),0_6px_0_-2px_var(--border)]",
        (picked || selected) &&
          "outline outline-2 outline-primary -outline-offset-2",
        faded && "opacity-40",
        interactive && "cursor-pointer hover:border-foreground/40",
        className,
      )}
    >
      {picked && carriesTo !== undefined ? (
        <span
          className={cn(
            "absolute flex items-center justify-center rounded-full border-2 border-card bg-primary font-mono text-primary-foreground",
            big
              ? "-top-4 right-[18px] size-9 text-lg"
              : "-top-3 right-3 size-6 text-xs",
          )}
        >
          {carriesTo}
        </span>
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
          <span
            draggable={onMergeIn !== undefined && id !== undefined}
            onDragStart={
              id === undefined
                ? undefined
                : (event) => {
                    event.stopPropagation();
                    event.dataTransfer.setData(PILE_MIME, id);
                    event.dataTransfer.effectAllowed = "move";
                  }
            }
            onDoubleClick={
              onRename === undefined ? undefined : () => setNaming(name)
            }
            dir="auto"
            className={cn(
              "min-w-0 break-words font-display font-semibold leading-[1.15]",
              face.name,
              onMergeIn !== undefined && "cursor-grab active:cursor-grabbing",
            )}
          >
            {name}
          </span>
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
        <span className="flex flex-none items-baseline gap-2">
          {rest === 0 || !counted ? null : (
            <span
              className={cn(
                "font-mono tabular-nums text-muted-foreground",
                face.rest,
              )}
            >
              +{rest}
            </span>
          )}
          {counted ? (
            <span className={cn("font-mono tabular-nums", face.count)}>
              {count}
            </span>
          ) : null}
        </span>
      </div>
      <div
        className={cn(
          "flex flex-col text-muted-foreground leading-[1.35]",
          face.peek,
        )}
      >
        {peek.map((card) =>
          card.mine ? (
            <Card
              key={card.card}
              card={card}
              className="max-w-full self-start px-2 py-[3px] text-xs"
            />
          ) : (
            <span
              key={card.card}
              title={titleOf(card)}
              className="flex min-w-0 items-center gap-1.5"
            >
              <Answer value={card.value} className="line-clamp-1" />
              {card.model ? <ModelTag big={big} /> : null}
            </span>
          ),
        )}
      </div>
      {onSummarize === undefined || interactive ? null : (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="mt-1 self-start"
          onClick={(event) => {
            event.stopPropagation();
            onSummarize();
          }}
        >
          Summarize
        </Button>
      )}
    </Tag>
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
