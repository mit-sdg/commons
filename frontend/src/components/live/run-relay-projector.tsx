"use client";

import { useEffect, useRef, useState } from "react";
import { PROJECTOR, ProjectorFit } from "@/components/live/projector-fit";
import { JoinCode, joinUrl } from "@/components/live/qr-code";
import { refusalSentence } from "@/components/live/refusals";
import {
  choicesOf,
  type RelayRun,
  type RelayRunRound,
  type Wall as WallShape,
} from "@/components/live/rounds";
import { Wall } from "@/components/live/wall";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@/hooks/use-query";
import { api, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { POLL_DEADLINE_MS } from "@/lib/poll";

/** The wall keeps pace with the room the same way the dashboard does. */
const POLL_MS = 3_000;

/**
 * The relay run on the projector: the wall of the open round, full screen,
 * with the join code in the corner. Before the first round it is the title
 * and the code; between rounds and once the run has ended the wall stands,
 * and the word for where the room is takes the join block's place. The shelf
 * of unsorted cards stands in the bottom row beside the code, so the piles
 * take the middle of the screen whole.
 *
 * The room can act on nothing, so the projector carries no word for the
 * connection or the model: its wall stands as it last read, and the
 * dashboard says what is wrong. A wall it has not read yet, on a first load
 * or a reload during class, leaves the title and the join code standing
 * while it keeps reading.
 */
export function RelayProjector({
  run,
  refetch,
}: {
  run: RelayRun;
  refetch: () => void;
}) {
  const { session } = useAuth();
  const [joinExpanded, setJoinExpanded] = useState(false);

  const { data: relayData, refetch: refetchRelay } = useQuery(
    session
      ? () => api["/live/relays/get"]({ relay: run.relay }).then(unwrap)
      : null,
    [session, run.relay],
    { retainOnTransportError: true },
  );
  const relay = relayData?.relay ?? null;

  const closedRound = lastClosed(run.rounds);
  const shownRound = run.openRound ?? closedRound;
  const shownLeg =
    run.rounds.find((round) => round.round === shownRound)?.leg ?? null;
  const take =
    shownLeg === null
      ? null
      : (relay?.rounds.find((round) => round.leg === shownLeg)?.takes[0] ??
        null);
  const sourceRound =
    take === null
      ? null
      : (run.rounds.find((round) => round.leg === take.source)?.round ?? null);
  const carrier =
    shownLeg === null
      ? null
      : (relay?.rounds.find((round) => round.takes[0]?.source === shownLeg) ??
        null);
  const carriesTo =
    carrier === null
      ? undefined
      : (run.rounds.find((round) => round.leg === carrier.leg)?.number ??
        undefined);

  const { data: wallData, refetch: refetchWall } = useQuery(
    session && shownRound !== null
      ? () =>
          api["/live/walls/read"](
            { round: shownRound },
            { timeoutMs: POLL_DEADLINE_MS },
          ).then(unwrap)
      : null,
    [session, shownRound],
    { retainOnTransportError: true, refreshOn: [run.openRound] },
  );
  const { data: sourceData, refetch: refetchSource } = useQuery(
    session && sourceRound !== null
      ? () =>
          api["/live/walls/read"](
            { round: sourceRound },
            { timeoutMs: POLL_DEADLINE_MS },
          ).then(unwrap)
      : null,
    [session, sourceRound],
    { retainOnTransportError: true },
  );

  const wall: WallShape | null = wallData?.wall ?? null;
  const sourceWall: WallShape | null = sourceData?.wall ?? null;

  // Polls and actions refresh these resources without changing their identity.
  // Keep the source cards mounted while their replacements are being read.
  const previousRun = useRef(run);
  useEffect(() => {
    const previous = previousRun.current;
    previousRun.current = run;
    if (previous === run || previous.relay !== run.relay) return;
    refetchRelay();
    refetchSource();
  }, [run, refetchRelay, refetchSource]);

  useEffect(() => {
    if (!run.open) return;
    const timer = setInterval(refetch, POLL_MS);
    return () => clearInterval(timer);
  }, [run.open, refetch]);

  // The close sends one last placing ask, so the wall is read until that
  // ask has landed and nothing is out, closed or not.
  const settling = wall?.sortPending === true || (wall?.asksOut ?? 0) > 0;
  useEffect(() => {
    if (!run.open && !settling) return;
    const timer = setInterval(refetchWall, POLL_MS);
    return () => clearInterval(timer);
  }, [run.open, settling, refetchWall]);

  const url = run.token === null ? null : joinUrl(run.token);
  const code = run.code;

  if (shownRound === null || wall === null) {
    return (
      <div className="relative flex h-dvh flex-col items-center justify-center gap-[clamp(0.75rem,3dvh,2.5rem)] overflow-hidden px-12 py-12 text-center">
        <h1
          dir="auto"
          className="text-balance font-display font-semibold text-5xl tracking-tight lg:text-7xl"
        >
          {run.title}
        </h1>
        {!run.open ? (
          <Standing>{refusalSentence("CLOSED")}</Standing>
        ) : url === null || code === null ? null : (
          <JoinCode audience="room" url={url} code={code} wall />
        )}
      </div>
    );
  }

  // The room can join for as long as the run is open, between rounds as much
  // as during one; the wall's own token says which round closed. On every
  // round, until its first pile opens, the code stands where the piles will —
  // that is the joining moment, and it comes round again each time; after
  // that it keeps the corner.
  const joining = run.open && url !== null && code !== null;
  const filling =
    !wall.open || wall.piles.length > 0 || choicesOf(wall).length > 0;
  const room = joining ? (
    filling ? (
      <JoinCode
        audience="room"
        url={url}
        code={code}
        size="corner"
        onExpand={() => setJoinExpanded(true)}
      />
    ) : null
  ) : (
    <Standing>{refusalSentence("CLOSED")}</Standing>
  );
  return (
    <Dialog open={joinExpanded && joining} onOpenChange={setJoinExpanded}>
      <div
        className={`${PROJECTOR} relative flex h-dvh flex-col gap-[clamp(0.75rem,2.5dvh,32px)] overflow-hidden px-[clamp(1.5rem,4.5vw,88px)] pt-[clamp(1rem,4.5dvh,60px)] pb-[clamp(0.75rem,3.5dvh,48px)]`}
      >
        <ProjectorFit />
        {/* The wall names itself the way the dashboard and the phone do; on the
          projector the run's own eyebrow is where the room reads it. */}
        <h1 className="sr-only">{run.title}</h1>
        <Wall
          wall={wall}
          big
          eyebrow={run.title}
          carriesTo={carriesTo}
          sourceWall={sourceWall}
          scroll
          shelfAt="bottom"
          foot={room ?? undefined}
          empty={
            joining && !filling ? (
              <JoinCode
                audience="room"
                url={url}
                code={code}
                size="room"
                onExpand={() => setJoinExpanded(true)}
              />
            ) : undefined
          }
          className="min-h-0 flex-1 overflow-hidden"
        />
      </div>
      <DialogContent
        showCloseButton={false}
        aria-describedby="projector-join-description"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document
            .querySelector<HTMLButtonElement>("[data-join-expand]")
            ?.focus();
        }}
        className="h-dvh max-h-dvh max-w-none sm:max-w-none rounded-none border-0 flex flex-col items-center justify-center gap-5 overflow-y-auto p-8 data-[state=open]:animate-none data-[state=closed]:animate-none"
      >
        <DialogTitle className="text-center font-display text-3xl sm:text-5xl">
          {run.title}
        </DialogTitle>
        <DialogDescription id="projector-join-description" className="text-xl">
          Scan to join, or enter the code on your device.
        </DialogDescription>
        {url !== null && code !== null ? (
          <JoinCode audience="room" url={url} code={code} wall />
        ) : null}
        <Button
          size="lg"
          variant="outline"
          onClick={() => setJoinExpanded(false)}
        >
          Back to round
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** One word to the room, where the join block stands while there is one. */
function Standing({ children }: { children: string }) {
  return (
    <span className="flex-none font-display text-4xl text-muted-foreground leading-none">
      {children}
    </span>
  );
}

/** The wall the projector keeps facing the room once a round closes. */
function lastClosed(rounds: RelayRunRound[]): string | null {
  let latest: RelayRunRound | null = null;
  for (const round of rounds) {
    if (round.round === null || round.figure.open !== false) continue;
    if (
      latest === null ||
      (round.figure.closedAt ?? "") > (latest.figure.closedAt ?? "")
    )
      latest = round;
  }
  return latest?.round ?? null;
}
