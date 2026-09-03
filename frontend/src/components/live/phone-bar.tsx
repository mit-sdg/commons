"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The bar a phone hands in from: how much is answered, and the button. */
export function HandInBar({
  answered,
  of,
  busy = false,
  refusal = null,
  onHandIn,
}: {
  answered: number;
  of: number;
  /** A hand-in already in flight: the button is out until it lands. */
  busy?: boolean;
  /** Why a hand-in would be refused now, read out with the button. */
  refusal?: string | null;
  onHandIn: () => void;
}) {
  const noteId = useId();
  const out = busy || refusal !== null;

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="text-sm text-muted-foreground"
        >
          {answered} of {of} answered
        </span>
        {/* Out, the button keeps its place under the thumb and in the tab
            order: a disabled control drops the focus it holds and says
            nothing. The reason is on hover and read out with the button. */}
        <Button
          // A thumb-sized target: the default h-9 falls under the 44px floor.
          className={cn(
            "h-11",
            out &&
              "cursor-default bg-muted text-muted-foreground hover:bg-muted",
          )}
          aria-disabled={out || undefined}
          aria-describedby={refusal === null ? undefined : noteId}
          title={refusal ?? undefined}
          onClick={() => {
            if (out) return;
            onHandIn();
          }}
        >
          Hand in
        </Button>
      </div>
      {refusal === null ? null : (
        <span id={noteId} className="sr-only">
          {refusal}
        </span>
      )}
    </div>
  );
}
