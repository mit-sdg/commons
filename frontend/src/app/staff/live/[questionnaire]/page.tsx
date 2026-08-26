"use client";

import {
  ArrowLeft,
  ClipboardList,
  History,
  Lock,
  Plus,
  Sparkles,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import {
  DISCLOSURE_OPTIONS,
  type Disclosure,
  FormBadge,
  isDisclosure,
  QUIZ_NOT_READY_MESSAGE,
  RUN_OPEN_MESSAGE,
} from "@/components/live/quiz-meta";
import {
  type EditableQuestion,
  type QuestionDraft,
  QuizQuestionEditor,
} from "@/components/live/quiz-question-editor";
import { RunLaunchButton } from "@/components/live/run-launch-button";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function report(result: unknown): boolean {
  if (!isApiError(result)) return true;
  toast.error(
    result.error === "CONFLICT"
      ? RUN_OPEN_MESSAGE
      : publicErrorMessage(result.error),
  );
  return false;
}

function QuestionnaireEditorContent() {
  const { questionnaire } = useParams<{ questionnaire: string }>();
  const { session } = useAuth();

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

  const sheet = data?.questionnaire ?? null;
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

  // Keyed on the questionnaire so moving between two of them starts a fresh
  // desk rather than carrying the last one's unsaved wording across.
  return (
    <QuestionnaireDesk
      key={sheet.questionnaire}
      sheet={sheet}
      provenance={drafting?.provenance ?? null}
      onChanged={refetch}
    />
  );
}

/** How often the desk re-reads while a run is open, so closing it elsewhere unlocks without a reload. */
const LOCK_POLL_MS = 5_000;

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

function QuestionnaireDesk({
  sheet,
  provenance,
  onChanged,
}: {
  sheet: Sheet;
  provenance: Provenance | null;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(sheet.title);
  const [disclosure, setDisclosure] = useState(sheet.disclosure);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const history = draftingHistory(provenance);
  // A question being written but not yet added: it lives here, never on the
  // server, so a placeholder can never ride into a run.
  const [adding, setAdding] = useState(false);
  const [dirtyQuestions, setDirtyQuestions] = useState<Set<string>>(
    () => new Set(),
  );

  const isQuiz = sheet.form === "quiz";
  const openRun = sheet.runs.find((run) => run.open) ?? null;
  const locked = openRun !== null || sheet.retired;
  const questions = sheet.questions;
  const runOpen = openRun !== null;
  const titleDirty = title.trim() !== sheet.title;
  const hasUnsavedChanges = titleDirty || adding || dirtyQuestions.size > 0;

  const questionDirty = useCallback((question: string, dirty: boolean) => {
    setDirtyQuestions((standing) => {
      const next = new Set(standing);
      if (dirty) next.add(question);
      else next.delete(question);
      return next;
    });
  }, []);

  // Explicit saves make the boundary understandable, but leaving must not
  // silently discard the browser-held question or title draft.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const guardLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.href === window.location.href) return;
      if (!window.confirm("Leave without saving your changes?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const guardHistory = () => {
      if (!window.confirm("Leave without saving your changes?")) {
        window.history.forward();
      }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("popstate", guardHistory);
    document.addEventListener("click", guardLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("popstate", guardHistory);
      document.removeEventListener("click", guardLink, true);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!runOpen) return;
    const timer = setInterval(onChanged, LOCK_POLL_MS);
    return () => clearInterval(timer);
  }, [runOpen, onChanged]);

  // Only a choice question proposes an answer; a written reference grades nothing.
  const answerable = questions.some(
    (question) =>
      question.choices.length > 0 && question.expected.trim() !== "",
  );
  // While a run is open the actions slot offers the dashboard, never Launch,
  // so the ladder starts past that case.
  const launchHint = sheet.retired
    ? "Retired."
    : questions.length === 0
      ? "Add a question first."
      : isQuiz && !answerable
        ? QUIZ_NOT_READY_MESSAGE
        : busy || hasUnsavedChanges
          ? "Save changes before launching."
          : undefined;

  async function retitle() {
    const trimmed = title.trim();
    if (trimmed === "" || trimmed === sheet.title) return;
    setBusy(true);
    const result = await api["/live/quizzes/retitle"]({
      questionnaire: sheet.questionnaire,
      title: trimmed,
    });
    setBusy(false);
    if (report(result)) onChanged();
  }

  async function changeDisclosure(next: Disclosure) {
    const previous = disclosure;
    setDisclosure(next);
    setBusy(true);
    const result = await api["/live/quizzes/set-disclosure"]({
      questionnaire: sheet.questionnaire,
      disclosure: next,
    });
    setBusy(false);
    if (report(result)) onChanged();
    else setDisclosure(previous);
  }

  async function addQuestion(draft: QuestionDraft) {
    const result = await api["/live/quizzes/add-question"]({
      questionnaire: sheet.questionnaire,
      prompt: draft.prompt,
      choices: draft.choices,
      expected: draft.expected,
      explanation: draft.explanation,
    });
    if (!report(result)) return;
    setAdding(false);
    onChanged();
  }

  async function saveQuestion(
    question: EditableQuestion,
    draft: QuestionDraft,
  ) {
    const result = await api["/live/quizzes/revise-question"]({
      question: question.question,
      prompt: draft.prompt,
      choices: draft.choices,
      expected: draft.expected,
      explanation: draft.explanation,
    });
    if (report(result)) onChanged();
  }

  async function removeQuestion(question: EditableQuestion) {
    const result = await api["/live/quizzes/remove-question"]({
      question: question.question,
    });
    if (report(result)) onChanged();
  }

  async function moveQuestion(question: EditableQuestion, direction: -1 | 1) {
    const move =
      direction === -1
        ? api["/live/quizzes/raise-question"]
        : api["/live/quizzes/lower-question"];
    const result = await move({ question: question.question });
    if (report(result)) onChanged();
  }

  async function refine() {
    setBusy(true);
    const result = await api["/live/drafts/refine"]({
      questionnaire: sheet.questionnaire,
    });
    setBusy(false);
    if (isApiError(result)) {
      report(result);
      return;
    }
    router.push(`/staff/live/draft?brief=${result.brief}`);
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
          openRun !== null ? (
            <Button asChild>
              <Link href={`/staff/live/run/${openRun.run}`}>
                Open dashboard
              </Link>
            </Button>
          ) : (
            <RunLaunchButton
              questionnaire={sheet.questionnaire}
              disabled={launchHint !== undefined}
              hint={launchHint}
            />
          )
        }
      />

      {openRun !== null ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
          <Lock className="size-4 text-primary" />
          <p className="flex-1 text-sm">{RUN_OPEN_MESSAGE}</p>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/staff/live/run/${openRun.run}`}>Go to the run</Link>
          </Button>
        </div>
      ) : null}

      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2">
          {/* Without the quiz-only disclosure beside it, the title has the row. */}
          <div className={cn("space-y-2", !isQuiz && "sm:col-span-2")}>
            <Label htmlFor="sheet-title">Title</Label>
            <div className="flex items-center gap-2">
              <Input
                id="sheet-title"
                value={title}
                maxLength={200}
                aria-invalid={title.trim() === ""}
                disabled={locked || busy}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && title.trim() !== "") {
                    void retitle();
                  }
                }}
              />
              {title.trim() !== sheet.title && title.trim() !== "" ? (
                <Button
                  size="sm"
                  disabled={locked || busy}
                  onClick={() => void retitle()}
                >
                  Save
                </Button>
              ) : null}
            </div>
            {title.trim() === "" ? (
              <p className="text-xs text-destructive">Enter a title.</p>
            ) : null}
          </div>

          {isQuiz ? (
            <div className="space-y-2">
              <Label htmlFor="sheet-disclosure">
                What participants see afterward
              </Label>
              <Select
                value={disclosure}
                disabled={locked || busy || hasUnsavedChanges}
                onValueChange={(value) => {
                  if (isDisclosure(value)) void changeDisclosure(value);
                }}
              >
                <SelectTrigger id="sheet-disclosure" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCLOSURE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Changes reach only runs launched afterward.
              </p>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">
              Questions{" "}
              <span className="font-normal text-muted-foreground">
                ({questions.length})
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={locked || busy || hasUnsavedChanges}
                onClick={() => void refine()}
              >
                <Sparkles /> Refine with AI
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={locked || busy || adding || questions.length >= 100}
                onClick={() => setAdding(true)}
              >
                <Plus /> Add question
              </Button>
            </div>
          </div>

          {questions.length === 0 && !adding ? (
            <EmptyState icon={ClipboardList} title="No questions yet" />
          ) : (
            <div className="space-y-3">
              {questions.map((question, index) => (
                <QuizQuestionEditor
                  key={question.question}
                  index={index}
                  question={question}
                  isQuiz={isQuiz}
                  locked={locked || busy}
                  first={index === 0}
                  last={index === questions.length - 1}
                  onSave={(draft) => saveQuestion(question, draft)}
                  onRemove={() => removeQuestion(question)}
                  onMove={(direction) => moveQuestion(question, direction)}
                  onDirtyChange={(dirty) =>
                    questionDirty(question.question, dirty)
                  }
                />
              ))}
              {adding ? (
                <QuizQuestionEditor
                  key="new"
                  index={questions.length}
                  question={null}
                  isQuiz={isQuiz}
                  locked={locked || busy}
                  onSave={addQuestion}
                  onRemove={async () => setAdding(false)}
                  onDirtyChange={(dirty) => questionDirty("new", dirty)}
                />
              ) : null}
            </div>
          )}

          {isQuiz && questions.length > 0 && !answerable ? (
            <p className="text-sm text-destructive">{QUIZ_NOT_READY_MESSAGE}</p>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Runs</h2>
          {sheet.runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              This has never been launched.
            </p>
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
                    {run.open ? (
                      <Badge>Open</Badge>
                    ) : (
                      <Badge variant="outline">Closed</Badge>
                    )}
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

export default function QuestionnaireEditorPage() {
  return (
    <RequireCapability capability="live:host">
      <QuestionnaireEditorContent />
    </RequireCapability>
  );
}
