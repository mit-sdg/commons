"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { count } from "@/lib/format";
import {
  cannotCover,
  type LateDayMove,
  type LateDayRow,
  type LateDayTerms,
  moveTo,
  sendMove,
} from "@/lib/late-days";
import { cn } from "@/lib/utils";

/**
 * Sends moves for one row. The row shows the sent total until the refetched
 * row replaces it, so a second press counts from the first.
 */
function useLateDayMoves(row: LateDayRow, onMoved: () => void) {
  const base = `${row.days}:${row.standing}`;
  const [sent, setSent] = useState<{
    base: string;
    days: number;
    standing: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  // The refetched row replaces what was sent.
  if (sent && sent.base !== base) setSent(null);
  const shown =
    sent?.base === base
      ? { ...row, days: sent.days, standing: sent.standing }
      : row;

  async function send(move: LateDayMove) {
    setBusy(true);
    const error = await sendMove(row.assignment, move);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    setSent(
      move.action === "cancel"
        ? { base, days: 0, standing: false }
        : { base, days: move.days, standing: true },
    );
    onMoved();
  }

  return { shown, busy, send };
}

function confirmTitle(row: LateDayRow): string {
  return row.title === null
    ? "Cancel late days on this archived assignment?"
    : `Cancel late days on ${row.title}?`;
}

function CancelConfirm({
  row,
  open,
  onOpenChange,
  onConfirm,
  trigger,
}: {
  row: LateDayRow;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  trigger?: React.ReactNode;
}) {
  return (
    <ConfirmAction
      title={confirmTitle(row)}
      description={
        row.days > 0 ? `You get ${count(row.days, "late day")} back.` : null
      }
      confirmLabel="Cancel late days"
      cancelLabel="Keep"
      destructive
      onConfirm={onConfirm}
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
    />
  );
}

/** − N + around the late days on one assignment. */
export function LateDayStepper({
  row,
  onMoved,
  className,
}: {
  row: LateDayRow;
  onMoved: () => void;
  className?: string;
}) {
  const { shown, busy, send } = useLateDayMoves(row, onMoved);
  const [confirming, setConfirming] = useState(false);
  const label = row.title ?? "this assignment";

  function step(target: number) {
    const move = moveTo(shown, target);
    if (!move) return;
    if (move.action === "cancel") setConfirming(true);
    else void send(move);
  }

  return (
    <div
      role="group"
      aria-label={`Late days on ${label}`}
      className={cn("inline-flex items-center gap-1", className)}
    >
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-8"
        aria-label="One fewer late day"
        disabled={busy || (shown.days <= 0 && !shown.standing)}
        onClick={() => step(Math.max(0, shown.days - 1))}
      >
        <Minus className="size-4" />
      </Button>
      <span
        aria-live="polite"
        className="min-w-8 text-center text-lg font-semibold tabular-nums"
      >
        {shown.days}
      </span>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-8"
        aria-label="One more late day"
        disabled={busy || shown.days >= shown.cap}
        onClick={() => step(shown.days + 1)}
      >
        <Plus className="size-4" />
      </Button>
      <CancelConfirm
        row={shown}
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() => send({ action: "cancel" })}
      />
    </div>
  );
}

/** Cancel for a standing use on an archived assignment, which can't change. */
export function LateDayCancel({
  row,
  onMoved,
}: {
  row: LateDayRow;
  onMoved: () => void;
}) {
  const { busy, send } = useLateDayMoves(row, onMoved);
  return (
    <CancelConfirm
      row={row}
      onConfirm={() => send({ action: "cancel" })}
      trigger={
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-destructive"
          disabled={busy}
        >
          Cancel
        </Button>
      }
    />
  );
}

/** "Use 2 late days", or "Use 1 more late day" when some are on already. */
export function coverLabel(row: Pick<LateDayRow, "days" | "daysNeeded">) {
  return row.days > 0
    ? `Use ${count(row.daysNeeded - row.days, "more late day")}`
    : `Use ${count(row.daysNeeded, "late day")}`;
}

/**
 * For a late hand-in the days don't cover: the button that covers it, or why
 * the balance or the per-assignment limit can't.
 */
export function CoverLateness({
  row,
  terms,
  onMoved,
  className,
}: {
  row: LateDayRow;
  terms: LateDayTerms;
  onMoved: () => void;
  className?: string;
}) {
  const { busy, send } = useLateDayMoves(row, onMoved);
  if (row.handedInAt === null || row.daysNeeded <= row.days) return null;
  const reason = cannotCover(row, terms);
  if (reason)
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>{reason}</p>
    );
  const move = moveTo(row, row.daysNeeded);
  if (!move) return null;
  return (
    <Button
      type="button"
      size="sm"
      className={className}
      disabled={busy}
      onClick={() => void send(move)}
    >
      {coverLabel(row)}
    </Button>
  );
}
