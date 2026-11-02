"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { InlineHelp } from "@/components/ui/inline-help";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** A native select sized for the policy list. */
export const SELECT = cn(
  "h-8 min-w-0 rounded-md border border-input bg-background px-1.5 text-sm",
  RING,
);

/** One part of the policy list: a small heading, its ? hint, and its body. */
export function PolicySection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="grid gap-2">
      <h3 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {title}
        {hint ? <InlineHelp label={title}>{hint}</InlineHelp> : null}
      </h3>
      {children}
    </section>
  );
}

/**
 * A number in the policy. The policy changes only while the text reads as a
 * number in range, so a cleared or half-typed field never reaches it; the
 * field shows the policy's value again on blur.
 */
export function NumberField({
  value,
  onChange,
  label,
  readOnly,
  min = 0,
  max,
  step = 1,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  readOnly: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  if (readOnly)
    return (
      <span className={cn("text-right text-sm tabular-nums", className)}>
        {value}
      </span>
    );
  const read = (raw: string) => {
    const number = Number(raw);
    return raw.trim() !== "" &&
      Number.isFinite(number) &&
      number >= min &&
      (max === undefined || number <= max)
      ? number
      : null;
  };
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={text ?? String(value)}
      aria-invalid={(text !== null && read(text) === null) || undefined}
      onChange={(event) => {
        setText(event.target.value);
        const number = read(event.target.value);
        if (number !== null && number !== value) onChange(number);
      }}
      onBlur={() => setText(null)}
      className={cn(
        "h-8 w-14 rounded-md border border-input bg-background px-1.5 text-right text-sm tabular-nums aria-invalid:border-destructive",
        RING,
        className,
      )}
    />
  );
}

/** A text field in the policy, such as a group's name. */
export function TextField({
  value,
  onChange,
  label,
  readOnly,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  readOnly: boolean;
  className?: string;
}) {
  if (readOnly)
    return <span className={cn("truncate text-sm", className)}>{value}</span>;
  return (
    <input
      type="text"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-8 min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-sm hover:border-input focus:border-input focus:bg-background",
        RING,
        className,
      )}
    />
  );
}

/** A choice from a short list; read only, the chosen option's words. */
export function ChoiceField<T extends string>({
  value,
  options,
  onChange,
  label,
  readOnly,
  className,
}: {
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
  label: string;
  readOnly: boolean;
  className?: string;
}) {
  const said = options.find(([option]) => option === value)?.[1] ?? value;
  if (readOnly) return <span className={cn("text-sm", className)}>{said}</span>;
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn(SELECT, className)}
    >
      {options.map(([option, words]) => (
        <option key={option} value={option}>
          {words}
        </option>
      ))}
    </select>
  );
}

/** The × that removes a group, row, or rule. */
export function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
        RING,
      )}
    >
      <X aria-hidden className="size-3.5" />
    </button>
  );
}

const ADDER = cn(
  "h-7 max-w-full rounded-md border border-dashed border-border bg-transparent px-2 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground",
  RING,
);

/** "+ Group", "+ Rule": adds one thing. */
export function AddButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={ADDER}>
      {children}
    </button>
  );
}

/** "+ Assignment", "+ Skill": adds the thing picked from a list. */
export function AddPicker({
  said,
  label,
  options,
  onPick,
}: {
  said: string;
  label: string;
  options: [string, string][];
  onPick: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <select
      aria-label={label}
      value=""
      onChange={(event) => {
        if (event.target.value) onPick(event.target.value);
      }}
      className={ADDER}
    >
      <option value="">{said}</option>
      {options.map(([value, words]) => (
        <option key={value} value={value}>
          {words}
        </option>
      ))}
    </select>
  );
}

/** A small outlined tag beside a row's name: "Skill", "Points". */
export function KindTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded border border-border px-1 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </span>
  );
}
