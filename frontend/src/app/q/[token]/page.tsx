"use client";

import { CheckCircle2, CircleSlash } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { HandInBar } from "@/components/live/phone-bar";
import {
  answeredOf,
  itemCountOf,
  QuestionCard as RoundQuestionCard,
} from "@/components/live/phone-question";
import { Card as AnswerCard } from "@/components/live/pile";
import { Figure, RoundToken } from "@/components/live/round-token";
import {
  choicesOf,
  standingOf,
  type Wall as WallShape,
} from "@/components/live/rounds";
import { Wall } from "@/components/live/wall";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, isApiError, type Output } from "@/lib/api";
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
 * overtake it. A write that did not land answers false; what to say about it,
 * and what to do with the value on the screen, belongs to the screen.
 */
function useAnswerSender(response: string | null) {
  const sent = useRef<Record<string, string>>({});
  const pending = useRef<Record<string, Promise<boolean>>>({});

  const forget = useCallback(() => {
    sent.current = {};
    pending.current = {};
  }, []);

  const persistAnswer = useCallback(
    (question: string, value: string): Promise<boolean> => {
      if (response === null) return Promise.resolve(false);
      const prior = pending.current[question] ?? Promise.resolve(true);
      const write = prior.then(async () => {
        if (sent.current[question] === value) return true;
        try {
          const result = await api["/live/p/answer"]({
            response,
            question,
            value,
          });
          if (!isApiError(result)) {
            sent.current[question] = value;
            return true;
          }
        } catch {
          // A transport failure and a refusal come to the same thing here: the
          // value is not on the server, and the local draft still holds it.
        }
        return false;
      });
      pending.current[question] = write;
      return write;
    },
    [response],
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
  const { persistAnswer, forget } = useAnswerSender(response);
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
    forget();
    submissionUncertain.current = false;
    reconciledResponse.current = null;
  }, [authLoading, signedParticipant, token, forget]);

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
      // One token opens onto either a questionnaire run or a relay run.
      const arrived = "relay" in result ? null : result.face;
      setFace(arrived ?? null);
      setRelay("relay" in result ? (result.relay ?? null) : null);
      return arrived ?? null;
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
        const result = await api["/live/p/outcome"]({ response });
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
  }, [submitted, response, outcomeRetry]);

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
      void persistAnswer(question, value).then((saved) => {
        if (saved) return;
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
      const result = await api["/live/p/outcome"]({ response });
      if (isApiError(result) || result.received !== true) return false;
      rememberSubmitted(result);
      return true;
    } catch {
      return false;
    }
  }, [response, rememberSubmitted]);

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
        if (!saved) {
          toast.error("That answer didn't save. Try again.");
          return;
        }
      }
      const result = await api["/live/p/submit"]({ response });
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
      <HandInBar
        answered={
          Object.values(answers).filter((value) => value.trim() !== "").length
        }
        of={face.questions.length}
        disabled={busy || (isQuiz && !complete)}
        onHandIn={() => void submit()}
      />
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

/** Where the phone stands, in one line, when it has no round to answer. */
function Line({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center text-muted-foreground">{children}</p>;
}

/** A response is per round, so each round keeps its own slot on the device. */
function roundSlot(participant: string, round: string): string {
  return `${participant}:${round}`;
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
  refresh,
}: {
  token: string;
  relay: Relay;
  participant: string;
  signedIn: boolean;
  refresh: () => Promise<Face | null>;
}) {
  const round = relay.openRound;
  const runOpen = relay.open;
  const held = useRef<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  /** The round whose begin was refused, kept only while that round stands. */
  const [refusedRound, setRefusedRound] = useState<string | null>(null);
  /** What the last refusal was, said in one line over the answer form. */
  const [refusal, setRefusal] = useState<string | null>(null);
  const [wall, setWall] = useState<WallShape | null>(null);
  const [busy, setBusy] = useState(false);
  const { persistAnswer, forget } = useAnswerSender(response);

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
    setRefusal(null);
    setWall(null);

    forget();
    if (!runOpen || stored !== null) return;
    void (async () => {
      try {
        const result = signedIn
          ? await api["/live/p/begin-signed"]({ token })
          : await api["/live/p/begin"]({ token, device: deviceId() });
        if (held.current !== round) return;
        if (isApiError(result)) {
          setRefusedRound(round);
          await refresh();
          return;
        }
        setResponse(result.response);
        writeProgress(token, slot, {
          response: result.response,
          answers: {},
          submitted: false,
        });
      } catch {
        toast.error("Could not join. Check your connection and try again.");
      }
    })();
  }, [token, participant, round, runOpen, signedIn, forget, refresh]);

  // The next round opening is what the phone watches for; a closed run opens none.
  useEffect(() => {
    if (!runOpen) return;
    const timer = setInterval(() => void refresh(), ROUND_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh, runOpen]);

  // After hand-in the wall shows where the answer landed, until the next round opens.
  useEffect(() => {
    if (!submitted || response === null || !runOpen) return;
    let cancelled = false;
    const read = async () => {
      try {
        const result = await api["/live/p/wall"]({ response });
        if (cancelled || isApiError(result) || result.wall === null) return;
        setWall(result.wall);
      } catch {
        // The wall is a read; the next tick tries again.
      }
    };
    void read();
    const timer = setInterval(() => void read(), ROUND_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [submitted, response, runOpen]);

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
      void persistAnswer(item, value).then((saved) => {
        if (saved) return;
        // A refused answer must not stand on the screen as one that landed.
        const back = { ...next, [item]: before };
        setAnswers(back);
        remember(back, false);
        setRefusal("That answer didn't save. Try again.");
      });
    },
    [answers, remember, persistAnswer],
  );

  /**
   * A refused hand-in settles which refusal it was. The wall answers only for
   * a response that is in, so it is the receipt: it tells a second tab of one
   * phone that the first tab already handed this very response in. Anything
   * else leaves the round to say whether there is still a form to hand in.
   */
  const settle = useCallback(async () => {
    if (response === null) return;
    try {
      const standing = await api["/live/p/wall"]({ response });
      if (!isApiError(standing) && standing.wall !== null) {
        setSubmitted(true);
        setWall(standing.wall);
        remember(answers, true);
        return;
      }
    } catch {
      // Out of reach is not refused; the line stands until a hand-in lands.
    }
    setRefusal("That didn't hand in. Try again.");
    await refresh();
  }, [response, answers, remember, refresh]);

  const handIn = useCallback(async () => {
    if (response === null) return;
    setBusy(true);
    setRefusal(null);
    try {
      // Hand-in flushes anything typed but not yet committed by a blur.
      for (const [item, value] of Object.entries(answers)) {
        const trimmed = value.trim();
        if (trimmed === "") continue;
        const saved = await persistAnswer(item, trimmed);
        if (!saved) {
          await settle();
          return;
        }
      }
      const result = await api["/live/p/submit"]({ response });
      if (isApiError(result)) {
        await settle();
        return;
      }
      setSubmitted(true);
      remember(answers, true);
    } catch {
      await settle();
    } finally {
      setBusy(false);
    }
  }, [response, answers, persistAnswer, remember, settle]);

  const openRound = relay.rounds.find(
    (candidate) => candidate.round !== null && candidate.open === true,
  );
  const nextRound = relay.rounds.find((candidate) => candidate.round === null);
  const questions = relay.questions;
  // Begin answers the same response over again; it refuses only a participant
  // already handed in. Refused against a round still open, it says: you are in.
  const handedIn =
    submitted || (refusedRound !== null && refusedRound === round);
  const answering = !handedIn && runOpen && round !== null && response !== null;
  // A round that closes before this phone hands in takes its answers with it:
  // nothing it wrote became a card, so the round leaves it only the word that
  // it closed. What was handed in stands, on the wall the phone keeps reading.
  const missed = round === null && response !== null && !submitted;
  // A vote wall carries bars, not cards, so the choice this phone cast has
  // nowhere to stand on it but here.
  const voted =
    wall !== null && choicesOf(wall).length > 0
      ? wall.cards.find((card) => card.mine)
      : undefined;

  return (
    <Shell>
      <div className={cn("flex flex-col gap-5", answering && "pb-28")}>
        <header className="flex items-center justify-between gap-4">
          <h1
            className="min-w-0 truncate font-display text-[22px] font-semibold tracking-tight"
            dir="auto"
          >
            {relay.title}
          </h1>
          {openRound === undefined ? (
            <span className="inline-flex flex-none items-center gap-1.5">
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
              className="flex-none"
              number={openRound.number}
              title={openRound.title}
              standing="open"
              size="sm"
            />
          )}
        </header>

        {handedIn ? (
          <>
            <div className="flex flex-col items-center gap-2 pt-1 pb-2 text-center">
              <CheckCircle2
                aria-hidden="true"
                strokeWidth={1.5}
                className="size-10 text-muted-foreground"
              />
              <h2 className="font-display text-lg font-semibold">Handed in</h2>
              {voted === undefined ? null : <AnswerCard card={voted} />}
              {runOpen ? null : (
                <p className="text-muted-foreground text-sm">
                  The run is closed.
                </p>
              )}
            </div>
            {wall !== null ? (
              <>
                <Figure value={wall.handedIn} of={wall.begun} size="sm" />
                <Wall wall={wall} phone carriesTo={nextRound?.number} />
              </>
            ) : null}
          </>
        ) : missed ? (
          <Line>The round closed before you handed in.</Line>
        ) : !runOpen ? (
          <Line>The run is closed.</Line>
        ) : round === null ? (
          <Line>Next round soon</Line>
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
          disabled={busy}
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
          // nothing has to be synced from props into state during render. Every
          // blur commits: the draft it would compare against is the same state
          // typing just wrote, and the sender knows what it has already sent.
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
