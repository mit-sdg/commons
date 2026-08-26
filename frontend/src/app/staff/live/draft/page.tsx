"use client";

import { FileQuestion } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
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
/** How often, and how many times, the line is re-read after adoption while its questionnaire composes. */
const ADOPT_READS = 10;
const ADOPT_READ_INTERVAL_MS = 300;

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
  const searchParams = useSearchParams();
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

  // A brief named in the address (the refine entry from a questionnaire's
  // desk) takes the line over; otherwise session storage means a reload
  // resumes the same line rather than starting the author over.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- resuming a brief runs once on mount */
    const named = searchParams.get("brief");
    if (named !== null) writeStoredBrief(named);
    setBrief(named ?? readStoredBrief());
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [searchParams]);

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

  // The line itself answers where an adopted candidate went: the questionnaire
  // it refined, or the one adoption composed a moment later.
  const adopt = useCallback(
    async (candidate: string) => {
      if (brief === null) return;
      setAdopting(true);
      setAdoptNote(null);

      const adopted = await api["/live/drafts/adopt"]({ candidate });
      if (isApiError(adopted)) {
        setAdopting(false);
        toast.error(publicErrorMessage(adopted.error));
        resumePolling();
        return;
      }

      for (let read = 0; read < ADOPT_READS; read += 1) {
        const result = await api["/live/drafts/line"]({ brief });
        if (!isApiError(result)) {
          const step = result.line.find(
            (entry) => entry.candidate === candidate,
          );
          const questionnaire = step?.composed ?? step?.refines ?? null;
          if (questionnaire !== null) {
            toast.success("Draft adopted");
            router.push(`/staff/live/${questionnaire}`);
            return;
          }
        }
        await sleep(ADOPT_READ_INTERVAL_MS);
      }

      setAdopting(false);
      setAdoptNote(
        "The draft was adopted. Its questionnaire is still being composed — it will appear on the quizzes page shortly.",
      );
      resumePolling();
    },
    [brief, resumePolling, router],
  );

  const tip = line.at(-1) ?? null;
  const waiting = isWaiting(line);
  const refining = tip?.refines ?? null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Live"
        title={
          refining !== null
            ? "Refine with the reasoner"
            : "Draft with the reasoner"
        }
        description={
          refining !== null
            ? "The line opened on the questionnaire as it stands. Ask for changes in plain language, and adopt the revision to apply it back."
            : "Describe the quiz or survey you want. The reasoner drafts it whole; you correct it in plain language and adopt it when it reads right."
        }
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
      <Suspense fallback={<LoadingState label="Loading…" />}>
        <DraftPageContent />
      </Suspense>
    </RequireCapability>
  );
}
