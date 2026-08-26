"use client";

import { Radio } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { JoinCode, joinUrl } from "@/components/live/qr-code";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, LoadingState } from "@/components/states";
import { useQuery } from "@/hooks/use-query";
import { api, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** The wall keeps pace with the room the same way the dashboard does. */
const POLL_MS = 3_000;

/**
 * The projected join page: the title, the code, the address, and how many are
 * in. Everything else — answers, scores, controls — stays on the dashboard,
 * so this screen can face the room.
 */
function ProjectorContent() {
  const { run } = useParams<{ run: string }>();
  const { session } = useAuth();

  const { data, loading, refetch } = useQuery(
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

  if (board === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <EmptyState icon={Radio} title="No such run" />
      </div>
    );
  }

  const url = board.token === null ? null : joinUrl(board.token);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10 text-center sm:gap-10">
      <h1
        dir="auto"
        className="text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
      >
        {board.title}
      </h1>
      {!open ? (
        <p className="text-2xl text-muted-foreground">Closed</p>
      ) : url === null ? (
        <p className="text-2xl text-muted-foreground">Nothing to project</p>
      ) : (
        <>
          <JoinCode url={url} wall />
          <p className="text-xl text-muted-foreground sm:text-2xl">
            {board.started} joined · {board.handedIn} handed in
          </p>
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
