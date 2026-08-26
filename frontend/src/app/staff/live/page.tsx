"use client";

import { Archive, ClipboardList, Pencil, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Link } from "@/components/link";
import { FormBadge } from "@/components/live/quiz-meta";
import { RunLaunchButton } from "@/components/live/run-launch-button";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import {
  api,
  isApiError,
  type Output,
  publicErrorMessage,
  unwrap,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fullTime, relativeTime } from "@/lib/format";

type Shelved = Output<"/live/quizzes/list">["questionnaires"][number];
type OpenRun = Output<"/live/runs/open">["runs"][number];

function LiveShelfContent() {
  const { session } = useAuth();
  const [showRetired, setShowRetired] = useState(false);

  const {
    data: shelf,
    loading,
    error,
    refetch,
  } = useQuery(
    session ? () => api["/live/quizzes/list"]({}).then(unwrap) : null,
    [session],
  );
  const { data: live, refetch: refetchLive } = useQuery(
    session ? () => api["/live/runs/open"]({}).then(unwrap) : null,
    [session],
  );

  const questionnaires = shelf?.questionnaires ?? [];
  const standing = questionnaires.filter((entry) => !entry.retired);
  const retired = questionnaires.filter((entry) => entry.retired);
  const openRuns = live?.runs ?? [];

  async function retire(questionnaire: string) {
    const result = await api["/live/quizzes/retire"]({ questionnaire });
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    toast.success("Moved out of use");
    refetch();
    refetchLive();
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Live"
        title="Quizzes and surveys"
        description="Compose a questionnaire, launch it into the room, and watch the answers land."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/staff/live/draft">
                <Sparkles /> Draft with AI
              </Link>
            </Button>
            <Button asChild>
              <Link href="/staff/live/new">
                <Plus /> New quiz or survey
              </Link>
            </Button>
          </>
        }
      />

      {openRuns.length > 0 ? (
        <section className="mb-8 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="eyebrow mb-3 flex items-center gap-2 text-primary">
            <span className="inline-block size-2 animate-pulse rounded-full bg-primary" />
            Live now
          </p>
          <ul className="space-y-2">
            {openRuns.map((run: OpenRun) => (
              <li
                key={run.run}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{run.title}</p>
                  <p className="text-muted-foreground text-xs">
                    Opened {relativeTime(run.openedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <FormBadge form={run.form} />
                  <Button size="sm" asChild>
                    <Link href={`/staff/live/run/${run.run}`}>
                      Open dashboard
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loading && shelf === null ? (
        <LoadingState label="Loading quizzes and surveys…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : questionnaires.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nothing composed yet"
          description="A quiz grades what the room answers; a survey only gathers it. Start either one here."
          action={
            <Button size="sm" asChild>
              <Link href="/staff/live/new">
                <Plus /> New quiz or survey
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {standing.map((entry) => (
            <ShelfRow
              key={entry.questionnaire}
              entry={entry}
              onRetire={() => retire(entry.questionnaire)}
            />
          ))}
          {standing.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Everything on the shelf has been retired.
            </p>
          ) : null}
        </div>
      )}

      {retired.length > 0 ? (
        <section className="mt-8">
          <button
            type="button"
            onClick={() => setShowRetired((shown) => !shown)}
            className="flex items-center gap-2 text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
          >
            <Archive className="size-4" />
            {showRetired ? "Hide" : "Show"} retired ({retired.length})
          </button>
          {showRetired ? (
            <div className="mt-3 space-y-2 opacity-60">
              {retired.map((entry) => (
                <ShelfRow key={entry.questionnaire} entry={entry} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </PageContainer>
  );
}

function ShelfRow({
  entry,
  onRetire,
}: {
  entry: Shelved;
  onRetire?: () => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/staff/live/${entry.questionnaire}`}
            className="font-medium hover:text-primary"
          >
            {entry.title}
          </Link>
          <FormBadge form={entry.form} />
          {entry.retired ? <Badge variant="outline">Retired</Badge> : null}
          {entry.openRun !== null ? (
            <Badge variant="secondary">Run open</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-muted-foreground text-xs">
          Created {fullTime(entry.createdAt)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/staff/live/${entry.questionnaire}`}>
            <Pencil /> Edit
          </Link>
        </Button>

        {entry.openRun !== null ? (
          <Button size="sm" asChild>
            <Link href={`/staff/live/run/${entry.openRun}`}>View run</Link>
          </Button>
        ) : entry.retired ? null : (
          <RunLaunchButton
            questionnaire={entry.questionnaire}
            size="sm"
            variant="outline"
          />
        )}

        {onRetire && entry.openRun === null ? (
          <ConfirmAction
            trigger={
              <Button variant="ghost" size="sm">
                <Archive /> Retire
              </Button>
            }
            title={`Retire "${entry.title}"?`}
            description="It moves out of use and can no longer be launched or edited. Past runs and their answers stay readable."
            confirmLabel="Retire"
            destructive
            onConfirm={onRetire}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function LiveShelfPage() {
  return (
    <RequireCapability capability="live:host">
      <LiveShelfContent />
    </RequireCapability>
  );
}
