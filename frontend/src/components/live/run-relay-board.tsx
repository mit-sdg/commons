"use client";

import { ArrowLeft, Presentation, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Link } from "@/components/link";
import { ModelRow } from "@/components/live/model-row";
import { JoinCode, joinUrl } from "@/components/live/qr-code";
import { RoundStrip, RoundToken } from "@/components/live/round-token";
import {
  modelCards,
  pickedPiles,
  questionOf,
  type RelayRun,
  type RelayRunRound,
  roundStanding,
  trayOf,
  type Wall as WallShape,
} from "@/components/live/rounds";
import { Wall, type WallEdits } from "@/components/live/wall";
import { PageContainer } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { api, isApiError, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fullTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Fast enough that the room sees itself answer, slow enough to be polite. */
const POLL_MS = 3_000;

/** The switch is standing consent for a run, so it is kept where the run's own page finds it. */
const SORTS_KEY = "commons-live-sorts:";

/** The disabled Open button names the line that says why. */
const REFUSAL_ID = "open-refusal";

/** The disc on the primary button takes the button's own colour. */
const ON_PRIMARY =
  "text-current [&>span:first-child]:border-solid [&>span:first-child]:border-current [&>span:first-child]:text-current";

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
  const [shownLeg, setShownLeg] = useState<string | null>(null);
  const [modelSorts, setModelSorts] = useState(false);
  const [askedFor, setAskedFor] = useState<string | null>(null);
  const [invited, setInvited] = useState<{
    round: string;
    seats: number;
  } | null>(null);

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
  const chosen =
    shownLeg === null
      ? null
      : (run.rounds.find((round) => round.leg === shownLeg)?.round ?? null);
  const next = run.rounds.find((round) => round.round === null) ?? null;
  const take =
    next === null
      ? null
      : (relay?.rounds.find((round) => round.leg === next.leg)?.takes[0] ??
        null);
  const source =
    take === null
      ? null
      : (run.rounds.find((round) => round.leg === take.source) ?? null);
  const shown = openRound ?? chosen ?? source?.round ?? lastClosed(closed);

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
    if (!modelSorts || openRound === null) return;
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
  }, [modelSorts, openRound]);

  const openEntry =
    run.rounds.find(
      (round) => round.round === openRound && round.round !== null,
    ) ?? null;
  const polled = wall === null ? [] : pickedPiles(wall);
  const [tapped, setTapped] = useState<{
    round: string;
    piles: string[];
  } | null>(null);
  const picks =
    tapped !== null && tapped.round === shown ? tapped.piles : polled;
  const takesShown =
    take?.shape === "picked" &&
    source !== null &&
    source.round === shown &&
    source.figure.open === false;

  async function send(request: Promise<unknown>) {
    const result = await request;
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return false;
    }
    return true;
  }

  const edits: WallEdits | undefined =
    shown === null
      ? undefined
      : {
          moveCard: (card, pile) => {
            void send(api["/live/walls/move-card"]({ card, pile })).then(
              refetchWall,
            );
          },
          toTray: (card) => {
            void send(api["/live/walls/to-tray"]({ card })).then(refetchWall);
          },
          openPile: (card, name) => {
            void send(
              api["/live/walls/open-pile"]({ round: shown, name, card }),
            ).then(refetchWall);
          },
          renamePile: (pile, name) => {
            void send(api["/live/walls/rename-pile"]({ pile, name })).then(
              refetchWall,
            );
          },
          mergePile: (pile, into) => {
            void send(api["/live/walls/merge-pile"]({ pile, into })).then(
              refetchWall,
            );
          },
          summarize: (pile) => {
            void send(api["/live/walls/summarize"]({ pile })).then(() => {
              toast.success("Summarizing…");
            });
          },
          togglePick:
            takesShown && run.open
              ? (pile) => {
                  const piles = picks.includes(pile)
                    ? picks.filter((one) => one !== pile)
                    : [...picks, pile];
                  setTapped({ round: shown, piles });
                  void send(
                    api["/live/walls/pick"]({ round: shown, piles }),
                  ).then(refetchWall);
                }
              : undefined,
        };

  async function openNext() {
    if (next === null) return;
    if (
      await send(
        api["/live/relays/open-round"]({ run: run.run, leg: next.leg }),
      )
    )
      refetch();
  }

  async function closeRound() {
    if (openRound === null) return;
    if (await send(api["/live/relays/close-round"]({ round: openRound })))
      refetch();
  }

  async function closeRun() {
    if (await send(api["/live/relays/close"]({ run: run.run }))) refetch();
  }

  function sortsChange(on: boolean) {
    setModelSorts(on);
    rememberSorts(run.run, on);
  }

  async function invite(seats: number) {
    const round = openRound;
    for (let seat = 0; seat < seats; seat += 1) {
      const taken = await send(
        api["/live/relays/invite"]({
          run: run.run,
          device: crypto.randomUUID(),
        }),
      );
      if (!taken) break;
      if (round !== null)
        setInvited((standing) => ({
          round,
          seats: (standing?.round === round ? standing.seats : 0) + 1,
        }));
    }
    refetch();
    refetchWall();
  }

  const participants = wall === null ? 0 : modelParticipants(wall);
  const writing =
    invited === null || invited.round !== openRound
      ? 0
      : Math.max(0, invited.seats - participants);
  const sorting =
    modelSorts &&
    openRound !== null &&
    askedFor === openRound &&
    wall !== null &&
    trayOf(wall.cards).length > 0;

  const refusal = refusalFor({
    open: run.open,
    openRound,
    next,
    source,
    take,
    picks: takesShown ? picks.length : null,
  });

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
          <RoundStrip
            titles
            size="md"
            className="flex-wrap gap-x-3.5 gap-y-1"
            rounds={run.rounds.map((round) => ({
              number: round.number,
              title: round.title,
              standing: roundStanding(round),
            }))}
          />
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/staff/live/run/${run.run}/project`} target="_blank">
              <Presentation /> Project
            </Link>
          </Button>
          {run.open ? (
            <ConfirmAction
              trigger={<Button variant="destructive">Close</Button>}
              title="Close this run?"
              description="Nobody can join or hand in after this. The walls stay."
              confirmLabel="Close"
              destructive
              onConfirm={closeRun}
            />
          ) : (
            <span className="text-muted-foreground text-sm">
              Closed {fullTime(run.closedAt)}
            </span>
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
          {openRound === null && closed.length > 1 ? (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {closed
                .filter((round) => round.round !== shown)
                .map((round) => (
                  <Button
                    key={round.leg}
                    variant="ghost"
                    size="sm"
                    onClick={() => setShownLeg(round.leg)}
                  >
                    Show
                    <RoundToken
                      number={round.number}
                      standing="done"
                      size="sm"
                    />
                    again
                  </Button>
                ))}
            </div>
          ) : null}

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
              edits={edits}
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
              <Button
                variant={openEntry === null ? "default" : "outline"}
                size="lg"
                className="w-full justify-between gap-3 pr-3.5 pl-4"
                disabled={refusal !== null}
                title={refusal ?? undefined}
                aria-describedby={refusal === null ? undefined : REFUSAL_ID}
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
            )}
            {!run.open || next === null || refusal === null ? null : (
              <p id={REFUSAL_ID} className="text-muted-foreground text-xs">
                {refusal}
              </p>
            )}

            {run.open && (next !== null || openEntry !== null) ? (
              <div className="h-px bg-border" />
            ) : null}

            {run.open ? (
              <>
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
                <ModelRow
                  count={participants}
                  writing={writing}
                  disabled={openRound === null}
                  onInvite={invite}
                />

                <div className="h-px bg-border" />
              </>
            ) : null}

            <Button variant="outline" size="sm" className="self-start" asChild>
              <Link href={`/staff/live/relay/${run.relay}?draft=1`}>
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

/** A model participant writes one card per box, so its seats are the cards over the boxes. */
function modelParticipants(wall: WallShape): number {
  const question = questionOf(wall);
  const boxes =
    question === null
      ? 1
      : Math.max(1, question.cap >= 2 ? question.cap : question.parts.length);
  return Math.ceil(modelCards(wall) / boxes);
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

/** Why the next round cannot open, in the words the refusal stands for. */
function refusalFor({
  open,
  openRound,
  next,
  source,
  take,
  picks,
}: {
  open: boolean;
  openRound: string | null;
  next: RelayRunRound | null;
  source: RelayRunRound | null;
  take: { shape: string } | null;
  picks: number | null;
}): string | null {
  if (!open) return "The run is closed.";
  if (openRound !== null) return "Close the open round first.";
  if (next === null) return "Every round has run.";
  if (source !== null && source.round === null)
    return "Open the round it takes from first.";
  if (source !== null && source.figure.open === true)
    return "Close the round it takes from first.";
  if (take?.shape === "picked" && picks === 0) return "Pick at least one pile.";
  return null;
}
