"use client";

import { Link } from "@/components/link";
import {
  CoverLateness,
  LateDayStepper,
} from "@/components/lms/late-day-stepper";
import {
  daysLeft,
  type LateDayRow,
  type LateDayTerms,
  lateBy,
} from "@/lib/late-days";
import { cn } from "@/lib/utils";

interface LateDayControlsProps {
  row: LateDayRow;
  terms: LateDayTerms;
  balance: { granted: number; remaining: number };
  onUpdate: () => void;
  className?: string;
}

/** The Late days card on an assignment. */
export function LateDayControls({
  row,
  terms,
  balance,
  onUpdate,
  className,
}: LateDayControlsProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Late days</p>
        <Link
          href="/late-days"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {daysLeft(balance)}
        </Link>
      </div>

      {row.handedInAt !== null && (
        <p className="text-sm">
          {row.lateMs > 0
            ? `Handed in ${lateBy(row.lateMs)} late`
            : "Handed in on time"}
        </p>
      )}

      <CoverLateness row={row} terms={terms} onMoved={onUpdate} />

      <LateDayStepper row={row} onMoved={onUpdate} />
    </div>
  );
}
