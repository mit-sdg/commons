"use client";

import { CheckCircle2, CircleSlash } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, isApiError, type Output } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Face = NonNullable<Output<"/live/p/arrive">["face"]>;
type Question = Face["questions"][number];
type Outcome = Output<"/live/p/outcome">;

/**
 * The outcome payload varies with what the run discloses: a bare score, a score
 * with the key, or the key plus explanations. A distributive conditional keeps
 * every shape — an indexed access would reduce the richer ones away — so the
 * page reads them off the generated types instead of asserting a shape.
 */
type OutcomeShapeOf<T> = T extends { outcome: infer Formed } ? Formed : never;
type FormedOutcome = OutcomeShapeOf<Outcome>;
type ScoredOutcome = NonNullable<FormedOutcome>;
type OutcomeReceipt = Extract<
  ScoredOutcome,
  { receipt: unknown }
>["receipt"][number];

const formedOutcomeOf = (result: Outcome): FormedOutcome | undefined =>
  "outcome" in result ? result.outcome : undefined;

const receiptOf = (formed: ScoredOutcome): OutcomeReceipt[] | undefined =>
  "receipt" in formed ? formed.receipt : undefined;

const explanationOf = (row: OutcomeReceipt): string | undefined =>
  "explanation" in row ? row.explanation : undefined;

const FACE_POLL_MS = 5_000;
const OUTCOME_POLL_MS = 1_500;

/** A device identifier that survives reloads; secure-context APIs may be absent on lecture-hall LANs. */
function deviceId(): string {
  const key = "commons-live-device";
  try {
    const standing = window.localStorage.getItem(key);
    if (standing !== null && standing !== "") return standing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

interface LocalProgress {
  response: string;
  answers: Record<string, string>;
  submitted: boolean;
}

function progressKey(token: string, participant: string): string {
  return `commons-live-${token}:${participant}`;
}

function readProgress(
  token: string,
  participant: string,
): LocalProgress | null {
  try {
    const raw = window.localStorage.getItem(progressKey(token, participant));
    return raw === null ? null : (JSON.parse(raw) as LocalProgress);
  } catch {
    return null;
  }
}

function writeProgress(
  token: string,
  participant: string,
  progress: LocalProgress,
) {
  try {
    window.localStorage.setItem(
      progressKey(token, participant),
      JSON.stringify(progress),
    );
  } catch {
    // A browser that refuses storage still participates; it just cannot rejoin.
  }
}

export default function ParticipantPage() {
  const { token } = useParams<{ token: string }>();
  const { me, loading: authLoading, logout } = useAuth();
  const [face, setFace] = useState<Face | null>(null);
  const [missing, setMissing] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [participant, setParticipant] = useState<string | null>(null);
  const [progressReady, setProgressReady] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [alreadyIn, setAlreadyIn] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const [outcomeRetry, setOutcomeRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const sent = useRef<Record<string, string>>({});
  const pending = useRef<Record<string, Promise<boolean>>>({});
  const submissionUncertain = useRef(false);
  const reconciledResponse = useRef<string | null>(null);
  const signedParticipant = me === null ? null : String(me.user);
  const progressBelongsToViewer =
    !authLoading &&
    participant !== null &&
    (signedParticipant === null
      ? participant.startsWith("device:")
      : participant === `user:${signedParticipant}`);

  // A shared browser can pass from one signed-in participant to another. Wait
  // for auth before restoring, and keep each account (or anonymous device) in
  // its own slot so nobody inherits somebody else's response or outcome.
  useEffect(() => {
    if (authLoading) return;
    const identity =
      signedParticipant === null
        ? `device:${deviceId()}`
        : `user:${signedParticipant}`;
    const stored = readProgress(token, identity);
    /* eslint-disable react-hooks/set-state-in-effect -- auth selects the participant's persisted response */
    setParticipant(identity);
    setResponse(stored?.response ?? null);
    setAnswers(stored?.answers ?? {});
    setSubmitted(stored?.submitted ?? false);
    setAlreadyIn(false);
    setOutcome(null);
    setProgressReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    sent.current = {};
    pending.current = {};
    submissionUncertain.current = false;
    reconciledResponse.current = null;
  }, [authLoading, signedParticipant, token]);

  const loadFace = useCallback(async () => {
    try {
      const result = await api["/live/p/arrive"]({ token });
      if (isApiError(result)) {
        setMissing(true);
        setFaceError(null);
        return null;
      }
      setMissing(false);
      setFaceError(null);
      setFace(result.face ?? null);
      return result.face ?? null;
    } catch {
      setFaceError(
        "We couldn't reach Commons. Check your connection and try again.",
      );
      return null;
    }
  }, [token]);

  // Arrive.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state lands after the awaited fetch, as in use-query
    void loadFace();
  }, [loadFace]);

  // While answering, watch for the run closing under us. The effect keys on the
  // booleans it actually needs, so a fresh face object each tick does not tear
  // the interval down and rebuild it.
  const arrived = face !== null;
  const open = face?.open ?? false;
  useEffect(() => {
    if (!arrived || !open || submitted) return;
    const timer = setInterval(() => void loadFace(), FACE_POLL_MS);
    return () => clearInterval(timer);
  }, [arrived, open, submitted, loadFace]);

  // After hand-in, poll the outcome until the grade lands (surveys answer at once).
  useEffect(() => {
    if (!submitted || response === null) return;
    let cancelled = false;
    // The handle exists before the first poll runs, so neither the poll nor the
    // cleanup closes over a binding that does not exist yet.
    const handle: { timer?: ReturnType<typeof setInterval> } = {};
    const stop = () => {
      cancelled = true;
      if (handle.timer !== undefined) clearInterval(handle.timer);
    };
    const poll = async () => {
      try {
        const result = me
          ? await api["/live/p/outcome-signed"]({ response })
          : await api["/live/p/outcome"]({ response });
        if (cancelled) return;
        if (isApiError(result)) {
          setOutcomeError("Your result couldn't be loaded. Try again.");
          return;
        }
        setOutcomeError(null);
        setOutcome(result);
        const formed = formedOutcomeOf(result);
        if (
          !("outcome" in result) ||
          (formed?.score !== null && formed?.score !== undefined)
        ) {
          stop();
        }
      } catch {
        if (!cancelled) {
          setOutcomeError(
            "Your result couldn't be loaded. Check your connection and try again.",
          );
        }
      }
    };
    void poll();
    handle.timer = setInterval(() => void poll(), OUTCOME_POLL_MS);
    return stop;
  }, [submitted, response, outcomeRetry, me]);

  const begin = useCallback(async () => {
    if (participant === null) return;
    setBusy(true);
    try {
      const result = me
        ? await api["/live/p/begin-signed"]({ token })
        : await api["/live/p/begin"]({ token, device: deviceId() });
      if (isApiError(result)) {
        const current = await loadFace();
        if (current?.open) setAlreadyIn(true);
        return;
      }
      setResponse(result.response);
      writeProgress(token, participant, {
        response: result.response,
        answers,
        submitted: false,
      });
    } catch {
      toast.error("Could not join. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [me, token, participant, answers, loadFace]);

  // Typing counts at once — the hand-in button must not stay dead under a
  // finger while a written answer sits uncommitted — but the network only
  // hears committed values: blur, or the hand-in flush.
  const draftAnswer = useCallback(
    (question: string, value: string) => {
      if (response === null || participant === null) return;
      const next = { ...answers, [question]: value };
      setAnswers(next);
      writeProgress(token, participant, {
        response,
        answers: next,
        submitted: false,
      });
    },
    [response, participant, answers, token],
  );

  const persistAnswer = useCallback(
    (question: string, value: string): Promise<boolean> => {
      if (response === null) return Promise.resolve(false);
      const prior = pending.current[question] ?? Promise.resolve(true);
      const write = prior.then(async () => {
        if (sent.current[question] === value) return true;
        try {
          const result = me
            ? await api["/live/p/answer-signed"]({ response, question, value })
            : await api["/live/p/answer"]({ response, question, value });
          if (!isApiError(result)) {
            sent.current[question] = value;
            return true;
          }
        } catch {
          // The same recovery sentence covers a transport failure and a
          // refusal: the local draft remains available for another attempt.
        }
        toast.error("That answer was not saved. Try again.");
        return false;
      });
      pending.current[question] = write;
      return write;
    },
    [response, me],
  );

  const answer = useCallback(
    (question: string, value: string) => {
      if (response === null || participant === null) return;
      const next = { ...answers, [question]: value };
      setAnswers(next);
      writeProgress(token, participant, {
        response,
        answers: next,
        submitted: false,
      });
      void persistAnswer(question, value);
    },
    [response, participant, answers, token, persistAnswer],
  );

  const rememberSubmitted = useCallback(
    (received?: Outcome) => {
      if (response === null || participant === null) return;
      submissionUncertain.current = false;
      setSubmitted(true);
      if (received !== undefined) {
        setOutcome(received);
        setOutcomeError(null);
      }
      writeProgress(token, participant, {
        response,
        answers,
        submitted: true,
      });
    },
    [response, participant, token, answers],
  );

  // A hand-in may commit even when its HTTP response is lost. Outcome is the
  // authoritative receipt, so it also reconciles an uncertain retry or reload.
  const recoverSubmission = useCallback(async (): Promise<boolean> => {
    if (response === null) return false;
    try {
      const result = me
        ? await api["/live/p/outcome-signed"]({ response })
        : await api["/live/p/outcome"]({ response });
      if (isApiError(result) || result.received !== true) return false;
      rememberSubmitted(result);
      return true;
    } catch {
      return false;
    }
  }, [response, rememberSubmitted, me]);

  useEffect(() => {
    if (
      !progressReady ||
      submitted ||
      response === null ||
      reconciledResponse.current === response
    )
      return;
    reconciledResponse.current = response;
    void recoverSubmission();
  }, [progressReady, submitted, response, recoverSubmission]);

  const submit = useCallback(async () => {
    if (response === null || participant === null) return;
    setBusy(true);
    try {
      if (submissionUncertain.current && (await recoverSubmission())) return;
      // Hand-in flushes anything typed but not yet committed by a blur.
      for (const [question, value] of Object.entries(answers)) {
        const trimmed = value.trim();
        if (trimmed === "") continue;
        const saved = await persistAnswer(question, trimmed);
        if (!saved) return;
      }
      const result = me
        ? await api["/live/p/submit-signed"]({ response })
        : await api["/live/p/submit"]({ response });
      if (isApiError(result)) {
        submissionUncertain.current = true;
        if (await recoverSubmission()) return;
        toast.error(
          "Could not hand in. Check every answer and make sure the quiz is still open.",
        );
        await loadFace();
        return;
      }
      rememberSubmitted();
    } catch {
      submissionUncertain.current = true;
      if (await recoverSubmission()) return;
      toast.error("Could not hand in. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [
    response,
    participant,
    answers,
    loadFace,
    persistAnswer,
    recoverSubmission,
    rememberSubmitted,
    me,
  ]);

  const isQuiz = face?.form === "quiz";
  const complete = useMemo(
    () =>
      face !== null &&
      face.questions.every(
        (question) => (answers[question.question] ?? "").trim() !== "",
      ),
    [face, answers],
  );

  if (missing) {
    return (
      <Shell>
        <EmptyState
          icon={CircleSlash}
          title="Nothing here"
          description="Check the address or scan again."
        />
      </Shell>
    );
  }

  if (face === null || !progressReady || !progressBelongsToViewer) {
    if (faceError !== null) {
      return (
        <Shell>
          <ErrorState message={faceError} onRetry={() => void loadFace()} />
        </Shell>
      );
    }
    return (
      <Shell>
        <LoadingState label="Opening…" />
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell title={face.title}>
        <OutcomeView
          outcome={outcome}
          isQuiz={isQuiz}
          error={outcomeError}
          onRetry={() => setOutcomeRetry((standing) => standing + 1)}
        />
      </Shell>
    );
  }

  if (!face.open) {
    return (
      <Shell title={face.title}>
        <EmptyState
          icon={CircleSlash}
          title={`This ${face.form} has been closed`}
        />
      </Shell>
    );
  }

  if (alreadyIn) {
    return (
      <Shell title={face.title}>
        <EmptyState icon={CheckCircle2} title="Already handed in" />
      </Shell>
    );
  }

  if (response === null) {
    return (
      <Shell title={face.title}>
        <div className="flex min-h-[55dvh] flex-col items-center justify-center gap-4 py-10">
          <p className="text-center text-muted-foreground">
            {face.questions.length} question
            {face.questions.length === 1 ? "" : "s"} ·{" "}
            {isQuiz ? "quiz" : "survey"}
          </p>
          {me !== null ? (
            <div className="text-center text-sm">
              <p>
                Joining as{" "}
                <span className="font-medium">{me.profile.displayName}</span>
              </p>
              <Button variant="link" size="sm" onClick={() => void logout()}>
                Not you? Sign out
              </Button>
            </div>
          ) : null}
          <Button
            size="lg"
            className="h-11"
            onClick={() => void begin()}
            disabled={busy}
          >
            Join
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={face.title}>
      <div className="flex flex-col gap-4 pb-28">
        {faceError !== null ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
          >
            <span>
              Connection interrupted. Your answers remain on this device.
            </span>
            <Button size="sm" variant="outline" onClick={() => void loadFace()}>
              Retry
            </Button>
          </div>
        ) : null}
        {face.questions.map((question, index) => (
          <QuestionCard
            key={question.question}
            index={index}
            question={question}
            value={answers[question.question] ?? ""}
            onAnswer={(value) => void answer(question.question, value)}
            onDraft={(value) => draftAnswer(question.question, value)}
          />
        ))}
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-sm text-muted-foreground"
          >
            {
              Object.values(answers).filter((value) => value.trim() !== "")
                .length
            }{" "}
            of {face.questions.length} answered
          </span>
          <Button
            // A thumb-sized target: the default h-9 falls under the 44px floor.
            className="h-11"
            onClick={() => void submit()}
            disabled={busy || (isQuiz && !complete)}
          >
            Hand in
          </Button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl px-4 py-6">
      {title !== undefined && (
        <h1
          className="mb-6 font-display text-2xl font-semibold tracking-tight"
          dir="auto"
        >
          {title}
        </h1>
      )}
      {children}
    </div>
  );
}

function QuestionCard({
  index,
  question,
  value,
  onAnswer,
  onDraft,
}: {
  index: number;
  question: Question;
  value: string;
  onAnswer: (value: string) => void;
  onDraft: (value: string) => void;
}) {
  const choices = question.choices;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        {/* The number keeps its own column so a wrapped prompt holds its edge. */}
        <h2 className="flex items-start gap-2 font-medium" dir="auto">
          <span className="w-6 shrink-0 text-muted-foreground tabular-nums">
            {index + 1}.
          </span>
          <span className="min-w-0 flex-1">{question.prompt}</span>
        </h2>
        {choices.length > 0 ? (
          <div className="flex flex-col gap-2">
            {choices.map((choice) => (
              <button
                key={choice}
                type="button"
                dir="auto"
                // Colour alone does not carry selection to a screen reader.
                aria-pressed={value === choice}
                onClick={() => onAnswer(choice)}
                className={cn(
                  "rounded-md border border-border px-4 py-3 text-start text-sm transition-colors",
                  value === choice
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "hover:bg-muted",
                )}
              >
                {choice}
              </button>
            ))}
          </div>
        ) : (
          // The field stays uncontrolled — typing drafts, blur commits — so
          // nothing has to be synced from props into state during render.
          <Input
            className="h-11"
            dir="auto"
            defaultValue={value}
            placeholder="Your answer"
            onChange={(event) => onDraft(event.currentTarget.value)}
            onBlur={(event) => {
              const next = event.currentTarget.value.trim();
              if (next === "") return;
              event.currentTarget.value = next;
              if (next !== value) onAnswer(next);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function OutcomeView({
  outcome,
  isQuiz,
  error,
  onRetry,
}: {
  outcome: Outcome | null;
  isQuiz: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (!isQuiz || (outcome !== null && !("outcome" in outcome))) {
    return <EmptyState icon={CheckCircle2} title="Handed in" />;
  }
  const formed = outcome === null ? undefined : formedOutcomeOf(outcome);
  if (formed === null || formed === undefined || formed.score === null) {
    if (error !== null) return <ErrorState message={error} onRetry={onRetry} />;
    return <LoadingState label="Handed in — scoring…" />;
  }
  // Disclosure decides whether the key travels back with the score at all.
  const receipt = receiptOf(formed);
  return (
    <div className="flex flex-col gap-4">
      <div className="py-6 text-center">
        <p className="text-muted-foreground">Your score</p>
        <p className="font-display text-5xl font-semibold">
          {formed.score}
          <span className="text-2xl text-muted-foreground">
            {" "}
            / {formed.outOf}
          </span>
        </p>
      </div>
      {receipt !== undefined && (
        <div className="flex flex-col gap-3">
          {receipt.map((item) => {
            const graded = item.kind === "graded";
            const right = graded && item.value === item.standard;
            const explanation = explanationOf(item);
            return (
              <Card key={item.item}>
                <CardContent className="flex flex-col gap-1 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-medium" dir="auto">
                      {item.prompt}
                    </h2>
                    {!graded ? (
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-muted-foreground text-xs">
                        Not graded
                      </span>
                    ) : null}
                  </div>
                  <p
                    dir="auto"
                    className={cn(
                      graded &&
                        (right
                          ? "text-green-600 dark:text-green-400"
                          : "text-destructive"),
                    )}
                  >
                    Your answer: {item.value}
                  </p>
                  {item.standard !== "" && (!graded || !right) ? (
                    <p className="text-muted-foreground" dir="auto">
                      {item.kind === "reference" ? "Reference" : "Expected"}:{" "}
                      {item.standard}
                    </p>
                  ) : null}
                  {explanation !== undefined && explanation !== "" && (
                    <p className="text-muted-foreground">{explanation}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
