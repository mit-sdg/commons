"use client";

import { FileQuestion } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DraftDescribe } from "@/components/live/draft-describe";
import type { DraftLineStep } from "@/components/live/draft-step";
import { DraftStep } from "@/components/live/draft-step";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { api, isApiError, publicErrorMessage } from "@/lib/api";

/** The brief the author is drafting against, kept across a reload. */
const BRIEF_STORAGE_KEY = "commons-live-draft-brief";
/** How often the line is re-read while a reply is out with the reasoner. */
const POLL_INTERVAL_MS = 1500;
/** How long to watch for the questionnaire an adopted candidate composes. */
const ADOPT_WATCH_MS = 5000;
const ADOPT_WATCH_INTERVAL_MS = 500;

function readStoredBrief(): string | null {
  try {
    return window.sessionStorage.getItem(BRIEF_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredBrief(brief: string | null): void {
  try {
    if (brief === null) window.sessionStorage.removeItem(BRIEF_STORAGE_KEY);
    else window.sessionStorage.setItem(BRIEF_STORAGE_KEY, brief);
  } catch {
    // A browser that refuses session storage still drafts; only the resume
    // across a reload is lost.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * The tip is waiting when its request is out with the reasoner: no candidate
 * yet, not stalled, and no clarifying question left unanswered.
 */
function isWaiting(line: DraftLineStep[]): boolean {
  const tip = line.at(-1);
  if (!tip) return false;
  if (tip.stalled || tip.candidate !== null) return false;
  return !tip.clarifications.some((entry) => entry.answer === null);
}

function DraftPageContent() {
  const router = useRouter();
  const [brief, setBrief] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [line, setLine] = useState<DraftLineStep[]>([]);
  const [lineError, setLineError] = useState<string | null>(null);
  const [loadingLine, setLoadingLine] = useState(false);
  const [pollNonce, setPollNonce] = useState(0);
  const [describing, setDescribing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [adoptNote, setAdoptNote] = useState<string | null>(null);

  // A brief kept in session storage means a reload resumes the same line
  // rather than starting the author over.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- resuming a stored brief runs once on mount */
    setBrief(readStoredBrief());
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // One self-scheduling loop per brief: read the line, and keep reading while
  // the tip is waiting on the reasoner. Every action bumps the nonce, which
  // restarts the loop with a fresh read.
  useEffect(() => {
    if (brief === null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      const result = await api["/live/drafts/line"]({ brief });
      if (cancelled) return;
      if (isApiError(result)) {
        setLineError(publicErrorMessage(result.error));
        setLoadingLine(false);
        return;
      }
      setLineError(null);
      setLine(result.line);
      setLoadingLine(false);
      if (isWaiting(result.line)) timer = setTimeout(run, POLL_INTERVAL_MS);
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect -- the loop's first read is starting
    setLoadingLine(true);
    void run();

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [brief, pollNonce]);

  const resumePolling = useCallback(() => {
    setPollNonce((nonce) => nonce + 1);
  }, []);

  const startNewDraft = useCallback(() => {
    writeStoredBrief(null);
    setBrief(null);
    setLine([]);
    setLineError(null);
    setAdoptNote(null);
    setLoadingLine(false);
  }, []);

  const describe = useCallback(async (request: string) => {
    setDescribing(true);
    const result = await api["/live/drafts/describe"]({ request });
    setDescribing(false);
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    writeStoredBrief(result.brief);
    setLine([]);
    setLineError(null);
    setAdoptNote(null);
    setBrief(result.brief);
  }, []);

  const clarify = useCallback(
    async (clarification: string, answer: string) => {
      setBusy(true);
      const result = await api["/live/drafts/clarify"]({
        clarification,
        answer,
      });
      setBusy(false);
      if (isApiError(result)) {
        toast.error(publicErrorMessage(result.error));
        return;
      }
      resumePolling();
    },
    [resumePolling],
  );

  const correct = useCallback(
    async (candidate: string, request: string) => {
      setBusy(true);
      const result = await api["/live/drafts/correct"]({ candidate, request });
      setBusy(false);
      if (isApiError(result)) {
        toast.error(publicErrorMessage(result.error));
        return;
      }
      resumePolling();
    },
    [resumePolling],
  );

  // Adoption composes a questionnaire a moment later, so the page watches the
  // quizzes list for one that was not there before and opens it.
  const adopt = useCallback(
    async (candidate: string) => {
      setAdopting(true);
      setAdoptNote(null);

      const before = await api["/live/quizzes/list"]({});
      const known = new Set(
        isApiError(before)
          ? []
          : before.questionnaires.map((entry) => entry.questionnaire),
      );

      const adopted = await api["/live/drafts/adopt"]({ candidate });
      if (isApiError(adopted)) {
        setAdopting(false);
        toast.error(publicErrorMessage(adopted.error));
        resumePolling();
        return;
      }

      const deadline = Date.now() + ADOPT_WATCH_MS;
      while (Date.now() < deadline) {
        const listed = await api["/live/quizzes/list"]({});
        if (!isApiError(listed)) {
          const fresh = listed.questionnaires.find(
            (entry) => !known.has(entry.questionnaire),
          );
          if (fresh) {
            toast.success("Draft adopted");
            router.push(`/staff/live/${fresh.questionnaire}`);
            return;
          }
        }
        await sleep(ADOPT_WATCH_INTERVAL_MS);
      }

      setAdopting(false);
      setAdoptNote(
        "The draft was adopted. Its questionnaire is still being composed — it will appear on the quizzes page shortly.",
      );
      resumePolling();
    },
    [resumePolling, router],
  );

  const tip = line.at(-1) ?? null;
  const waiting = isWaiting(line);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Live"
        title="Draft with the reasoner"
        description="Describe the quiz or survey you want. The reasoner drafts it whole; you correct it in plain language and adopt it when it reads right."
        actions={
          brief !== null ? (
            <Button variant="outline" onClick={startNewDraft}>
              Start a new draft
            </Button>
          ) : null
        }
      />

      {!restored ? (
        <LoadingState label="Loading…" />
      ) : brief === null ? (
        <DraftDescribe submitting={describing} onSubmit={describe} />
      ) : loadingLine && line.length === 0 ? (
        <LoadingState label="Reading the drafting line…" />
      ) : lineError !== null && line.length === 0 ? (
        <ErrorState message={lineError} onRetry={resumePolling} />
      ) : line.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="That draft is no longer available"
          description="The brief this page was resuming has gone. Describe what you want and the reasoner will draft it again."
          action={<Button onClick={startNewDraft}>Start a new draft</Button>}
        />
      ) : (
        <div className="space-y-8">
          {lineError !== null ? (
            <p
              role="status"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {lineError}
            </p>
          ) : null}

          {line.map((step, index) => (
            <DraftStep
              key={step.step}
              step={step}
              position={index + 1}
              isTip={step.step === tip?.step}
              waiting={waiting}
              busy={busy}
              adopting={adopting}
              onClarify={clarify}
              onCorrect={correct}
              onAdopt={adopt}
              onStartOver={startNewDraft}
            />
          ))}

          {adoptNote !== null ? (
            <p
              role="status"
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            >
              {adoptNote}
            </p>
          ) : null}
        </div>
      )}
    </PageContainer>
  );
}

export default function DraftPage() {
  return (
    <RequireCapability capability="live:host">
      <DraftPageContent />
    </RequireCapability>
  );
}
