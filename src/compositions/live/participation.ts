import {
  compute,
  former,
  is,
  no,
  now,
  reaction,
  when,
  where,
  whether,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { activeUser } from "../access/session.ts";
import {
  questionBelongsToRun,
  questionIsNotOfRun,
  responseIsNotWhole,
  responseIsWhole,
  runIsClosed,
  runIsOpen,
} from "./policy.ts";
import { concepts } from "../../concepts.ts";
import { computations } from "../../concepts.ts";

const { Locating, Publishing, Responding, RunSnapshotting, Scoring, Sharing } = concepts;

/**
 * What a participant meets on arrival: the run, whether it is open, and its
 * questions with prompt and choices only. Pre-submission concealment has this
 * one home — expected answers and explanations are simply never formed here.
 */
export const theParticipantFace = former(
  "the face of (run)",
  ({ run }, { open, presentation, title, form, questions }) =>
    where(
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

export const Arrive = endpoint(
  "/live/p/arrive",
  ({ token, run }) =>
    receive({ token })
      .then(Sharing.open({ token }).responds({ subject: run }))
      .then(respond({ face: theParticipantFace({ run }) })),
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

export const Begin = endpoint(
  "/live/p/begin",
  ({ token, device, run, at, response }) =>
    receive({ token, device })
      .then(Sharing.open({ token }).responds({ subject: run }))
      .then(
        where(now(at), runIsOpen({ run }))
          .then(Responding.begin({ participant: device, subject: run, at }).responds({ response }))
          .then(respond({ response, participant: device }))
          .named("open"),
        where(runIsClosed({ run }))
          .then(respond({ error: "CLOSED" }))
          .named("closed"),
      ),
  { input: { required: ["token", "device"] } },
);

export const BeginSigned = endpoint(
  "/live/p/begin-signed",
  ({ token, session, run, user, at, response }) =>
    receive({ token, session })
      .then(Sharing.open({ token }).responds({ subject: run }))
      .then(
        where(now(at), runIsOpen({ run }), activeUser({ session }).is({ user }))
          .then(Responding.begin({ participant: user, subject: run, at }).responds({ response }))
          .then(respond({ response, participant: user }))
          .named("open"),
        where(runIsClosed({ run }))
          .then(respond({ error: "CLOSED" }))
          .named("closed"),
      ),
  { input: { required: ["token", "session"] } },
);

export const Answer = endpoint(
  "/live/p/answer",
  ({ response, question, value, run, answered }) =>
    receive({ response, question, value }).then(
      where(
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
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        questionIsNotOfRun({ question, run }),
      )
        .then(respond({ error: "NOT_PART" }))
        .named("not-part"),
      where(Responding._response({ response }).is({ subject: run }), runIsClosed({ run }))
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
    ),
  { input: { required: ["response", "question", "value"] } },
);

export const Submit = endpoint(
  "/live/p/submit",
  ({ response, run, presentation, form, at, submitted }) =>
    receive({ response }).then(
      where(
        now(at),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
        compute(computations.snapshotForm, { value: presentation }, form),
        is.among(form, ["survey"]),
      )
        .then(Responding.submit({ response, at }).responds({ response: submitted }))
        .then(respond({ response: submitted }))
        .named("survey"),
      where(
        now(at),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
        compute(computations.snapshotForm, { value: presentation }, form),
        is.among(form, ["quiz"]),
        responseIsWhole({ response }),
      )
        .then(Responding.submit({ response, at }).responds({ response: submitted }))
        .then(respond({ response: submitted }))
        .named("quiz-whole"),
      where(
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
        compute(computations.snapshotForm, { value: presentation }, form),
        is.among(form, ["quiz"]),
        responseIsNotWhole({ response }),
      )
        .then(respond({ error: "INCOMPLETE" }))
        .named("quiz-incomplete"),
      where(Responding._response({ response }).is({ subject: run }), runIsClosed({ run }))
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
    ),
  { input: { required: ["response"] } },
);

export const Outcome = endpoint(
  "/live/p/outcome",
  ({ response, run }) =>
    receive({ response }).then(
      where(
        Responding._response({ response }).is({ subject: run, submitted: true }),
        no(Scoring._keyFor({ subject: run })),
      )
        .then(respond({ received: true }))
        .named("survey"),
      where(
        Responding._response({ response }).is({ subject: run, submitted: true }),
        Scoring._keyFor({ subject: run }).is({ disclosure: "score" }),
      )
        .then(respond({ received: true, outcome: theScoreOutcome({ response }) }))
        .named("score"),
      where(
        Responding._response({ response }).is({ subject: run, submitted: true }),
        Scoring._keyFor({ subject: run }).is({ disclosure: "answers" }),
      )
        .then(respond({ received: true, outcome: theAnswersOutcome({ response }) }))
        .named("answers"),
      where(
        Responding._response({ response }).is({ subject: run, submitted: true }),
        Scoring._keyFor({ subject: run }).is({ disclosure: "explanations" }),
      )
        .then(respond({ received: true, outcome: theExplanationsOutcome({ response }) }))
        .named("explanations"),
      where(Responding._response({ response }).is({ submitted: false }))
        .then(respond({ error: "NOT_SUBMITTED" }))
        .named("in-progress"),
    ),
  { input: { required: ["response"] } },
);
