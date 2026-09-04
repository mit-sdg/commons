"use client";

import { Check, X } from "lucide-react";
import { ActButton } from "@/components/live/round-editor";
import {
  RoundToken,
  TakesChip,
  takeWords,
} from "@/components/live/round-token";
import type { Output } from "@/lib/api";
import { cn } from "@/lib/utils";

type Offered = Output<"/live/edits/offerings">;
type OfferedLine = Offered["offerings"][number]["lines"][number];
type Round = NonNullable<Output<"/live/relays/get">["relay"]>["rounds"][number];

/** What a proposal reads off the round it is about. */
type Stands = Pick<
  Round,
  "number" | "title" | "prompt" | "parts" | "cap" | "choices" | "takes"
>;

/** The word a proposal stands under: the field it touches, as the card names it. */
const FIELD: Record<string, string> = {
  title: "Title",
  prompt: "Prompt",
  parts: "Parts",
  choices: "Choices",
  takes: "Takes from",
  move: "Move to",
  remove: "Remove",
};

/**
 * A card whose round a proposal would remove: everything under the strip at its
 * top reads as gone, so the strip that says so stays legible.
 */
export const GOING = "[&>div>*:not(:first-child)]:opacity-45";

/** The mark every standing proposal carries, wherever on the page it stands. */
const MARK = "data-proposed";

/** What a proposal is marked with, and how the first of them on a page is found. */
export const PROPOSED = { [MARK]: "" };
export const FIRST_PROPOSED = `[${MARK}]`;

/** One line as the panel and the cards address it, with what a concept refused. */
export interface Proposed {
  line: OfferedLine;
  refusal: string | null;
}

function readJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/** The boxes a round holds, in words: one label repeated, or the labels in a row. */
export function partWords(parts: string[], cap: number): string {
  if (parts.length === 0) return "";
  if (cap > 0) return `${parts[0]}, up to ${cap}`;
  return parts.join(" · ");
}

/** What a round takes, in words, and `nothing` for a round that takes none. */
export function takesWords(from: number, use: string): string {
  return from === 0 || use === "" ? "nothing" : `${from} ${takeWords(use)}`;
}

/** The round an `add` line carries, read off its value. */
export function addedRound(value: string) {
  const drafted = record(readJson(value));
  const takes = record(drafted.takes);
  return {
    title: typeof drafted.title === "string" ? drafted.title : "",
    prompt: typeof drafted.prompt === "string" ? drafted.prompt : "",
    kind: typeof drafted.kind === "string" ? drafted.kind : "",
    parts: strings(drafted.parts),
    cap: typeof drafted.cap === "number" ? drafted.cap : 0,
    choices: strings(drafted.choices),
    from: typeof takes.from === "number" ? takes.from : 0,
    use: typeof takes.use === "string" ? takes.use : "",
    position: typeof drafted.position === "number" ? drafted.position : 0,
  };
}

/**
 * What a line proposes for a round that stands: the field it touches, what
 * stands there now, and what it would read. A field that stands empty gives an
 * empty `was`, so the row shows one value rather than a struck blank.
 */
export function changeWords(
  line: { kind: string; value: string },
  round: Stands | null,
): { field: string; was: string; to: string } {
  const field = FIELD[line.kind] ?? line.kind;
  if (line.kind === "remove") {
    return { field, was: round?.title ?? "", to: "" };
  }
  if (line.kind === "move") {
    return { field, was: String(round?.number ?? ""), to: line.value };
  }
  if (line.kind === "title") {
    return { field, was: round?.title ?? "", to: line.value };
  }
  if (line.kind === "prompt") {
    return { field, was: round?.prompt ?? "", to: line.value };
  }
  if (line.kind === "parts") {
    const drafted = record(readJson(line.value));
    const cap = typeof drafted.cap === "number" ? drafted.cap : 0;
    const to = partWords(strings(drafted.parts), cap);
    return {
      field,
      was: round === null ? "" : partWords(round.parts, round.cap),
      to: to === "" ? "nothing" : to,
    };
  }
  if (line.kind === "choices") {
    const to = strings(readJson(line.value)).join(" · ");
    return {
      field,
      was: round?.choices.join(" · ") ?? "",
      to: to === "" ? "nothing" : to,
    };
  }
  if (line.kind === "takes") {
    const drafted = record(readJson(line.value));
    const from = typeof drafted.from === "number" ? drafted.from : 0;
    const use = typeof drafted.use === "string" ? drafted.use : "";
    const stands = round?.takes[0] ?? null;
    return {
      field,
      was: stands == null ? "" : takesWords(stands.sourceNumber, stands.use),
      to: takesWords(from, use),
    };
  }
  return { field, was: "", to: line.value };
}

function Settle({
  words,
  busy,
  reversed = false,
  onAccept,
  onRefuse,
}: {
  /** What the pair acts on, so a screen reader hears the line and not the icon. */
  words: string;
  busy: boolean;
  /** Refuse first, where accepting is the way that takes something away. */
  reversed?: boolean;
  onAccept: () => void;
  onRefuse: () => void;
}) {
  const accept = (
    <ActButton
      key="accept"
      variant="ghost"
      size="icon-sm"
      aria-label={`Accept ${words}`}
      busy={busy}
      onClick={onAccept}
    >
      <Check />
    </ActButton>
  );
  const refuse = (
    <ActButton
      key="refuse"
      variant="ghost"
      size="icon-sm"
      aria-label={`Refuse ${words}`}
      busy={busy}
      onClick={onRefuse}
    >
      <X />
    </ActButton>
  );
  return (
    <span className="flex flex-none gap-1">
      {reversed ? [refuse, accept] : [accept, refuse]}
    </span>
  );
}

/**
 * One proposal, said in a row: the field, what stands there struck through, and
 * what it would read, with the pair that settles it.
 */
export function ProposalRow({
  field,
  was,
  to,
  words,
  busy,
  refusal,
  reversed,
  onAccept,
  onRefuse,
}: {
  field: string;
  was: string;
  to: string;
  words: string;
  busy: boolean;
  refusal: string | null;
  reversed?: boolean;
  onAccept: () => void;
  onRefuse: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-1 py-1.5 text-sm",
        refusal === null ? null : "text-destructive",
      )}
    >
      <span className="w-full flex-none whitespace-nowrap font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.06em] sm:w-[92px]">
        {field}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
        {was === "" || was === to ? null : (
          <s className="min-w-0 text-muted-foreground">{was}</s>
        )}
        {to === "" ? null : (
          <>
            {was === "" || was === to ? null : (
              <span className="flex-none text-muted-foreground">→</span>
            )}
            <span className="min-w-0">{to}</span>
          </>
        )}
      </span>
      <Settle
        words={words}
        busy={busy}
        reversed={reversed}
        onAccept={onAccept}
        onRefuse={onRefuse}
      />
      {refusal === null ? null : (
        <p className="w-full text-destructive sm:pl-[102px]">{refusal}</p>
      )}
    </div>
  );
}

/** What the model proposes for a round that stands, drawn across its card's top. */
export function RoundChanges({
  proposed,
  round,
  busy,
  onSettle,
}: {
  proposed: Proposed[];
  round: Round;
  busy: boolean;
  onSettle: (line: OfferedLine, take: boolean) => void;
}) {
  if (proposed.length === 0) return null;
  return (
    <div
      {...PROPOSED}
      className="mb-1 divide-y divide-primary/20 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1"
    >
      {proposed.map(({ line, refusal }) => {
        const { field, was, to } = changeWords(line, round);
        return (
          <ProposalRow
            key={line.suggestion}
            field={field}
            was={was}
            to={to}
            words={`${field.toLowerCase()} on round ${round.number}`}
            busy={busy}
            refusal={refusal}
            reversed={line.kind === "remove"}
            onAccept={() => onSettle(line, true)}
            onRefuse={() => onSettle(line, false)}
          />
        );
      })}
    </div>
  );
}

/** A round the model proposes, standing at the number it would land at. */
export function ProposedRound({
  proposed,
  number,
  busy,
  onSettle,
}: {
  proposed: Proposed;
  number: number;
  busy: boolean;
  onSettle: (line: OfferedLine, take: boolean) => void;
}) {
  const { line, refusal } = proposed;
  const round = addedRound(line.value);
  const boxes = partWords(round.parts, round.cap) || round.choices.join(" · ");
  return (
    <div
      {...PROPOSED}
      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 rounded-xl border border-dashed border-primary/50 bg-primary/5 px-5 py-4"
    >
      <RoundToken number={number} size="lg" standing="next" />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1 font-display font-semibold text-xl">
            {round.title}
          </span>
          <Settle
            words={`round ${number}`}
            busy={busy}
            onAccept={() => onSettle(line, true)}
            onRefuse={() => onSettle(line, false)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {round.kind === "" ? null : (
            <span className="text-muted-foreground text-sm capitalize">
              {round.kind}
            </span>
          )}
          {round.from > 0 && round.use !== "" ? (
            <TakesChip from={round.from} use={round.use} standing="plain" />
          ) : null}
        </div>
        {round.prompt === "" ? null : (
          <p className="min-w-0 text-muted-foreground text-sm">
            {round.prompt}
          </p>
        )}
        {boxes === "" ? null : (
          <p className="min-w-0 text-muted-foreground text-sm">{boxes}</p>
        )}
        {refusal === null ? null : (
          <p className="text-destructive text-sm">{refusal}</p>
        )}
      </div>
    </div>
  );
}
