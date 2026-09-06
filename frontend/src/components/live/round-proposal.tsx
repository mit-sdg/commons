"use client";

import { Check, X } from "lucide-react";
import { Chips } from "@/components/live/chips";
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
  | "number"
  | "title"
  | "prompt"
  | "parts"
  | "cap"
  | "choices"
  | "takes"
  | "piles"
  | "notes"
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
  pile: "Add pile",
  unpile: "Remove pile",
  notes: "Notes",
};

/** The word for a pile whose name already stands: only its sentence changes. */
const DESCRIBE = "Describe pile";

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

/** The piles an added round carries, each a name and the sentence under it. */
function piles(value: unknown): { name: string; sentence: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(record)
    .map((pile) => ({
      name: typeof pile.name === "string" ? pile.name : "",
      sentence: typeof pile.sentence === "string" ? pile.sentence : "",
    }))
    .filter((pile) => pile.name !== "");
}

/** One pile in words: its name, and the sentence that says what goes in it. */
export function pileWords(name: string, sentence: string): string {
  return sentence === "" ? name : `${name}: ${sentence}`;
}

/** The boxes a round holds, in words: one label repeated, or the labels in a row. */
export function partWords(parts: string[], cap: number): string {
  if (parts.length === 0) return "";
  if (cap > 0) return `${parts[0]}, up to ${cap}`;
  return parts.join(", ");
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
    piles: piles(drafted.piles),
    notes: typeof drafted.notes === "string" ? drafted.notes : "",
    from: typeof takes.from === "number" ? takes.from : 0,
    use: typeof takes.use === "string" ? takes.use : "",
    position: typeof drafted.position === "number" ? drafted.position : 0,
  };
}

/**
 * A side of a proposed change: a phrase, or a list of like things that is
 * read as chips because one of its values may itself hold a comma.
 */
export type Said = string | string[];

/** Whether a side says nothing at all, so the row shows one value, not a struck blank. */
function saidNothing(said: Said): boolean {
  return Array.isArray(said) ? said.length === 0 : said === "";
}

/** Whether two sides say the same, so a change that changes nothing shows once. */
function saidSame(was: Said, to: Said): boolean {
  if (Array.isArray(was) !== Array.isArray(to)) return false;
  return Array.isArray(was) && Array.isArray(to)
    ? was.length === to.length && was.every((word, i) => word === to[i])
    : was === to;
}

/**
 * What a line proposes for a round that stands: the field it touches, what
 * stands there now, and what it would read. A field that stands empty gives an
 * empty `was`, so the row shows one value rather than a struck blank.
 */
export function changeWords(
  line: { kind: string; value: string },
  round: Stands | null,
): { field: string; was: Said; to: Said } {
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
    const to = strings(readJson(line.value));
    return {
      field,
      was: round?.choices ?? [],
      to: to.length === 0 ? "nothing" : to,
    };
  }
  if (line.kind === "pile") {
    const drafted = record(readJson(line.value));
    const name = typeof drafted.name === "string" ? drafted.name : "";
    const sentence =
      typeof drafted.sentence === "string" ? drafted.sentence : "";
    const stands = round?.piles.find((pile) => pile.name === name) ?? null;
    return {
      field: stands === null ? field : DESCRIBE,
      was: stands === null ? "" : pileWords(name, stands.description),
      to: pileWords(name, sentence),
    };
  }
  if (line.kind === "unpile") {
    return { field, was: line.value, to: "" };
  }
  if (line.kind === "notes") {
    return { field, was: round?.notes ?? "", to: line.value };
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

/** One side of a change: a phrase, or a list of like things as chips. */
function Side({ said, struck = false }: { said: Said; struck?: boolean }) {
  if (Array.isArray(said))
    return <Chips values={said} className="min-w-0 text-sm" struck={struck} />;
  if (struck) return <s className="min-w-0 text-muted-foreground">{said}</s>;
  return <span className="min-w-0">{said}</span>;
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
  was: Said;
  to: Said;
  words: string;
  busy: boolean;
  refusal: string | null;
  reversed?: boolean;
  onAccept: () => void;
  onRefuse: () => void;
}) {
  // Nothing stood here, or what stood here still stands: either way the row
  // says one value, with no arrow and nothing struck.
  const stands = saidNothing(was) || saidSame(was, to);
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
        {stands ? null : <Side said={was} struck />}
        {saidNothing(to) ? null : (
          <>
            {stands ? null : (
              <span className="flex-none text-muted-foreground">→</span>
            )}
            <Side said={to} />
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
  const boxes = partWords(round.parts, round.cap);
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
        <Chips values={round.choices} className="flex min-w-0" />
        {round.piles.length === 0 ? null : (
          <ul className="flex min-w-0 flex-col gap-1 text-muted-foreground text-sm">
            {round.piles.map((pile) => (
              <li key={pile.name} className="min-w-0">
                {pileWords(pile.name, pile.sentence)}
              </li>
            ))}
          </ul>
        )}
        {round.notes === "" ? null : (
          <p className="min-w-0 whitespace-pre-wrap text-muted-foreground text-sm">
            {round.notes}
          </p>
        )}
        {refusal === null ? null : (
          <p className="text-destructive text-sm">{refusal}</p>
        )}
      </div>
    </div>
  );
}
