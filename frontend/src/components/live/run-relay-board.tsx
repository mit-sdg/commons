"use client";

import { ArrowLeft, Presentation, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Link } from "@/components/link";
import { ModelRow } from "@/components/live/model-row";
import { PickControl, usePick } from "@/components/live/pick-control";
import { JoinCode, joinUrl } from "@/components/live/qr-code";
import {
  type RefusalAbout,
  type RefusalWord,
  refusalSentence,
  saidRefusal,
} from "@/components/live/refusals";
import { RoundToken } from "@/components/live/round-token";
import {
  choicesOf,
  pickedPiles,
  type Relay,
  type RelayRun,
  type RelayRunRound,
  type RelayTake,
  roundStanding,
  trayOf,
  type Wall as WallShape,
} from "@/components/live/rounds";
import { Wall, type WallEdits } from "@/components/live/wall";
import { PageContainer } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { api, isApiError, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Fast enough that the room sees itself answer, slow enough to be polite. */
const POLL_MS = 3_000;

/** The switch is standing consent for a run, so it is kept where the run's own page finds it. */
const SORTS_KEY = "commons-live-sorts:";

/** The disabled Open button names the line that says why. */
const REFUSAL_ID = "open-refusal";

/** Every round in the strip sits in the same pill, tapped or not. */
const STRIP_TOKEN = "flex min-w-0 rounded-full px-1 py-0.5";

/** The disc on the primary button takes the button's own colour. */
const ON_PRIMARY =
  "text-current [&>span:first-child]:border-solid [&>span:first-child]:border-current [&>span:first-child]:text-current";

/** A refusal the screen has read: the word, and the round its sentence names. */
interface Refusal {
  word: RefusalWord;
  about: RefusalAbout;
}

/** What a refused request is read as, once the screen has seen the state again. */
type Reader = (error: string) => Refusal | null | Promise<Refusal | null>;

/**
 * The staff screen for a relay run: the rounds, the wall of the round in
 * hand, and the one button that moves the relay on.
 */
export function RelayRunBoard({
  run,
  error,
  refetch,
}: {
  run: RelayRun;
  error: string | null;
  refetch: () => void;
}) {
  const { session } = useAuth();
  /** The round the strip was tapped for, under the round that was open then. */
  const [shownLeg, setShownLeg] = useState<{
    leg: string;
    under: string | null;
  } | null>(null);
  const [modelSorts, setModelSorts] = useState(false);
  const [askedFor, setAskedFor] = useState<string | null>(null);

  const { data: relayData } = useQuery(
    session
      ? () => api["/live/relays/get"]({ relay: run.relay }).then(unwrap)
      : null,
    [session, run.relay, run],
  );
  const relay = relayData?.relay ?? null;

  const openRound = run.openRound;
  const closed = run.rounds.filter(
    (round) => round.round !== null && round.figure.open === false,
  );
  // A tap lapses when the round it was made under gives way to another, so a
  // round that opens takes the screen back.
  const chosen =
    shownLeg === null || shownLeg.under !== openRound
      ? null
      : (run.rounds.find((round) => round.leg === shownLeg.leg)?.round ?? null);
  const next = run.rounds.find((round) => round.round === null) ?? null;
  const { take, source } = takeOf(run, relay, next);
  const shown = chosen ?? openRound ?? source?.round ?? lastClosed(closed);

  const {
    data: wallData,
    error: wallError,
    refetch: refetchWall,
  } = useQuery(
    session && shown !== null
      ? () => api["/live/walls/read"]({ round: shown }).then(unwrap)
      : null,
    [session, shown, openRound],
  );
  const wall = wallData?.wall ?? null;

  // A vote round's rows stand for piles on the wall its choices came from, so
  // the dashboard reads that wall too and each row spreads the cards behind it.
  const shownEntry =
    run.rounds.find((round) => round.round !== null && round.round === shown) ??
    null;
  const shownTake =
    shownEntry === null
      ? null
      : (relay?.rounds.find((one) => one.leg === shownEntry.leg)?.takes[0] ??
        null);
  const choiceSource =
    shownTake === null || shownTake.shape !== "choices"
      ? null
      : (run.rounds.find((one) => one.leg === shownTake.source)?.round ?? null);
  const { data: sourceData } = useQuery(
    session && choiceSource !== null
      ? () => api["/live/walls/read"]({ round: choiceSource }).then(unwrap)
      : null,
    [session, choiceSource],
  );
  const sourceWall: WallShape | null = sourceData?.wall ?? null;

  /** A vote round has nothing to sort: every answer is one of the choices. */
  const voting =
    openRound !== null && wall !== null && choicesOf(wall).length > 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the switch is standing consent the browser holds, which only a read can say
    setModelSorts(recalledSorts(run.run));
  }, [run.run]);

  useEffect(() => {
    if (!run.open) return;
    const timer = setInterval(refetch, POLL_MS);
    return () => clearInterval(timer);
  }, [run.open, refetch]);

  useEffect(() => {
    if (!run.open) return;
    const timer = setInterval(refetchWall, POLL_MS);
    return () => clearInterval(timer);
  }, [run.open, refetchWall]);

  useEffect(() => {
    if (!modelSorts || openRound === null || voting) return;
    let live = true;
    const sort = async () => {
      const answer = await api["/live/walls/sort"]({ round: openRound });
      if (!live || isApiError(answer)) return;
      if (answer.asked) setAskedFor(openRound);
    };
    void sort();
    const timer = setInterval(() => void sort(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [modelSorts, openRound, voting]);

  const openEntry =
    run.rounds.find(
      (round) => round.round === openRound && round.round !== null,
    ) ?? null;
  const polled = wall === null ? [] : pickedPiles(wall);
  const [tapped, setTapped] = useState<{
    round: string;
    piles: string[];
  } | null>(null);
  /** A pick still in flight, whose taps stand until the wall they wrote arrives. */
  const picking = useRef(false);

  useEffect(() => {
    if (picking.current) return;
    setTapped(null);
  }, [wall]);

  const picks =
    tapped !== null && tapped.round === shown ? tapped.piles : polled;
  const takesShown =
    take !== null &&
    source !== null &&
    source.round === shown &&
    source.figure.open === false;

  /** Sends the whole picked set, which stands on the screen until the wall lands. */
  function applyPick(piles: string[]) {
    if (shown === null) return;
    setTapped({ round: shown, piles });
    picking.current = true;
    void send(
      api["/live/walls/pick"]({ round: shown, piles }),
      goneOrClosed("PILE_GONE"),
    ).then(() => {
      picking.current = false;
      refetchWall();
    });
  }

  const pick = usePick({
    run: run.run,
    piles: wall?.piles ?? [],
    picked: picks,
    live: takesShown && run.open,
    onPick: applyPick,
  });

  /** Sends one request; a refusal is said in the word the screen reads for it. */
  async function send(request: Promise<unknown>, read: Reader) {
    const result = await request;
    if (!isApiError(result)) return true;
    const refusal = await read(result.error);
    toast.error(
      saidRefusal(result.error, refusal?.word ?? null, refusal?.about),
    );
    return false;
  }

  /** The run as it now stands, so a refusal is said from what is true. */
  async function freshRun(): Promise<RelayRun | null> {
    const answer = await api["/live/relays/run"]({ run: run.run });
    refetch();
    return isApiError(answer) ? null : answer.run;
  }

  /** A refused wall edit: the pile or card is gone, or the run has closed. */
  function goneOrClosed(gone: "PILE_GONE" | "CARD_GONE"): Reader {
    return async (error) => {
      if (error === "NOT_FOUND") return { word: gone, about: {} };
      if (error !== "CONFLICT") return null;
      const fresh = await freshRun();
      return fresh !== null && !fresh.open
        ? { word: "CLOSED", about: {} }
        : null;
    };
  }

  /** A refused seat: the run has closed under the row. */
  const seatRefused: Reader = async () => {
    const fresh = await freshRun();
    return fresh !== null && !fresh.open ? { word: "CLOSED", about: {} } : null;
  };

  const edits: WallEdits | undefined =
    shown === null
      ? undefined
      : {
          moveCard: (card, pile) => {
            void send(
              api["/live/walls/move-card"]({ card, pile }),
              goneOrClosed("PILE_GONE"),
            ).then(refetchWall);
          },
          toTray: (card) => {
            void send(
              api["/live/walls/to-tray"]({ card }),
              goneOrClosed("CARD_GONE"),
            ).then(refetchWall);
          },
          openPile: (card, name) => {
            void send(
              api["/live/walls/open-pile"]({ round: shown, name, card }),
              goneOrClosed("CARD_GONE"),
            ).then(refetchWall);
          },
          renamePile: (pile, name) => {
            void send(
              api["/live/walls/rename-pile"]({ pile, name }),
              goneOrClosed("PILE_GONE"),
            ).then(refetchWall);
          },
          mergePile: (pile, into) => {
            void send(
              api["/live/walls/merge-pile"]({ pile, into }),
              goneOrClosed("PILE_GONE"),
            ).then(refetchWall);
          },
          summarize: (pile) => {
            void send(
              api["/live/walls/summarize"]({ pile }),
              goneOrClosed("PILE_GONE"),
            ).then((sent) => {
              if (sent) toast.success("Summarizing…");
            });
          },
          togglePick: takesShown && run.open ? pick.tap : undefined,
        };

  async function openNext() {
    if (next === null) return;
    const leg = next.leg;
    const opened = await send(
      api["/live/relays/open-round"]({ run: run.run, leg }),
      async () => {
        const fresh = await freshRun();
        return fresh === null
          ? null
          : refusalFor({
              run: fresh,
              relay,
              leg,
              picks: takesShown ? picks.length : null,
            });
      },
    );
    if (opened) refetch();
  }

  async function closeRound() {
    if (openRound === null || openEntry === null) return;
    const number = openEntry.number;
    await send(
      api["/live/relays/close-round"]({ round: openRound }),
      async () => {
        const fresh = await freshRun();
        return fresh !== null && !fresh.open
          ? { word: "CLOSED", about: {} }
          : { word: "ROUND_CLOSED", about: { round: number } };
      },
    );
    refetch();
  }

  async function closeRun() {
    await send(api["/live/relays/close"]({ run: run.run }), () => ({
      word: "CLOSED",
      about: {},
    }));
    refetch();
  }

  function sortsChange(on: boolean) {
    setModelSorts(on);
    rememberSorts(run.run, on);
  }

  async function invite(seats: number) {
    for (let seat = 0; seat < seats; seat += 1) {
      const taken = await send(
        api["/live/relays/invite"]({
          run: run.run,
          device: crypto.randomUUID(),
        }),
        seatRefused,
      );
      if (!taken) break;
    }
    refetch();
    refetchWall();
  }

  async function dismiss() {
    const seat = run.seats.at(-1);
    if (seat === undefined) return;
    await send(
      api["/live/relays/dismiss"]({
        run: run.run,
        participant: seat.participant,
      }),
      seatRefused,
    );
    refetch();
  }

  async function dismissAll() {
    await send(api["/live/relays/dismiss-all"]({ run: run.run }), seatRefused);
    refetch();
  }

  const writing =
    openEntry === null
      ? 0
      : Math.max(0, run.seats.length - (openEntry.figure.handedInByModel ?? 0));
  const sorting =
    modelSorts &&
    openRound !== null &&
    askedFor === openRound &&
    wall !== null &&
    trayOf(wall.cards).length > 0;
  /** Nothing is left to open, so the switch and the seats have nothing to act on. */
  const everyRoundRan = run.open && openRound === null && next === null;

  const refusal = refusalFor({
    run,
    relay,
    leg: next?.leg ?? null,
    picks: takesShown ? picks.length : null,
  });
  /** The Close button says the round is open, so only the unseen reasons are printed. */
  const refusalLine =
    refusal === null || refusal.word === "ROUND_OPEN"
      ? null
      : refusalSentence(refusal.word, refusal.about);

  return (
    <PageContainer width="wide">
      <header className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2.5">
          <Link
            href="/staff/live"
            className="eyebrow inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Live
          </Link>
          <h1
            dir="auto"
            className="text-balance font-display font-semibold text-[40px] leading-tight tracking-tight"
          >
            {run.title}
          </h1>
          <div className="-mx-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {run.rounds.map((round) => {
              const standing = roundStanding(round);
              const token = (
                <RoundToken
                  number={round.number}
                  title={round.title}
                  standing={standing}
                  size="md"
                />
              );
              return standing === "done" ? (
                <button
                  key={round.leg}
                  type="button"
                  aria-pressed={round.round === shown}
                  onClick={() =>
                    setShownLeg({ leg: round.leg, under: openRound })
                  }
                  className={cn(
                    STRIP_TOKEN,
                    round.round === shown && "ring-1 ring-primary/60",
                  )}
                >
                  {token}
                </button>
              ) : (
                <span key={round.leg} className={STRIP_TOKEN}>
                  {token}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/staff/live/run/${run.run}/project`} target="_blank">
              <Presentation /> Project
            </Link>
          </Button>
          {run.open ? (
            <ConfirmAction
              trigger={<Button variant="destructive">Close run</Button>}
              title="Close this run?"
              description="Nobody can join or hand in after this."
              confirmLabel="Close run"
              destructive
              onConfirm={closeRun}
            />
          ) : (
            <span className="text-muted-foreground text-sm">Closed</span>
          )}
        </div>
      </header>

      {error !== null ? (
        <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-destructive text-sm">
          {error} Showing the last wall that arrived.
        </p>
      ) : null}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-3">
          {wall === null ? (
            wallError !== null ? (
              <ErrorState message={wallError} onRetry={refetchWall} />
            ) : shown === null ? (
              <p className="rounded-2xl border border-border border-dashed bg-card/40 px-7 py-16 text-center text-muted-foreground">
                No round has opened yet.
              </p>
            ) : (
              <LoadingState label="Loading the wall…" />
            )
          ) : (
            <Wall
              wall={wall}
              named={shown !== openRound}
              carriesTo={takesShown ? (next?.number ?? undefined) : undefined}
              sourceWall={sourceWall}
              edits={run.open ? edits : undefined}
            />
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-5">
            {!run.open || openEntry === null ? null : (
              <Button
                size="lg"
                className="w-full justify-start gap-2 pr-3.5 pl-4"
                onClick={() => void closeRound()}
              >
                Close
                <RoundToken
                  number={openEntry.number}
                  title={openEntry.title}
                  standing="open"
                  size="sm"
                  className={ON_PRIMARY}
                />
              </Button>
            )}
            {!run.open || next === null ? null : (
              <>
                {takesShown ? (
                  <PickControl
                    mode={pick.mode}
                    top={pick.top}
                    onMode={pick.setMode}
                    onTop={pick.setTop}
                  />
                ) : null}
                <Button
                  variant={openEntry === null ? "default" : "outline"}
                  size="lg"
                  className="w-full justify-between gap-3 pr-3.5 pl-4"
                  disabled={refusal !== null}
                  title={refusalLine ?? undefined}
                  aria-describedby={
                    refusalLine === null ? undefined : REFUSAL_ID
                  }
                  onClick={() => void openNext()}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    Open
                    <RoundToken
                      number={next.number}
                      title={next.title}
                      standing="next"
                      size="sm"
                      className={openEntry === null ? ON_PRIMARY : undefined}
                    />
                  </span>
                  {takesShown ? (
                    <span className="flex-none font-mono text-xs opacity-80">
                      {picks.length} {picks.length === 1 ? "pile" : "piles"}
                    </span>
                  ) : null}
                </Button>
                {refusalLine === null ? null : (
                  <p id={REFUSAL_ID} className="text-muted-foreground text-xs">
                    {refusalLine}
                  </p>
                )}
              </>
            )}
            {everyRoundRan ? (
              <p className="text-muted-foreground text-xs">
                Every round has run.
              </p>
            ) : null}

            {run.open && (next !== null || openEntry !== null) ? (
              <div className="h-px bg-border" />
            ) : null}

            {run.open && !everyRoundRan ? (
              <>
                {voting ? null : (
                  <div className="flex items-center gap-2.5">
                    <Switch
                      on={modelSorts}
                      label="Model sorts"
                      onChange={sortsChange}
                    />
                    {sorting ? (
                      <span className="text-muted-foreground text-xs">
                        sorting…
                      </span>
                    ) : null}
                  </div>
                )}
                <ModelRow
                  count={run.seats.length}
                  writing={writing}
                  onInvite={invite}
                  onDismiss={dismiss}
                  onDismissAll={dismissAll}
                />

                <div className="h-px bg-border" />
              </>
            ) : null}

            <Button variant="outline" size="sm" className="self-start" asChild>
              <Link href={`/staff/live/relay/${run.relay}/edit?draft=1`}>
                <Sparkles /> Draft a round
              </Link>
            </Button>
          </div>

          {!run.open || run.token === null || run.code === null ? null : (
            <div className="rounded-xl border border-border bg-card p-4">
              <JoinCode url={joinUrl(run.token)} code={run.code} />
            </div>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}

/** The switch that says the model sorts, which is standing consent while it is on. */
function Switch({
  on,
  label,
  onChange,
}: {
  on: boolean;
  label: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-center gap-2 text-sm"
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

function recalledSorts(run: string): boolean {
  try {
    return window.localStorage.getItem(SORTS_KEY + run) === "on";
  } catch {
    return false;
  }
}

function rememberSorts(run: string, on: boolean): void {
  try {
    window.localStorage.setItem(SORTS_KEY + run, on ? "on" : "off");
  } catch {
    // A browser that refuses storage still sorts; it just starts each load off.
  }
}

/** The closed round whose wall stands until another is shown or opened. */
function lastClosed(closed: RelayRunRound[]): string | null {
  let latest: RelayRunRound | null = null;
  for (const round of closed) {
    if (
      latest === null ||
      (round.figure.closedAt ?? "") > (latest.figure.closedAt ?? "")
    )
      latest = round;
  }
  return latest?.round ?? null;
}

/** What a round takes from an earlier one, and how that source stands in this run. */
function takeOf(
  run: RelayRun,
  relay: Relay | null,
  round: RelayRunRound | null,
): { take: RelayTake | null; source: RelayRunRound | null } {
  const take =
    round === null
      ? null
      : (relay?.rounds.find((one) => one.leg === round.leg)?.takes[0] ?? null);
  const source =
    take === null
      ? null
      : (run.rounds.find((one) => one.leg === take.source) ?? null);
  return { take, source };
}

/** Why a round does not open, in the words the open-round refusals stand for. */
function refusalFor({
  run,
  relay,
  leg,
  picks,
}: {
  run: RelayRun;
  relay: Relay | null;
  leg: string | null;
  picks: number | null;
}): Refusal | null {
  if (!run.open) return { word: "CLOSED", about: {} };
  const open = run.rounds.find((round) => round.figure.open === true) ?? null;
  if (open !== null)
    return { word: "ROUND_OPEN", about: { round: open.number } };
  const round =
    leg === null ? null : (run.rounds.find((one) => one.leg === leg) ?? null);
  if (round === null) return null;
  if (round.round !== null)
    return { word: "ROUND_DONE", about: { round: round.number } };
  const { take, source } = takeOf(run, relay, round);
  if (source !== null && source.round === null)
    return { word: "SOURCE_UNRUN", about: { round: source.number } };
  if (source !== null && source.figure.open === true)
    return { word: "SOURCE_OPEN", about: { round: source.number } };
  if (take !== null && picks === 0)
    return { word: "NOTHING_PICKED", about: {} };
  return null;
}
