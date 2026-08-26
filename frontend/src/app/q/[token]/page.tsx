"use client";

import { CheckCircle2, CircleSlash } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, LoadingState } from "@/components/states";
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
type OutcomeItem = Extract<ScoredOutcome, { items: unknown }>["items"][number];

const formedOutcomeOf = (result: Outcome): FormedOutcome | undefined =>
  "outcome" in result ? result.outcome : undefined;

const itemsOf = (formed: ScoredOutcome): OutcomeItem[] | undefined =>
  "items" in formed ? formed.items : undefined;

const explanationOf = (item: OutcomeItem): string | undefined =>
  "explanation" in item ? item.explanation : undefined;

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

function readProgress(token: string): LocalProgress | null {
  try {
    const raw = window.localStorage.getItem(`commons-live-${token}`);
    return raw === null ? null : (JSON.parse(raw) as LocalProgress);
  } catch {
    return null;
  }
}

function writeProgress(token: string, progress: LocalProgress) {
  try {
    window.localStorage.setItem(
      `commons-live-${token}`,
      JSON.stringify(progress),
    );
  } catch {
    // A browser that refuses storage still participates; it just cannot rejoin.
  }
}

export default function ParticipantPage() {
  const { token } = useParams<{ token: string }>();
  const { me } = useAuth();
  const [face, setFace] = useState<Face | null>(null);
  const [missing, setMissing] = useState(false);
  // Progress recovers lazily from this device's storage; until the face loads,
  // none of it shapes the markup, so hydration stays consistent.
  const [response, setResponse] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : (readProgress(token)?.response ?? null),
  );
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    typeof window === "undefined" ? {} : (readProgress(token)?.answers ?? {}),
  );
  const [submitted, setSubmitted] = useState(() =>
    typeof window === "undefined"
      ? false
      : (readProgress(token)?.submitted ?? false),
  );
  const [alreadyIn, setAlreadyIn] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const sent = useRef<Record<string, string>>({});

  const loadFace = useCallback(async () => {
    const result = await api["/live/p/arrive"]({ token });
    if (isApiError(result)) {
      setMissing(true);
      return null;
    }
    setFace(result.face ?? null);
    return result.face ?? null;
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
      const result = await api["/live/p/outcome"]({ response });
      if (cancelled || isApiError(result)) return;
      setOutcome(result);
      const formed = formedOutcomeOf(result);
      if (
        !("outcome" in result) ||
        (formed?.score !== null && formed?.score !== undefined)
      ) {
        stop();
      }
    };
    void poll();
    handle.timer = setInterval(() => void poll(), OUTCOME_POLL_MS);
    return stop;
  }, [submitted, response]);

  const begin = useCallback(async () => {
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
      writeProgress(token, {
        response: result.response,
        answers,
        submitted: false,
      });
    } finally {
      setBusy(false);
    }
  }, [me, token, answers, loadFace]);

  const answer = useCallback(
    async (question: string, value: string) => {
      if (response === null) return;
      const next = { ...answers, [question]: value };
      setAnswers(next);
      writeProgress(token, { response, answers: next, submitted: false });
      if (sent.current[question] === value) return;
      sent.current[question] = value;
      await api["/live/p/answer"]({ response, question, value });
    },
    [response, answers, token],
  );

  const submit = useCallback(async () => {
    if (response === null) return;
    setBusy(true);
    try {
      const result = await api["/live/p/submit"]({ response });
      if (isApiError(result)) {
        await loadFace();
        return;
      }
      setSubmitted(true);
      writeProgress(token, { response, answers, submitted: true });
    } finally {
      setBusy(false);
    }
  }, [response, answers, token, loadFace]);

  const isQuiz = face?.form === "quiz";
  const complete = useMemo(
    () =>
      face !== null &&
      face.questions.every(
        (question) => (answers[question.question] ?? "") !== "",
      ),
    [face, answers],
  );

  if (missing) {
    return (
      <Shell>
        <EmptyState
          icon={CircleSlash}
          title="Nothing is shared here"
          description="Check the address or scan the code again."
        />
      </Shell>
    );
  }

  if (face === null) {
    return (
      <Shell>
        <LoadingState label="Opening…" />
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell title={face.title}>
        <OutcomeView outcome={outcome} isQuiz={isQuiz} />
      </Shell>
    );
  }

  if (!face.open) {
    return (
      <Shell title={face.title}>
        <EmptyState
          icon={CircleSlash}
          title="This has closed"
          // Only someone who had begun lost something by the close; a device
          // arriving after the fact is just late.
          description={
            response === null
              ? "This run has ended."
              : "Participation ended before you could hand in."
          }
        />
      </Shell>
    );
  }

  if (alreadyIn) {
    return (
      <Shell title={face.title}>
        <EmptyState
          icon={CheckCircle2}
          title="Already handed in"
          // Signed-in participation is bound to the account, not the handset.
          description={
            me
              ? "You already handed in from this account."
              : `This device already handed in a response to this ${face.form}.`
          }
        />
      </Shell>
    );
  }

  if (response === null) {
    return (
      <Shell title={face.title}>
        <div className="flex flex-col items-center gap-4 py-10">
          <p className="text-center text-muted-foreground">
            {face.questions.length} question
            {face.questions.length === 1 ? "" : "s"} ·{" "}
            {isQuiz ? "quiz" : "survey"}
          </p>
          <Button size="lg" onClick={() => void begin()} disabled={busy}>
            Join
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={face.title}>
      <div className="flex flex-col gap-4 pb-28">
        {face.questions.map((question, index) => (
          <QuestionCard
            key={question.question}
            index={index}
            question={question}
            value={answers[question.question] ?? ""}
            onAnswer={(value) => void answer(question.question, value)}
          />
        ))}
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            {Object.values(answers).filter((value) => value !== "").length} of{" "}
            {face.questions.length} answered
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
}: {
  index: number;
  question: Question;
  value: string;
  onAnswer: (value: string) => void;
}) {
  const choices = question.choices;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="font-medium" dir="auto">
          <span className="me-2 text-muted-foreground">{index + 1}.</span>
          {question.prompt}
        </p>
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
          // The field owns the draft and commits on blur, so nothing has to be
          // synced from props into state during render.
          <Input
            className="h-11"
            dir="auto"
            defaultValue={value}
            placeholder="Your answer"
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
}: {
  outcome: Outcome | null;
  isQuiz: boolean;
}) {
  if (!isQuiz || (outcome !== null && !("outcome" in outcome))) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Handed in"
        description="Thanks — your response was received."
      />
    );
  }
  const formed = outcome === null ? undefined : formedOutcomeOf(outcome);
  if (formed === null || formed === undefined || formed.score === null) {
    return <LoadingState label="Handed in — scoring…" />;
  }
  // Disclosure decides whether the key travels back with the score at all.
  const items = itemsOf(formed);
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
      {items !== undefined && (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const right = item.value !== null && item.value === item.expected;
            const explanation = explanationOf(item);
            return (
              <Card key={item.item}>
                <CardContent className="flex flex-col gap-1 text-sm">
                  <p className="font-medium" dir="auto">
                    {item.prompt}
                  </p>
                  <p
                    className={cn(
                      right
                        ? "text-green-600 dark:text-green-400"
                        : "text-destructive",
                    )}
                  >
                    Your answer: {item.value ?? "—"}
                  </p>
                  {!right && (
                    <p className="text-muted-foreground">
                      Expected: {item.expected}
                    </p>
                  )}
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
