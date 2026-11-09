"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setLecture } from "@/lib/attendance";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Whether the signed-in caller may mark runs as lectures, as `/live/lectures/mark` checks it. */
export function useCanMarkLectures(): boolean {
  const { permissions } = useAuth();
  return permissions.can("live:host") || permissions.can("course:manage");
}

/**
 * The Lecture switch on a run. It shows the new state while the mark is
 * saved, then `onChanged` refetches; a refused mark toasts and the switch
 * returns to the state it had.
 */
export function LectureSwitch({
  run,
  lecture,
  onChanged,
  className,
}: {
  run: string;
  lecture: boolean;
  onChanged: () => void;
  className?: string;
}) {
  const canMark = useCanMarkLectures();
  const [busy, setBusy] = useState(false);
  // The value set by this switch, kept until a refetch moves `lecture` off
  // the value it was set from.
  const [pending, setPending] = useState<{
    value: boolean;
    from: boolean;
  } | null>(null);
  const on =
    pending !== null && pending.from === lecture ? pending.value : lecture;
  const disabled = !canMark || busy;

  async function toggle() {
    if (disabled) return;
    const value = !on;
    setPending({ value, from: lecture });
    setBusy(true);
    const error = await setLecture(run, value);
    setBusy(false);
    if (error !== null) {
      setPending(null);
      toast.error(error);
      return;
    }
    onChanged();
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={disabled}
      onClick={toggle}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-md text-sm",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        canMark ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground",
        className,
      )}
    >
      Lecture
      <span
        aria-hidden
        className={cn(
          "relative inline-block h-[18px] w-8 flex-none rounded-full transition-colors",
          on ? "bg-foreground" : "bg-border",
          !canMark && "opacity-50",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-3.5 rounded-full bg-card shadow-sm transition-transform",
            on && "translate-x-3.5",
          )}
        />
      </span>
    </button>
  );
}
