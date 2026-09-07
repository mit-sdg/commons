"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** A button that is out reads as out without leaving the tab order. */
const OUT =
  "cursor-default text-muted-foreground hover:bg-background hover:text-muted-foreground dark:hover:bg-input/30";

/**
 * The shown round as the panel holds it: the relay's note, written in the
 * editor and read here, and the run's note, written here on the round itself.
 */
export interface SortingRound {
  round: string;
  /** The relay the shown round belongs to, which the editor link names. */
  relay: string;
  relayNotes: string;
  notes: string;
}

/**
 * The model's controls for the shown round: the run's standing consent, the
 * one press that acts on purpose, and the notes whoever sorts reads first.
 */
export function SortingPanel({
  modelSorts,
  word,
  round,
  canSweep,
  busy,
  closed,
  onSorts,
  onSweep,
  onNotes,
  onClearEmpty,
  canClearEmpty = false,
}: {
  modelSorts: boolean;
  /** What the model is doing about the shown round, when there is a word for it. */
  word: string | null;
  /** The shown round, or nothing while no round has opened. */
  round: SortingRound | null;
  /** Some card of the shown wall is in a pile. */
  canSweep: boolean;
  busy: boolean;
  /** The run has closed, so the server refuses every move made here. */
  closed: boolean;
  onSorts: (on: boolean) => void;
  /** Every card back to the tray; with the model sorting, one ask follows. */
  onSweep: () => void;
  onNotes: (body: string) => void;
  onClearEmpty?: () => void;
  canClearEmpty?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="eyebrow">Sorting</span>
        {word === null ? null : (
          <span className="text-muted-foreground text-xs">{word}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Switch
          on={modelSorts}
          label="Sort automatically"
          out={closed}
          onChange={onSorts}
        />
        {round === null ? null : (
          <div className="flex flex-wrap items-center gap-1.5">
            <Press out={!canSweep || busy || closed} onPress={onSweep}>
              {sweepWord(modelSorts)}
            </Press>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Pile actions"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!canClearEmpty || busy || closed}
                  onSelect={onClearEmpty}
                >
                  Clear empty piles
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {round === null ? null : (
        <>
          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">
              Sorting instructions
              <span className="ml-2 font-normal text-muted-foreground text-xs">
                {round.relayNotes || round.notes ? "Added" : "None"}
              </span>
            </summary>
            <div className="mt-3 flex flex-col gap-4">
              <RelayNotes round={round} />
              <Notes round={round} readOnly={closed} onNotes={onNotes} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}

/** Emptying with sorting off asks for nothing new; an already-pending reply can still place cards. */
export function sweepWord(modelSorts: boolean): string {
  return modelSorts ? "Resort" : "Move all responses to tray";
}

/** The relay's note, as the editor wrote it, which nothing typed here changes. */
function RelayNotes({ round }: { round: SortingRound }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <Label asChild>
          <span>Saved sorting instructions</span>
        </Label>
        <Link
          href={`/staff/live/relay/${round.relay}/edit`}
          className="text-muted-foreground text-xs underline-offset-4 hover:underline"
        >
          Edit
        </Link>
      </div>
      <p className="whitespace-pre-wrap text-muted-foreground text-sm">
        {round.relayNotes === "" ? "None" : round.relayNotes}
      </p>
    </div>
  );
}

/**
 * The run's note as the round has it until a hand types over it; what a hand
 * is typing stands until it is saved, even when another dashboard's note lands
 * meanwhile, and a note that landed while no hand was in the box replaces it.
 * Once the run has closed, instructions are read only while any intentional
 * final sort finishes.
 */
function Notes({
  round,
  readOnly,
  onNotes,
}: {
  round: SortingRound;
  readOnly: boolean;
  onNotes: (body: string) => void;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = box.current;
    if (element === null || document.activeElement === element) return;
    element.value = round.notes;
  }, [round.notes]);
  if (readOnly) {
    return (
      <div className="flex flex-col gap-1">
        <Label asChild>
          <span>Additional instructions for this run</span>
        </Label>
        <p className="whitespace-pre-wrap text-muted-foreground text-sm">
          {round.notes === "" ? "None" : round.notes}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`run-notes-${round.round}`}>
        Additional instructions for this run
      </Label>
      <Textarea
        key={round.round}
        ref={box}
        id={`run-notes-${round.round}`}
        defaultValue={round.notes}
        rows={2}
        readOnly={readOnly}
        className="min-h-11 text-sm"
        onBlur={(event) => {
          const body = noteEdit(event.target.value, round.notes);
          if (body !== null) onNotes(body);
        }}
      />
    </div>
  );
}

/** What a blurred note asks to be written; nothing, when it stands as it was. */
export function noteEdit(typed: string, standing: string): string | null {
  const body = typed.trim();
  return body === standing.trim() ? null : body;
}

/** One press of the panel, out while another move is in flight. */
function Press({
  out,
  onPress,
  children,
}: {
  out: boolean;
  onPress: () => void;
  children: string;
}) {
  return (
    <Button
      variant="outline"
      size="xs"
      aria-disabled={out}
      className={out ? OUT : undefined}
      onClick={() => {
        if (out) return;
        onPress();
      }}
    >
      {children}
    </Button>
  );
}

/** The switch that says the model sorts, which is standing consent while it is on. */
function Switch({
  on,
  label,
  out,
  onChange,
}: {
  on: boolean;
  label: string;
  out: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={out}
      onClick={() => {
        if (out) return;
        onChange(!on);
      }}
      className={cn(
        "flex items-center gap-2 text-sm",
        out && "cursor-default text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "relative inline-block h-[18px] w-8 flex-none rounded-full transition-colors",
          on ? "bg-primary" : "bg-input",
        )}
      >
        <i
          className={cn(
            "absolute top-0.5 block size-3.5 rounded-full bg-card transition-[left]",
            on ? "left-4" : "left-0.5",
          )}
        />
      </span>
      {label}
    </button>
  );
}
