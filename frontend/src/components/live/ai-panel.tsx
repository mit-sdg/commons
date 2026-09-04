"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { refusalSentence, saidRefusal } from "@/components/live/refusals";
import { ActButton } from "@/components/live/round-editor";
import {
  changeWords,
  FIRST_PROPOSED,
  PROPOSED,
  ProposalRow,
  type Proposed,
  ProposedRound,
  RoundChanges,
} from "@/components/live/round-proposal";
import { Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, isApiError, type Output, publicErrorMessage } from "@/lib/api";
import { toDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Offered = Output<"/live/edits/offerings">;
type Offering = Offered["offerings"][number];
type OfferedLine = Offering["lines"][number];
type Round = NonNullable<Output<"/live/relays/get">["relay"]>["rounds"][number];

const POLL_MS = 2_000;
const WAIT_MS = 60_000;
/** How long the note about what was applied stands before the box comes back. */
const NOTE_MS = 5_000;

/** What the line says when the reasoner never got the brief. */
const UNREACHED = "The model could not be reached.";

const EXAMPLE = "Add a last round where the room picks a winner.";

/** The light a reply that has just landed leaves on the first proposal it made. */
const LANDED = "proposal-landed";

/**
 * Whether the reasoner's last failure is this brief's. The read carries the
 * failure it recorded last; one recorded after the brief went out is the
 * answer to it, and the line says so rather than waiting out the minute.
 */
function failedSince(read: Offered, askedAt: number | null): boolean {
  if (askedAt === null || read.failure === null) return false;
  const at = toDate(read.failedAt)?.getTime() ?? null;
  return at !== null && at >= askedAt;
}

function readJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** A line as the rounds show it: the round it is about, under its number. */
interface Shown {
  line: OfferedLine;
  round: Round | null;
  number: number;
}

/**
 * What a refused line says. The boundary answers a category, and the panel
 * reads the word behind it from the round the line names: a line about a round
 * whose run is open is held back, whatever the line changes.
 */
function refusalWords(error: string, shown: Shown): string {
  if (error === "NOT_FOUND") return saidRefusal(error, "ROUND_GONE");
  if (error !== "CONFLICT") return saidRefusal(error, null);
  return shown.round === null
    ? "Refused. Nothing changed."
    : refusalSentence("RUN_OPEN", { round: shown.number });
}

/**
 * The number each line's round carries, so a line stands where every other
 * screen would name it: the round the relay holds for a line about one, and
 * the number an added round lands at for one that is not there yet.
 */
function numbered(lines: OfferedLine[], rounds: Round[]): Shown[] {
  let adds = 0;
  return lines.map((line) => {
    const round = rounds.find((entry) => entry.leg === line.target) ?? null;
    if (round !== null) return { line, round, number: round.number };
    adds += 1;
    const lands = (readJson(line.value) as { position?: unknown } | null)
      ?.position;
    return {
      line,
      round,
      number:
        typeof lands === "number" && lands > 0 ? lands : rounds.length + adds,
    };
  });
}

/** How long the wait has run, counted from the moment the brief went out. */
function Waited({ since }: { since: number }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const count = () => setSeconds(Math.floor((Date.now() - since) / 1000));
    count();
    const timer = setInterval(count, 1000);
    return () => clearInterval(timer);
  }, [since]);

  return (
    <span
      aria-hidden="true"
      className="font-mono text-muted-foreground text-xs tabular-nums"
    >
      {seconds} s
    </span>
  );
}

/** What a landed reply says when it left nothing to confirm. */
function landedNote(offering: Offering | null): string | null {
  if (offering === null) return null;
  const lines = offering.lines.filter((line) => line.kind !== "keep");
  if (lines.some((line) => line.standing === "pending")) return null;
  const taken = lines.filter((line) => line.standing === "taken").length;
  return taken === 0
    ? null
    : `${taken} ${taken === 1 ? "change" : "changes"} applied.`;
}

/** What the page draws of the model's proposals, and where each belongs. */
export interface Drafting {
  /** The handle that opens the brief, and under it the box or the naming rows. */
  line: React.ReactNode;
  /** How much stands and the pair that settles all of it, for the foot of the list. */
  bar: React.ReactNode;
  /** What is proposed for the round at this leg, drawn across its card's top. */
  proposal: (leg: string) => React.ReactNode;
  /** Whether a proposal would take the round at this leg away. */
  going: (leg: string) => boolean;
  /**
   * The rounds proposed to land at this number, drawn before the round standing
   * there; the number past the last round takes every round landing past it.
   */
  adds: (number: number) => React.ReactNode;
  /** How many proposals still stand, on which the line opens itself. */
  standing: number;
}

/**
 * The one place a staff member meets what the model proposed. A brief goes out,
 * the reply comes back as lines, and each stands on the round it is about,
 * confirmed or dismissed there. A line settled leaves the list at once, because
 * the list is the relay.
 */
export function useDrafting({
  relay,
  rounds,
  title,
  open,
  onOpen,
  pending = false,
  since = null,
  onChanged,
}: {
  relay: string;
  rounds: Round[];
  /** The relay's own name, which the model may propose another for. */
  title: string;
  /** Whether the line stands open under its handle. */
  open: boolean;
  onOpen: (open: boolean) => void;
  /** A brief was already sent from the page before this one, so a reply is on its way. */
  pending?: boolean;
  /** When that brief went out, so the count reads the whole wait. */
  since?: number | null;
  onChanged: () => void;
}): Drafting {
  const [request, setRequest] = useState("");
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [nothing, setNothing] = useState(false);
  const [unreached, setUnreached] = useState(false);
  const [busy, setBusy] = useState(false);
  const [took, setTook] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [stopped, setStopped] = useState<{
    line: string;
    error: string;
  } | null>(null);
  const known = useRef<Set<string>>(new Set());
  /** The reply just landed, which the first proposal it made is shown for. */
  const [landed, setLanded] = useState<string | null>(null);
  /** How many lines this settling has changed the relay by, for the note. */
  const applied = useRef(0);
  /** When the reply now waited on was asked for; a failure before it is not its. */
  const [askedAt, setAskedAt] = useState<number | null>(null);

  /** The relay as the panel compares it: every round, whole, in order. */
  const readRelay = useCallback(async (): Promise<string | null> => {
    const result = await api["/live/relays/get"]({ relay });
    if (isApiError(result) || result.relay === null) return null;
    return JSON.stringify(result.relay.rounds);
  }, [relay]);

  const read = useCallback(async (): Promise<Offered | null> => {
    const result = await api["/live/edits/offerings"]({ relay });
    if (isApiError(result)) return null;
    setOfferings(result.offerings);
    return result;
  }, [relay]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the line opens on what has already been offered, which only a read can say
    void read().then((offered) => {
      if (cancelled || offered === null) return;
      known.current = new Set(offered.offerings.map((entry) => entry.offering));
      if (pending && offered.offerings.length === 0) {
        setAskedAt(since ?? Date.now());
        setWaiting(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [read, pending, since]);

  useEffect(() => {
    if (note === null) return;
    const timer = setTimeout(() => setNote(null), NOTE_MS);
    return () => clearTimeout(timer);
  }, [note]);

  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const offered = await read();
      if (cancelled) return;
      if (
        offered !== null &&
        offered.offerings.some((entry) => !known.current.has(entry.offering))
      ) {
        known.current = new Set(
          offered.offerings.map((entry) => entry.offering),
        );
        setWaiting(false);
        if (askedAt !== null) setTook((Date.now() - askedAt) / 1000);
        setLanded(offered.offerings[0]?.offering ?? null);
        setNote(landedNote(offered.offerings[0] ?? null));
        onChanged();
        return;
      }
      if (offered !== null && failedSince(offered, askedAt)) {
        setWaiting(false);
        setUnreached(true);
        return;
      }
      if (Date.now() - started >= WAIT_MS) {
        setWaiting(false);
        setNothing(true);
        return;
      }
      timer = setTimeout(() => void tick(), POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [waiting, read, askedAt, onChanged]);

  // Every proposal is drawn by the page, around its own round, so where the
  // first one stands is read back from the page rather than held here.
  useEffect(() => {
    if (landed === null) return;
    const first = document.querySelector<HTMLElement>(FIRST_PROPOSED);
    if (first === null) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    first.scrollIntoView({
      block: "center",
      behavior: still ? "auto" : "smooth",
    });
    first.classList.add(LANDED);
    const done = () => first.classList.remove(LANDED);
    first.addEventListener("animationend", done, { once: true });
    return () => {
      first.removeEventListener("animationend", done);
      done();
    };
  }, [landed]);

  async function send() {
    const brief = request.trim();
    if (brief === "") return;
    setNothing(false);
    setUnreached(false);
    setStopped(null);
    setNote(null);
    setTook(null);
    setBusy(true);
    applied.current = 0;
    const offered = await read();
    known.current = new Set(
      (offered?.offerings ?? []).map((entry) => entry.offering),
    );
    const sent = Date.now();
    const result = await api["/live/edits/draft"]({ relay, request: brief });
    setBusy(false);
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    setRequest("");
    setAskedAt(sent);
    setWaiting(true);
  }

  /** One line, settled on its own request, so a refusal stops where it fell. */
  async function apply(line: OfferedLine, take: boolean): Promise<boolean> {
    const result = take
      ? await api["/live/edits/take"]({ suggestion: line.suggestion })
      : await api["/live/edits/decline"]({ suggestion: line.suggestion });
    if (isApiError(result)) {
      setStopped({ line: line.suggestion, error: result.error });
      return false;
    }
    return true;
  }

  /**
   * What the line says once nothing is left to settle, and nothing while a line
   * still stands. A concept can refuse what a line asks while the take itself
   * succeeds, and the relay reading back word for word is what says so.
   */
  function settledNote(offered: Offered | null): string | null {
    const outstanding = (offered?.offerings[0]?.lines ?? []).filter(
      (line) => line.standing === "pending" && line.kind !== "keep",
    ).length;
    if (outstanding > 0) return null;
    const count = applied.current;
    return count === 0
      ? "Nothing changed."
      : `${count} ${count === 1 ? "change" : "changes"} applied.`;
  }

  async function settle(line: OfferedLine, take: boolean) {
    setBusy(true);
    setStopped(null);
    setNote(null);
    const before = take ? await readRelay() : null;
    if ((await apply(line, take)) && take) {
      const after = await readRelay();
      if (after !== null && before !== null && after !== before)
        applied.current += 1;
    }
    setBusy(false);
    setNote(settledNote(await read()));
    onChanged();
  }

  /** The lines still standing, in order, until one is refused. */
  async function settleAll(offering: Offering, take: boolean) {
    setBusy(true);
    setStopped(null);
    setNote(null);
    let before = take ? await readRelay() : null;
    for (const line of offering.lines) {
      if (line.standing !== "pending" || line.kind === "keep") continue;
      if (!(await apply(line, take))) break;
      if (!take) continue;
      const after = await readRelay();
      if (after === null) continue;
      if (before !== null && after !== before) applied.current += 1;
      before = after;
    }
    setBusy(false);
    setNote(settledNote(await read()));
    onChanged();
  }

  const offering = offerings[0] ?? null;
  const shown = numbered(
    (offering?.lines ?? []).filter(
      (line) => line.standing === "pending" && line.kind !== "keep",
    ),
    rounds,
  );
  const kept =
    offering !== null && offering.lines.every((line) => line.kind === "keep");
  const proposedOf = (entry: Shown): Proposed => ({
    line: entry.line,
    refusal:
      entry.line.suggestion === stopped?.line
        ? refusalWords(stopped.error, entry)
        : null,
  });
  const naming = shown.filter(
    (entry) => entry.round === null && entry.line.kind !== "add",
  );

  const body =
    shown.length > 0 ? (
      naming.length === 0 ? null : (
        <div
          {...PROPOSED}
          className="flex flex-col gap-2 rounded-lg"
          id="brief-line"
        >
          {naming.map((entry) => (
            <ProposalRow
              key={entry.line.suggestion}
              field={changeWords(entry.line, null).field}
              was={title}
              to={changeWords(entry.line, null).to}
              words="the relay's title"
              busy={busy}
              refusal={proposedOf(entry).refusal}
              onAccept={() => void settle(entry.line, true)}
              onRefuse={() => void settle(entry.line, false)}
            />
          ))}
        </div>
      )
    ) : note !== null ? (
      <p className="text-muted-foreground text-sm" id="brief-line">
        {note}
      </p>
    ) : (
      <div className="flex flex-col gap-2.5" id="brief-line">
        <Textarea
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          placeholder={EXAMPLE}
          rows={2}
          aria-label="Brief"
          className="min-h-12 bg-card"
        />
        <div className="flex flex-wrap items-center gap-2">
          <ActButton
            size="sm"
            out={request.trim() === ""}
            busy={busy || waiting}
            onClick={() => void send()}
          >
            {waiting ? <Spinner className="size-4" /> : null} Send
          </ActButton>
          {waiting && askedAt !== null ? <Waited since={askedAt} /> : null}
          {!waiting && took !== null ? (
            <span className="font-mono text-muted-foreground text-xs tabular-nums">
              {took.toFixed(1)} s
            </span>
          ) : null}
          {unreached ? (
            <span className="text-muted-foreground text-sm">{UNREACHED}</span>
          ) : null}
          {nothing ? (
            <span className="text-muted-foreground text-sm">
              Nothing came back.
            </span>
          ) : null}
          {kept ? (
            <span className="text-muted-foreground text-sm">
              Nothing to change.
            </span>
          ) : null}
        </div>
      </div>
    );

  return {
    // Closed, the handle stands alone at the head of the list, no wider than
    // its word; open, the box grows around it.
    line: (
      <div
        className={cn(
          "mb-3 flex flex-col gap-3",
          open && "rounded-xl border border-primary/30 bg-primary/5 px-4 py-3",
        )}
      >
        <Button
          variant={open ? "outline" : "ghost"}
          size="sm"
          aria-expanded={open}
          aria-controls="brief-line"
          className={cn(
            "w-fit",
            open ? "border-primary text-primary" : "text-muted-foreground",
          )}
          onClick={() => onOpen(!open)}
        >
          <Sparkles /> Ask AI
        </Button>
        {open ? body : null}
      </div>
    ),
    bar:
      shown.length === 0 ? null : (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-background/95 px-4 py-3 backdrop-blur">
          <span className="mr-1 font-medium text-sm">
            {shown.length} {shown.length === 1 ? "proposal" : "proposals"}
          </span>
          <ActButton
            size="sm"
            busy={busy}
            onClick={() =>
              offering === null ? undefined : void settleAll(offering, true)
            }
          >
            Accept all
          </ActButton>
          <ActButton
            variant="outline"
            size="sm"
            busy={busy}
            onClick={() =>
              offering === null ? undefined : void settleAll(offering, false)
            }
          >
            Refuse all
          </ActButton>
        </div>
      ),
    proposal: (leg) => {
      const round = rounds.find((entry) => entry.leg === leg) ?? null;
      const about = shown.filter((entry) => entry.line.target === leg);
      if (round === null || about.length === 0) return null;
      return (
        <RoundChanges
          proposed={about.map(proposedOf)}
          round={round}
          busy={busy}
          onSettle={(line, take) => void settle(line, take)}
        />
      );
    },
    going: (leg) =>
      shown.some(
        (entry) => entry.line.kind === "remove" && entry.line.target === leg,
      ),
    adds: (number) => {
      const past = number > rounds.length;
      const landing = shown.filter(
        (entry) =>
          entry.line.kind === "add" &&
          (past ? entry.number >= number : entry.number === number),
      );
      if (landing.length === 0) return null;
      return landing.map((entry) => (
        <ProposedRound
          key={entry.line.suggestion}
          proposed={proposedOf(entry)}
          number={entry.number}
          busy={busy}
          onSettle={(line, take) => void settle(line, take)}
        />
      ));
    },
    standing: shown.length,
  };
}
