"use client";

import { Radio } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { JoinCode, joinUrl } from "@/components/live/qr-code";
import { RelayProjector } from "@/components/live/run-relay-projector";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useQuery } from "@/hooks/use-query";
import { api, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** The wall keeps pace with the room the same way the dashboard does. */
const POLL_MS = 3_000;

/** A relay run projects its wall; anything else projects the join page below. */
function ProjectorContent() {
  const { run } = useParams<{ run: string }>();
  const { session } = useAuth();

  const { data, loading, error, refetch } = useQuery(
    session ? () => api["/live/relays/run"]({ run }).then(unwrap) : null,
    [session, run],
  );

  const relayRun = data?.run ?? null;

  if (loading && data === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingState label="Loading…" />
      </div>
    );
  }
  if (error !== null && data === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }
  if (relayRun !== null)
    return <RelayProjector run={relayRun} refetch={refetch} />;
  return <QuizProjector />;
}

function QuizProjector() {
  const { run } = useParams<{ run: string }>();
  const { session } = useAuth();

  const { data, loading, error, refetch } = useQuery(
    session ? () => api["/live/runs/results"]({ run }).then(unwrap) : null,
    [session, run],
  );

  const board = data?.board ?? null;
  const open = board?.open ?? false;

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(refetch, POLL_MS);
    return () => clearInterval(timer);
  }, [open, refetch]);

  if (loading && data === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingState label="Loading…" />
      </div>
    );
  }

  if (error !== null && data === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <ErrorState message={error} onRetry={refetch} />
      </div>
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

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-[clamp(0.75rem,2.5dvh,2rem)] overflow-hidden px-6 py-[clamp(1rem,3dvh,2.5rem)] text-center">
      <h1
        dir="auto"
        className="text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
      >
        {board.title}
      </h1>
      {!open ? (
        <p className="text-2xl text-muted-foreground">Closed</p>
      ) : url === null || code === null ? (
        <p className="text-2xl text-muted-foreground">Nothing to project</p>
      ) : (
        <>
          <JoinCode url={url} code={code} wall />
          <p className="text-lg text-muted-foreground sm:text-2xl">
            {board.started} joined · {board.handedIn} handed in
          </p>
          {error !== null ? (
            <p className="text-amber-700 text-sm dark:text-amber-300">
              No connection.
            </p>
          ) : null}
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
