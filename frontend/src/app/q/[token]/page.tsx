"use client";

import { CheckCircle2, CircleSlash } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Fact, Facts } from "@/components/facts";
import { HandInBar } from "@/components/live/phone-bar";
import { identityLine, trayLine } from "@/components/live/phone-lines";
import {
  answeredOf,
  Choice,
  itemCountOf,
  QuestionCard as RoundQuestionCard,
  WrittenBox,
  wholeOf,
} from "@/components/live/phone-question";
import { Card as AnswerCard } from "@/components/live/pile";
import { refusalSentence, saidRefusal } from "@/components/live/refusals";
import { RoundStrip, RoundToken } from "@/components/live/round-token";
import {
  choicesOf,
  standingOf,
  trayOf,
  type Wall as WallShape,
} from "@/components/live/rounds";
import { roomFigures, Wall } from "@/components/live/wall";
import { SIGN_IN_ENDED, SignInEnded } from "@/components/sign-in-ended";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dueAt, useClock, useHeard } from "@/hooks/use-adrift";
import {
  type ApiError,
  api,
  isApiError,
  type Output,
  publicErrorMessage,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  adrift,
  NO_CONNECTION,
  outOfReach,
  PHONE_STALE_MS,
  POLL_CAP_MS,
  POLL_DEADLINE_MS,
  STALE_MS,
  startPolling,
} from "@/lib/poll";
import { signInHref } from "@/lib/sign-in-return";
import { cn } from "@/lib/utils";

type Arrival = Output<"/live/p/arrive">;
type Face = NonNullable<Extract<Arrival, { face: unknown }>["face"]>;
/** A relay run answers Arrive under `relay`: the rounds, and the open one's question. */
type Relay = NonNullable<Extract<Arrival, { relay: unknown }>["relay"]>;
/** What one arrive read found: an answer, whatever it said, or nothing at all. */
type FaceRead = { reached: true; face: Face | null } | { reached: false };
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

const OUTCOME_POLL_MS = 1_500;
const ROUND_POLL_MS = 3_000;

/** What a phone out of reach says while answers are on it. */
const ANSWERS_KEPT = "No connection. Your answers stay on this phone.";

/** What the phone says over a result that was refused to it. */
const RESULT_REFUSED = "Result did not load. Try again.";

/**
 * A phone's pollers learn that the network or the page came back, and ask
 * nothing while the page is off the screen. While the strip stands they
 * try at most two cadences apart, so the strip never outlives one try's
 * silence once the network is back.
 */
function pollerOptions(hurry: () => number) {
  return {
    wakeOn: true,
    pauseWhileHidden: true,
    capMs: hurry,
  } as const;
}

/** The longest wait between tries, shortened while the strip stands. */
function useHurry(stripUp: boolean): () => number {
  const up = useRef(stripUp);
  useEffect(() => {
    up.current = stripUp;
  }, [stripUp]);
  return useCallback(() => (up.current ? ROUND_POLL_MS * 2 : POLL_CAP_MS), []);
}

/** What the strip says, if it says anything: a pressed action's own word first, then the silence. */
function stripWord(
  said: string | null,
  silent: boolean,
  answering: boolean,
): string | null {
  if (said !== null) return said;
  if (!silent) return null;
  return answering ? ANSWERS_KEPT : NO_CONNECTION;
}

/**
 * Where a written answer landed: on the server, refused, nowhere, or refused
 * because the phone's sign-in no longer stands.
 */
type Landing = "saved" | "refused" | "unreachable" | "unsigned";

/** The HTTP boundary uses the same category for required and expired sign-in. */
function unsigned(result: unknown): boolean {
  return isApiError(result) && result.error === "UNAUTHORIZED";
}

/** A closed round's wall stops moving once no ask is out and no sort is pending. */
function wallHasSettled(wall: WallShape): boolean {
  return !wall.open && !wall.sortPending && wall.asksOut === 0;
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
          if (unsigned(result)) return "unsigned";
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

/**
 * How this device reached the token. The join page says so in the address, and
 * the answer is kept against the token, so a reload still knows it. A device
 * that opened the link or scanned the code says nothing and is anonymous.
 */
function useArrivedBy(token: string): string | null {
  const asked = useSearchParams().get("by");
  const [arrival, setArrival] = useState<string | null>(null);

  useEffect(() => {
    const key = `commons-live-by-${token}`;
    let kept = asked;
    try {
      if (asked === null) kept = window.sessionStorage.getItem(key);
      else window.sessionStorage.setItem(key, asked);
    } catch {
      // A browser that refuses storage reads the address alone.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the device's own storage is read once it is there to read
    setArrival(kept);
  }, [asked, token]);

  return arrival;
}

export default function ParticipantPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <LoadingState label="Opening…" />
        </Shell>
      }
    >
      <ParticipantContent />
    </Suspense>
  );
}

function ParticipantContent() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const arrivedBy = useArrivedBy(token);
  const { me, loading: authLoading, logout } = useAuth();
  const [face, setFace] = useState<Face | null>(null);
  const [relay, setRelay] = useState<Relay | null>(null);
  const [missing, setMissing] = useState(false);
  /** When any request last got through; nothing has yet while null. */
  const [heardAt, setHeardAt] = useState<number | null>(null);
  /** The last arrive was out of reach; nothing on the screen yet says so after ten seconds. */
  const [lost, setLost] = useState(false);
  /** A pressed action's own word, said at once and taken away by the next answer. */
  const [said, setSaid] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());
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
  const signIn = useCallback(() => {
    router.replace(
      signInHref(
        window.location.pathname +
          window.location.search +
          window.location.hash,
      ),
    );
  }, [router]);
  const onEnded = useCallback(async () => {
    if (me === null) {
      signIn();
      return;
    }
    try {
      const probe = await api.auth.me();
      if (!("error" in probe)) return;
    } catch {
      return;
    }
    setEnded(true);
  }, [me, signIn]);
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

  const requireSignIn = (face ?? relay)?.requireSignIn;
  const needsSignIn = requireSignIn === true && !authLoading && me === null;
  const participationReady =
    progressBelongsToViewer &&
    progressReady &&
    requireSignIn !== undefined &&
    !needsSignIn &&
    !ended;

  useEffect(() => {
    if (needsSignIn) signIn();
  }, [needsSignIn, signIn]);

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

  /**
   * A request got through, whichever it was: the poll, a read, an action.
   * The moment is what the strip is read against, and an action's word goes
   * with it, so a word never outlives the drop that put it up.
   */
  const heard = useCallback(() => {
    setHeardAt(Date.now());
    setLost(false);
    setSaid(null);
  }, []);

  /** A pressed action went out of reach: the student is told at once, once. */
  const failed = useCallback((word: string) => {
    setSaid(word);
  }, []);

  // A poll gives up on an arrive nobody answers; a one-off read carries no
  // deadline of its own and waits on the server's.
  const loadFace = useCallback(
    async (call?: { timeoutMs: number }): Promise<FaceRead> => {
      try {
        const result = await api["/live/p/arrive"]({ token }, call);
        // Out of reach says nothing about the token: what is on the screen —
        // the round, the relay, the answers — stays, and the next poll recovers.
        if (outOfReach(result)) {
          setLost(true);
          return { reached: false };
        }
        heard();
        if (isApiError(result)) {
          setMissing(true);
          return { reached: true, face: null };
        }
        setMissing(false);
        // One token opens onto either a questionnaire run or a relay run.
        const arrived = "relay" in result ? null : result.face;
        setFace(arrived ?? null);
        setRelay("relay" in result ? (result.relay ?? null) : null);
        return { reached: true, face: arrived ?? null };
      } catch {
        setLost(true);
        return { reached: false };
      }
    },
    [token, heard],
  );

  // Arrive. The first read has a deadline too, so a server that answers
  // nothing is met by the poller below and not waited on for good.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state lands after the awaited fetch, as in use-query
    void loadFace({ timeoutMs: POLL_DEADLINE_MS });
  }, [loadFace]);

  // One poller reads arrive for both screens: on a questionnaire, for the run
  // closing under us while answering; on a relay, for the next round opening.
  // The effect keys on the booleans it needs, so a fresh face object each tick
  // does not tear the poller down and rebuild it.
  const arrived = face !== null;
  const open = face?.open ?? false;
  const relaying = relay !== null;
  const relayOpen = relay?.open ?? false;
  // A phone that never got through polls too, so a drop on the way in comes
  // back on its own rather than waiting on the Retry.
  const reaching = lost && !arrived && !relaying;
  const watching =
    reaching || (relaying ? relayOpen : arrived && open && !submitted);
  // The result is the one screen still asking after a hand-in, until the
  // score lands or the result is refused.
  const scored =
    outcome !== null &&
    (!("outcome" in outcome) ||
      (formedOutcomeOf(outcome)?.score ?? null) !== null);
  const scoring =
    participationReady && submitted && response !== null && !scored;

  // The strip is read against a clock that lives as long as something polls:
  // a phone on its settled result has nothing to be late with. A poll's
  // misses say nothing until the phone has had no answer for forty-two seconds
  // with a round on the screen; on an empty screen there is no continuity to
  // protect, and the error state with its Retry comes after ten.
  const { now, resumedAt } = useClock(
    reaching || watching || scoring,
    ROUND_POLL_MS,
    [dueAt(heardAt, PHONE_STALE_MS), dueAt(openedAt, STALE_MS)],
  );
  const { latest, before } = useHeard(heardAt, resumedAt);
  const silent =
    (arrived || relaying) && adrift(latest, before, now, PHONE_STALE_MS);
  const openingFailed = lost && now - Math.max(openedAt, resumedAt) >= STALE_MS;
  const stripUp = said !== null || silent;
  const hurry = useHurry(stripUp);

  useEffect(() => {
    if (!watching) return;
    // The arrive above has already read once, so the first poll is a cadence out.
    return startPolling(
      async () => (await loadFace({ timeoutMs: POLL_DEADLINE_MS })).reached,
      { everyMs: ROUND_POLL_MS, atOnce: false, ...pollerOptions(hurry) },
    );
  }, [watching, loadFace, hurry]);

  // After hand-in, poll the outcome until the grade lands (surveys answer at once).
  useEffect(() => {
    if (!participationReady || !submitted || response === null) return;
    let cancelled = false;
    // The handle exists before the first poll runs, so neither the poll nor the
    // cleanup closes over a binding that does not exist yet.
    const handle: { stop?: () => void } = {};
    const stop = () => {
      cancelled = true;
      handle.stop?.();
    };
    const poll = async () => {
      try {
        const result = me
          ? await api["/live/p/outcome-signed"](
              { response },
              { timeoutMs: POLL_DEADLINE_MS },
            )
          : await api["/live/p/outcome"](
              { response },
              { timeoutMs: POLL_DEADLINE_MS },
            );
        if (cancelled) return true;
        // A drop is a miss the poller waits out; the strip says it in time.
        if (outOfReach(result)) return false;
        heard();
        if (isApiError(result)) {
          stop();
          if (unsigned(result)) {
            void onEnded();
            return true;
          }
          // A refused result is not asked for again until Retry.
          setOutcomeError(RESULT_REFUSED);
          return true;
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
        return true;
      } catch {
        return false;
      }
    };
    handle.stop = startPolling(poll, {
      everyMs: OUTCOME_POLL_MS,
      atOnce: true,
      ...pollerOptions(hurry),
    });
    return stop;
  }, [
    participationReady,
    submitted,
    response,
    outcomeRetry,
    me,
    onEnded,
    heard,
    hurry,
  ]);

  const begin = useCallback(async () => {
    if (!participationReady || participant === null) return;
    setBusy(true);
    try {
      const result = me
        ? await api["/live/p/begin-signed"]({ token })
        : await api["/live/p/begin"]({ token, device: deviceId() });
      // Out of reach nobody has joined anything; the Join button stands,
      // and the strip says why.
      if (outOfReach(result)) {
        failed(NO_CONNECTION);
        return;
      }
      heard();
      if (isApiError(result)) {
        if (unsigned(result)) {
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
        if (current.reached && current.face?.open) setAlreadyIn(true);
        return;
      }
      setResponse(result.response);
      writeProgress(token, participant, {
        response: result.response,
        answers,
        submitted: false,
      });
    } catch {
      failed(NO_CONNECTION);
    } finally {
      setBusy(false);
    }
  }, [
    participationReady,
    me,
    token,
    participant,
    answers,
    loadFace,
    onEnded,
    heard,
    failed,
  ]);

  // Typing counts at once — the hand-in button must not stay dead under a
  // finger while a written answer sits uncommitted — but the network only
  // hears committed values: blur, or the hand-in flush.
  const draftAnswer = useCallback(
    (question: string, value: string) => {
      if (!participationReady || response === null || participant === null)
        return;
      const next = { ...answers, [question]: value };
      setAnswers(next);
      writeProgress(token, participant, {
        response,
        answers: next,
        submitted: false,
      });
    },
    [participationReady, response, participant, answers, token],
  );

  const answer = useCallback(
    (question: string, value: string) => {
      if (!participationReady || response === null || participant === null)
        return;
      const held = answers[question] ?? "";
      const next = { ...answers, [question]: value };
      setAnswers(next);
      writeProgress(token, participant, {
        response,
        answers: next,
        submitted: false,
      });
      void persistAnswer(question, value).then((landing) => {
        if (landing === "saved") {
          heard();
          return;
        }
        // A sign-in that ended keeps the value on the phone: it is not
        // refused, only unsigned, and the hand-in sends it again after.
        if (landing === "unsigned") {
          void onEnded();
          return;
        }
        // Out of reach the answer is not refused, only not sent: it stays on
        // the phone, and the hand-in sends it again; the strip says so now.
        if (landing === "unreachable") {
          failed(ANSWERS_KEPT);
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
    [
      participationReady,
      response,
      participant,
      answers,
      token,
      persistAnswer,
      onEnded,
      heard,
      failed,
    ],
  );

  const rememberSubmitted = useCallback(
    (received?: Outcome) => {
      if (!participationReady || response === null || participant === null)
        return;
      submissionUncertain.current = false;
      heard();
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
    [participationReady, response, participant, token, answers, heard],
  );

  // A hand-in may commit even when its HTTP response is lost. Outcome is the
  // authoritative receipt, so it also reconciles an uncertain retry or reload.
  const recoverSubmission = useCallback(async (): Promise<boolean> => {
    if (!participationReady || response === null) return false;
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
  }, [participationReady, response, rememberSubmitted, me]);

  useEffect(() => {
    if (
      !participationReady ||
      submitted ||
      response === null ||
      reconciledResponse.current === response
    )
      return;
    reconciledResponse.current = response;
    void recoverSubmission();
  }, [participationReady, submitted, response, recoverSubmission]);

  const submit = useCallback(async () => {
    if (!participationReady || response === null || participant === null)
      return;
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
          failed(ANSWERS_KEPT);
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
        failed(ANSWERS_KEPT);
        return;
      }
      heard();
      if (unsigned(result)) {
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
      failed(ANSWERS_KEPT);
    } finally {
      setBusy(false);
    }
  }, [
    participationReady,
    response,
    participant,
    answers,
    loadFace,
    persistAnswer,
    recoverSubmission,
    rememberSubmitted,
    me,
    onEnded,
    heard,
    failed,
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

  if (needsSignIn || authLoading) {
    return (
      <Shell>
        <LoadingState
          label={
            needsSignIn ? "Redirecting to sign in…" : "Checking your session…"
          }
        />
      </Shell>
    );
  }

  if (relay !== null) {
    if (!progressReady || !progressBelongsToViewer || participant === null) {
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
        holder={identityLine(me?.profile.displayName ?? null, arrivedBy)}
        signedIn={me !== null}
        silent={silent}
        said={said}
        hurry={hurry}
        ended={ended}
        onEnded={onEnded}
        onHeard={heard}
        onFailed={failed}
        refresh={loadFace}
      />
    );
  }

  if (face === null || !progressReady || !progressBelongsToViewer) {
    // A late joiner in the doorway has no continuity to protect: after ten
    // seconds with nothing to show, the one Retry the phone offers on its own.
    if (openingFailed) {
      return (
        <Shell>
          <ErrorState message={NO_CONNECTION} onRetry={() => void loadFace()} />
        </Shell>
      );
    }
    return (
      <Shell>
        <LoadingState label="Opening…" />
      </Shell>
    );
  }

  // The phone has a round, a result, or a cover on it, so what is wrong is
  // said in one strip over the header, and the screen holds still beneath.
  const connection = {
    word: stripWord(said, silent, response !== null && !submitted && face.open),
    onRetry: () => void loadFace(),
  };

  if (submitted) {
    return (
      <Shell
        title={face.title}
        said={justHandedIn ? "Handed in" : ""}
        notice={notice}
        connection={connection}
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
      <Shell title={face.title} connection={connection}>
        <EmptyState
          icon={CircleSlash}
          title={`This ${face.form} has been closed`}
        />
      </Shell>
    );
  }

  if (alreadyIn) {
    return (
      <Shell title={face.title} connection={connection}>
        <EmptyState icon={CheckCircle2} title="Already handed in" />
      </Shell>
    );
  }

  if (response === null) {
    return (
      <Shell title={face.title} notice={notice} connection={connection}>
        <div className="flex min-h-[55dvh] flex-col items-center justify-center gap-4 py-10">
          <Facts className="justify-center text-muted-foreground">
            <Fact.Kind>{isQuiz ? "Quiz" : "Survey"}</Fact.Kind>
            <Fact.Count n={face.questions.length} noun="question" />
          </Facts>
          <div className="flex flex-col items-center text-center">
            <p className="text-muted-foreground text-sm" dir="auto">
              {identityLine(me?.profile.displayName ?? null, arrivedBy)}
            </p>
            {me !== null ? (
              <Button variant="link" size="sm" onClick={() => void logout()}>
                Not you? Sign out
              </Button>
            ) : null}
          </div>
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
    <Shell title={face.title} notice={notice} connection={connection}>
      <div className="flex flex-col gap-4 pb-28">
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

/**
 * One strip over the header, fixed to the top of the viewport inside the
 * safe area: it covers the title and the round chip, nothing tappable, and
 * the screen beneath does not move when it comes or goes. Retry asks once,
 * now; the pollers keep asking on their own beneath it either way.
 */
function ConnectionStrip({
  word,
  onRetry,
}: {
  word: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-40 border-amber-500/30 border-b bg-background pt-[env(safe-area-inset-top)]"
    >
      <div className="flex h-10 items-center justify-between gap-3 bg-amber-500/10 px-4 text-sm">
        <span className="min-w-0 truncate">{word}</span>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          aria-label="Retry the connection"
          onClick={onRetry}
        >
          Retry
        </Button>
      </div>
    </div>
  );
}

function Shell({
  title,
  said = "",
  notice = null,
  connection = null,
  children,
}: {
  title?: string;
  /** What just happened on this phone, said once, whatever the screen shows. */
  said?: string;
  /** A line that stands over every screen while it holds, under the title. */
  notice?: React.ReactNode;
  /** The strip over the header, with what it says while it says anything. */
  connection?: { word: string | null; onRetry: () => void } | null;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl px-4 py-6">
      {connection === null || connection.word === null ? null : (
        <ConnectionStrip word={connection.word} onRetry={connection.onRetry} />
      )}
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
  if (!relay.open) return "Relay finished. Thank you for taking part.";
  if (
    relay.rounds.length > 0 &&
    relay.rounds.every((round) => round.round !== null)
  )
    return refusalSentence("ROUNDS_RUN");
  return "You’re joined. Waiting for the next round.";
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
  holder,
  signedIn,
  silent,
  said,
  hurry,
  ended,
  onEnded,
  onHeard,
  onFailed,
  refresh,
}: {
  token: string;
  relay: Relay;
  participant: string;
  /** Who is holding the phone: the name it signed in under, or how it arrived. */
  holder: string;
  signedIn: boolean;
  /** No answer for forty-two seconds: the screen keeps what it has and the strip says so. */
  silent: boolean;
  /** A pressed action's own word for the strip, while it stands. */
  said: string | null;
  /** The longest wait between a poller's tries, shortened while the strip stands. */
  hurry: () => number;
  /** The phone's sign-in ended: said once over the screen, which keeps what it has. */
  ended: boolean;
  /** A signed call was refused as unsigned; the page asks whether that stands. */
  onEnded: () => Promise<void>;
  /** A request got through, which the strip is read against. */
  onHeard: () => void;
  /** A pressed action went out of reach, with the word the strip says for it. */
  onFailed: (word: string) => void;
  refresh: () => Promise<FaceRead>;
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
    // A phone out of reach has begun nothing, and nothing it met says the
    // round is not there: it is a poller until the begin is answered, so a
    // drop on the way in costs a poll rather than the round, and the network
    // coming back is met at once. The student has an empty screen, so the
    // strip says the drop as it would a pressed action's.
    const handle: { stop?: () => void } = {};
    const begin = async (): Promise<boolean> => {
      if (!going()) return true;
      let result: Output<"/live/p/begin"> | ApiError | null = null;
      try {
        result = signedIn
          ? await api["/live/p/begin-signed"]({ token })
          : await api["/live/p/begin"]({ token, device: deviceId() });
      } catch {
        result = null;
      }
      if (!going()) return true;
      if (result === null || outOfReach(result)) {
        onFailed(NO_CONNECTION);
        return false;
      }
      handle.stop?.();
      onHeard();
      if (isApiError(result)) {
        settled = true;
        if (unsigned(result)) {
          void onEnded();
          return true;
        }
        // Only the handed-in word says handed in, and it comes back as a
        // conflict, as do a closed run and a run with no round open; the
        // fresh face says which: the first two leave no round to answer,
        // and the line over them is the run's; a round still open leaves
        // the hand-in. Any other word says what it is, with Retry.
        if (result.error !== "CONFLICT") {
          setStopped(result.error);
          return true;
        }
        setRefusedRound(round);
        await refresh();
        return true;
      }
      settled = true;
      setResponse(result.response);
      writeProgress(token, slot, {
        response: result.response,
        answers: {},
        submitted: false,
      });
      return true;
    };
    handle.stop = startPolling(begin, {
      everyMs: ROUND_POLL_MS,
      atOnce: true,
      ...pollerOptions(hurry),
    });
    return () => {
      cancelled = true;
      handle.stop?.();
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
    onHeard,
    onFailed,
    onEnded,
    hurry,
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

  // After hand-in the wall shows where the answer landed, until the next round
  // opens. Only a response that is in has a wall to read, so nothing is asked
  // for one that never handed in. A closed round's wall is read while it is
  // still settling, and stands once nothing is out about it; a closed run's
  // wall is finished the moment it lands.
  useEffect(() => {
    if (!submitted || response === null || ended) return;
    let cancelled = false;
    // The handle exists before the first read runs, so a finished wall can
    // stop the poller that carried it.
    const handle: { stop?: () => void } = {};
    const read = async () => {
      try {
        const result = signedIn
          ? await api["/live/p/wall-signed"](
              { response },
              { timeoutMs: POLL_DEADLINE_MS },
            )
          : await api["/live/p/wall"](
              { response },
              { timeoutMs: POLL_DEADLINE_MS },
            );
        if (cancelled) return true;
        if (unsigned(result)) {
          handle.stop?.();
          void onEnded();
          return true;
        }
        // A drop says nothing about the wall: it is a miss the poller waits
        // out, never a reason to settle what it did not read.
        if (outOfReach(result)) return false;
        onHeard();
        if (isApiError(result) || result.wall === null) return true;
        setWall(result.wall);
        if (!runOpen || wallHasSettled(result.wall)) handle.stop?.();
        return true;
      } catch {
        return false;
      }
    };
    handle.stop = startPolling(read, {
      everyMs: ROUND_POLL_MS,
      atOnce: true,
      ...pollerOptions(hurry),
    });
    return () => {
      cancelled = true;
      handle.stop?.();
    };
  }, [submitted, response, runOpen, signedIn, ended, onEnded, onHeard, hurry]);

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
      // Unsigned, the value stays on the phone; signing in sends it again.
      if (ended) return;
      void persistAnswer(item, value).then(async (landing) => {
        if (landing === "saved") {
          onHeard();
          return;
        }
        // Out of reach the answer is not refused, only not sent yet: it stays
        // on the phone, and the hand-in sends it again; the strip says so now.
        if (landing === "unreachable") {
          onFailed(ANSWERS_KEPT);
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
    [
      answers,
      remember,
      persistAnswer,
      refresh,
      onHeard,
      onFailed,
      onEnded,
      ended,
    ],
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
        if (unsigned(standing)) {
          void onEnded();
          return;
        }
        if (!isApiError(standing) && standing.wall !== null) {
          if (error !== null) toast.error(refusalSentence("ALREADY_SUBMITTED"));
          onHeard();
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
      // phone and Hand in stands, as the strip says.
      if (error !== null && outOfReach({ error })) {
        onFailed(ANSWERS_KEPT);
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
    [
      response,
      answers,
      whole,
      remember,
      refresh,
      onHeard,
      onFailed,
      onEnded,
      signedIn,
    ],
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
          onFailed(ANSWERS_KEPT);
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
      if (unsigned(result)) {
        void onEnded();
        return;
      }
      if (isApiError(result)) {
        await settle(result.error);
        return;
      }
      onHeard();
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
    onHeard,
    onFailed,
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
  // A phone whose sign-in ended keeps its answers and its footer on the
  // screen; the hand-in bar says why it is out, and nothing is sent until it
  // is signed in again.
  const answering = !handedIn && runOpen && round !== null && response !== null;
  // Out of reach the screen keeps the round it has and the strip says so: a
  // phone with answers on it is told they stay there.
  const connection = {
    word: stripWord(said, silent, answering),
    onRetry: () => void refresh(),
  };
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
        if (unsigned(standing)) {
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
  // tray is a count — a room writes more cards than a phone can read. A vote
  // wall carries bars, not cards, and holds no tray to count.
  const landed = useMemo(() => {
    if (wall === null) return null;
    const mine = wall.cards.filter((card) => card.mine);
    const room = roomFigures(wall);
    if (choicesOf(wall).length > 0) return { wall, mine, room, tray: null };
    const unplaced = trayOf(wall.cards);
    return {
      wall: { ...wall, cards: wall.cards.filter((card) => card.pile !== null) },
      mine,
      room,
      tray: trayLine(
        unplaced.length,
        unplaced.some((card) => card.mine),
      ),
    };
  }, [wall]);

  return (
    <Shell said={justHandedIn ? "Handed in" : ""} connection={connection}>
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
            // Numbers alone, then the round to come named apart from them. A
            // title set among the discs read as one run of digits with a
            // sentence caught in the middle; on its own line it cost the top
            // of the screen, which the open round needs.
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <RoundStrip
                className="flex-wrap"
                rounds={relay.rounds.map((candidate) => ({
                  number: candidate.number,
                  title: candidate.title,
                  standing: standingOf(candidate),
                }))}
              />
              {relay.open && nextRound !== undefined ? (
                <span className="min-w-0 truncate border-border border-l pl-2.5 text-muted-foreground text-sm">
                  Up next:{" "}
                  <span className="text-foreground" dir="auto">
                    {nextRound.title}
                  </span>
                </span>
              ) : null}
            </div>
          ) : (
            <RoundToken
              className="min-w-0"
              number={openRound.number}
              title={openRound.title}
              standing="open"
              size="sm"
            />
          )}
          <p className="truncate text-muted-foreground text-sm" dir="auto">
            {holder}
          </p>
        </header>

        {ended ? <SignInEnded next={`/q/${token}`} /> : null}

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
                {relay.open ? "Response received" : "Relay finished"}
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
                  {relay.open
                    ? waitingLine(relay)
                    : "Thank you for taking part."}
                </p>
              )}
            </div>
            {landed === null ? null : (
              <>
                {/* The figures count the room, not this phone. */}
                <Facts className="text-sm">
                  <Fact.Count>{landed.room.joined} joined</Fact.Count>
                  <Fact.Count>{landed.room.writing} writing</Fact.Count>
                  <Fact.Count>{landed.room.handedIn} handed in</Fact.Count>
                </Facts>
                {landed.tray === null ? null : (
                  <p className="text-muted-foreground text-sm">{landed.tray}</p>
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
          progress={
            questions.length === 1 && questions[0].cap > 0
              ? `${answeredOf(questions, answers)} ${answeredOf(questions, answers) === 1 ? "response" : "responses"}, up to ${questions[0].cap}`
              : undefined
          }
          answered={answeredOf(questions, answers)}
          of={itemCountOf(questions)}
          busy={busy}
          refusal={
            ended ? SIGN_IN_ENDED : whole ? null : refusalSentence("INCOMPLETE")
          }
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
          <WrittenBox
            // The prompt above is the box's name; the placeholder is not one.
            labelledBy={promptId}
            value={value}
            placeholder="Your answer"
            onAnswer={onAnswer}
            onDraft={onDraft}
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
