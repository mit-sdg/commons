"use client";

import { ArrowLeft, ClipboardList, Lock, Plus, Sparkles } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import {
  DISCLOSURE_OPTIONS,
  type Disclosure,
  disclosureHint,
  FormBadge,
  isDisclosure,
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

type Sheet = NonNullable<Output<"/live/quizzes/get">["questionnaire"]>;

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
          description="It may have been removed, or the address may be wrong."
          action={
            <Button size="sm" asChild>
              <Link href="/staff/live">Back to the shelf</Link>
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
      onChanged={refetch}
    />
  );
}

/** How often the desk re-reads while a run is open, so closing it elsewhere unlocks without a reload. */
const LOCK_POLL_MS = 5_000;

function QuestionnaireDesk({
  sheet,
  onChanged,
}: {
  sheet: Sheet;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(sheet.title);
  const [disclosure, setDisclosure] = useState(sheet.disclosure);
  const [busy, setBusy] = useState(false);

  const isQuiz = sheet.form === "quiz";
  const openRun = sheet.runs.find((run) => run.open) ?? null;
  const locked = openRun !== null || sheet.retired;
  const questions = sheet.questions;
  const runOpen = openRun !== null;

  useEffect(() => {
    if (!runOpen) return;
    const timer = setInterval(onChanged, LOCK_POLL_MS);
    return () => clearInterval(timer);
  }, [runOpen, onChanged]);

  const answerable = questions.some(
    (question) => question.expected.trim() !== "",
  );
  const launchHint =
    openRun !== null
      ? "A run of this questionnaire is already open."
      : sheet.retired
        ? "This questionnaire is retired."
        : questions.length === 0
          ? "Add a question first."
          : isQuiz && !answerable
            ? "A quiz launches only once at least one question has an expected answer."
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

  async function addQuestion() {
    setBusy(true);
    const result = await api["/live/quizzes/add-question"]({
      questionnaire: sheet.questionnaire,
      prompt: "New question",
      choices: [],
      expected: "",
      explanation: "",
    });
    setBusy(false);
    if (report(result)) onChanged();
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
          <p className="flex-1 text-sm">
            A run is open — editing is disabled so the room never meets a
            questionnaire that moved under it.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/staff/live/run/${openRun.run}`}>Go to the run</Link>
          </Button>
        </div>
      ) : sheet.retired ? (
        <div className="mb-6 rounded-xl border border-border bg-muted/40 px-4 py-3 text-muted-foreground text-sm">
          This questionnaire is retired. It stays readable, but it can no longer
          be edited or launched.
        </div>
      ) : null}

      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sheet-title">Title</Label>
            <div className="flex items-center gap-2">
              <Input
                id="sheet-title"
                value={title}
                disabled={locked || busy}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => void retitle()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
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
          </div>

          {isQuiz ? (
            <div className="space-y-2">
              <Label htmlFor="sheet-disclosure">
                What participants see after
              </Label>
              <Select
                value={disclosure}
                disabled={locked || busy}
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
                {disclosureHint(disclosure)}
              </p>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">
              Questions{" "}
              <span className="font-normal text-muted-foreground">
                ({questions.length})
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={locked || busy}
                onClick={() => void refine()}
              >
                <Sparkles /> Refine with the reasoner
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={locked || busy}
                onClick={() => void addQuestion()}
              >
                <Plus /> Add question
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No questions yet"
              description={
                isQuiz
                  ? "A quiz launches once at least one question carries an expected answer."
                  : "Add the first thing you want to ask the room."
              }
            />
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
                />
              ))}
            </div>
          )}

          {isQuiz && questions.length > 0 && !answerable ? (
            <p className="text-sm text-destructive">
              No question has an expected answer yet, so this quiz cannot be
              launched.
            </p>
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
