"use client";

import {
  ArrowLeft,
  Circle,
  CircleCheck,
  ClipboardList,
  History,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Link } from "@/components/link";
import {
  FormBadge,
  QUIZ_NOT_READY_MESSAGE,
  RETIRE_NOTE,
} from "@/components/live/quiz-meta";
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
import { fullTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Sheet = NonNullable<Output<"/live/quizzes/get">["questionnaire"]>;
type Provenance = Output<"/live/drafts/provenance">["provenance"];

/** Every drafting line behind the questionnaire, the one that composed it first. */
function draftingHistory(provenance: Provenance | null) {
  if (provenance === null) return [];
  return [
    ...provenance.composed.map((line) => ({
      brief: line.brief,
      createdAt: line.createdAt,
      label: "Drafted",
      status: line.abandoned ? "abandoned" : (null as string | null),
    })),
    ...provenance.refined.map((line) => ({
      brief: line.brief,
      createdAt: line.createdAt,
      label: "Refined",
      status: line.abandoned
        ? "abandoned"
        : line.adopted
          ? null
          : line.stalled
            ? "stalled"
            : "open",
    })),
  ];
}

function QuestionnaireOverviewContent() {
  const { questionnaire } = useParams<{ questionnaire: string }>();
  const { session } = useAuth();
  const [showHistory, setShowHistory] = useState(false);

  const { data, loading, error, refetch } = useQuery(
    session
      ? () => api["/live/quizzes/get"]({ questionnaire }).then(unwrap)
      : null,
    [session, questionnaire],
  );
  const { data: drafting } = useQuery(
    session
      ? () => api["/live/drafts/provenance"]({ questionnaire }).then(unwrap)
      : null,
    [session, questionnaire],
  );

  if (loading && data === null) {
    return (
      <PageContainer>
        <LoadingState label="Loading questionnaire…" />
      </PageContainer>
    );
  }
  if (error) {
    return (
      <PageContainer>
        <ErrorState message={error} onRetry={refetch} />
      </PageContainer>
    );
  }

  const sheet: Sheet | null = data?.questionnaire ?? null;
  if (sheet === null) {
    return (
      <PageContainer>
        <EmptyState
          icon={ClipboardList}
          title="No such questionnaire"
          action={
            <Button size="sm" asChild>
              <Link href="/staff/live">Back to Live</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const isQuiz = sheet.form === "quiz";
  const openRun = sheet.runs.find((run) => run.open) ?? null;
  const history = draftingHistory(drafting?.provenance ?? null);
  const answerable = sheet.questions.some(
    (question) =>
      question.choices.length > 0 && question.expected.trim() !== "",
  );
  const launchHint = sheet.retired
    ? "Retired."
    : sheet.questions.length === 0
      ? "Add a question first."
      : isQuiz && !answerable
        ? QUIZ_NOT_READY_MESSAGE
        : undefined;

  async function retire() {
    const result = await api["/live/quizzes/retire"]({ questionnaire });
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    refetch();
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <Link
            href="/staff/live"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Live
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {sheet.title}
            <FormBadge form={sheet.form} />
            {sheet.retired ? <Badge variant="outline">Retired</Badge> : null}
          </span>
        }
        actions={
          <>
            {sheet.retired ? null : (
              <Button variant="outline" asChild>
                <Link href={`/staff/live/${sheet.questionnaire}/edit`}>
                  Edit
                </Link>
              </Button>
            )}
            {openRun !== null ? (
              <Button asChild>
                <Link href={`/staff/live/run/${openRun.run}`}>Run</Link>
              </Button>
            ) : (
              <RunLaunchButton
                questionnaire={sheet.questionnaire}
                disabled={launchHint !== undefined}
                hint={launchHint}
              />
            )}
            {openRun === null && !sheet.retired ? (
              <ConfirmAction
                trigger={<Button variant="ghost">Retire</Button>}
                title={`Retire “${sheet.title}”?`}
                description={RETIRE_NOTE}
                confirmLabel="Retire"
                destructive
                onConfirm={retire}
              />
            ) : null}
          </>
        }
      />

      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">
            Questions{" "}
            <span className="font-normal text-muted-foreground">
              ({sheet.questions.length})
            </span>
          </h2>
          {sheet.questions.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No questions yet" />
          ) : (
            <ol className="space-y-2">
              {sheet.questions.map((question, index) => (
                <li
                  key={question.question}
                  className="rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex items-start gap-2 font-medium">
                    <span className="w-6 shrink-0 text-muted-foreground tabular-nums">
                      {index + 1}.
                    </span>
                    <p dir="auto" className="min-w-0 flex-1">
                      {question.prompt}
                    </p>
                  </div>
                  {question.choices.length > 0 ? (
                    <ul className="mt-2 space-y-1 ps-8">
                      {question.choices.map((choice) => {
                        const marked =
                          isQuiz &&
                          question.expected !== "" &&
                          choice === question.expected;
                        return (
                          <li
                            key={choice}
                            className={cn(
                              "flex items-start gap-2 text-sm",
                              marked
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {marked ? (
                              <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                            ) : (
                              <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            )}
                            <span dir="auto">{choice}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Runs</h2>
          {sheet.runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Never launched.</p>
          ) : (
            <ul className="space-y-2">
              {sheet.runs.map((run) => (
                <li key={run.run}>
                  <Link
                    href={`/staff/live/run/${run.run}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="text-sm">
                      Opened {fullTime(run.openedAt)}
                      {run.closedAt !== null
                        ? ` · closed ${fullTime(run.closedAt)}`
                        : ""}
                    </span>
                    {run.open ? <Badge>Open</Badge> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {history.length > 0 ? (
          <section>
            <button
              type="button"
              onClick={() => setShowHistory((shown) => !shown)}
              className="flex items-center gap-2 text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
            >
              <History className="size-4" />
              History ({history.length})
            </button>
            {showHistory ? (
              <ul className="mt-3 space-y-2">
                {history.map((line) => (
                  <li
                    key={line.brief}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 text-sm"
                  >
                    <span>{line.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {fullTime(line.createdAt)}
                    </span>
                    {line.status !== null ? (
                      <Badge variant="outline">{line.status}</Badge>
                    ) : null}
                    <Link
                      href={`/staff/live/draft?brief=${line.brief}`}
                      className="ml-auto text-muted-foreground text-xs hover:text-primary"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    </PageContainer>
  );
}

export default function QuestionnaireOverviewPage() {
  return (
    <RequireCapability capability="live:host">
      <QuestionnaireOverviewContent />
    </RequireCapability>
  );
}
