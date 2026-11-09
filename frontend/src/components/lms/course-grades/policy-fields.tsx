"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { InlineHelp } from "@/components/ui/inline-help";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** A soft field: filled, borderless until focused. */
const SOFT =
  "rounded-md border border-transparent bg-foreground/[0.05] hover:bg-foreground/[0.08] focus:border-ring focus:bg-background";

/** A native select sized for the policy list. */
export const SELECT = cn("h-7 min-w-0 px-1 text-sm", SOFT, RING);

/** A select that reads as plain muted text until hovered: "Average", "Latest". */
const QUIET_SELECT = cn(
  "h-7 min-w-0 rounded-md border border-transparent bg-transparent px-0.5 text-sm text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
  RING,
);

/**
 * One step of the policy, in the order a grade is worked out: a numbered
 * heading with its ? hint, and the step read as the policy says it, or open
 * for editing. "Edited" marks a step that differs from the saved policy.
 */
export function PolicySection({
  step,
  title,
  hint,
  edited,
  editing,
  onEditing,
  children,
}: {
  step: number;
  title: string;
  hint?: React.ReactNode;
  edited: boolean;
  editing: boolean;
  /** Absent when the policy is read only. */
  onEditing?: (editing: boolean) => void;
  children: React.ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  // Opening a step moves focus to its first field; Done returns it to the button.
  const pressed = useRef(false);
  useEffect(() => {
    if (!pressed.current) return;
    pressed.current = false;
    if (editing)
      body.current?.querySelector<HTMLElement>("input, select")?.focus();
    else toggle.current?.focus();
  }, [editing]);
  return (
    <section
      aria-label={title}
      className={cn(
        "group/step -mx-4 grid gap-2.5 border-t border-border px-4 pt-3.5 pb-4 transition-colors",
        editing
          ? "bg-foreground/[0.035]"
          : onEditing && "hover:bg-foreground/[0.025]",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-foreground/30 text-[11px] font-bold text-muted-foreground"
        >
          {step}
        </span>
        <h3 className="text-[0.9rem] font-semibold">{title}</h3>
        {hint ? <InlineHelp label={title}>{hint}</InlineHelp> : null}
        {edited ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
            Edited
          </span>
        ) : null}
        {onEditing ? (
          <button
            ref={toggle}
            type="button"
            aria-expanded={editing}
            aria-label={`${editing ? "Done editing" : "Edit"} ${title}`}
            onClick={() => {
              pressed.current = true;
              onEditing(!editing);
            }}
            className={cn(
              "ml-auto rounded-md border px-2 py-px text-[13px] font-medium",
              editing
                ? "border-foreground/30 bg-card text-foreground"
                : "border-transparent text-muted-foreground group-hover/step:border-foreground/20 group-hover/step:text-foreground",
              RING,
            )}
          >
            {editing ? "Done" : "Edit"}
          </button>
        ) : null}
      </div>
      <div ref={body} className="grid gap-2.5">
        {children}
      </div>
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
        "h-7 w-14 px-1.5 text-right text-sm tabular-nums aria-invalid:border-destructive",
        SOFT,
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
        "h-7 min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-sm hover:bg-foreground/[0.06] focus:border-ring focus:bg-background",
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
  quiet,
  className,
}: {
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
  label: string;
  readOnly: boolean;
  /** Muted text until hovered, for a choice beside a name. */
  quiet?: boolean;
  className?: string;
}) {
  const said = options.find(([option]) => option === value)?.[1] ?? value;
  if (readOnly) return <span className={cn("text-sm", className)}>{said}</span>;
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn(quiet ? QUIET_SELECT : SELECT, className)}
    >
      {options.map(([option, words]) => (
        <option key={option} value={option}>
          {words}
        </option>
      ))}
    </select>
  );
}

/** The × that removes a group, row, or rule; it shows when its row is hovered or focused. */
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
        "inline-grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100",
        RING,
      )}
    >
      <X aria-hidden className="size-3.5" />
    </button>
  );
}

const ADDER = cn(
  "-ml-1.5 h-7 max-w-full appearance-none justify-self-start rounded-md bg-transparent px-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
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

/** "+ Add": adds the thing picked from a list, in named groups of options. */
export function AddPicker({
  said,
  label,
  groups,
  onPick,
}: {
  said: string;
  label: string;
  groups: { label: string; options: [string, string][] }[];
  onPick: (value: string) => void;
}) {
  const shown = groups.filter((group) => group.options.length > 0);
  if (shown.length === 0) return null;
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
      {shown.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map(([value, words]) => (
            <option key={value} value={value}>
              {words}
            </option>
          ))}
        </optgroup>
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
