"use client";

import { ArrowLeft, FileQuestion } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Link } from "@/components/link";
import { titleFromBrief } from "@/components/live/copy-relay";
import { DraftDescribe } from "@/components/live/draft-describe";
import type { DraftLineStep } from "@/components/live/draft-step";
import { DraftStep } from "@/components/live/draft-step";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@/hooks/use-query";
import { api, isApiError, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/format";

const KINDS = [
  { kind: "quiz", label: "Quiz" },
  { kind: "survey", label: "Survey" },
  { kind: "relay", label: "Relay" },
] as const;

type Kind = (typeof KINDS)[number]["kind"];

function isKind(value: string | null): value is Kind {
  return KINDS.some((entry) => entry.kind === value);
}

/** The grain of a relay brief: the rounds, and what the later one is handed. */
const RELAY_EXAMPLE =
  "two rounds: three verbs for a concept, then a stranger guesses it from the verbs alone";

/** The brief the author is drafting against, kept across a reload. */
const BRIEF_STORAGE_KEY = "commons-live-draft-brief";
/** How often the line is re-read while a reply is out with the reasoner. */
const POLL_INTERVAL_MS = 1500;
/** How often, and how many times, the line is re-read after adoption while its questionnaire composes. */
const ADOPT_READS = 10;
const ADOPT_READ_INTERVAL_MS = 300;

/** The slot is the author's own: two staff sharing a browser keep separate lines. */
function briefStorageKey(author: string): string {
  return `${BRIEF_STORAGE_KEY}:${author}`;
}

function readStoredBrief(author: string): string | null {
  try {
    return window.sessionStorage.getItem(briefStorageKey(author));
  } catch {
    return null;
  }
}

function writeStoredBrief(author: string, brief: string | null): void {
  try {
    const key = briefStorageKey(author);
    if (brief === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, brief);
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

/** A line with nothing left to do on it: adopted at the tip, or gone entirely. */
function isFinished(line: DraftLineStep[]): boolean {
  const tip = line.at(-1);
  return tip === undefined || tip.adopted || tip.abandoned;
}

function DraftPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me } = useAuth();
  const author = me === null ? null : String(me.user);
  const named = searchParams.get("brief");
  const askedKind = searchParams.get("kind");
  const [kind, setKind] = useState<Kind>(
    isKind(askedKind) ? askedKind : "quiz",
  );
  const [brief, setBrief] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [resumed, setResumed] = useState(false);
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
  // resumes the same line rather than starting the author over. The slot
  // belongs to one author, so nothing is read until the session names them.
  useEffect(() => {
    if (author === null) return;
    /* eslint-disable react-hooks/set-state-in-effect -- resuming a brief runs once the author is known */
    if (named !== null) writeStoredBrief(author, named);
    const stored = named === null ? readStoredBrief(author) : null;
    setBrief(named ?? stored);
    setResumed(stored !== null);
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [author, named]);

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
      // A line resumed from the slot is only worth returning to while there is
      // still drafting to do on it; a finished one is dropped for a fresh
      // description. A brief named in the address is shown either way.
      if (resumed && isFinished(result.line)) {
        if (author !== null) writeStoredBrief(author, null);
        setResumed(false);
        setBrief(null);
        setLine([]);
        setLineError(null);
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
  }, [author, brief, pollNonce, resumed]);

  const resumePolling = useCallback(() => {
    setPollNonce((nonce) => nonce + 1);
  }, []);

  const startNewDraft = useCallback(() => {
    if (author !== null) writeStoredBrief(author, null);
    // A brief still named in the address is written back to the slot on the
    // next read, so the address is left behind with the line.
    if (named !== null) router.replace("/staff/live/draft");
    setBrief(null);
    setResumed(false);
    setLine([]);
    setLineError(null);
    setAdoptNote(null);
    setLoadingLine(false);
  }, [author, named, router]);

  const abandon = useCallback(async () => {
    if (brief === null) return;
    setBusy(true);
    try {
      const result = await api["/live/drafts/abandon"]({ brief });
      if (isApiError(result)) {
        toast.error(publicErrorMessage(result.error));
        return;
      }
      toast.success("Draft left in history");
      startNewDraft();
    } catch {
      toast.error("The draft could not be left. Try again.");
    } finally {
      setBusy(false);
    }
  }, [brief, startNewDraft]);

  const describe = useCallback(
    async (request: string) => {
      if (author === null) return;
      setDescribing(true);
      const result = await api["/live/drafts/describe"]({ request });
      setDescribing(false);
      if (isApiError(result)) {
        toast.error(publicErrorMessage(result.error));
        return;
      }
      writeStoredBrief(author, result.brief);
      setLine([]);
      setLineError(null);
      setAdoptNote(null);
      setResumed(false);
      setBrief(result.brief);
    },
    [author],
  );

  // A relay is drafted onto a relay of its own: the brief names it, the model
  // proposes its rounds on the edit page.
  const draftRelay = useCallback(
    async (request: string) => {
      setDescribing(true);
      const planned = await api["/live/relays/plan"]({
        title: titleFromBrief(request),
      });
      if (isApiError(planned)) {
        setDescribing(false);
        toast.error(publicErrorMessage(planned.error));
        return;
      }
      const asked = await api["/live/edits/draft"]({
        relay: planned.relay,
        request,
      });
      if (isApiError(asked)) {
        setDescribing(false);
        toast.error(publicErrorMessage(asked.error));
        return;
      }
      router.push(
        `/staff/live/relay/${planned.relay}/edit?draft=${asked.asking}`,
      );
    },
    [router],
  );

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

      // The line is spent once it is adopted, so the slot must not carry the
      // author back to it.
      if (author !== null) writeStoredBrief(author, null);
      setResumed(false);

      for (let read = 0; read < ADOPT_READS; read += 1) {
        const result = await api["/live/drafts/line"]({ brief });
        if (!isApiError(result)) {
          const step = result.line.find(
            (entry) => entry.candidate === candidate,
          );
          const questionnaire = step?.composed ?? step?.refines ?? null;
          if (questionnaire !== null) {
            toast.success("Draft adopted");
            router.push(`/staff/live/${questionnaire}/edit`);
            return;
          }
        }
        await sleep(ADOPT_READ_INTERVAL_MS);
      }

      setAdopting(false);
      setAdoptNote(
        "Adopted — the questionnaire will appear under Live shortly.",
      );
      resumePolling();
    },
    [author, brief, resumePolling, router],
  );

  // The describe surface offers back the lines still worth returning to.
  const onDescribeSurface = restored && brief === null && author !== null;
  const { data: lines } = useQuery(
    onDescribeSurface ? () => api["/live/drafts/lines"]({}).then(unwrap) : null,
    [onDescribeSurface],
  );
  const unfinished = (lines?.lines ?? []).filter(
    (entry) => !entry.adopted && !entry.abandoned,
  );

  const tip = line.at(-1) ?? null;
  const waiting = isWaiting(line);
  const refining = tip?.refines ?? null;
  const refiningForm = line.find((step) => step.refines !== null)?.form ?? null;
  const abandoned = tip?.abandoned ?? false;
  const ownsLine = tip !== null && author === String(tip.rootAuthor);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <Link
            href={
              refining !== null ? `/staff/live/${refining}/edit` : "/staff/live"
            }
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            {refining !== null ? "Back to the questionnaire" : "Live"}
          </Link>
        }
        title={refining !== null ? "Refine with AI" : "Draft with AI"}
        actions={
          brief !== null && !abandoned && !tip?.adopted && ownsLine ? (
            <ConfirmAction
              trigger={
                <Button variant="outline" disabled={busy}>
                  Abandon and start new
                </Button>
              }
              title="Leave this draft?"
              description="It will leave your unfinished drafts and stay available as read-only history."
              confirmLabel="Leave draft"
              destructive
              onConfirm={abandon}
            />
          ) : null
        }
      />

      {!restored ? (
        <LoadingState label="Loading…" />
      ) : brief === null ? (
        <>
          <Tabs
            value={kind}
            className="mb-6"
            onValueChange={(value) => {
              if (isKind(value)) setKind(value);
            }}
          >
            <TabsList>
              {KINDS.map((entry) => (
                <TabsTrigger
                  key={entry.kind}
                  value={entry.kind}
                  className="text-foreground/70"
                >
                  {entry.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {kind === "relay" ? (
            <DraftDescribe
              submitting={describing}
              onSubmit={draftRelay}
              title="Describe the relay you want"
              placeholder={RELAY_EXAMPLE}
              label="Draft"
            />
          ) : (
            <DraftDescribe submitting={describing} onSubmit={describe} />
          )}
          {kind !== "relay" && unfinished.length > 0 ? (
            <section className="mt-10 space-y-3">
              <h2 className="font-display text-lg font-semibold">
                Unfinished drafts
              </h2>
              <div className="space-y-2">
                {unfinished.map((entry) => (
                  <Link
                    key={entry.brief}
                    href={`/staff/live/draft?brief=${entry.brief}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span
                      className="min-w-0 flex-1 truncate text-sm"
                      dir="auto"
                    >
                      {entry.request}
                    </span>
                    <span className="flex items-center gap-2">
                      {entry.stalled ? (
                        <Badge variant="outline">Stalled</Badge>
                      ) : null}
                      <span className="whitespace-nowrap text-muted-foreground text-xs">
                        Started {relativeTime(entry.createdAt)}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : loadingLine && line.length === 0 ? (
        <LoadingState label="Loading…" />
      ) : lineError !== null && line.length === 0 ? (
        <ErrorState message={lineError} onRetry={resumePolling} />
      ) : line.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="That draft is no longer available"
          action={<Button onClick={startNewDraft}>Start a new draft</Button>}
        />
      ) : (
        <div className="space-y-8">
          {abandoned ? (
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              This draft was left unfinished. It is retained as read-only
              history.
            </div>
          ) : !ownsLine ? (
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              This draft belongs to another author and is read-only.
            </div>
          ) : null}
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
              editable={ownsLine && !abandoned}
              refiningForm={refiningForm}
              onClarify={clarify}
              onCorrect={correct}
              onAdopt={adopt}
              onStartOver={abandon}
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
