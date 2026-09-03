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
  type RelayRun,
  type RelayRunRound,
  roundStanding,
} from "@/components/live/rounds";
import { Wall, type WallEdits } from "@/components/live/wall";
import { PageContainer } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { api, isApiError, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Fast enough that the room sees itself answer, slow enough to be polite. */
const POLL_MS = 3_000;

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

  const { data: relayData } = useQuery(
    session
      ? () => api["/live/relays/get"]({ relay: run.relay }).then(unwrap)
      : null,
    [session, run.relay],
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
  const shown = openRound ?? chosen ?? lastClosed(closed);

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
    const timer = setInterval(() => {
      void api["/live/walls/sort"]({ round: openRound });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [modelSorts, openRound]);

  const openEntry =
    run.rounds.find(
      (round) => round.round === openRound && round.round !== null,
    ) ?? null;
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
          togglePick: takesShown
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

  async function invite(seats: number) {
    for (let seat = 0; seat < seats; seat += 1) {
      const taken = await send(
        api["/live/relays/invite"]({
          run: run.run,
          device: crypto.randomUUID(),
        }),
      );
      if (!taken) return;
    }
    refetch();
    refetchWall();
  }

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
          ) : null}
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
            {openEntry === null ? null : (
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
            {next === null ? null : (
              <Button
                variant={openEntry === null ? "default" : "outline"}
                size="lg"
                className="w-full justify-between gap-3 pr-3.5 pl-4"
                disabled={refusal !== null}
                title={refusal ?? undefined}
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
            {next === null || refusal === null || openEntry !== null ? null : (
              <p className="text-muted-foreground text-xs">{refusal}</p>
            )}

            {next === null && openEntry === null ? null : (
              <div className="h-px bg-border" />
            )}

            <Switch
              on={modelSorts}
              label="Model sorts"
              onChange={setModelSorts}
            />
            <ModelRow
              count={wall === null ? 0 : modelCards(wall)}
              disabled={openRound === null}
              onInvite={invite}
            />

            <div className="h-px bg-border" />

            <Button variant="outline" size="sm" className="self-start" asChild>
              <Link href={`/staff/live/relay/${run.relay}?draft=1`}>
                <Sparkles /> Draft a round
              </Link>
            </Button>
          </div>

          {run.token === null || run.code === null ? null : (
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
