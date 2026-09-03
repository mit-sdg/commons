"use client";

import { Maximize2 } from "lucide-react";
import { Answer, ModelTag } from "@/components/live/pile";
import type { WallCard } from "@/components/live/rounds";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Every card in a group, read whole. A pile's face shows three; this opens the
 * rest, and changes nothing — the wall behind it takes the taps that sort and
 * pick, so neither the button nor the dialog lets one through.
 */
export function Spread({
  name,
  count,
  cards,
  description = "",
  big = false,
  phone = false,
}: {
  name: string;
  count: number;
  cards: WallCard[];
  /** The pile's lid, standing under the name as it does on the face. */
  description?: string;
  big?: boolean;
  /** A phone is opened with a thumb, so its button takes a thumb's room. */
  phone?: boolean;
}) {
  if (cards.length === 0) return null;
  return (
    <span
      className="inline-flex flex-none"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Dialog>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size={big || phone ? "icon-lg" : "icon-sm"}
            aria-label={`Spread ${name}`}
            className="text-muted-foreground max-sm:size-10"
          >
            <Maximize2 className={big ? "size-6" : undefined} />
          </Button>
        </DialogTrigger>
        <DialogContent
          {...(description === "" ? { "aria-describedby": undefined } : {})}
          className="grid-rows-[auto_minmax(0,1fr)] gap-4 max-h-[85dvh] sm:max-w-xl"
        >
          <DialogHeader>
            <DialogTitle className="flex items-baseline gap-3 font-display text-xl">
              <span dir="auto" className="min-w-0 break-words">
                {name}
              </span>
              <span className="flex-none font-mono tabular-nums text-muted-foreground">
                {count}
              </span>
            </DialogTitle>
            {description === "" ? null : (
              <DialogDescription className="text-foreground">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
          {/* The list fills the box and fades where it runs past it, so a
              group longer than the box reads as one that scrolls — and the
              box takes the keys that scroll it. */}
          <div
            role="group"
            tabIndex={0}
            aria-label={`${name}, every card`}
            className="min-h-0 overflow-y-auto border-border border-t outline-none [mask-image:linear-gradient(to_bottom,#000_calc(100%_-_32px),transparent)] focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ul className="flex flex-col pb-10">
              {cards.map((card) => (
                <li
                  key={card.card}
                  className="flex min-w-0 items-baseline gap-2.5 border-border border-b py-2 text-sm leading-[1.35] last:border-0"
                >
                  <Answer value={card.value} className="flex-1" />
                  {card.part === "" ? null : (
                    <span className="flex-none font-mono text-muted-foreground text-xs">
                      {card.part}
                    </span>
                  )}
                  {card.model ? <ModelTag /> : null}
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </span>
  );
}
