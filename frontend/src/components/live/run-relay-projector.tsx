"use client";

import { useEffect, useState } from "react";
import { PROJECTOR, ProjectorFit } from "@/components/live/projector-fit";
import { JoinCode, joinUrl } from "@/components/live/qr-code";
import { refusalSentence } from "@/components/live/refusals";
import {
  choicesOf,
  type RelayRun,
  type RelayRunRound,
  type Wall as WallShape,
} from "@/components/live/rounds";
import { modelSilent } from "@/components/live/run-relay-board";
import { Wall } from "@/components/live/wall";
import { LoadingState } from "@/components/states";
import { useQuery } from "@/hooks/use-query";
import { api, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** The wall keeps pace with the room the same way the dashboard does. */
const POLL_MS = 3_000;

/** How many polls in a row have to go unanswered before the room is told. */
const MISSES = 2;

/**
 * The relay run on the projector: the wall of the open round, full screen,
 * with the join code in the corner. Before the first round it is the title
 * and the code; between rounds and once the run has ended the wall stands,
 * and the word for where the room is takes the join block's place. The shelf
 * of unsorted cards stands in the bottom row beside the code, so the piles
 * take the middle of the screen whole.
 */
export function RelayProjector({
  run,
  refetch,
  ended = false,
}: {
  run: RelayRun;
  refetch: () => void;
  /** The page's sign-in ended: it says so once; the wall says nothing else. */
  ended?: boolean;
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

  // When the wall was last answered, which only an answer moves.
  const [answeredAt, setAnsweredAt] = useState(() => Date.now());
  const { data: wallData, refetch: refetchWall } = useQuery(
    session && shownRound !== null
      ? () =>
          api["/live/walls/read"]({ round: shownRound })
            .then(unwrap)
            .then((read) => {
              setAnsweredAt(Date.now());
              return read;
            })
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

  // A failure is only worth saying while the room would still be waiting on
  // it, so the clock it is read against moves with the poll.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!run.open) return;
    const timer = setInterval(() => setNow(Date.now()), POLL_MS);
    return () => clearInterval(timer);
  }, [run.open]);

  // One poll that does not come back is a hiccup; two in a row is the room
  // being shown a wall that has stopped moving. The clock above is what
  // notices, so the answer that comes back clears it on its own.
  const gone = run.open && now - answeredAt >= MISSES * POLL_MS;

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
          <Standing>{refusalSentence("CLOSED")}</Standing>
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
  // as during one; the wall's own token says which round closed. On every
  // round, until its first pile opens, the code stands where the piles will —
  // that is the joining moment, and it comes round again each time; after
  // that it keeps the corner.
  const joining = run.open && url !== null && code !== null;
  const filling =
    !wall.open || wall.piles.length > 0 || choicesOf(wall).length > 0;
  const room = joining ? (
    filling ? (
      <JoinCode url={url} code={code} size="corner" />
    ) : null
  ) : (
    <Standing>{refusalSentence("CLOSED")}</Standing>
  );
  // Why the wall is not moving, in the words the dashboard uses. A wall that
  // is not reaching the server at all is said before anything read off it.
  const word = ended
    ? null
    : gone
      ? "No connection."
      : modelSilent(wall, now)
        ? "The model is not answering."
        : null;

  return (
    <div
      className={`${PROJECTOR} flex h-dvh flex-col gap-[clamp(0.75rem,2.5dvh,32px)] overflow-hidden px-[clamp(1.5rem,4.5vw,88px)] pt-[clamp(1rem,4.5dvh,60px)] pb-[clamp(0.75rem,3.5dvh,48px)]`}
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
            <JoinCode url={url} code={code} size="room" />
          ) : undefined
        }
        className="min-h-0 flex-1 overflow-hidden"
      />
      {word === null ? null : (
        <span
          role="status"
          className="flex-none text-muted-foreground text-xl leading-none"
        >
          {word}
        </span>
      )}
    </div>
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
