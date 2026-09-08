"use client";

import {
  ArrowDown,
  ArrowUp,
  CircleHelp,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { type ComponentProps, useState } from "react";
import { toast } from "sonner";
import { RoundGuideEditor } from "@/components/live/host-guide";
import {
  type RefusalAbout,
  type RefusalWord,
  saidRefusal,
} from "@/components/live/refusals";
import { RoundToken } from "@/components/live/round-token";
import {
  firstUse,
  KINDS,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

function CarryHelp({
  text,
  label = "How this round uses selected piles",
}: {
  text: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          onMouseEnter={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onClick={(event) => {
            event.preventDefault();
            setOpen(true);
          }}
        >
          <CircleHelp className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="text-sm"
      >
        {text}
      </PopoverContent>
    </Popover>
  );
}

export type RelayRound = NonNullable<
  Output<"/live/relays/get">["relay"]
>["rounds"][number];

type RelayPile = RelayRound["piles"][number];

/**
 * A title that still reads as the heading it is, with a rule under it saying
 * it can be typed into — and no filled slab of its own in the dark.
 */
export const TITLE_FIELD =
  "h-auto rounded-none border-transparent border-b-border bg-transparent px-0 font-display font-semibold shadow-none focus-visible:border-b-primary dark:bg-transparent";

/**
 * A round the run has reached is read, not written. Its fields stand plain and
 * legible where a field out at half opacity reads as a page still loading.
 */
const LOCKED_FIELD =
  "disabled:cursor-default disabled:opacity-100 disabled:text-foreground";

/** A boxed field, locked: the box says it is out and the words stay readable. */
const LOCKED_BOX = `${LOCKED_FIELD} disabled:border-transparent disabled:bg-muted/40`;

/** The kind a run has fixed, read as the prompt beside it is: a muted box. */
const LOCKED_PILL = "bg-muted/40 font-medium text-foreground";

/**
 * An acting control. Out is out of the tab order, as a disabled button is; busy
 * is said by aria alone, so a request in flight leaves the focus where the hand
 * left it rather than handing it back to the top of the page.
 */
export function ActButton({
  out = false,
  busy = false,
  onClick,
  ...rest
}: Omit<ComponentProps<typeof Button>, "disabled"> & {
  out?: boolean;
  busy?: boolean;
}) {
  return (
    <Button
      {...rest}
      disabled={out}
      aria-disabled={busy || undefined}
      onClick={busy ? undefined : onClick}
    />
  );
}

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
const PILE_NAME_MAX = 60;
const PILE_SENTENCE_MAX = 200;
const NOTES_MAX = 2000;

/** What a pile's boxes hold while they are being typed. */
interface PileBoxes {
  name: string;
  description: string;
}

/** The piles as they stand, in one string, to tell one read from the next. */
function pilesKey(piles: RelayPile[]): string {
  return piles
    .map((pile) => [pile.pile, pile.name, pile.description].join("\n"))
    .join("\n\n");
}

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

/**
 * A question offers choices or takes parts, not both, so a draft that has both
 * written keeps the pressed kind's side and lets the other go.
 */
function kept(draft: Draft, kind: RoundKind): Draft {
  if (draft.parts.length === 0 || draft.choices.length === 0) return draft;
  return kind === "vote"
    ? { ...draft, parts: [], cap: 0 }
    : { ...draft, choices: [] };
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

function report(
  result: unknown,
  said: Said | null,
  /** What a request about a pile has lost, where the round is what else can go. */
  gone: RefusalWord = "ROUND_GONE",
): boolean {
  if (!isApiError(result)) return true;
  const read =
    result.error === "CONFLICT"
      ? said
      : result.error === "NOT_FOUND"
        ? { word: gone, about: {} }
        : null;
  toast.error(saidRefusal(result.error, read?.word ?? null, read?.about));
  return false;
}

export function RoundEditor({
  round,
  rounds,
  locked,
  retired = false,
  note = null,
  proposal = null,
  onChanged,
}: {
  round: RelayRound;
  rounds: RelayRound[];
  /** The round may be read but never rewritten. */
  locked: boolean;
  /** The relay is retired, so even what the run leaves open is read. */
  retired?: boolean;
  /** The one sentence saying why it is locked, said once at the card's top. */
  note?: string | null;
  /** What the AI proposes for this round, drawn across the card's top. */
  proposal?: React.ReactNode;
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
  // A pile's boxes as they are being typed, under the pile they are about, and
  // the pile being named before it stands.
  const [boxes, setBoxes] = useState<Record<string, PileBoxes>>({});
  const [seenPiles, setSeenPiles] = useState(pilesKey(round.piles));
  const [naming, setNaming] = useState<PileBoxes | null>(null);
  const [notes, setNotes] = useState(round.notes);
  const [editingSorting, setEditingSorting] = useState(false);
  const [sortingOpen, setSortingOpen] = useState(false);
  const [seenNotes, setSeenNotes] = useState(round.notes);
  const [busy, setBusy] = useState(false);
  // The kind pressed, held for the instant before the round comes back with
  // the word on it.
  const [chosenKind, setChosenKind] = useState<RoundKind | null>(null);
  const [seenKind, setSeenKind] = useState(round.kind);
  const uses = useCarryUses();

  // The round can change under the card — a drafting line taken, another tab —
  // and a draft written against the round as it was is dropped for the one
  // that now stands, so the card never writes a stale round back out.
  if (!same(cleaned(saved), cleaned(seen))) {
    setSeen(saved);
    setDraft(saved);
  }
  if (pilesKey(round.piles) !== seenPiles) {
    setSeenPiles(pilesKey(round.piles));
    setBoxes({});
  }
  if (round.notes !== seenNotes) {
    setSeenNotes(round.notes);
    setNotes(round.notes);
  }
  if (round.kind !== seenKind) {
    setSeenKind(round.kind);
    setChosenKind(null);
  }

  const takes = round.takes[0] ?? null;
  const earlier = rounds.filter((entry) => entry.number < round.number);
  const first = round.number === 1;
  const last = round.number === rounds.length;
  const written = cleaned(draft);
  const kind: RoundKind =
    chosenKind ??
    kindOf({
      kind: round.kind,
      choices: written.choices,
      parts: written.parts,
      takes: round.takes,
    });
  const open = usesFor(uses, kind);

  async function commit(next: Draft) {
    const wanted = kept(cleaned(next), kind);
    if (wanted.title === "" || wanted.prompt === "") return;
    if (same(wanted, cleaned(saved))) return;
    if (!same(wanted, cleaned(next))) setDraft(wanted);
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

  async function setTakes(source: string, use: string) {
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
      use,
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
   * A kind is the leg's own word and a selector: the question keeps its parts,
   * its cap, and its choices, and the word decides which of them the round
   * uses. A take that the new kind is not open to moves to the use the kind
   * starts with.
   */
  async function chooseKind(next: RoundKind) {
    if (next === kind) return;
    setBusy(true);
    const named = await api["/live/relays/set-kind"]({
      leg: round.leg,
      kind: next,
    });
    setBusy(false);
    if (!report(named, null)) return;
    setChosenKind(next);
    onChanged();
    if (takes === null) return;
    if (usesFor(uses, next).some((entry) => entry.use === takes.use)) return;
    await setTakes(takes.source, firstUse(uses, next));
  }

  const inTheRun = roundRefusal({ kind: "revise" }, round, rounds, locked);
  const boxesOf = (pile: RelayPile): PileBoxes => boxes[pile.pile] ?? pile;

  /** A pile is refused for the name it asks for, or because the run has the round. */
  function pileRefusal(name: string, pile?: string): Said {
    return round.piles.some(
      (entry) => entry.pile !== pile && entry.name === name,
    )
      ? { word: "NAME_TAKEN", about: { name } }
      : inTheRun;
  }

  async function addPile() {
    if (naming === null) return;
    const name = naming.name.trim();
    if (name === "") return;
    setBusy(true);
    const result = await api["/live/rounds/add-pile"]({
      leg: round.leg,
      name,
      description: naming.description.trim(),
    });
    setBusy(false);
    if (!report(result, pileRefusal(name))) return;
    setNaming(null);
    onChanged();
  }

  /** A name cleared and left behind is not a name: the standing one comes back. */
  async function renamePile(pile: RelayPile) {
    const name = boxesOf(pile).name.trim();
    if (name === "") {
      setBoxes({
        ...boxes,
        [pile.pile]: { ...boxesOf(pile), name: pile.name },
      });
      return;
    }
    if (name === pile.name) return;
    setBusy(true);
    const result = await api["/live/rounds/rename-pile"]({
      pile: pile.pile,
      name,
    });
    setBusy(false);
    if (report(result, pileRefusal(name, pile.pile), "PILE_GONE")) onChanged();
  }

  async function describePile(pile: RelayPile) {
    const description = boxesOf(pile).description.trim();
    if (description === pile.description) return;
    setBusy(true);
    const result = await api["/live/rounds/describe-pile"]({
      pile: pile.pile,
      description,
    });
    setBusy(false);
    if (report(result, inTheRun, "PILE_GONE")) onChanged();
  }

  async function removePile(pile: RelayPile) {
    setBusy(true);
    const result = await api["/live/rounds/remove-pile"]({ pile: pile.pile });
    setBusy(false);
    if (report(result, inTheRun, "PILE_GONE")) onChanged();
  }

  async function writeNotes() {
    const body = notes.trim();
    if (body === round.notes) return;
    setBusy(true);
    const result =
      body === ""
        ? await api["/live/rounds/clear-notes"]({ leg: round.leg })
        : await api["/live/rounds/set-notes"]({ leg: round.leg, body });
    setBusy(false);
    if (report(result, null)) onChanged();
  }

  const repeats = draft.parts.length === 1 && draft.cap > 0;
  // A round that takes its parts or choices from another round is written
  // there, so this card only offers the side the round still holds itself.
  const partsOpen = kind === "list" && takes?.use !== "parts";
  const choicesOpen = kind === "vote" && takes?.use !== "choices";

  return (
    <div className="grid grid-cols-1 items-start gap-4 rounded-xl border border-border bg-card px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:px-5 focus-within:outline focus-within:outline-2 focus-within:outline-primary focus-within:-outline-offset-2">
      {proposal === null ? null : (
        <div className="sm:col-span-2">{proposal}</div>
      )}
      <RoundToken
        number={round.number}
        size="lg"
        standing="plain"
        className="hidden sm:inline-flex"
      />

      <div className="flex min-w-0 flex-col gap-3">
        {note === null ? null : (
          <p className="text-muted-foreground text-sm">{note}</p>
        )}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:flex">
          <RoundToken
            number={round.number}
            size="md"
            standing="plain"
            className="sm:hidden"
          />
          <Input
            value={draft.title}
            maxLength={200}
            disabled={locked}
            readOnly={busy}
            aria-label={`Round ${round.number} title`}
            aria-invalid={draft.title.trim() === ""}
            className={cn(
              TITLE_FIELD,
              LOCKED_FIELD,
              "min-w-0 flex-1 text-xl disabled:border-b-transparent md:text-xl",
            )}
            onChange={(event) => change({ title: event.target.value })}
            onBlur={() => leaveTitle()}
          />
          {locked ? null : (
            <div className="col-start-2 flex flex-none justify-end gap-0.5">
              <ActButton
                variant="ghost"
                size="icon-sm"
                aria-label={`Move round ${round.number} up`}
                out={first}
                busy={busy}
                onClick={() => void move(round.number - 1)}
              >
                <ArrowUp />
              </ActButton>
              <ActButton
                variant="ghost"
                size="icon-sm"
                aria-label={`Move round ${round.number} down`}
                out={last}
                busy={busy}
                onClick={() => void move(round.number + 1)}
              >
                <ArrowDown />
              </ActButton>
              <ActButton
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove round ${round.number}`}
                busy={busy}
                onClick={() => void remove()}
              >
                <X />
              </ActButton>
            </div>
          )}
        </div>

        <div
          role="group"
          aria-label={`Round ${round.number} kind`}
          className={cn(
            "inline-flex w-fit gap-0.5 rounded-md border p-0.5",
            locked ? "border-transparent" : "border-border",
          )}
        >
          {KINDS.map((entry) => (
            <button
              key={entry}
              type="button"
              disabled={locked}
              aria-disabled={busy || undefined}
              aria-pressed={entry === kind}
              className={cn(
                "rounded-[5px] px-2.5 py-1 text-sm capitalize disabled:pointer-events-none disabled:cursor-default",
                entry === kind
                  ? locked
                    ? LOCKED_PILL
                    : "bg-foreground font-medium text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                if (busy) return;
                void chooseKind(entry);
              }}
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
            disabled={locked}
            readOnly={busy}
            rows={2}
            className={cn("min-h-11", LOCKED_BOX)}
            onChange={(event) => change({ prompt: event.target.value })}
            onBlur={() => void commit(draft)}
          />
        </div>

        {partsOpen || choicesOpen ? (
          <div className="flex flex-wrap items-start gap-6">
            {partsOpen ? (
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label>Parts</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {draft.parts.map((part, index) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: a part is its row, and a row carries no id
                      key={index}
                      className="group/part relative inline-flex min-w-0 flex-[1_1_16rem] items-center"
                    >
                      <Textarea
                        rows={1}
                        value={part}
                        maxLength={40}
                        disabled={locked}
                        readOnly={busy}
                        aria-label={`Round ${round.number} part ${index + 1}`}
                        placeholder={PART_WORDS[index] ?? ""}
                        className={cn(
                          "min-h-9 w-full min-w-0 resize-none py-1.5 pr-9",
                          LOCKED_BOX,
                        )}
                        onChange={(event) => {
                          const parts = [...draft.parts];
                          parts[index] = event.target.value.replace(
                            /[\r\n]+/g,
                            " ",
                          );
                          change({ parts });
                        }}
                        onBlur={() => void commit(draft)}
                      />
                      {locked ? null : (
                        <ActButton
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Remove round ${round.number} part ${index + 1}`}
                          busy={busy}
                          className="-translate-y-1/2 absolute top-1/2 right-1 opacity-100 sm:opacity-0 group-focus-within/part:opacity-100 group-hover/part:opacity-100 [@media(hover:none)]:opacity-100"
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
                        </ActButton>
                      )}
                    </span>
                  ))}
                  {!locked && draft.parts.length < PARTS_MAX && !repeats ? (
                    <ActButton
                      variant="ghost"
                      size="sm"
                      busy={busy}
                      onClick={() => change({ parts: [...draft.parts, ""] })}
                    >
                      + Part
                    </ActButton>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {draft.parts.length === 1 ? (
                    <>
                      <Button
                        size="sm"
                        variant={repeats ? "secondary" : "ghost"}
                        disabled={locked || busy}
                        aria-pressed={repeats}
                        onClick={() => change({ cap: CAP_START }, true)}
                      >
                        Repeat one part
                      </Button>
                      <Button
                        size="sm"
                        variant={!repeats ? "secondary" : "ghost"}
                        disabled={locked || busy}
                        aria-pressed={!repeats}
                        onClick={() => change({ cap: 0 }, true)}
                      >
                        Define separate parts
                      </Button>
                    </>
                  ) : null}
                  {repeats ? (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      Up to
                      <Input
                        type="number"
                        min={CAP_MIN}
                        max={CAP_MAX}
                        value={draft.cap}
                        disabled={locked}
                        readOnly={busy}
                        aria-label={`Round ${round.number} repeat up to`}
                        className={cn("h-8 w-16", LOCKED_BOX)}
                        onChange={(event) =>
                          change({ cap: Number(event.target.value) })
                        }
                        onBlur={() => void commit(draft)}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            ) : null}

            {choicesOpen ? (
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
                        disabled={locked}
                        readOnly={busy}
                        aria-label={`Round ${round.number} choice ${index + 1}`}
                        className={cn("w-56", LOCKED_BOX)}
                        onChange={(event) => {
                          const choices = [...draft.choices];
                          choices[index] = event.target.value;
                          change({ choices });
                        }}
                        onBlur={() => void commit(draft)}
                      />
                      {locked ? null : (
                        <ActButton
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Remove round ${round.number} choice ${index + 1}`}
                          busy={busy}
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
                        </ActButton>
                      )}
                    </span>
                  ))}
                  {locked ? null : (
                    <ActButton
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      busy={busy}
                      onClick={() =>
                        change({ choices: [...draft.choices, ""] })
                      }
                    >
                      + Choice
                    </ActButton>
                  )}
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
              disabled={locked}
              onValueChange={(value) => {
                if (busy) return;
                if (value === NOTHING) {
                  void clearTakes();
                  return;
                }
                void setTakes(value, takes?.use ?? firstUse(uses, kind));
              }}
            >
              <SelectTrigger
                size="sm"
                aria-label={`Round ${round.number} takes from`}
                aria-disabled={busy || undefined}
                className={cn("max-w-[220px]", LOCKED_BOX)}
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
                  open.some((entry) => entry.use === takes.use) ? (
                    <Select
                      value={takes.use}
                      disabled={locked}
                      onValueChange={(value) => {
                        if (busy) return;
                        void setTakes(takes.source, value);
                      }}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label={`Round ${round.number} use`}
                        aria-disabled={busy || undefined}
                        className={LOCKED_BOX}
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
                    <span>{takes.use}</span>
                  )}
                </span>
                <CarryHelp text={sentenceOf(uses, takes.use)} />
              </>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-1 border-t border-border pt-2">
          <RoundGuideEditor
            round={round}
            retired={retired}
            onChanged={onChanged}
          />
          {kind === "vote" ? null : (
            <>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  aria-expanded={sortingOpen}
                  aria-controls={`sorting-${round.leg}`}
                  onClick={() => setSortingOpen(!sortingOpen)}
                  className="flex w-fit max-w-full cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
                >
                  <Layers className="size-4" /> Response sorting
                  <span className="text-xs">
                    {round.piles.length}{" "}
                    {round.piles.length === 1 ? "pile" : "piles"}
                  </span>
                  <span
                    className={cn(
                      "transition-transform",
                      sortingOpen && "rotate-90",
                    )}
                    aria-hidden
                  >
                    ›
                  </span>
                </button>
                <CarryHelp
                  label="How response sorting works"
                  text="Piles group related responses. Reserved piles remain available even when empty, with or without AI sorting. Their definitions explain what belongs in each pile; participants see the pile name and supporting responses."
                />
                {sortingOpen && !retired ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    disabled={busy}
                    onClick={() => setEditingSorting(!editingSorting)}
                  >
                    {editingSorting ? "Done" : "Edit"}
                  </Button>
                ) : null}
              </div>
              <div
                hidden={!sortingOpen}
                id={`sorting-${round.leg}`}
                className="col-span-2 min-w-0 mt-2"
              >
                <div className="mt-3 flex flex-col gap-3">
                  {locked && round.piles.length === 0 ? null : (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-col gap-2">
                        {round.piles.map((pile, index) => (
                          <span
                            key={pile.pile}
                            className="relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-1.5 py-1"
                          >
                            <Layers
                              className="absolute -left-6 top-3 size-4 text-muted-foreground"
                              aria-hidden
                            />
                            {!editingSorting ? (
                              <span
                                className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium [overflow-wrap:anywhere]"
                                dir="auto"
                              >
                                {pile.name}
                              </span>
                            ) : (
                              <Input
                                value={boxesOf(pile).name}
                                maxLength={PILE_NAME_MAX}
                                disabled={locked}
                                readOnly={busy || !editingSorting}
                                aria-label={`Round ${round.number} pile ${index + 1} name`}
                                className={cn(
                                  "w-full font-medium",
                                  LOCKED_BOX,
                                  !editingSorting &&
                                    "border-transparent bg-transparent shadow-none dark:bg-transparent",
                                )}
                                onChange={(event) =>
                                  setBoxes({
                                    ...boxes,
                                    [pile.pile]: {
                                      ...boxesOf(pile),
                                      name: event.target.value,
                                    },
                                  })
                                }
                                onBlur={() => void renamePile(pile)}
                              />
                            )}
                            <label className="col-span-2 text-xs text-muted-foreground">
                              <span className="mr-1 font-medium">
                                What belongs:
                              </span>

                              {!editingSorting ? (
                                <p
                                  className="inline text-sm leading-relaxed [overflow-wrap:anywhere]"
                                  dir="auto"
                                >
                                  {pile.description || "No definition added."}
                                </p>
                              ) : (
                                <Textarea
                                  rows={2}
                                  value={boxesOf(pile).description}
                                  maxLength={PILE_SENTENCE_MAX}
                                  disabled={locked}
                                  readOnly={busy || !editingSorting}
                                  aria-label={`Round ${round.number} pile ${index + 1} sentence`}
                                  placeholder="What goes in it"
                                  className={cn(
                                    "min-w-0 text-sm",
                                    !editingSorting &&
                                      "border-transparent bg-transparent shadow-none dark:bg-transparent",
                                    LOCKED_BOX,
                                  )}
                                  onChange={(event) =>
                                    setBoxes({
                                      ...boxes,
                                      [pile.pile]: {
                                        ...boxesOf(pile),
                                        description: event.target.value,
                                      },
                                    })
                                  }
                                  onBlur={() => void describePile(pile)}
                                />
                              )}
                            </label>
                            {locked || !editingSorting ? null : (
                              <ActButton
                                variant="ghost"
                                size="icon-sm"
                                className="col-start-2 row-start-1"
                                aria-label={`Remove pile ${pile.name}`}
                                busy={busy}
                                onClick={() => void removePile(pile)}
                              >
                                <X />
                              </ActButton>
                            )}
                          </span>
                        ))}
                        {locked || !editingSorting ? null : naming === null ? (
                          <ActButton
                            variant="ghost"
                            size="sm"
                            className="self-start"
                            busy={busy}
                            onClick={() =>
                              setNaming({ name: "", description: "" })
                            }
                          >
                            + Pile
                          </ActButton>
                        ) : (
                          <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <Input
                              // biome-ignore lint/a11y/noAutofocus: the pile is named the moment the row appears.
                              autoFocus
                              value={naming.name}
                              maxLength={PILE_NAME_MAX}
                              readOnly={busy || !editingSorting}
                              aria-label={`Round ${round.number} new pile name`}
                              placeholder="Name"
                              className="w-40"
                              onChange={(event) =>
                                setNaming({
                                  ...naming,
                                  name: event.target.value,
                                })
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") void addPile();
                              }}
                            />
                            <Input
                              value={naming.description}
                              maxLength={PILE_SENTENCE_MAX}
                              readOnly={busy || !editingSorting}
                              aria-label={`Round ${round.number} new pile sentence`}
                              placeholder="What goes in it"
                              className="min-w-0 flex-1"
                              onChange={(event) =>
                                setNaming({
                                  ...naming,
                                  description: event.target.value,
                                })
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") void addPile();
                              }}
                            />
                            <ActButton
                              size="sm"
                              out={naming.name.trim() === ""}
                              busy={busy}
                              onClick={() => void addPile()}
                            >
                              Add
                            </ActButton>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Close"
                              onClick={() => setNaming(null)}
                            >
                              <X />
                            </Button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {retired && notes === "" ? null : (
                    <div className="flex flex-col gap-1.5 rounded-lg bg-brand-pine/5 px-3 py-2.5">
                      <Label
                        className="text-xs text-brand-pine"
                        htmlFor={`notes-${round.leg}`}
                      >
                        <Sparkles className="size-3.5" /> AI sorting
                        instructions
                      </Label>
                      {!editingSorting ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                          {round.notes || "No additional instructions."}
                        </p>
                      ) : (
                        <Textarea
                          id={`notes-${round.leg}`}
                          value={notes}
                          maxLength={NOTES_MAX}
                          disabled={retired}
                          readOnly={busy || !editingSorting}
                          rows={2}
                          placeholder="Describe how to group responses."
                          className={cn(
                            "min-h-11",
                            LOCKED_BOX,
                            !editingSorting &&
                              "border-transparent bg-transparent shadow-none dark:bg-transparent",
                          )}
                          onChange={(event) => setNotes(event.target.value)}
                          onBlur={() => void writeNotes()}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The end of the list: a round is written here before it exists on the server. */
export function AddRoundCard({
  busy,
  onAdd,
}: {
  /** A request is in flight on the relay, so the card says so and waits. */
  busy: boolean;
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
        aria-disabled={busy || undefined}
        onClick={() => {
          if (busy) return;
          setWriting(true);
        }}
        className="flex items-center gap-3 rounded-xl border border-dashed border-border px-5 py-4 text-muted-foreground hover:border-primary/40 hover:text-foreground"
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
          <ActButton
            size="sm"
            out={!ready}
            busy={busy}
            onClick={async () => {
              const added = await onAdd(title.trim(), prompt.trim());
              if (!added) return;
              setTitle("");
              setPrompt("");
              setWriting(false);
            }}
          >
            Add
          </ActButton>
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
