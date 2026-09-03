"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** How many seats the row offers before anyone touches it. */
const SEATS = 5;

/**
 * The model participants on a round: how many cards they have written, and a
 * seat count to invite more. One seat is one request, so the dashboard sends
 * as many as were asked for.
 */
export function ModelRow({
  count,
  disabled = false,
  onInvite,
}: {
  count: number;
  disabled?: boolean;
  onInvite: (seats: number) => void | Promise<void>;
}) {
  const [seats, setSeats] = useState(String(SEATS));
  const [busy, setBusy] = useState(false);
  const asked = Number(seats);
  const usable = Number.isInteger(asked) && asked > 0 && asked <= 100;

  async function invite() {
    if (!usable) return;
    setBusy(true);
    try {
      await onInvite(asked);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm">
        Model participants
        <span className="font-mono text-muted-foreground tabular-nums">
          {count}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <Input
          value={seats}
          inputMode="numeric"
          aria-label="Model participants"
          onChange={(event) => setSeats(event.target.value)}
          className="h-8 w-[52px] px-2.5 text-center"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || busy || !usable}
          onClick={() => void invite()}
        >
          Invite
        </Button>
      </span>
    </div>
  );
}
