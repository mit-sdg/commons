import {
  compute,
  former,
  is,
  no,
  now,
  reaction,
  view,
  when,
  where,
  whether,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { activeUser } from "../access/session.ts";
import {
  anonymousParticipationAllowed,
  participationAvailable,
  theParticipationAccess,
  questionBelongsToRun,
  questionIsNotOfRun,
  runHasNoOpenRound,
  runIsAQuestionnaireRun,
  runIsARelayRun,
  namesNoAccount,
  runIsClosed,
  runIsOpen,
  theOpenRoundOf,
} from "./policy.ts";
import { theRelayFace } from "./relays.ts";
import { theWall } from "./walls.ts";
import { concepts } from "../../concepts.ts";
import { computations } from "../../concepts.ts";

const {
  Authenticating,
  Locating,
  Publishing,
  Relaying,
  Responding,
  RunSnapshotting,
  Scoring,
  Sharing,
} = concepts;

const anonymousResponse = view(
  "(response) belongs to an anonymous participant",
  ({ response }, _outputs, { participant }) =>
    where(
      Responding._response({ response }).is({ participant }),
      no(Authenticating._getById({ user: participant })),
    ),
).holds();

const signedResponse = view(
  "(response) belongs to the active (session)",
  ({ response, session }, _outputs, { participant }) =>
    where(
      activeUser({ session }).is({ user: participant }),
      Responding._response({ response }).is({ participant }),
    ),
).holds();

const allowedAnonymousResponse = view(
  "(response) allows anonymous use",
  ({ response }, _outputs, { subject }) =>
    where(
      anonymousResponse({ response }),
      Responding._response({ response }).is({ subject }),
      anonymousParticipationAllowed({ subject }),
    ),
).holds();

const allowedSignedResponse = view(
  "(response) allows use by (session)",
  ({ response, session }, _outputs, { subject }) =>
    where(
      signedResponse({ response, session }),
      Responding._response({ response }).is({ subject }),
      participationAvailable({ subject }),
    ),
).holds();

/**
 * What a participant meets on arrival: the run, whether it is open, and its
 * questions with prompt and choices only. Pre-submission concealment has this
 * one home — expected answers and explanations are simply never formed here.
 */
export const theParticipantFace = former(
  "the face of (run)",
  ({ run }, { open, presentation, title, form, questions, mode, requireSignIn }) =>
    where(
      theParticipationAccess({ subject: run }).is({ mode }),
      compute(computations.liveRequiresSignIn, { mode }, requireSignIn),
      Publishing._edition({ edition: run }).is({ open }),
      RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
      compute(computations.snapshotTitle, { value: presentation }, title),
      compute(computations.snapshotForm, { value: presentation }, form),
      compute(computations.participantQuestions, { value: presentation }, questions),
    ).form({
      run,
      title,
      form,
      open,
      questions,
      requireSignIn,
    }),
).optional();

/**
 * What a participant learns afterward, by the key's disclosure level. The
 * levels that reveal answers also carry the written-answer questions keeping a
 * reference, each beside what the participant wrote: the key holds proposed
 * expectations alone, so a written answer is read against its reference and
 * never measured. Every receipt row comes from the run's captured presentation,
 * so later work on the questionnaire cannot rewrite an earlier hand-in.
 */
export const theScoreOutcome = former(
  "the score outcome of (response)",
  ({ response }, { run, key, disclosure, score, outOf }) =>
    where(
      Responding._response({ response }).is({ subject: run, submitted: true }),
      Scoring._keyFor({ subject: run }).is({ key, disclosure }),
      whether(Scoring._resultFor({ key, submission: response }).is({ score, outOf })),
    ).form({ response, disclosure, score, outOf }),
).optional();

export const theAnswersOutcome = former(
  "the answers outcome of (response)",
  ({ response }, { run, key, presentation, disclosure, score, outOf, answers, receipt }) =>
    where(
      Responding._response({ response }).is({ subject: run, submitted: true }),
      RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
      Scoring._keyFor({ subject: run }).is({ key, disclosure }),
      whether(Scoring._resultFor({ key, submission: response }).is({ score, outOf })),
      Responding._collectedAnswers({ response }).is({ answers }),
      compute(computations.answerReceipt, { value: presentation, answers }, receipt),
    ).form({
      response,
      disclosure,
      score,
      outOf,
      receipt,
    }),
).optional();

export const theExplanationsOutcome = former(
  "the explained outcome of (response)",
  ({ response }, { run, key, presentation, disclosure, score, outOf, answers, receipt }) =>
    where(
      Responding._response({ response }).is({ subject: run, submitted: true }),
      RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
      Scoring._keyFor({ subject: run }).is({ key, disclosure }),
      whether(Scoring._resultFor({ key, submission: response }).is({ score, outOf })),
      Responding._collectedAnswers({ response }).is({ answers }),
      compute(computations.explanationReceipt, { value: presentation, answers }, receipt),
    ).form({
      response,
      disclosure,
      score,
      outOf,
      receipt,
    }),
).optional();

/** A submitted response to a keyed run is measured, once, against that key. */
export const SubmittedResponseIsGraded = reaction(({ response, run, key, answers }) =>
  when(Responding.submit({ response }).responds())
    .where(
      Responding._response({ response }).is({ subject: run }),
      Scoring._keyFor({ subject: run }).is({ key }),
      Responding._collectedAnswers({ response }).is({ answers }),
    )
    .then(Scoring.grade({ key, submission: response, answers })),
);

/** The token opens onto a questionnaire run or a relay run; the join page reads which. */
export const Arrive = endpoint(
  "/live/p/arrive",
  ({ token, run }) =>
    receive({ token })
      .then(Sharing.open({ token }).responds({ subject: run }))
      .then(
        where(runIsAQuestionnaireRun({ run }), participationAvailable({ subject: run }))
          .then(respond({ face: theParticipantFace({ run }) }))
          .named("questionnaire"),
        where(runIsARelayRun({ run }), participationAvailable({ subject: run }))
          .then(respond({ relay: theRelayFace({ run }) }))
          .named("relay"),
        where(no(participationAvailable({ subject: run })))
          .then(respond({ error: "NOT_FOUND" }))
          .named("unavailable"),
      ),
  { input: { required: ["token"] } },
);

/** Turn the room-friendly code into the existing participation token. */
export const Locate = endpoint(
  "/live/p/locate",
  ({ code, run, token }) =>
    receive({ code })
      .then(Locating.locate({ code }).responds({ subject: run }))
      .then(where(Sharing._sharesFor({ subject: run }).is({ token })).then(respond({ token }))),
  { input: { required: ["code"] } },
);

/** A round's edition: its material is a relay's leg, so every box is handed in. */
const runIsARound = view("(run) is a round of a relay", ({ run }, _outputs, { questionnaire }) =>
  where(
    Publishing._edition({ edition: run }).is({ material: questionnaire }),
    Relaying._legFor({ material: questionnaire }),
  ),
).holds();

export const Begin = endpoint(
  "/live/p/begin",
  ({ token, device, run, round, at, response }) =>
    receive({ token, device })
      .then(Sharing.open({ token }).responds({ subject: run }))
      .then(
        where(
          now(at),
          namesNoAccount({ identifier: device }),
          runIsOpen({ run }),
          anonymousParticipationAllowed({ subject: run }),
          runIsAQuestionnaireRun({ run }),
        )
          .then(Responding.begin({ participant: device, subject: run, at }).responds({ response }))
          .then(respond({ response, participant: device }))
          .named("open"),
        where(
          now(at),
          namesNoAccount({ identifier: device }),
          runIsOpen({ run }),
          anonymousParticipationAllowed({ subject: run }),
          runIsARelayRun({ run }),
          theOpenRoundOf({ run }).is({ round }),
        )
          .then(
            Responding.begin({ participant: device, subject: round, at }).responds({ response }),
          )
          .then(respond({ response, participant: device }))
          .named("round"),
        where(
          namesNoAccount({ identifier: device }),
          runIsOpen({ run }),
          anonymousParticipationAllowed({ subject: run }),
          runIsARelayRun({ run }),
          runHasNoOpenRound({ run }),
        )
          .then(respond({ error: "NO_OPEN_ROUND" }))
          .named("no-open-round"),
        where(runIsOpen({ run }), no(namesNoAccount({ identifier: device })))
          .then(respond({ error: "NOT_FOUND" }))
          .named("named-account"),
        where(
          runIsOpen({ run }),
          namesNoAccount({ identifier: device }),
          theParticipationAccess({ subject: run }).is({ mode: "signed" }),
        )
          .then(respond({ error: "SIGN_IN_REQUIRED" }))
          .named("sign-in-required"),
        where(
          runIsOpen({ run }),
          namesNoAccount({ identifier: device }),
          no(participationAvailable({ subject: run })),
        )
          .then(respond({ error: "NOT_FOUND" }))
          .named("unavailable"),
        where(runIsClosed({ run }))
          .then(respond({ error: "CLOSED" }))
          .named("closed"),
      ),
  { input: { required: ["token", "device"] } },
);

export const BeginSigned = endpoint(
  "/live/p/begin-signed",
  ({ token, session, run, round, user, at, response }) =>
    receive({ token, session })
      .then(Sharing.open({ token }).responds({ subject: run }))
      .then(
        where(
          now(at),
          runIsOpen({ run }),
          participationAvailable({ subject: run }),
          runIsAQuestionnaireRun({ run }),
          activeUser({ session }).is({ user }),
        )
          .then(Responding.begin({ participant: user, subject: run, at }).responds({ response }))
          .then(respond({ response, participant: user }))
          .named("open"),
        where(
          now(at),
          runIsOpen({ run }),
          participationAvailable({ subject: run }),
          runIsARelayRun({ run }),
          theOpenRoundOf({ run }).is({ round }),
          activeUser({ session }).is({ user }),
        )
          .then(Responding.begin({ participant: user, subject: round, at }).responds({ response }))
          .then(respond({ response, participant: user }))
          .named("round"),
        where(
          participationAvailable({ subject: run }),
          runIsOpen({ run }),
          runIsARelayRun({ run }),
          runHasNoOpenRound({ run }),
        )
          .then(respond({ error: "NO_OPEN_ROUND" }))
          .named("no-open-round"),
        where(
          runIsOpen({ run }),
          activeUser({ session }),
          no(participationAvailable({ subject: run })),
        )
          .then(respond({ error: "NOT_FOUND" }))
          .named("unavailable"),
        where(runIsClosed({ run }))
          .then(respond({ error: "CLOSED" }))
          .named("closed"),
      ),
  { input: { required: ["token", "session"] } },
);

// Keep refusals beside each endpoint: only an owned response may reveal its
// access policy. Signed endpoints never expose the anonymous sign-in refusal.
export const Answer = endpoint(
  "/live/p/answer",
  ({ response, question, value, run, answered }) =>
    receive({ response, question, value }).then(
      where(
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        questionBelongsToRun({ question, run }),
      )
        .then(
          Responding.answer({ response, item: question, value }).responds({ response: answered }),
        )
        .then(respond({ response: answered }))
        .named("success"),
      where(
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        questionIsNotOfRun({ question, run }),
      )
        .then(respond({ error: "NOT_PART" }))
        .named("not-part"),
      where(
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run }),
        runIsClosed({ run }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(
        anonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run }),
        no(participationAvailable({ subject: run })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("unavailable"),
      where(
        anonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run }),
        theParticipationAccess({ subject: run }).is({ mode: "signed" }),
      )
        .then(respond({ error: "SIGN_IN_REQUIRED" }))
        .named("sign-in-required"),
      where(no(anonymousResponse({ response })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("not-owner"),
    ),
  { input: { required: ["response", "question", "value"] } },
);

export const AnswerSigned = endpoint(
  "/live/p/answer-signed",
  ({ session, response, question, value, run, answered }) =>
    receive({ session, response, question, value }).then(
      where(
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        questionBelongsToRun({ question, run }),
      )
        .then(
          Responding.answer({ response, item: question, value }).responds({ response: answered }),
        )
        .then(respond({ response: answered }))
        .named("success"),
      where(
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        questionIsNotOfRun({ question, run }),
      )
        .then(respond({ error: "NOT_PART" }))
        .named("not-part"),
      where(
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run }),
        runIsClosed({ run }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(
        signedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run }),
        no(participationAvailable({ subject: run })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("unavailable"),

      where(no(signedResponse({ response, session })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("not-owner"),
    ),
  { input: { required: ["session", "response", "question", "value"] } },
);

export const Submit = endpoint(
  "/live/p/submit",
  ({ response, run, presentation, form, required, at, submitted }) =>
    receive({ response }).then(
      where(
        now(at),
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
        compute(computations.snapshotForm, { value: presentation }, form),
        is.among(form, ["survey"]),
        no(runIsARound({ run })),
      )
        .then(Responding.submit({ response, at }).responds({ response: submitted }))
        .then(respond({ response: submitted }))
        .named("survey"),
      where(
        now(at),
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        runIsARound({ run }),
        RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
        compute(computations.snapshotRequirements, { value: presentation }, required),
      )
        .then(Responding.submit({ response, at, required }).responds({ response: submitted }))
        .then(respond({ response: submitted }))
        .named("round-whole"),
      where(
        now(at),
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
        compute(computations.snapshotForm, { value: presentation }, form),
        is.among(form, ["quiz"]),
        compute(computations.snapshotRequirements, { value: presentation }, required),
      )
        .then(Responding.submit({ response, at, required }).responds({ response: submitted }))
        .then(respond({ response: submitted }))
        .named("quiz-whole"),
      where(
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run }),
        runIsClosed({ run }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(
        anonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run }),
        no(participationAvailable({ subject: run })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("unavailable"),
      where(
        anonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run }),
        theParticipationAccess({ subject: run }).is({ mode: "signed" }),
      )
        .then(respond({ error: "SIGN_IN_REQUIRED" }))
        .named("sign-in-required"),
      where(no(anonymousResponse({ response })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("not-owner"),
    ),
  { input: { required: ["response"] } },
);

export const SubmitSigned = endpoint(
  "/live/p/submit-signed",
  ({ session, response, run, presentation, form, required, at, submitted }) =>
    receive({ session, response }).then(
      where(
        now(at),
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
        compute(computations.snapshotForm, { value: presentation }, form),
        is.among(form, ["survey"]),
        no(runIsARound({ run })),
      )
        .then(Responding.submit({ response, at }).responds({ response: submitted }))
        .then(respond({ response: submitted }))
        .named("survey"),
      where(
        now(at),
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        runIsARound({ run }),
        RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
        compute(computations.snapshotRequirements, { value: presentation }, required),
      )
        .then(Responding.submit({ response, at, required }).responds({ response: submitted }))
        .then(respond({ response: submitted }))
        .named("round-whole"),
      where(
        now(at),
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
        compute(computations.snapshotForm, { value: presentation }, form),
        is.among(form, ["quiz"]),
        compute(computations.snapshotRequirements, { value: presentation }, required),
      )
        .then(Responding.submit({ response, at, required }).responds({ response: submitted }))
        .then(respond({ response: submitted }))
        .named("quiz-whole"),
      where(
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run }),
        runIsClosed({ run }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(
        signedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run }),
        no(participationAvailable({ subject: run })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("unavailable"),

      where(no(signedResponse({ response, session })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("not-owner"),
    ),
  { input: { required: ["session", "response"] } },
);

export const Outcome = endpoint(
  "/live/p/outcome",
  ({ response, run }) =>
    receive({ response }).then(
      where(
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run, submitted: true }),
        no(Scoring._keyFor({ subject: run })),
      )
        .then(respond({ received: true }))
        .named("survey"),
      where(
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run, submitted: true }),
        Scoring._keyFor({ subject: run }).is({ disclosure: "score" }),
      )
        .then(respond({ received: true, outcome: theScoreOutcome({ response }) }))
        .named("score"),
      where(
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run, submitted: true }),
        Scoring._keyFor({ subject: run }).is({ disclosure: "answers" }),
      )
        .then(respond({ received: true, outcome: theAnswersOutcome({ response }) }))
        .named("answers"),
      where(
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run, submitted: true }),
        Scoring._keyFor({ subject: run }).is({ disclosure: "explanations" }),
      )
        .then(respond({ received: true, outcome: theExplanationsOutcome({ response }) }))
        .named("explanations"),
      where(
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ submitted: false }),
      )
        .then(respond({ error: "NOT_SUBMITTED" }))
        .named("in-progress"),
      where(
        anonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run }),
        no(participationAvailable({ subject: run })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("unavailable"),
      where(
        anonymousResponse({ response }),
        Responding._response({ response }).is({ subject: run }),
        theParticipationAccess({ subject: run }).is({ mode: "signed" }),
      )
        .then(respond({ error: "SIGN_IN_REQUIRED" }))
        .named("sign-in-required"),
      where(no(anonymousResponse({ response })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("not-owner"),
    ),
  { input: { required: ["response"] } },
);

export const OutcomeSigned = endpoint(
  "/live/p/outcome-signed",
  ({ session, response, run }) =>
    receive({ session, response }).then(
      where(
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run, submitted: true }),
        no(Scoring._keyFor({ subject: run })),
      )
        .then(respond({ received: true }))
        .named("survey"),
      where(
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run, submitted: true }),
        Scoring._keyFor({ subject: run }).is({ disclosure: "score" }),
      )
        .then(respond({ received: true, outcome: theScoreOutcome({ response }) }))
        .named("score"),
      where(
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run, submitted: true }),
        Scoring._keyFor({ subject: run }).is({ disclosure: "answers" }),
      )
        .then(respond({ received: true, outcome: theAnswersOutcome({ response }) }))
        .named("answers"),
      where(
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run, submitted: true }),
        Scoring._keyFor({ subject: run }).is({ disclosure: "explanations" }),
      )
        .then(respond({ received: true, outcome: theExplanationsOutcome({ response }) }))
        .named("explanations"),
      where(
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ submitted: false }),
      )
        .then(respond({ error: "NOT_SUBMITTED" }))
        .named("in-progress"),
      where(
        signedResponse({ response, session }),
        Responding._response({ response }).is({ subject: run }),
        no(participationAvailable({ subject: run })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("unavailable"),

      where(no(signedResponse({ response, session })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("not-owner"),
    ),
  { input: { required: ["session", "response"] } },
);

/** Where you landed, shown once you have handed in, with your own cards marked. */
export const Wall = endpoint(
  "/live/p/wall",
  ({ response, round }) =>
    receive({ response }).then(
      where(
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ subject: round, submitted: true }),
      )
        .then(respond({ wall: theWall({ round, viewer: response }) }))
        .named("submitted"),
      where(
        allowedAnonymousResponse({ response }),
        Responding._response({ response }).is({ submitted: false }),
      )
        .then(respond({ error: "NOT_SUBMITTED" }))
        .named("in-progress"),
      where(
        anonymousResponse({ response }),
        Responding._response({ response }).is({ subject: round }),
        no(participationAvailable({ subject: round })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("unavailable"),
      where(
        anonymousResponse({ response }),
        Responding._response({ response }).is({ subject: round }),
        theParticipationAccess({ subject: round }).is({ mode: "signed" }),
      )
        .then(respond({ error: "SIGN_IN_REQUIRED" }))
        .named("sign-in-required"),
      where(no(anonymousResponse({ response })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("not-owner"),
    ),
  { input: { required: ["response"] } },
);

export const WallSigned = endpoint(
  "/live/p/wall-signed",
  ({ session, response, round }) =>
    receive({ session, response }).then(
      where(
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ subject: round, submitted: true }),
      )
        .then(respond({ wall: theWall({ round, viewer: response }) }))
        .named("submitted"),
      where(
        allowedSignedResponse({ response, session }),
        Responding._response({ response }).is({ submitted: false }),
      )
        .then(respond({ error: "NOT_SUBMITTED" }))
        .named("in-progress"),
      where(
        signedResponse({ response, session }),
        Responding._response({ response }).is({ subject: round }),
        no(participationAvailable({ subject: round })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("unavailable"),

      where(no(signedResponse({ response, session })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("not-owner"),
    ),
  { input: { required: ["session", "response"] } },
);
