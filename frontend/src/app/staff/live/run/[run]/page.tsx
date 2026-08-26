"use client";

import { ArrowLeft, Presentation, Radio, Square } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Link } from "@/components/link";
import { JoinCode, joinUrl } from "@/components/live/qr-code";
import { FormBadge } from "@/components/live/quiz-meta";
import {
  RunCount,
  RunQuestionBoard,
  RunScoreBoard,
  scoresOf,
} from "@/components/live/run-board";
import { PageContainer } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { api, isApiError, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fullTime } from "@/lib/format";

/** Fast enough that the room sees itself answer, slow enough to be polite. */
const POLL_MS = 3_000;

function RunDashboardContent() {
  const { run } = useParams<{ run: string }>();
  const { session } = useAuth();

  const { data, loading, error, refetch } = useQuery(
    session ? () => api["/live/runs/results"]({ run }).then(unwrap) : null,
    [session, run],
  );

  const board = data?.board ?? null;
  const scores = data === null ? null : scoresOf(data);
  const open = board?.open ?? false;

  // The board only moves while the run is open; a closed run is final, so the
  // polling stops rather than asking the same question forever.
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(refetch, POLL_MS);
    return () => clearInterval(timer);
  }, [open, refetch]);

  async function close() {
    const result = await api["/live/runs/close"]({ run });
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    toast.success("Run closed");
    refetch();
  }

  if (loading && data === null) {
    return (
      <PageContainer width="wide">
        <LoadingState label="Loading the board…" />
      </PageContainer>
    );
  }
  // A poll that fails mid-run must not blank the board the room is watching;
  // only a first load with nothing to show gives way to the error.
  if (error !== null && data === null) {
    return (
      <PageContainer width="wide">
        <ErrorState message={error} onRetry={refetch} />
      </PageContainer>
    );
  }
  if (board === null) {
    return (
      <PageContainer width="wide">
        <EmptyState
          icon={Radio}
          title="No such run"
          action={
            <Button size="sm" asChild>
              <Link href="/staff/live">Back to Live</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const url = board.token === null ? null : joinUrl(board.token);
  const code = board.code;

  return (
    <PageContainer width="wide">
      <header className="mb-8 border-b border-border pb-6">
        <Link
          href={`/staff/live/${board.questionnaire}`}
          className="eyebrow inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Back to the questionnaire
        </Link>
        <div className="mt-2 space-y-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <h1
              dir="auto"
              className="text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
            >
              {board.title}
            </h1>
            {open ? (
              <ConfirmAction
                trigger={
                  <Button size="lg" variant="destructive">
                    <Square /> Close run
                  </Button>
                }
                title="Close this run?"
                description="Nobody can join or hand in after this. The results stay."
                confirmLabel="Close run"
                destructive
                onConfirm={close}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FormBadge form={board.form} />
            {open ? (
              <Badge className="gap-1.5">
                <span className="inline-block size-2 animate-pulse rounded-full bg-primary-foreground" />
                Open
              </Badge>
            ) : (
              <Badge variant="outline">Closed</Badge>
            )}
            <span className="text-muted-foreground text-sm">
              Opened {fullTime(board.openedAt)}
              {board.closedAt !== null
                ? ` · closed ${fullTime(board.closedAt)}`
                : ""}
            </span>
          </div>
        </div>
      </header>

      {error !== null ? (
        <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-destructive text-sm">
          {error} Showing the last board that arrived.
        </p>
      ) : null}

      <div
        className={
          open ? "grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]" : "grid gap-8"
        }
      >
        <div className="order-2 space-y-6 lg:order-1">
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <RunCount label="Started" value={board.started} />
            <RunCount label="Handed in" value={board.handedIn} />
          </div>

          {scores !== null ? <RunScoreBoard scores={scores} /> : null}

          {board.questions.length === 0 ? (
            <p className="text-muted-foreground">No questions in this run.</p>
          ) : (
            board.questions.map((question, index) => (
              <RunQuestionBoard
                key={question.question}
                index={index}
                question={question}
                revealExpected={!open}
              />
            ))
          )}
        </div>

        {open ? (
          <aside className="order-1 lg:order-2">
            <div className="sticky top-6 space-y-4 rounded-xl border border-border bg-card p-5">
              <p className="eyebrow text-center">Join here</p>
              {url === null || code === null ? (
                <p className="text-center text-muted-foreground text-sm">
                  No join code.
                </p>
              ) : (
                <>
                  <JoinCode url={url} code={code} />
                  <Button variant="outline" className="w-full" asChild>
                    <Link
                      href={`/staff/live/run/${run}/project`}
                      target="_blank"
                    >
                      <Presentation /> Project
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </PageContainer>
  );
}

export default function RunDashboardPage() {
  return (
    <RequireCapability capability="live:host">
      <RunDashboardContent />
    </RequireCapability>
  );
}
