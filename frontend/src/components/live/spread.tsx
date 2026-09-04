"use client";

import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { Answer, ModelTag } from "@/components/live/pile";
import type { WallCard } from "@/components/live/rounds";
import { PILE_MOVE } from "@/components/live/wall-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The word that spreads a group, where a face has room for a word and not a
 * tap: the dashboard's row of controls, a vote's tally, a phone.
 */
export function SpreadButton({
  name,
  open,
  onClick,
  phone = false,
}: {
  name: string;
  open: boolean;
  onClick: () => void;
  /** A phone is opened with a thumb, so the word takes a thumb's room. */
  phone?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={phone ? "sm" : "xs"}
      aria-expanded={open}
      aria-label={`${open ? "Fold" : "Spread"} ${name}`}
      className="text-muted-foreground max-sm:h-9 max-sm:px-3"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {open ? "fold" : "spread"}
    </Button>
  );
}

/**
 * A pile in focus: the rest of the wall gives way and every card in the pile
 * is read whole, in columns beside the pile's own face, which stays as the
 * header. A tap or Escape brings the wall back. It changes nothing on the wall.
 */
export function Spread({
  name,
  cards,
  big = false,
  phone = false,
  onClose,
  onRemove,
  className,
}: {
  name: string;
  cards: WallCard[];
  big?: boolean;
  phone?: boolean;
  onClose: () => void;
  /** Takes a card off the wall; only a dashboard offers it. */
  onRemove?: (card: WallCard) => void;
  className?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      // A reader who asked for no motion gets the columns at once.
      initial={reduced ? false : { opacity: 0 }}
      animate={{
        opacity: 1,
        transition: reduced ? { duration: 0 } : { duration: 0.3, delay: 0.15 },
      }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.12 } }}
      role="region"
      aria-label={`${name}, every card`}
      onClick={onClose}
      className={cn(
        "flex min-w-0 cursor-pointer flex-col",
        big ? "px-2" : phone ? "px-1" : "px-1.5",
        className,
      )}
    >
      <ul
        className={cn(
          "min-w-0 gap-x-8",
          big
            ? "columns-3 text-xl leading-[1.35]"
            : phone
              ? "columns-1 text-sm leading-[1.35]"
              : "columns-2 text-sm leading-[1.35]",
        )}
      >
        {cards.map((card) => (
          <li
            key={card.card}
            className={cn(
              "flex min-w-0 break-inside-avoid items-baseline gap-2 border-border border-b py-1.5",
              big && "py-2.5",
            )}
          >
            <Answer value={card.value} className="flex-1" />
            {card.part === "" ? null : (
              <span className="flex-none font-mono text-muted-foreground text-xs">
                {card.part}
              </span>
            )}
            {card.model ? <ModelTag big={big} /> : null}
            {onRemove === undefined ? null : (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove “${card.value}”`}
                className="flex-none self-center text-muted-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(card);
                }}
              >
                <X />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

/**
 * Every card of a vote's choice, read whole, unfolded under the choice's own
 * row: the rows below make room. Escape or the cross folds it back.
 */
export function SpreadPanel({
  name,
  count,
  cards,
  description = "",
  big = false,
  phone = false,
  onClose,
}: {
  name: string;
  count: number;
  cards: WallCard[];
  /** The pile's lid, standing under the name as it does on the face. */
  description?: string;
  big?: boolean;
  phone?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      transition={PILE_MOVE}
      role="region"
      aria-label={`${name}, every card`}
      className={cn(
        "col-span-full flex min-w-0 flex-col rounded-xl border border-foreground/30 bg-card",
        big ? "gap-4 px-7 py-5" : phone ? "gap-3 px-4 py-3" : "gap-3 px-5 py-4",
      )}
    >
      <div className="flex items-baseline gap-3">
        <span
          dir="auto"
          className={cn(
            "min-w-0 break-words font-display font-semibold leading-[1.2]",
            big ? "text-3xl" : "text-lg",
          )}
        >
          {name}
        </span>
        <span
          className={cn(
            "flex-none font-mono text-muted-foreground tabular-nums",
            big ? "text-3xl" : "text-lg",
          )}
        >
          {count}
        </span>
        <Button
          type="button"
          variant="ghost"
          size={big ? "icon-lg" : "icon-sm"}
          aria-label={`Fold ${name}`}
          className="ml-auto self-center text-muted-foreground"
          onClick={onClose}
        >
          <X className={big ? "size-6" : undefined} />
        </Button>
      </div>
      {description === "" ? null : (
        <p className={cn("font-display", big ? "text-2xl" : "text-base")}>
          {description}
        </p>
      )}
      <ul
        className={cn(
          "min-w-0 gap-x-8",
          big
            ? "columns-3 text-xl leading-[1.35]"
            : phone
              ? "columns-1 text-sm leading-[1.35]"
              : "columns-2 text-sm leading-[1.35] md:columns-3",
        )}
      >
        {cards.map((card) => (
          <li
            key={card.card}
            className={cn(
              "flex min-w-0 break-inside-avoid items-baseline gap-2 border-border border-b py-1.5",
              big && "py-2.5",
            )}
          >
            <Answer value={card.value} className="flex-1" />
            {card.part === "" ? null : (
              <span className="flex-none font-mono text-muted-foreground text-xs">
                {card.part}
              </span>
            )}
            {card.model ? <ModelTag big={big} /> : null}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
