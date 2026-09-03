"use client";

import { useEffect } from "react";
import { JoinCode, joinUrl } from "@/components/live/qr-code";
import {
  choicesOf,
  type RelayRun,
  type RelayRunRound,
  type Wall as WallShape,
} from "@/components/live/rounds";
import { Wall } from "@/components/live/wall";
import { LoadingState } from "@/components/states";
import { useQuery } from "@/hooks/use-query";
import { api, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** The wall keeps pace with the room the same way the dashboard does. */
const POLL_MS = 3_000;

/**
 * The relay run on the projector: the wall of the open round, full screen,
 * with the join code in the corner. Before the first round it is the title
 * and the code; between rounds and once the run has ended the wall stands,
 * and the word for where the room is takes the join block's place.
 */
export function RelayProjector({
  run,
  refetch,
}: {
  run: RelayRun;
  refetch: () => void;
}) {
  const { session } = useAuth();

  const { data: relayData } = useQuery(
    session
      ? () => api["/live/relays/get"]({ relay: run.relay }).then(unwrap)
      : null,
    [session, run.relay, run],
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
      ? () => api["/live/walls/read"]({ round: shownRound }).then(unwrap)
      : null,
    [session, shownRound, run.openRound],
  );
  const { data: sourceData } = useQuery(
    session && sourceRound !== null
      ? () => api["/live/walls/read"]({ round: sourceRound }).then(unwrap)
      : null,
    [session, sourceRound],
  );

  const wall: WallShape | null = wallData?.wall ?? null;
  const sourceWall: WallShape | null = sourceData?.wall ?? null;

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

  const url = run.token === null ? null : joinUrl(run.token);
  const code = run.code;

  if (shownRound === null) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-[clamp(0.75rem,3dvh,2.5rem)] overflow-hidden px-12 py-12 text-center">
        <h1
          dir="auto"
          className="text-balance font-display font-semibold text-5xl tracking-tight lg:text-7xl"
        >
          {run.title}
        </h1>
        {!run.open ? (
          <Standing>The run is closed.</Standing>
        ) : url === null || code === null ? null : (
          <JoinCode url={url} code={code} wall />
        )}
      </div>
    );
  }

  if (wall === null) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <LoadingState label="Loading the wall…" />
      </div>
    );
  }

  // The room can join for as long as the run is open, between rounds as much
  // as during one; the wall's own token says which round closed. Until the
  // first pile opens the code stands where the piles will; after that it
  // keeps the corner.
  const joining = run.open && url !== null && code !== null;
  const filling =
    !wall.open || wall.piles.length > 0 || choicesOf(wall).length > 0;

  return (
    <div className="flex h-dvh flex-col gap-9 overflow-hidden px-[clamp(1.5rem,4.5vw,88px)] py-[clamp(1.5rem,6dvh,64px)]">
      <Wall
        wall={wall}
        big
        eyebrow={run.title}
        carriesTo={carriesTo}
        sourceWall={sourceWall}
        scroll
        empty={
          joining ? <JoinCode url={url} code={code} size="room" /> : undefined
        }
        className="min-h-0 flex-1 overflow-hidden"
      />
      {joining ? (
        filling ? (
          <div className="flex flex-none justify-end">
            <JoinCode url={url} code={code} size="corner" />
          </div>
        ) : null
      ) : (
        <Standing>The run is closed.</Standing>
      )}
    </div>
  );
}

/** One word to the room, where the join block stands while there is one. */
function Standing({ children }: { children: string }) {
  return (
    <span className="flex-none font-display text-[40px] text-muted-foreground leading-none">
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
