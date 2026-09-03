"use client";

import { Button } from "@/components/ui/button";

/** The bar a phone hands in from: how much is answered, and the button. */
export function HandInBar({
  answered,
  of,
  disabled = false,
  onHandIn,
}: {
  answered: number;
  of: number;
  disabled?: boolean;
  onHandIn: () => void;
}) {
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
        <Button
          // A thumb-sized target: the default h-9 falls under the 44px floor.
          className="h-11"
          onClick={onHandIn}
          disabled={disabled}
        >
          Hand in
        </Button>
      </div>
    </div>
  );
}
