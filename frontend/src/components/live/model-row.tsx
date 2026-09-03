"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** How many seats the row offers before anyone touches it. */
const SEATS = 5;

/** A button that is out reads as out without leaving the tab order. */
const OUT =
  "cursor-default text-muted-foreground hover:bg-background hover:text-muted-foreground dark:hover:bg-input/30";

/**
 * The model participants of a run: the seats taken, how many of them are still
 * writing the open round, and the buttons that take or drop seats. One seat is
 * one request, so the dashboard sends as many as were asked for.
 */
export function ModelRow({
  count,
  writing = 0,
  onInvite,
  onDismiss,
  onDismissAll,
}: {
  count: number;
  writing?: number;
  onInvite: (seats: number) => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
  onDismissAll: () => void | Promise<void>;
}) {
  const [seats, setSeats] = useState(String(SEATS));
  const [busy, setBusy] = useState(false);
  const asked = Number(seats);
  const usable = Number.isInteger(asked) && asked > 0 && asked <= 100;

  async function act(work: () => void | Promise<void>) {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-2 whitespace-nowrap text-sm">
          Model seats
          <span className="text-muted-foreground text-xs tabular-nums">
            {count} seated
          </span>
        </span>
        <span className="ml-auto flex flex-none items-center gap-1.5">
          <Input
            value={seats}
            inputMode="numeric"
            aria-label="Seats"
            onChange={(event) => setSeats(event.target.value)}
            className="h-8 w-[52px] px-2.5 text-center"
          />
          <Button
            size="sm"
            variant="outline"
            // Out while a seat is in flight, but never out of the tab order:
            // the row keeps the focus the click left on it.
            aria-disabled={busy || !usable}
            className={busy || !usable ? OUT : undefined}
            onClick={() => {
              if (busy || !usable) return;
              void act(() => onInvite(asked));
            }}
          >
            Invite
          </Button>
        </span>
      </div>
      {count > 0 ? (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            aria-disabled={busy}
            className={busy ? OUT : undefined}
            onClick={() => {
              if (busy) return;
              void act(onDismiss);
            }}
          >
            Dismiss last
          </Button>
          <Button
            variant="outline"
            size="xs"
            aria-disabled={busy}
            className={busy ? OUT : undefined}
            onClick={() => {
              if (busy) return;
              void act(onDismissAll);
            }}
          >
            Dismiss all
          </Button>
        </div>
      ) : null}
      {writing > 0 ? (
        <p className="text-muted-foreground text-xs">{writing} writing</p>
      ) : null}
    </div>
  );
}
