"use client";

import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-lg bg-muted p-0.5"
    >
      {options.map(([option, said]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-3 py-1 text-sm text-muted-foreground",
            value === option && "bg-card font-medium text-foreground shadow-xs",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
        >
          {said}
        </button>
      ))}
    </div>
  );
}
