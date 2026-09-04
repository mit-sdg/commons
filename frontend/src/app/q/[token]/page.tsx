"use client";

import { CheckCircle2, CircleSlash } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { HandInBar } from "@/components/live/phone-bar";
import {
  answeredOf,
  Choice,
  itemCountOf,
  QuestionCard as RoundQuestionCard,
  wholeOf,
} from "@/components/live/phone-question";
import { Card as AnswerCard } from "@/components/live/pile";
import { refusalSentence, saidRefusal } from "@/components/live/refusals";
import { Figure, RoundToken } from "@/components/live/round-token";
import {
  choicesOf,
  standingOf,
  trayOf,
  type Wall as WallShape,
} from "@/components/live/rounds";
import { Wall } from "@/components/live/wall";
import { SignInEnded } from "@/components/sign-in-ended";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type ApiError,
  api,
  isApiError,
  type Output,
  publicErrorMessage,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Arrival = Output<"/live/p/arrive">;
type Face = NonNullable<Extract<Arrival, { face: unknown }>["face"]>;
/** A relay run answers Arrive under `relay`: the rounds, and the open one's question. */
type Relay = NonNullable<Extract<Arrival, { relay: unknown }>["relay"]>;
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
const ROUND_POLL_MS = 3_000;

/** What a phone out of reach says, and what it says with answers on it. */
const NO_CONNECTION = "No connection. Try again.";
const ANSWERS_KEPT = "No connection. Your answers stay on this phone.";

/**
 * The words that mean the phone never reached Commons — the transport's own,
 * and the boundary's for a request it could not carry through. The client
 * answers a network failure with a value, not a throw, so an error like any
 * other arrives where a refusal would; none of these says a word about the
 * token, so the round stays on the screen and the next poll picks it up.
 */
const OUT_OF_REACH = new Set([
  "ABORTED",
  "BAD_JSON",
  "BAD_STATUS",
  "HEADER_RESOLUTION_FAILED",
  "INTERNAL_ERROR",
  "NETWORK_ERROR",
  "RESPONSE_TOO_LARGE",
  "TIMED_OUT",
  "TRANSPORT_ERROR",
  "UNAVAILABLE",
]);

/** Whether a refused request says anything at all about what was asked. */
function outOfReach(result: unknown): boolean {
  return isApiError(result) && OUT_OF_REACH.has(result.error);
}

/**
 * Where a written answer landed: on the server, refused, nowhere, or refused
 * because the phone's sign-in no longer stands.
 */
type Landing = "saved" | "refused" | "unreachable" | "unsigned";

/** A signed call refused for its sign-in, which is the phone's to renew. */
function unsigned(signed: boolean, result: unknown): boolean {
  return signed && isApiError(result) && result.error === "UNAUTHORIZED";
}

/** What a phone says when begin is refused with a word other than handed in. */
function beginRefusal(error: string): string {
  return error === "NOT_FOUND" ? "Couldn't join." : publicErrorMessage(error);
}

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

/**
 * Committed answers go out one at a time per item, and an unchanged value is
 * never sent twice, so a blur landing on a write still in flight cannot
 * overtake it. A write says where it landed; what to say about it, and what to
 * do with the value on the screen, belongs to the screen. A refused value is
 * not on the server and never will be; an unreachable one is only not there
 * yet, so the screen keeps it and the hand-in sends it again.
 */
function useAnswerSender(response: string | null, signed: boolean) {
  const sent = useRef<Record<string, string>>({});
  const pending = useRef<Record<string, Promise<Landing>>>({});

  const forget = useCallback(() => {
    sent.current = {};
    pending.current = {};
  }, []);

  const persistAnswer = useCallback(
    (question: string, value: string): Promise<Landing> => {
      if (response === null) return Promise.resolve<Landing>("refused");
      const prior =
        pending.current[question] ?? Promise.resolve<Landing>("saved");
      const write = prior.then(async (): Promise<Landing> => {
        if (sent.current[question] === value) return "saved";
        try {
          const result = signed
            ? await api["/live/p/answer-signed"]({ response, question, value })
            : await api["/live/p/answer"]({ response, question, value });
          if (!isApiError(result)) {
            sent.current[question] = value;
            return "saved";
          }
          if (unsigned(signed, result)) return "unsigned";
          return outOfReach(result) ? "unreachable" : "refused";
        } catch {
          return "unreachable";
        }
      });
      pending.current[question] = write;
      return write;
    },
    [response, signed],
  );

  return { persistAnswer, forget };
}

export default function ParticipantPage() {
  const { token } = useParams<{ token: string }>();
  const { me, loading: authLoading, logout } = useAuth();
  const [face, setFace] = useState<Face | null>(null);
  const [relay, setRelay] = useState<Relay | null>(null);
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
  /** A hand-in that landed while this phone watched: the receipt is said once. */
  const [justHandedIn, setJustHandedIn] = useState(false);
  /** The phone's sign-in ended under it: said once, with the way back in. */
  const [ended, setEnded] = useState(false);
  const { persistAnswer, forget } = useAnswerSender(response, me !== null);
  const submissionUncertain = useRef(false);

  // A signed call refused as unsigned is met once: the phone asks whether its
  // sign-in still stands and says so if it does not. The identity it holds
  // stays, so nothing falls back to an anonymous phone in the meantime; what
  // was typed stays on the screen, and what was handed in belongs to the run.
  const onEnded = useCallback(async () => {
    try {
      const probe = await api.auth.me();
      if (!("error" in probe)) return;
    } catch {
      return;
    }
    setEnded(true);
  }, []);
  const notice = ended ? (
    <SignInEnded next={`/q/${token}`} className="mb-4" />
  ) : null;
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
    forget();
    submissionUncertain.current = false;
    reconciledResponse.current = null;
  }, [authLoading, signedParticipant, token, forget]);

  const loadFace = useCallback(async () => {
    try {
      const result = await api["/live/p/arrive"]({ token });
      // Out of reach says nothing about the token: what is on the screen —
      // the round, the relay, the answers — stays, and the next poll recovers.
      if (outOfReach(result)) {
        setFaceError(NO_CONNECTION);
        return null;
      }
      if (isApiError(result)) {
        setMissing(true);
        setFaceError(null);
        return null;
      }
      setMissing(false);
      setFaceError(null);
      // One token opens onto either a questionnaire run or a relay run.
      const arrived = "relay" in result ? null : result.face;
      setFace(arrived ?? null);
      setRelay("relay" in result ? (result.relay ?? null) : null);
      return arrived ?? null;
    } catch {
      setFaceError(NO_CONNECTION);
      return null;
    }
  }, [token]);

  /**
   * One flag says whether this phone is reaching Commons, whichever request
   * found out: the poll raises it, and anything that gets through lowers it,
   * so a line never outlives the drop that put it up.
   */
  const reached = useCallback((got: boolean) => {
    setFaceError(got ? null : NO_CONNECTION);
  }, []);

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
  // A phone that never got through polls too, so a drop on the way in comes
  // back on its own rather than waiting on the Retry.
  const reaching = faceError !== null && !arrived && relay === null;
  useEffect(() => {
    if (!reaching && (!arrived || !open || submitted)) return;
    const timer = setInterval(() => void loadFace(), FACE_POLL_MS);
    return () => clearInterval(timer);
  }, [reaching, arrived, open, submitted, loadFace]);

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
        if (outOfReach(result)) {
          setOutcomeError(NO_CONNECTION);
          return;
        }
        if (isApiError(result)) {
          if (unsigned(me !== null, result)) {
            stop();
            void onEnded();
            return;
          }
          setOutcomeError("Result did not load. Try again.");
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
          setOutcomeError(NO_CONNECTION);
        }
      }
    };
    void poll();
    handle.timer = setInterval(() => void poll(), OUTCOME_POLL_MS);
    return stop;
  }, [submitted, response, outcomeRetry, me, onEnded]);

  const begin = useCallback(async () => {
    if (participant === null) return;
    setBusy(true);
    try {
      const result = me
        ? await api["/live/p/begin-signed"]({ token })
        : await api["/live/p/begin"]({ token, device: deviceId() });
      // Out of reach nobody has joined anything; the Join button stands.
      if (outOfReach(result)) {
        toast.error(NO_CONNECTION);
        return;
      }
      if (isApiError(result)) {
        if (unsigned(me !== null, result)) {
          void onEnded();
          return;
        }
        // Only the handed-in word says handed in; it comes back as a conflict
        // against a questionnaire still open. Anything else says what it is.
        if (result.error !== "CONFLICT") {
          toast.error(beginRefusal(result.error));
          return;
        }
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
      toast.error("Could not join. Try again.");
    } finally {
      setBusy(false);
    }
  }, [me, token, participant, answers, loadFace, onEnded]);

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

  const answer = useCallback(
    (question: string, value: string) => {
      if (response === null || participant === null) return;
      const held = answers[question] ?? "";
      const next = { ...answers, [question]: value };
      setAnswers(next);
      writeProgress(token, participant, {
        response,
        answers: next,
        submitted: false,
      });
      void persistAnswer(question, value).then((landing) => {
        if (landing === "saved") return;
        // A sign-in that ended keeps the value on the phone: it is not
        // refused, only unsigned, and the hand-in sends it again after.
        if (landing === "unsigned") {
          void onEnded();
          return;
        }
        // Out of reach the answer is not refused, only not sent: it stays on
        // the phone, and the hand-in sends it again.
        if (landing === "unreachable") {
          setFaceError(ANSWERS_KEPT);
          return;
        }
        // A refused answer must not stand on the screen as one that landed.
        const back = { ...next, [question]: held };
        setAnswers(back);
        writeProgress(token, participant, {
          response,
          answers: back,
          submitted: false,
        });
        toast.error("That answer didn't save. Try again.");
      });
    },
    [response, participant, answers, token, persistAnswer, onEnded],
  );

  const rememberSubmitted = useCallback(
    (received?: Outcome) => {
      if (response === null || participant === null) return;
      submissionUncertain.current = false;
      setSubmitted(true);
      setJustHandedIn(true);
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
        const landing = await persistAnswer(question, trimmed);
        if (landing === "unsigned") {
          void onEnded();
          return;
        }
        if (landing === "unreachable") {
          setFaceError(ANSWERS_KEPT);
          return;
        }
        if (landing === "refused") {
          toast.error("That answer didn't save. Try again.");
          return;
        }
      }
      const result = me
        ? await api["/live/p/submit-signed"]({ response })
        : await api["/live/p/submit"]({ response });
      // A hand-in out of reach may still have landed, with only its answer
      // lost on the way back, so the outcome is asked before the line stands.
      if (outOfReach(result)) {
        submissionUncertain.current = true;
        if (await recoverSubmission()) return;
        setFaceError(ANSWERS_KEPT);
        return;
      }
      if (unsigned(me !== null, result)) {
        void onEnded();
        return;
      }
      if (isApiError(result)) {
        submissionUncertain.current = true;
        if (await recoverSubmission()) return;
        toast.error("Could not hand in. Try again.");
        await loadFace();
        return;
      }
      rememberSubmitted();
    } catch {
      submissionUncertain.current = true;
      if (await recoverSubmission()) return;
      toast.error("Could not hand in. Try again.");
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
    onEnded,
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

  if (relay !== null) {
    if (!progressReady || participant === null) {
      return (
        <Shell>
          <LoadingState label="Opening…" />
        </Shell>
      );
    }
    return (
      <RelayPhone
        token={token}
        relay={relay}
        participant={participant}
        signedIn={me !== null}
        offline={faceError !== null}
        ended={ended}
        onEnded={onEnded}
        onReach={reached}
        refresh={loadFace}
      />
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
      <Shell
        title={face.title}
        said={justHandedIn ? "Handed in" : ""}
        notice={notice}
      >
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
      <Shell title={face.title} notice={notice}>
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
    <Shell title={face.title} notice={notice}>
      <div className="flex flex-col gap-4 pb-28">
        {faceError !== null ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
          >
            <span>{ANSWERS_KEPT}</span>
            <Button
              size="sm"
              variant="outline"
              aria-label="Retry the connection"
              onClick={() => void loadFace()}
            >
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
      <HandInBar
        answered={
          Object.values(answers).filter((value) => value.trim() !== "").length
        }
        of={face.questions.length}
        busy={busy}
        refusal={isQuiz && !complete ? refusalSentence("INCOMPLETE") : null}
        onHandIn={() => void submit()}
      />
    </Shell>
  );
}

function Shell({
  title,
  said = "",
  notice = null,
  children,
}: {
  title?: string;
  /** What just happened on this phone, said once, whatever the screen shows. */
  said?: string;
  /** A line that stands over every screen while it holds, under the title. */
  notice?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl px-4 py-6">
      {/* The region stands through every screen the phone passes, so the word
          that lands in it is a change and is announced; a region that mounts
          already carrying its words says nothing. */}
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {said}
      </span>
      {title !== undefined && (
        <h1
          className="mb-6 font-display text-2xl font-semibold tracking-tight"
          dir="auto"
        >
          {title}
        </h1>
      )}
      {notice}
      {children}
    </div>
  );
}

/** Where the phone stands, in one line, when it has no round to answer. */
function Line({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center text-muted-foreground">{children}</p>;
}

/**
 * What that line says while no round is open. The face carries every round with
 * its standing, so the rounds say whether the first is still to come, another
 * follows, or every one has run. A phone is never told about the run: the
 * closed line says what the student can see, in the words the rounds use.
 */
function waitingLine(relay: Relay): string {
  if (!relay.open) return refusalSentence("CLOSED");
  if (
    relay.rounds.length > 0 &&
    relay.rounds.every((round) => round.round !== null)
  )
    return refusalSentence("ROUNDS_RUN");
  return refusalSentence("NO_OPEN_ROUND");
}

/** A response is per round, so each round keeps its own slot on the device. */
function roundSlot(participant: string, round: string): string {
  return `${participant}:${round}`;
}

/**
 * The last round this phone handed in, read from the slots the device keeps.
 * A closed run opens no round to begin again, so what it handed in is on the
 * device alone — and that response is the one wall it still has to read.
 */
function lastHandedIn(
  token: string,
  participant: string,
  relay: Relay,
): string | null {
  let kept: string | null = null;
  for (const round of relay.rounds) {
    if (round.round === null) continue;
    const stored = readProgress(token, roundSlot(participant, round.round));
    if (stored?.submitted === true) kept = stored.response;
  }
  return kept;
}

/**
 * The phone in a relay run: the round that is open, answered and handed in,
 * then the wall of where the answer landed. A round is a response of its own,
 * so the phone begins again when the next round opens.
 */
function RelayPhone({
  token,
  relay,
  participant,
  signedIn,
  offline,
  ended,
  onEnded,
  onReach,
  refresh,
}: {
  token: string;
  relay: Relay;
  participant: string;
  signedIn: boolean;
  /** Nothing this phone sends is getting through: the screen keeps what it has. */
  offline: boolean;
  /** The phone's sign-in ended: said once over the screen, which keeps what it has. */
  ended: boolean;
  /** A signed call was refused as unsigned; the page asks whether that stands. */
  onEnded: () => Promise<void>;
  /** Whether a request got through, said to the one flag both screens read. */
  onReach: (reached: boolean) => void;
  refresh: () => Promise<Face | null>;
}) {
  const round = relay.openRound;
  const runOpen = relay.open;
  const held = useRef<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  /** The round whose begin was refused as handed in, kept only while that round stands. */
  const [refusedRound, setRefusedRound] = useState<string | null>(null);
  /** The word begin was refused with, when it was not the handed-in word. */
  const [stopped, setStopped] = useState<string | null>(null);
  /** Bumped by Retry so the round is begun again. */
  const [attempt, setAttempt] = useState(0);
  /** What the last refusal was, said in one line over the answer form. */
  const [refusal, setRefusal] = useState<string | null>(null);
  const [wall, setWall] = useState<WallShape | null>(null);
  const [busy, setBusy] = useState(false);
  /** A hand-in that landed while this phone watched: the receipt takes focus. */
  const [justHandedIn, setJustHandedIn] = useState(false);
  /** The response the missed line has already asked the wall about, asked once. */
  const asked = useRef<string | null>(null);
  const receipt = useRef<HTMLHeadingElement>(null);
  const { persistAnswer, forget } = useAnswerSender(response, signedIn);

  // The receipt takes the focus the hand-in button held, so nothing is dropped
  // to the page; the Shell's polite region says the same word once.
  useEffect(() => {
    if (justHandedIn) receipt.current?.focus();
  }, [justHandedIn]);

  // A new round is a fresh response: forget the one before and begin again.
  // The round the screen holds is a ref, so beginning it cannot restart this.
  useEffect(() => {
    if (round === null || round === held.current) return;
    held.current = round;
    const slot = roundSlot(participant, round);
    const stored = readProgress(token, slot);

    setResponse(stored?.response ?? null);
    setAnswers(stored?.answers ?? {});
    setSubmitted(stored?.submitted ?? false);
    setRefusedRound(null);
    setStopped(null);
    setRefusal(null);
    setWall(null);
    setJustHandedIn(false);

    forget();
    if (!runOpen || stored !== null || ended) return;
    let cancelled = false;
    // Until the begin has settled, a cancelled run lets go of the round, so
    // the run that replaces it begins again rather than waiting on an answer
    // nobody will read. Beginning twice reaches the same response.
    let settled = false;
    const going = () => !cancelled && held.current === round;
    void (async () => {
      // A phone out of reach has begun nothing, and nothing it met says the
      // round is not there: it asks again on the round's own cadence, so a
      // drop on the way in costs a poll rather than the round.
      while (going()) {
        let result: Output<"/live/p/begin"> | ApiError | null = null;
        try {
          result = signedIn
            ? await api["/live/p/begin-signed"]({ token })
            : await api["/live/p/begin"]({ token, device: deviceId() });
        } catch {
          result = null;
        }
        if (!going()) return;
        if (result === null || outOfReach(result)) {
          onReach(false);
          await new Promise<void>((wake) => {
            setTimeout(wake, ROUND_POLL_MS);
          });
          continue;
        }
        onReach(true);
        if (isApiError(result)) {
          settled = true;
          if (unsigned(signedIn, result)) {
            void onEnded();
            return;
          }
          // Only the handed-in word says handed in, and it comes back as a
          // conflict, as do a closed run and a run with no round open; the
          // fresh face says which: the first two leave no round to answer,
          // and the line over them is the run's; a round still open leaves
          // the hand-in. Any other word says what it is, with Retry.
          if (result.error !== "CONFLICT") {
            setStopped(result.error);
            return;
          }
          setRefusedRound(round);
          await refresh();
          return;
        }
        settled = true;
        setResponse(result.response);
        writeProgress(token, slot, {
          response: result.response,
          answers: {},
          submitted: false,
        });
        return;
      }
    })();
    return () => {
      cancelled = true;
      if (!settled && held.current === round) held.current = null;
    };
  }, [
    token,
    participant,
    round,
    runOpen,
    signedIn,
    ended,
    attempt,
    forget,
    refresh,
    onReach,
    onEnded,
  ]);

  // A closed run opens no round, so a phone that reloads into one has nothing
  // to begin: it reads the last round it handed in off the device and keeps
  // that wall under the closed line. A round it never handed in has no wall.
  useEffect(() => {
    if (runOpen || round !== null || response !== null) return;
    const kept = lastHandedIn(token, participant, relay);
    if (kept === null) return;
    /* eslint-disable react-hooks/set-state-in-effect -- the device says which response the closed run left */
    setResponse(kept);
    setSubmitted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [runOpen, round, response, token, participant, relay]);

  // Two tabs of one phone share the round's slot on the device. What one tab
  // writes there — an answer, a hand-in — the other reads on the storage event.
  useEffect(() => {
    if (round === null) return;
    const slot = roundSlot(participant, round);
    const key = progressKey(token, slot);
    const read = (event: StorageEvent) => {
      if (event.key !== key) return;
      const stored = readProgress(token, slot);
      if (stored === null) return;
      setResponse(stored.response);
      setAnswers(stored.answers);
      setSubmitted(stored.submitted);
    };
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [token, participant, round]);

  // The next round opening is what the phone watches for; a closed run opens none.
  useEffect(() => {
    if (!runOpen) return;
    const timer = setInterval(() => void refresh(), ROUND_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh, runOpen]);

  // After hand-in the wall shows where the answer landed, until the next round
  // opens. Only a response that is in has a wall to read, so nothing is asked
  // for one that never handed in. A closed run's wall is finished: it is read
  // once and stays on the screen.
  useEffect(() => {
    if (!submitted || response === null || ended) return;
    let cancelled = false;
    // The handle exists before the first read runs, so a finished wall can
    // stop the ticking that carried it.
    const handle: { timer?: ReturnType<typeof setInterval> } = {};
    const stop = () => {
      if (handle.timer !== undefined) clearInterval(handle.timer);
    };
    const read = async () => {
      try {
        const result = signedIn
          ? await api["/live/p/wall-signed"]({ response })
          : await api["/live/p/wall"]({ response });
        if (cancelled) return;
        if (unsigned(signedIn, result)) {
          stop();
          void onEnded();
          return;
        }
        if (isApiError(result) || result.wall === null) return;
        setWall(result.wall);
        // A closed run's wall is finished once it lands; a read that never
        // landed leaves the tick running, so a drop costs one cadence.
        if (!runOpen) stop();
      } catch {
        // The wall is a read; the next tick tries again.
      }
    };
    void read();
    handle.timer = setInterval(() => void read(), ROUND_POLL_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [submitted, response, runOpen, signedIn, ended, onEnded]);

  const remember = useCallback(
    (next: Record<string, string>, handedIn: boolean) => {
      if (response === null || held.current === null) return;
      writeProgress(token, roundSlot(participant, held.current), {
        response,
        answers: next,
        submitted: handedIn,
      });
    },
    [response, token, participant],
  );

  const draft = useCallback(
    (item: string, value: string) => {
      const next = { ...answers, [item]: value };
      setAnswers(next);
      remember(next, false);
    },
    [answers, remember],
  );

  const answer = useCallback(
    (item: string, value: string) => {
      const before = answers[item] ?? "";
      const next = { ...answers, [item]: value };
      setAnswers(next);
      remember(next, false);
      setRefusal(null);
      void persistAnswer(item, value).then(async (landing) => {
        if (landing === "saved") {
          onReach(true);
          return;
        }
        // Out of reach the answer is not refused, only not sent yet: it stays
        // on the phone, and the hand-in sends it again.
        if (landing === "unreachable") {
          onReach(false);
          return;
        }
        // A sign-in that ended keeps the value too: it is not refused, only
        // unsigned, and the hand-in sends it again after.
        if (landing === "unsigned") {
          void onEnded();
          return;
        }
        // A refused answer must not stand on the screen as one that landed.
        const back = { ...next, [item]: before };
        setAnswers(back);
        remember(back, false);
        // An answer is refused when the round closed under the phone, and the
        // fresh face says so: the round-closed line takes the form's place.
        // A phone that still has a round to answer met the network instead.
        await refresh();
        setRefusal("That answer didn't save. Try again.");
      });
    },
    [answers, remember, persistAnswer, refresh, onReach, onEnded],
  );

  /** Every box the round captured, answered: what a hand-in is taken on. */
  const whole = useMemo(
    () => wholeOf(relay.questions, answers),
    [relay.questions, answers],
  );

  /**
   * A refused hand-in reads which word stands behind it. The wall answers only
   * for a response that is in, so it is the receipt: it tells a second tab of
   * one phone that the first tab already handed this very response in. Failing
   * that, the fresh face says whether the round closed, and the round-closed
   * line takes the form's place. A hand-in that never reached Commons carries
   * no word, so it keeps its own sentence.
   */
  const settle = useCallback(
    async (error: string | null) => {
      if (response === null) return;
      try {
        const standing = signedIn
          ? await api["/live/p/wall-signed"]({ response })
          : await api["/live/p/wall"]({ response });
        if (unsigned(signedIn, standing)) {
          void onEnded();
          return;
        }
        if (!isApiError(standing) && standing.wall !== null) {
          if (error !== null) toast.error(refusalSentence("ALREADY_SUBMITTED"));
          onReach(true);
          setSubmitted(true);
          setJustHandedIn(true);
          setWall(standing.wall);
          remember(answers, true);
          return;
        }
      } catch {
        // Out of reach is not refused; the line stands until a hand-in lands.
      }
      // Nothing got through, so nothing is refused: the answers stay on the
      // phone and Hand in stands, as the connection line says.
      if (error !== null && OUT_OF_REACH.has(error)) {
        onReach(false);
        return;
      }
      await refresh();
      setRefusal(
        error === null
          ? "Not handed in. Try again."
          : // A hand-in refused with a box still blank is the round's own
            // rule: every box it captured is answered, or it is not in.
            saidRefusal(
              error,
              error === "CONFLICT" && !whole ? "INCOMPLETE" : null,
            ),
      );
    },
    [response, answers, whole, remember, refresh, onReach, onEnded, signedIn],
  );

  const handIn = useCallback(async () => {
    if (response === null) return;
    // The button is dead where the round would refuse, so this is the second
    // door: a hand-in reaching here unwhole is told the round's own rule.
    if (!whole) {
      setRefusal(refusalSentence("INCOMPLETE"));
      return;
    }
    setBusy(true);
    setRefusal(null);
    try {
      // Hand-in flushes anything typed but not yet committed by a blur.
      for (const [item, value] of Object.entries(answers)) {
        const trimmed = value.trim();
        if (trimmed === "") continue;
        const landing = await persistAnswer(item, trimmed);
        if (landing === "unreachable") {
          onReach(false);
          return;
        }
        if (landing === "unsigned") {
          void onEnded();
          return;
        }
        if (landing === "refused") {
          await settle(null);
          return;
        }
      }
      const result = signedIn
        ? await api["/live/p/submit-signed"]({ response })
        : await api["/live/p/submit"]({ response });
      if (unsigned(signedIn, result)) {
        void onEnded();
        return;
      }
      if (isApiError(result)) {
        await settle(result.error);
        return;
      }
      onReach(true);
      setSubmitted(true);
      setJustHandedIn(true);
      remember(answers, true);
    } catch {
      await settle(null);
    } finally {
      setBusy(false);
    }
  }, [
    response,
    answers,
    whole,
    persistAnswer,
    remember,
    settle,
    onReach,
    onEnded,
    signedIn,
  ]);

  const openRound = relay.rounds.find(
    (candidate) => candidate.round !== null && candidate.open === true,
  );
  const nextRound = relay.rounds.find((candidate) => candidate.round === null);
  const questions = relay.questions;
  // Begin answers the same response over again; it refuses only a participant
  // already handed in. Refused against a round still open, it says: you are in.
  const handedIn =
    submitted || (refusedRound !== null && refusedRound === round);
  // A phone whose sign-in ended keeps its answers on the screen and sends
  // nothing until it is signed in again.
  const answering =
    !handedIn && runOpen && round !== null && response !== null && !ended;
  // Out of reach the screen keeps the round it has and says so in one line: a
  // phone with answers on it is told they stay there.
  const connection = offline
    ? answering
      ? ANSWERS_KEPT
      : NO_CONNECTION
    : null;
  // A round that closes before this phone hands in takes its answers with it:
  // nothing it wrote became a card, so the round leaves it only the word that
  // it closed. What was handed in stands, on the wall the phone keeps reading.
  const missed = round === null && response !== null && !submitted;

  // The wall answers only for a response that is in, so it is the receipt here
  // too: a tab whose sibling handed this round in reads it there, once, before
  // the missed line stands.
  useEffect(() => {
    if (!missed || response === null || asked.current === response) return;
    asked.current = response;
    let cancelled = false;
    void (async () => {
      try {
        const standing = signedIn
          ? await api["/live/p/wall-signed"]({ response })
          : await api["/live/p/wall"]({ response });
        if (cancelled) return;
        if (unsigned(signedIn, standing)) {
          void onEnded();
          return;
        }
        if (isApiError(standing) || standing.wall === null) return;
        setSubmitted(true);
        setWall(standing.wall);
        remember(answers, true);
      } catch {
        // Out of reach is not a hand-in; the missed line stands.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missed, response, answers, remember, signedIn, onEnded]);

  // Where you landed, on a screen one hand holds: this phone's own cards
  // first, then the piles, each wearing this phone's card on its face. The
  // rest of the tray is a count — a room writes more cards than a phone can
  // read. A vote wall carries bars, not cards, and holds no tray to count.
  const landed = useMemo(() => {
    if (wall === null) return null;
    const mine = wall.cards.filter((card) => card.mine);
    if (choicesOf(wall).length > 0) return { wall, mine, inTray: 0 };
    return {
      wall: { ...wall, cards: wall.cards.filter((card) => card.pile !== null) },
      mine,
      inTray: trayOf(wall.cards).filter((card) => !card.mine).length,
    };
  }, [wall]);

  return (
    <Shell said={justHandedIn ? "Handed in" : ""}>
      <div className={cn("flex flex-col gap-5", answering && "pb-28")}>
        {/* The name of what you are in is the phone's own line: a round with
            a long title of its own never takes it away. */}
        <header className="flex flex-col gap-2">
          <h1
            className="line-clamp-2 font-display text-[22px] font-semibold tracking-tight"
            dir="auto"
          >
            {relay.title}
          </h1>
          {openRound === undefined ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {relay.rounds.map((candidate) => (
                <RoundToken
                  key={candidate.number}
                  number={candidate.number}
                  title={
                    candidate.number === nextRound?.number
                      ? candidate.title
                      : undefined
                  }
                  standing={standingOf(candidate)}
                  size="sm"
                />
              ))}
            </span>
          ) : (
            <RoundToken
              className="min-w-0"
              number={openRound.number}
              title={openRound.title}
              standing="open"
              size="sm"
            />
          )}
        </header>

        {ended ? (
          <SignInEnded next={`/q/${token}`} />
        ) : connection === null ? null : (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
          >
            <span>{connection}</span>
            <Button
              size="sm"
              variant="outline"
              aria-label="Retry the connection"
              onClick={() => void refresh()}
            >
              Retry
            </Button>
          </div>
        )}

        {handedIn ? (
          <>
            <div className="flex flex-col items-center gap-2 pt-1 pb-2 text-center">
              <CheckCircle2
                aria-hidden="true"
                strokeWidth={1.5}
                className="size-10 text-muted-foreground"
              />
              {/* The receipt takes the focus the hand-in button held. */}
              <h2
                ref={receipt}
                tabIndex={-1}
                className="font-display text-lg font-semibold outline-none"
              >
                Handed in
              </h2>
              {landed === null || landed.mine.length === 0 ? null : (
                <div className="flex flex-wrap justify-center gap-2">
                  {/* These cards stand where the phone landed, off the wall's
                      own layout, so they hold still while it sorts below. */}
                  {landed.mine.map((card) => (
                    <AnswerCard key={card.card} card={card} still />
                  ))}
                </div>
              )}
              {round !== null && runOpen ? null : (
                <p className="text-muted-foreground text-sm">
                  {waitingLine(relay)}
                </p>
              )}
            </div>
            {landed === null ? null : (
              <>
                {/* The figure counts the room, not this phone, so it says so. */}
                <p className="flex items-baseline gap-2 text-muted-foreground text-sm">
                  <Figure
                    className="min-w-0"
                    value={landed.wall.handedIn}
                    of={landed.wall.begun}
                    size="sm"
                  />
                  handed in
                </p>
                {landed.inTray === 0 ? null : (
                  <p className="text-muted-foreground text-sm">
                    {landed.inTray} more in the tray
                  </p>
                )}
                <Wall wall={landed.wall} phone carriesTo={nextRound?.number} />
              </>
            )}
          </>
        ) : missed ? (
          <Line>
            The round closed before you handed in.
            <br />
            {waitingLine(relay)}
          </Line>
        ) : !runOpen || round === null ? (
          <Line>{waitingLine(relay)}</Line>
        ) : stopped !== null ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
          >
            <span>{beginRefusal(stopped)}</span>
            <Button
              size="sm"
              variant="outline"
              aria-label="Retry joining the round"
              onClick={() => {
                held.current = null;
                setAttempt((standing) => standing + 1);
              }}
            >
              Retry
            </Button>
          </div>
        ) : response === null ? (
          <LoadingState label="Opening…" />
        ) : (
          <>
            {refusal === null ? null : (
              <p role="alert" className="text-destructive text-sm">
                {refusal}
              </p>
            )}
            {questions.map((question) => (
              <RoundQuestionCard
                key={question.question}
                question={question}
                answers={answers}
                onAnswer={answer}
                onDraft={draft}
              />
            ))}
          </>
        )}
      </div>

      {answering ? (
        <HandInBar
          answered={answeredOf(questions, answers)}
          of={itemCountOf(questions)}
          busy={busy}
          refusal={whole ? null : refusalSentence("INCOMPLETE")}
          onHandIn={() => void handIn()}
        />
      ) : null}
    </Shell>
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
  const promptId = `prompt-${question.question}`;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        {/* The number keeps its own column so a wrapped prompt holds its edge. */}
        <h2 className="flex items-start gap-2 font-medium" dir="auto">
          <span className="w-6 shrink-0 text-muted-foreground tabular-nums">
            {index + 1}.
          </span>
          <span className="min-w-0 flex-1" id={promptId}>
            {question.prompt}
          </span>
        </h2>
        {choices.length > 0 ? (
          <div className="flex flex-col gap-2">
            {choices.map((choice) => (
              <Choice
                key={choice}
                choice={choice}
                picked={value === choice}
                onPick={() => onAnswer(choice)}
              />
            ))}
          </div>
        ) : (
          // The field stays uncontrolled — typing drafts, blur commits — so
          // nothing has to be synced from props into state during render. Every
          // blur commits: the draft it would compare against is the same state
          // typing just wrote, and the sender knows what it has already sent.
          <Input
            className="h-11"
            dir="auto"
            // The prompt above is the box's name; the placeholder is not one.
            aria-labelledby={promptId}
            defaultValue={value}
            placeholder="Your answer"
            onChange={(event) => onDraft(event.currentTarget.value)}
            onBlur={(event) => {
              const next = event.currentTarget.value.trim();
              if (next === "") return;
              event.currentTarget.value = next;
              onAnswer(next);
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
