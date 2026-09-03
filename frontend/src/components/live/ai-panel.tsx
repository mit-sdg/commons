"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { refusalSentence, saidRefusal } from "@/components/live/refusals";
import { RoundToken, TakesChip } from "@/components/live/round-token";
import { Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, isApiError, type Output, publicErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type Offering = Output<"/live/edits/offerings">["offerings"][number];
type OfferedLine = Offering["lines"][number];
type Round = NonNullable<Output<"/live/relays/get">["relay"]>["rounds"][number];

const POLL_MS = 2_000;
const WAIT_MS = 60_000;

const EXAMPLE =
  "add a third round where the room explains what the stranger missed";

const VERB: Record<string, string> = {
  add: "add round",
  remove: "remove round",
  move: "move round",
  title: "set title",
  prompt: "set prompt",
  parts: "set parts",
  choices: "set choices",
  takes: "set takes",
};

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

function partWords(parts: string[], cap: number): string {
  if (parts.length === 0) return "";
  if (cap > 0) return `${parts[0]}, up to ${cap}`;
  return parts.join(" · ");
}

/** A line as the panel shows it: the round it is about, under its number. */
interface Shown {
  line: OfferedLine;
  round: Round | null;
  /** The round as it stood when the line was taken, so "was" says what was. */
  was: Round | null;
  number: number;
}

/**
 * What a refused line says. The boundary answers a category, and the panel
 * reads the word behind it from the round the line names: a line about a round
 * whose run is open is held back, whatever the line changes.
 */
function refusalWords(error: string, shown: Shown): string {
  if (shown.line.standing !== "pending") return "Taken, but nothing changed.";
  if (error === "NOT_FOUND") return saidRefusal(error, "ROUND_GONE");
  if (error !== "CONFLICT") return saidRefusal(error, null);
  return shown.round === null
    ? "Refused. Nothing changed."
    : refusalSentence("RUN_OPEN", { round: shown.number });
}

/**
 * The number each line's round carries, so a line names it the way every
 * other screen does: the relay as it now stands, the round as it last stood
 * for one a taken line has removed, the round a taken `add` made, and the
 * number an add still pending lands at.
 */
function numbered(
  lines: OfferedLine[],
  rounds: Round[],
  stood: Map<string, Round>,
  froze: Map<string, Round>,
): Shown[] {
  let adds = 0;
  return lines.map((line) => {
    const was = froze.get(line.suggestion) ?? null;
    const round =
      rounds.find((entry) => entry.leg === line.target) ??
      stood.get(line.target) ??
      null;
    if (round !== null)
      return { line, round, was: was ?? round, number: round.number };
    const drafted = record(readJson(line.value));
    const made =
      line.standing === "taken"
        ? (rounds.find((entry) => entry.title === drafted.title) ?? null)
        : null;
    if (made !== null)
      return { line, round: made, was: was ?? made, number: made.number };
    adds += 1;
    const lands = drafted.position;
    return {
      line,
      round,
      was,
      number:
        typeof lands === "number" && lands > 0 ? lands : rounds.length + adds,
    };
  });
}

function Was({ children }: { children: React.ReactNode }) {
  return <s className="min-w-0 text-muted-foreground">{children}</s>;
}

/** What the line proposes, with the arrow bound to the value it points at. */
function Change({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="flex-none text-muted-foreground">→</span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

function LineBody({ line, round }: { line: OfferedLine; round: Round | null }) {
  if (line.kind === "add") {
    const drafted = record(readJson(line.value));
    const kind = typeof drafted.kind === "string" ? drafted.kind : "";
    const takes = record(drafted.takes);
    const from = typeof takes.from === "number" ? takes.from : 0;
    const use = typeof takes.use === "string" ? takes.use : "";
    const cap = typeof drafted.cap === "number" ? drafted.cap : 0;
    const boxes =
      partWords(strings(drafted.parts), cap) ||
      strings(drafted.choices).join(" · ");
    return (
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex min-w-0 flex-wrap items-baseline gap-2">
          <span className="min-w-0 font-medium">
            {String(drafted.title ?? "")}
          </span>
          {kind === "" ? null : (
            <span className="flex-none text-muted-foreground capitalize">
              {kind}
            </span>
          )}
          {from > 0 && use !== "" ? <TakesChip from={from} use={use} /> : null}
        </span>
        {drafted.prompt ? (
          <span className="min-w-0 text-muted-foreground">
            {String(drafted.prompt)}
          </span>
        ) : null}
        {boxes === "" ? null : (
          <span className="min-w-0 text-muted-foreground">{boxes}</span>
        )}
      </span>
    );
  }
  if (line.kind === "remove") {
    return <Was>{round?.title ?? ""}</Was>;
  }
  if (line.kind === "move") {
    return (
      <Change>
        <RoundToken number={Number(line.value)} size="sm" />
      </Change>
    );
  }
  if (line.kind === "title" || line.kind === "prompt") {
    const was = line.kind === "title" ? round?.title : round?.prompt;
    return (
      <>
        {was && was !== line.value ? <Was>{was}</Was> : null}
        <Change>{line.value}</Change>
      </>
    );
  }
  if (line.kind === "parts") {
    const drafted = record(readJson(line.value));
    const cap = typeof drafted.cap === "number" ? drafted.cap : 0;
    const was = round === null ? "" : partWords(round.parts, round.cap);
    const to = partWords(strings(drafted.parts), cap);
    return (
      <>
        {was === "" || was === to ? null : <Was>{was}</Was>}
        <Change>{to === "" ? "nothing" : to}</Change>
      </>
    );
  }
  if (line.kind === "choices") {
    const drafted = strings(readJson(line.value));
    const was = round === null ? "" : round.choices.join(" · ");
    const to = drafted.join(" · ");
    return (
      <>
        {was === "" || was === to ? null : <Was>{was}</Was>}
        <Change>{to === "" ? "nothing" : to}</Change>
      </>
    );
  }
  if (line.kind === "takes") {
    const drafted = record(readJson(line.value));
    const use = typeof drafted.use === "string" ? drafted.use : "";
    const from = typeof drafted.from === "number" ? drafted.from : 0;
    if (use === "" || from === 0) {
      return <Change>nothing</Change>;
    }
    return <TakesChip from={from} use={use} />;
  }
  return <span className="min-w-0">{line.value}</span>;
}

/** How long the wait has run, in the panel's own mono reading. */
function Waited() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span
      aria-hidden="true"
      className="font-mono text-muted-foreground text-xs tabular-nums"
    >
      {seconds} s
    </span>
  );
}

/**
 * The one place a staff member meets what the model proposed: a brief goes
 * out, the lines come back, and each is confirmed or dismissed by hand. A
 * line is only ever a concept action, so the panel shows the verb, what it
 * touches, and nothing else.
 */
export function AiPanel({
  relay,
  rounds,
  pending = false,
  onChanged,
}: {
  relay: string;
  rounds: Round[];
  /** A brief was already sent from the Live list, so a reply is on its way. */
  pending?: boolean;
  onChanged: () => void;
}) {
  const [request, setRequest] = useState("");
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [nothing, setNothing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [took, setTook] = useState<number | null>(null);
  const [stopped, setStopped] = useState<{
    line: string;
    error: string;
  } | null>(null);
  const [stood, setStood] = useState<Map<string, Round>>(new Map());
  const [froze, setFroze] = useState<Map<string, Round>>(new Map());
  const [unmoved, setUnmoved] = useState<Set<string>>(new Set());
  const known = useRef<Set<string>>(new Set());
  const sentAt = useRef<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a round a taken line has removed is gone from the relay, and only the panel still holds it
    setStood(
      (last) =>
        new Map([
          ...last,
          ...rounds.map((round) => [round.leg, round] as const),
        ]),
    );
  }, [rounds]);

  /** The relay as the panel compares it: every round, whole, in order. */
  const readRelay = useCallback(async (): Promise<string | null> => {
    const result = await api["/live/relays/get"]({ relay });
    if (isApiError(result) || result.relay === null) return null;
    return JSON.stringify(result.relay.rounds);
  }, [relay]);

  const read = useCallback(async () => {
    const result = await api["/live/edits/offerings"]({ relay });
    if (isApiError(result)) return null;
    setOfferings(result.offerings);
    return result.offerings;
  }, [relay]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the panel opens on what has already been offered, which only a read can say
    void read().then((offered) => {
      if (cancelled || offered === null) return;
      known.current = new Set(offered.map((entry) => entry.offering));
      if (pending && offered.length === 0) setWaiting(true);
    });
    return () => {
      cancelled = true;
    };
  }, [read, pending]);

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
        offered.some((entry) => !known.current.has(entry.offering))
      ) {
        known.current = new Set(offered.map((entry) => entry.offering));
        setWaiting(false);
        if (sentAt.current !== null) {
          setTook((Date.now() - sentAt.current) / 1000);
        }
        onChanged();
        return;
      }
      if (Date.now() - started >= WAIT_MS) {
        setWaiting(false);
        setNothing(true);
        return;
      }
      timer = setTimeout(() => void tick(), POLL_MS);
    };

    timer = setTimeout(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [waiting, read, onChanged]);

  async function draft() {
    const brief = request.trim();
    if (brief === "") return;
    setNothing(false);
    setStopped(null);
    setTook(null);
    setBusy(true);
    const offered = await read();
    known.current = new Set((offered ?? []).map((entry) => entry.offering));
    const sent = Date.now();
    const result = await api["/live/edits/draft"]({ relay, request: brief });
    setBusy(false);
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    sentAt.current = sent;
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

  /** The round a line is about, held as it stands before the line is taken. */
  function freeze(line: OfferedLine) {
    const round =
      rounds.find((entry) => entry.leg === line.target) ??
      stood.get(line.target) ??
      null;
    if (round === null) return;
    setFroze((last) => new Map(last).set(line.suggestion, round));
  }

  /**
   * A concept can refuse what a line asks while the take itself succeeds, and
   * the relay reading back word for word is what says so.
   */
  function markUnmoved(
    line: OfferedLine,
    before: string | null,
    after: string,
  ) {
    if (before === null || before !== after) return;
    setUnmoved((last) => new Set(last).add(line.suggestion));
  }

  async function settle(line: OfferedLine, take: boolean) {
    setBusy(true);
    setStopped(null);
    const before = take ? await readRelay() : null;
    if (take) freeze(line);
    if ((await apply(line, take)) && take) {
      const after = await readRelay();
      if (after !== null) markUnmoved(line, before, after);
    }
    setBusy(false);
    await read();
    onChanged();
  }

  /** The lines still pending, in order, until one is refused. */
  async function settleAll(offering: Offering, take: boolean) {
    setBusy(true);
    setStopped(null);
    let before = take ? await readRelay() : null;
    for (const line of offering.lines) {
      if (line.standing !== "pending") continue;
      if (take) freeze(line);
      if (!(await apply(line, take))) break;
      if (!take) continue;
      const after = await readRelay();
      if (after === null) continue;
      markUnmoved(line, before, after);
      before = after;
    }
    setBusy(false);
    await read();
    onChanged();
  }

  const offering = offerings[0] ?? null;
  const outstanding =
    offering === null
      ? 0
      : offering.lines.filter((line) => line.standing === "pending").length;
  const shown =
    offering === null ? [] : numbered(offering.lines, rounds, stood, froze);

  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-2.5">
          <Textarea
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            placeholder={EXAMPLE}
            rows={3}
            className="min-h-16 bg-card"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={busy || waiting || request.trim() === ""}
              onClick={() => void draft()}
            >
              {waiting ? <Spinner className="size-4" /> : null} Draft
            </Button>
            {waiting ? <Waited /> : null}
            {!waiting && took !== null ? (
              <span className="font-mono text-muted-foreground text-xs tabular-nums">
                {took.toFixed(1)} s
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {nothing ? (
            <p className="text-muted-foreground text-sm">Nothing came back.</p>
          ) : null}
          {offering !== null &&
          offering.lines.every((line) => line.kind === "keep") ? (
            <p className="text-muted-foreground text-sm">Nothing to change.</p>
          ) : null}
          {offering === null ||
          offering.lines.every((line) => line.kind === "keep") ? null : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {shown.map((entry) => {
                const { line, was, number } = entry;
                return (
                  <div
                    key={line.suggestion}
                    className={cn(
                      "flex flex-wrap items-center gap-2.5 px-3 py-2 text-sm",
                      line.standing !== "pending" &&
                        !unmoved.has(line.suggestion) &&
                        "opacity-45",
                      line.suggestion === stopped?.line && "bg-destructive/5",
                    )}
                  >
                    <span className="w-full flex-none whitespace-nowrap font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.06em] sm:w-[104px]">
                      {VERB[line.kind] ?? line.kind}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
                      <RoundToken
                        number={number}
                        size="sm"
                        standing={line.kind === "add" ? "next" : "plain"}
                      />
                      <LineBody line={line} round={was} />
                    </span>
                    {line.standing !== "pending" ? (
                      <span className="flex-none text-muted-foreground text-xs">
                        {unmoved.has(line.suggestion)
                          ? "Nothing changed."
                          : line.standing === "taken"
                            ? "Applied"
                            : "Declined"}
                      </span>
                    ) : (
                      <span className="flex flex-none gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Take"
                          disabled={busy}
                          onClick={() => void settle(line, true)}
                        >
                          <Check />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Decline"
                          disabled={busy}
                          onClick={() => void settle(line, false)}
                        >
                          <X />
                        </Button>
                      </span>
                    )}
                    {line.suggestion === stopped?.line ? (
                      <p className="w-full text-destructive sm:pl-[114px]">
                        {refusalWords(stopped.error, entry)}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {offering !== null &&
          outstanding > 0 &&
          !offering.lines.every((line) => line.kind === "keep") ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void settleAll(offering, true)}
              >
                Accept all
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void settleAll(offering, false)}
              >
                Dismiss
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
