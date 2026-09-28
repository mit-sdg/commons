"use client";

import { cn } from "@/lib/utils";

export function SwitchRow({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-6 text-sm">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-[18px] w-8 shrink-0 rounded-full transition-colors",
          on ? "bg-foreground" : "bg-border",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-3.5 rounded-full bg-card shadow-sm transition-transform",
            on && "translate-x-3.5",
          )}
        />
      </button>
    </label>
  );
}
