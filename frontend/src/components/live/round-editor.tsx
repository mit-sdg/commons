"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  type RefusalAbout,
  type RefusalWord,
  saidRefusal,
} from "@/components/live/refusals";
import { RoundPreview } from "@/components/live/round-preview";
import { RoundToken } from "@/components/live/round-token";
import {
  firstUse,
  kindOf,
  type RoundKind,
  sentenceOf,
  useCarryUses,
  usesFor,
} from "@/components/live/rounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, isApiError, type Output } from "@/lib/api";
import { cn } from "@/lib/utils";

export type RelayRound = NonNullable<
  Output<"/live/relays/get">["relay"]
>["rounds"][number];

const KINDS: RoundKind[] = ["write", "list", "vote"];

/**
 * A title that still reads as the heading it is, with a rule under it saying
 * it can be typed into — and no filled slab of its own in the dark.
 */
export const TITLE_FIELD =
  "h-auto rounded-none border-transparent border-b-border bg-transparent px-0 font-display font-semibold shadow-none focus-visible:border-b-primary dark:bg-transparent";

/** What a part is called until it is named, so an empty box shows its place. */
const PART_WORDS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

/** The source select's word for a round that takes nothing; no leg reads so. */
const NOTHING = "nothing";

const PARTS_MAX = 12;
const CAP_MIN = 2;
const CAP_MAX = 20;
const CAP_START = 3;

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

/** A refusal the screen has read: the word, and the round its sentence names. */
interface Said {
  word: RefusalWord;
  about: RefusalAbout;
}

/** What a request asks of the round, which is what says how a refusal reads. */
type RoundChange =
  | { kind: "revise" }
  | { kind: "remove" }
  | { kind: "move"; to: number }
  | { kind: "takes"; source: string };

/**
 * Which refusal stands behind a conflict, read from the relay this page holds:
 * the round is in the open run, another round still takes from it, or the
 * order asked for would put a round before what it takes from.
 */
function roundRefusal(
  change: RoundChange,
  round: RelayRound,
  rounds: RelayRound[],
  inRun: boolean,
): Said {
  const inTheRun: Said = { word: "RUN_OPEN", about: { round: round.number } };
  if (change.kind === "revise") return inTheRun;

  const drawnOn =
    rounds.find((entry) =>
      entry.takes.some((takes) => takes.source === round.leg),
    ) ?? null;
  if (change.kind === "remove") {
    return inRun || drawnOn === null
      ? inTheRun
      : { word: "LEG_DRAWN_ON", about: { round: drawnOn.number } };
  }
  const sourceOf = (leg: string | undefined) =>
    rounds.find((entry) => entry.leg === leg) ?? null;
  if (change.kind === "takes") {
    const chosen = sourceOf(change.source);
    return {
      word: "FORWARD_DRAW",
      about: chosen === null ? {} : { source: chosen.number },
    };
  }
  if (drawnOn !== null && change.to >= drawnOn.number)
    return { word: "FORWARD_DRAW", about: { round: drawnOn.number } };
  const from = sourceOf(round.takes[0]?.source);
  return from !== null && change.to <= from.number
    ? { word: "FORWARD_DRAW", about: { source: from.number } }
    : { word: "FORWARD_DRAW", about: {} };
}

function report(result: unknown, said: Said | null): boolean {
  if (!isApiError(result)) return true;
  const read =
    result.error === "CONFLICT"
      ? said
      : result.error === "NOT_FOUND"
        ? { word: "ROUND_GONE" as const, about: {} }
        : null;
  toast.error(saidRefusal(result.error, read?.word ?? null, read?.about));
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
  note = null,
  onChanged,
}: {
  round: RelayRound;
  rounds: RelayRound[];
  /** The round may be read but never rewritten. */
  locked: boolean;
  /** The one sentence saying why it is locked, said once at the card's top. */
  note?: string | null;
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
  const [seen, setSeen] = useState<Draft>(saved);
  const [busy, setBusy] = useState(false);
  const [chosenKind, setChosenKind] = useState<RoundKind | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const uses = useCarryUses();

  // The round can change under the card — a drafting line taken, another tab —
  // and a draft written against the round as it was is dropped for the one
  // that now stands, so the card never writes a stale round back out.
  if (!same(cleaned(saved), cleaned(seen))) {
    setSeen(saved);
    setDraft(saved);
  }

  const takes = round.takes[0] ?? null;
  const earlier = rounds.filter((entry) => entry.number < round.number);
  const first = round.number === 1;
  const last = round.number === rounds.length;
  const written = cleaned(draft);
  // The kind is what the card holds — the parts or choices being typed, or a
  // take that fixes it. A round holding none of those is still free to be the
  // kind that was chosen for it, so the boxes of that kind can be filled.
  const held = kindOf({
    choices: written.choices,
    parts: written.parts,
    takes: round.takes,
  });
  const bare =
    written.parts.length === 0 &&
    written.choices.length === 0 &&
    (takes === null || takes.shape === "context");
  const kind: RoundKind = (bare ? chosenKind : null) ?? held;
  const open = usesFor(uses, kind);

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
    if (report(result, roundRefusal({ kind: "revise" }, round, rounds, locked)))
      onChanged();
  }

  /** A title cleared and left behind is not a title: the saved one comes back. */
  function leaveTitle() {
    if (draft.title.trim() === "") change({ title: round.title });
    else void commit(draft);
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
    if (
      report(result, roundRefusal({ kind: "move", to }, round, rounds, locked))
    )
      onChanged();
  }

  async function remove() {
    setBusy(true);
    const result = await api["/live/relays/remove-round"]({ leg: round.leg });
    setBusy(false);
    if (report(result, roundRefusal({ kind: "remove" }, round, rounds, locked)))
      onChanged();
  }

  async function setTakes(source: string, shape: string) {
    setBusy(true);
    if (takes !== null) {
      const cleared = await api["/live/relays/clear-takes"]({
        leg: round.leg,
        source: takes.source,
      });
      if (!report(cleared, null)) {
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
    if (
      report(
        result,
        roundRefusal({ kind: "takes", source }, round, rounds, locked),
      )
    )
      onChanged();
  }

  async function clearTakes() {
    if (takes === null) return;
    setBusy(true);
    const result = await api["/live/relays/clear-takes"]({
      leg: round.leg,
      source: takes.source,
    });
    setBusy(false);
    if (report(result, null)) onChanged();
  }

  /**
   * A kind is chosen by clearing what the other kinds hold: a write holds
   * neither parts nor choices, a list no choices, a vote no parts. A take that
   * the new kind is not open to moves to the use the kind starts with.
   */
  async function chooseKind(next: RoundKind) {
    if (next === kind) return;
    setChosenKind(next);
    const merged: Draft =
      next === "write"
        ? { ...draft, parts: [], cap: 0, choices: [] }
        : next === "list"
          ? { ...draft, choices: [] }
          : { ...draft, parts: [], cap: 0 };
    setDraft(merged);
    await commit(merged);
    if (takes === null) return;
    if (usesFor(uses, next).some((entry) => entry.use === takes.shape)) return;
    await setTakes(takes.source, firstUse(uses, next));
  }

  const disabled = locked || busy;
  const repeats = draft.parts.length === 1 && draft.cap > 0;
  // A round that takes its parts or choices from another round is written
  // there, so this card only offers the side the round still holds itself.
  const partsOpen = kind === "list" && takes?.shape !== "parts";
  const choicesOpen = kind === "vote" && takes?.shape !== "choices";

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 rounded-xl border border-border bg-card px-5 py-4 focus-within:outline focus-within:outline-2 focus-within:outline-primary focus-within:-outline-offset-2">
      <RoundToken number={round.number} size="lg" standing="plain" />

      <div className="flex min-w-0 flex-col gap-3">
        {note === null ? null : (
          <p className="text-muted-foreground text-sm">{note}</p>
        )}
        <div className="flex items-center gap-2">
          <Input
            value={draft.title}
            maxLength={200}
            disabled={disabled}
            aria-label={`Round ${round.number} title`}
            aria-invalid={draft.title.trim() === ""}
            className={cn(TITLE_FIELD, "min-w-0 flex-1 text-xl md:text-xl")}
            onChange={(event) => change({ title: event.target.value })}
            onBlur={() => leaveTitle()}
          />
          <div className="flex flex-none gap-0.5">
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

        <div
          role="group"
          aria-label={`Round ${round.number} kind`}
          className="inline-flex w-fit gap-0.5 rounded-md border border-border p-0.5"
        >
          {KINDS.map((entry) => (
            <button
              key={entry}
              type="button"
              disabled={disabled}
              aria-pressed={entry === kind}
              className={cn(
                "rounded-[5px] px-2.5 py-1 text-sm capitalize disabled:opacity-50",
                entry === kind
                  ? "bg-foreground font-medium text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => void chooseKind(entry)}
            >
              {entry}
            </button>
          ))}
        </div>

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

        {partsOpen || choicesOpen ? (
          <div className="flex flex-wrap items-start gap-6">
            {partsOpen ? (
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label>Parts</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {draft.parts.map((part, index) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: a part is its row, and a row carries no id
                      key={index}
                      className="group/part relative inline-flex items-center"
                    >
                      <Input
                        value={part}
                        maxLength={40}
                        disabled={disabled}
                        aria-label={`Round ${round.number} part ${index + 1}`}
                        placeholder={PART_WORDS[index] ?? ""}
                        className="w-36 pr-8"
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
                        className="-translate-y-1/2 absolute top-1/2 right-1 opacity-0 group-focus-within/part:opacity-100 group-hover/part:opacity-100"
                        onClick={() =>
                          change(
                            {
                              parts: draft.parts.filter(
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
                      className="size-4 rounded-sm border-input accent-primary"
                      onChange={(event) =>
                        change(
                          { cap: event.target.checked ? CAP_START : 0 },
                          true,
                        )
                      }
                    />
                    Repeat up to
                    <Input
                      type="number"
                      min={CAP_MIN}
                      max={CAP_MAX}
                      value={repeats ? draft.cap : CAP_START}
                      disabled={disabled || !repeats}
                      aria-label="Repeat up to"
                      className="h-8 w-16"
                      onChange={(event) =>
                        change({ cap: Number(event.target.value) })
                      }
                      onBlur={() => void commit(draft)}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}

            {choicesOpen ? (
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
                        aria-label={`Round ${round.number} choice ${index + 1}`}
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
          </div>
        ) : null}

        {earlier.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Takes from</span>
            <Select
              value={takes?.source ?? NOTHING}
              disabled={disabled}
              onValueChange={(value) => {
                if (value === NOTHING) {
                  void clearTakes();
                  return;
                }
                void setTakes(value, takes?.shape ?? firstUse(uses, kind));
              }}
            >
              <SelectTrigger
                size="sm"
                aria-label="Takes from"
                className="max-w-[220px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NOTHING}>nothing</SelectItem>
                {earlier.map((entry) => (
                  <SelectItem
                    key={entry.leg}
                    value={entry.leg}
                    textValue={`${entry.number} ${entry.title}`}
                  >
                    <RoundToken
                      number={entry.number}
                      title={entry.title}
                      size="sm"
                    />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {takes === null ? null : (
              <>
                <span className="inline-flex items-center gap-2">
                  <span className="text-muted-foreground">as</span>
                  {open.length > 1 &&
                  open.some((entry) => entry.use === takes.shape) ? (
                    <Select
                      value={takes.shape}
                      disabled={disabled}
                      onValueChange={(value) =>
                        void setTakes(takes.source, value)
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label="Use"
                        aria-describedby={`use-${round.leg}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {open.map((entry) => (
                          <SelectItem key={entry.use} value={entry.use}>
                            {entry.use}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span>{takes.shape}</span>
                  )}
                </span>
                <span id={`use-${round.leg}`} className="text-muted-foreground">
                  {sentenceOf(uses, takes.shape)}
                </span>
              </>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setPreviewing((shown) => !shown)}
          >
            Preview
          </Button>
          {previewing ? (
            <RoundPreview round={{ ...round, ...written }} />
          ) : null}
        </div>
      </div>
    </div>
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
          placeholder="Title"
          aria-label="New round title"
          className="h-auto px-3 py-1.5 font-display text-xl font-semibold md:text-xl"
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
            Add
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
