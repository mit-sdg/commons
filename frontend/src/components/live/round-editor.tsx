"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RUN_OPEN_MESSAGE } from "@/components/live/quiz-meta";
import {
  RoundToken,
  shapeWords,
  TakesChip,
} from "@/components/live/round-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { api, isApiError, type Output, publicErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export type RelayRound = NonNullable<
  Output<"/live/relays/get">["relay"]
>["rounds"][number];

const SHAPES = ["picked", "every", "top"] as const;

const PARTS_MAX = 12;
const CAP_MIN = 2;
const CAP_MAX = 20;

interface Draft {
  title: string;
  prompt: string;
  parts: string[];
  cap: number;
  choices: string[];
}

function cleaned(draft: Draft): Draft {
  const parts = draft.parts
    .map((part) => part.trim())
    .filter((part) => part !== "");
  return {
    title: draft.title.trim(),
    prompt: draft.prompt.trim(),
    parts,
    cap: parts.length === 1 ? draft.cap : 0,
    choices: draft.choices
      .map((choice) => choice.trim())
      .filter((choice) => choice !== ""),
  };
}

function same(left: Draft, right: Draft): boolean {
  return (
    left.title === right.title &&
    left.prompt === right.prompt &&
    left.cap === right.cap &&
    left.parts.join("\n") === right.parts.join("\n") &&
    left.choices.join("\n") === right.choices.join("\n")
  );
}

function report(result: unknown, conflict: string): boolean {
  if (!isApiError(result)) return true;
  toast.error(
    result.error === "CONFLICT" ? conflict : publicErrorMessage(result.error),
  );
  return false;
}

/**
 * One round, edited in place. The card holds its own draft and writes it back
 * whenever a field is left or a row is added or dropped, so a round never
 * stands half written. A question offers choices or takes parts, never both,
 * and the card shows only the side still open to it.
 */
export function RoundEditor({
  round,
  rounds,
  locked,
  onChanged,
}: {
  round: RelayRound;
  rounds: RelayRound[];
  /** A run is open: the round may be read but never rewritten. */
  locked: boolean;
  onChanged: () => void;
}) {
  const saved: Draft = {
    title: round.title,
    prompt: round.prompt,
    parts: round.parts,
    cap: round.cap,
    choices: round.choices,
  };
  const [draft, setDraft] = useState<Draft>(saved);
  const [busy, setBusy] = useState(false);

  const takes = round.takes[0] ?? null;
  const earlier = rounds.filter((entry) => entry.number < round.number);
  const first = round.number === 1;
  const last = round.number === rounds.length;

  async function commit(next: Draft) {
    const wanted = cleaned(next);
    if (wanted.title === "" || wanted.prompt === "") return;
    if (same(wanted, cleaned(saved))) return;
    setBusy(true);
    const result = await api["/live/relays/revise-round"]({
      leg: round.leg,
      title: wanted.title,
      prompt: wanted.prompt,
      parts: wanted.parts,
      cap: wanted.cap,
      choices: wanted.choices,
    });
    setBusy(false);
    if (report(result, RUN_OPEN_MESSAGE)) onChanged();
  }

  function change(next: Partial<Draft>, write = false) {
    const merged = { ...draft, ...next };
    setDraft(merged);
    if (write) void commit(merged);
  }

  async function move(to: number) {
    setBusy(true);
    const result = await api["/live/relays/move-round"]({
      leg: round.leg,
      position: to,
    });
    setBusy(false);
    if (report(result, publicErrorMessage("CONFLICT"))) onChanged();
  }

  async function remove() {
    setBusy(true);
    const result = await api["/live/relays/remove-round"]({ leg: round.leg });
    setBusy(false);
    if (report(result, publicErrorMessage("CONFLICT"))) onChanged();
  }

  async function setTakes(source: string, shape: string) {
    setBusy(true);
    if (takes !== null) {
      const cleared = await api["/live/relays/clear-takes"]({
        leg: round.leg,
        source: takes.source,
      });
      if (!report(cleared, publicErrorMessage("CONFLICT"))) {
        setBusy(false);
        return;
      }
    }
    const result = await api["/live/relays/set-takes"]({
      leg: round.leg,
      source,
      shape,
    });
    setBusy(false);
    if (report(result, publicErrorMessage("CONFLICT"))) onChanged();
  }

  async function clearTakes() {
    if (takes === null) return;
    setBusy(true);
    const result = await api["/live/relays/clear-takes"]({
      leg: round.leg,
      source: takes.source,
    });
    setBusy(false);
    if (report(result, publicErrorMessage("CONFLICT"))) onChanged();
  }

  const disabled = locked || busy;
  const repeats = draft.parts.length === 1 && draft.cap > 0;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 rounded-xl border border-border bg-card px-5 py-4">
      <RoundToken number={round.number} size="lg" standing="next" />

      <div className="flex min-w-0 flex-col gap-3">
        <Input
          value={draft.title}
          maxLength={200}
          disabled={disabled}
          aria-label="Title"
          aria-invalid={draft.title.trim() === ""}
          className="h-auto border-transparent px-0 font-display text-xl font-semibold shadow-none md:text-xl"
          onChange={(event) => change({ title: event.target.value })}
          onBlur={() => void commit(draft)}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`prompt-${round.leg}`}>Prompt</Label>
          <Textarea
            id={`prompt-${round.leg}`}
            value={draft.prompt}
            disabled={disabled}
            rows={2}
            className="min-h-11"
            onChange={(event) => change({ prompt: event.target.value })}
            onBlur={() => void commit(draft)}
          />
        </div>

        <div className="flex flex-wrap items-start gap-6">
          {draft.choices.length === 0 ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label>Parts</Label>
              <div className="flex flex-wrap items-center gap-2">
                {draft.parts.map((part, index) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: a part is its row, and a row carries no id
                    key={index}
                    className="inline-flex items-center gap-1"
                  >
                    <Input
                      value={part}
                      maxLength={40}
                      disabled={disabled}
                      aria-label="Part"
                      className="w-36"
                      onChange={(event) => {
                        const parts = [...draft.parts];
                        parts[index] = event.target.value;
                        change({ parts });
                      }}
                      onBlur={() => void commit(draft)}
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Remove part"
                      disabled={disabled}
                      onClick={() =>
                        change(
                          {
                            parts: draft.parts.filter((_, at) => at !== index),
                          },
                          true,
                        )
                      }
                    >
                      <X />
                    </Button>
                  </span>
                ))}
                {draft.parts.length < PARTS_MAX && !repeats ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => change({ parts: [...draft.parts, ""] })}
                  >
                    + Part
                  </Button>
                ) : null}
              </div>
              {draft.parts.length === 1 ? (
                <label className="flex items-center gap-2 text-muted-foreground text-sm">
                  <input
                    type="checkbox"
                    checked={repeats}
                    disabled={disabled}
                    onChange={(event) =>
                      change({ cap: event.target.checked ? 3 : 0 }, true)
                    }
                  />
                  repeat up to
                  {repeats ? (
                    <Input
                      type="number"
                      min={CAP_MIN}
                      max={CAP_MAX}
                      value={draft.cap}
                      disabled={disabled}
                      aria-label="repeat up to"
                      className="h-8 w-16"
                      onChange={(event) =>
                        change({ cap: Number(event.target.value) })
                      }
                      onBlur={() => void commit(draft)}
                    />
                  ) : null}
                </label>
              ) : null}
            </div>
          ) : null}

          {draft.parts.length === 0 ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label>Choices</Label>
              <div className="flex flex-col gap-2">
                {draft.choices.map((choice, index) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: a choice is its row, and a row carries no id
                    key={index}
                    className="inline-flex items-center gap-1"
                  >
                    <Input
                      value={choice}
                      maxLength={500}
                      disabled={disabled}
                      aria-label="Choice"
                      className="w-56"
                      onChange={(event) => {
                        const choices = [...draft.choices];
                        choices[index] = event.target.value;
                        change({ choices });
                      }}
                      onBlur={() => void commit(draft)}
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Remove choice"
                      disabled={disabled}
                      onClick={() =>
                        change(
                          {
                            choices: draft.choices.filter(
                              (_, at) => at !== index,
                            ),
                          },
                          true,
                        )
                      }
                    >
                      <X />
                    </Button>
                  </span>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  disabled={disabled}
                  onClick={() => change({ choices: [...draft.choices, ""] })}
                >
                  + Choice
                </Button>
              </div>
            </div>
          ) : null}

          {earlier.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label>Takes</Label>
              <div className="flex items-center gap-2">
                {takes === null ? (
                  <span className="text-muted-foreground text-sm">nothing</span>
                ) : (
                  <TakesChip
                    from={takes.sourceNumber}
                    shape={takes.shape}
                    size="lg"
                  />
                )}
                <TakesPicker
                  earlier={earlier}
                  disabled={disabled}
                  onSet={(source, shape) => void setTakes(source, shape)}
                  onClear={() => void clearTakes()}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Move up"
          disabled={disabled || first}
          onClick={() => void move(round.number - 1)}
        >
          <ArrowUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Move down"
          disabled={disabled || last}
          onClick={() => void move(round.number + 1)}
        >
          <ArrowDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Remove round"
          disabled={disabled}
          onClick={() => void remove()}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}

function TakesPicker({
  earlier,
  disabled,
  onSet,
  onClear,
}: {
  earlier: RelayRound[];
  disabled: boolean;
  onSet: (source: string, shape: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string>(
    earlier[earlier.length - 1]?.leg ?? "",
  );
  const [shape, setShape] = useState<string>("picked");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          Change
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="start">
        <div className="flex flex-col gap-1">
          {earlier.map((entry) => (
            <button
              key={entry.leg}
              type="button"
              className={cn(
                "flex items-center rounded-md px-2 py-1.5 text-left hover:bg-accent",
                entry.leg === source && "bg-accent",
              )}
              onClick={() => setSource(entry.leg)}
            >
              <RoundToken
                number={entry.number}
                title={entry.title}
                size="sm"
                standing="done"
              />
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {SHAPES.map((entry) => (
            <button
              key={entry}
              type="button"
              className={cn(
                "rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                entry === shape && "bg-accent",
              )}
              onClick={() => setShape(entry)}
            >
              {shapeWords(entry)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={source === ""}
            onClick={() => {
              setOpen(false);
              onSet(source, shape);
            }}
          >
            Change
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              onClear();
            }}
          >
            nothing
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The end of the list: a round is written here before it exists on the server. */
export function AddRoundCard({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (title: string, prompt: string) => Promise<boolean>;
}) {
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const ready = title.trim() !== "" && prompt.trim() !== "";

  if (!writing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setWriting(true)}
        className="flex items-center gap-3 rounded-xl border border-dashed border-border px-5 py-4 text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
      >
        <span className="inline-flex size-10 items-center justify-center rounded-full border-[1.5px] border-dashed border-muted-foreground font-mono text-lg">
          +
        </span>
        Add a round
      </button>
    );
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 rounded-xl border border-dashed border-border px-5 py-4">
      <span className="inline-flex size-10 items-center justify-center rounded-full border-[1.5px] border-dashed border-muted-foreground font-mono text-lg text-muted-foreground">
        +
      </span>
      <div className="flex min-w-0 flex-col gap-3">
        <Input
          value={title}
          maxLength={200}
          aria-label="Title"
          className="h-auto border-transparent px-0 font-display text-xl font-semibold shadow-none md:text-xl"
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-round-prompt">Prompt</Label>
          <Textarea
            id="new-round-prompt"
            value={prompt}
            rows={2}
            className="min-h-11"
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!ready || disabled}
            onClick={async () => {
              const added = await onAdd(title.trim(), prompt.trim());
              if (!added) return;
              setTitle("");
              setPrompt("");
              setWriting(false);
            }}
          >
            + Round
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={() => setWriting(false)}
          >
            <X />
          </Button>
        </div>
      </div>
    </div>
  );
}
