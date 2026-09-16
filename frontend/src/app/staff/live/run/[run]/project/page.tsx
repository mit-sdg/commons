"use client";

import { Radio } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Facts } from "@/components/facts";
import { JoinCode, joinUrl } from "@/components/live/qr-code";
import { marksExpected, QuizResults } from "@/components/live/quiz-projector";
import { modelCounts, scoresOf } from "@/components/live/run-board";
import { RelayProjector } from "@/components/live/run-relay-projector";
import { RequireCapability } from "@/components/require-capability";
import { SignInEnded } from "@/components/sign-in-ended";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useQuery } from "@/hooks/use-query";
import { api, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { outOfReach, POLL_DEADLINE_MS } from "@/lib/poll";
import { cn } from "@/lib/utils";

/** The wall keeps pace with the room the same way the dashboard does. */
const POLL_MS = 3_000;

/**
 * The room can act on nothing, so a projector that has nothing to show yet
 * keeps reading on the cadence rather than offering a Retry.
 */
function useKeepReading(read: boolean, refetch: () => void) {
  useEffect(() => {
    if (!read) return;
    const timer = setInterval(refetch, POLL_MS);
    return () => clearInterval(timer);
  }, [read, refetch]);
}

/** A declared refusal is an answer, and the one thing the projector says in place of a wall. */
function refusedOutright(refused: string | null): boolean {
  return refused !== null && !outOfReach({ error: refused });
}

function Quiet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      {children}
    </div>
  );
}

/** A relay run projects its wall; anything else projects the join page below. */
function ProjectorContent() {
  const { run } = useParams<{ run: string }>();
  const { session } = useAuth();

  const { data, error, refused, refetch } = useQuery(
    session
      ? () =>
          api["/live/relays/run"](
            { run },
            { timeoutMs: POLL_DEADLINE_MS },
          ).then(unwrap)
      : null,
    [session, run],
    { retainOnTransportError: true },
  );

  const relayRun = data?.run ?? null;
  // A sign-in that ended is said once, in a corner, with the way back in; the
  // wall stays up for the room, since it belongs to the run.
  const ended = refused === "UNAUTHORIZED";
  const refusedRun = !ended && refusedOutright(refused);
  useKeepReading(data === null && !ended && !refusedRun, refetch);

  if (data === null) {
    return (
      <Quiet>
        {refusedRun && error !== null ? (
          <ErrorState message={error} refused={refused} />
        ) : (
          <LoadingState label="Loading…" />
        )}
      </Quiet>
    );
  }
  const notice = ended ? (
    <div className="fixed top-4 left-4 z-50 max-w-sm">
      <SignInEnded next={`/staff/live/run/${run}/project`} />
    </div>
  ) : null;
  if (relayRun !== null)
    return (
      <>
        {notice}
        <RelayProjector run={relayRun} refetch={refetch} />
      </>
    );
  return (
    <>
      {notice}
      <QuizProjector />
    </>
  );
}

function QuizProjector() {
  const { run } = useParams<{ run: string }>();
  const { session } = useAuth();

  const { data, error, refused, refetch } = useQuery(
    session
      ? () =>
          api["/live/runs/results"](
            { run },
            { timeoutMs: POLL_DEADLINE_MS },
          ).then(unwrap)
      : null,
    [session, run],
    { retainOnTransportError: true },
  );

  const board = data?.board ?? null;
  const open = board?.open ?? false;
  const refusedBoard = refused !== "UNAUTHORIZED" && refusedOutright(refused);
  useKeepReading((data === null && !refusedBoard) || open, refetch);

  if (data === null) {
    return (
      <Quiet>
        {refusedBoard && error !== null ? (
          <ErrorState message={error} refused={refused} />
        ) : (
          <LoadingState label="Loading…" />
        )}
      </Quiet>
    );
  }

  if (board === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <EmptyState icon={Radio} title="No such run" />
      </div>
    );
  }

  const url = board.token === null ? null : joinUrl(board.token);
  const code = board.code;
  const model = modelCounts(board.modelResponses);
  const scores = data === null ? null : scoresOf(data);
  const markExpected = scores !== null && marksExpected(scores.disclosure);
  const results = !open && board.questions.length > 0;

  return (
    <div className="relative flex h-dvh flex-col items-center justify-center gap-[clamp(0.75rem,2.5dvh,2rem)] overflow-hidden px-6 py-[clamp(1rem,3dvh,2.5rem)] text-center">
      <h1
        dir="auto"
        className={cn(
          "text-balance font-display font-semibold tracking-tight",
          results
            ? "text-[clamp(1.5rem,4dvh,3rem)]"
            : "text-4xl sm:text-5xl lg:text-6xl",
        )}
      >
        {board.title}
      </h1>
      {results ? (
        <QuizResults
          questions={board.questions}
          modelResponses={board.modelResponses}
          markExpected={markExpected}
        />
      ) : !open ? (
        <p className="text-2xl text-muted-foreground">Closed</p>
      ) : url === null || code === null ? (
        <p className="text-2xl text-muted-foreground">Nothing to project</p>
      ) : (
        <>
          <JoinCode audience="room" url={url} code={code} wall />
          <Facts className="justify-center text-lg sm:text-2xl">
            <span>{board.started - model.begun} joined</span>
            <span>{board.handedIn - model.handedIn} handed in</span>
          </Facts>
        </>
      )}
    </div>
  );
}

export default function ProjectorPage() {
  return (
    <RequireCapability capability="live:host">
      <ProjectorContent />
    </RequireCapability>
  );
}
