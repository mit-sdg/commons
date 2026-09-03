"use client";

import { useEffect } from "react";
import { JoinCode, joinUrl } from "@/components/live/qr-code";
import {
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
 * and the code; after the run closes it is the last wall.
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
    [session, run.relay],
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

  const { data: wallData, refetch: refetchWall } = useQuery(
    session && shownRound !== null
      ? () => api["/live/walls/read"]({ round: shownRound }).then(unwrap)
      : null,
    [session, shownRound],
  );
  const { data: sourceData } = useQuery(
    session && sourceRound !== null
      ? () => api["/live/walls/read"]({ round: sourceRound }).then(unwrap)
      : null,
    [session, sourceRound],
  );

  const wall: WallShape | null = wallData?.wall ?? null;
  const sourceWall: WallShape | null = sourceData?.wall ?? null;
  const openRound = run.openRound;

  useEffect(() => {
    if (!run.open) return;
    const timer = setInterval(refetch, POLL_MS);
    return () => clearInterval(timer);
  }, [run.open, refetch]);

  useEffect(() => {
    if (openRound === null) return;
    const timer = setInterval(refetchWall, POLL_MS);
    return () => clearInterval(timer);
  }, [openRound, refetchWall]);

  const url = run.token === null ? null : joinUrl(run.token);
  const code = run.code;

  if (run.open && openRound === null && closedRound === null) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-[clamp(0.75rem,3dvh,2.5rem)] overflow-hidden px-12 py-12 text-center">
        <h1
          dir="auto"
          className="text-balance font-display font-semibold text-5xl tracking-tight lg:text-7xl"
        >
          {run.title}
        </h1>
        {url === null || code === null ? null : (
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

  return (
    <div className="flex h-dvh flex-col gap-9 overflow-hidden px-[clamp(1.5rem,4.5vw,88px)] py-[clamp(1.5rem,6dvh,64px)]">
      <Wall
        wall={wall}
        big
        eyebrow={run.title}
        sourceWall={sourceWall}
        className="min-h-0 flex-1 overflow-hidden"
      />
      {run.open && url !== null && code !== null ? (
        <div className="flex flex-none justify-end">
          <div className="w-52 flex-none">
            <JoinCode url={url} code={code} />
          </div>
        </div>
      ) : null}
    </div>
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
