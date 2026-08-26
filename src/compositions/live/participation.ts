import {
  each,
  former,
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

const { Publishing, Questioning, Responding, Scoring, Sharing } = concepts;

/**
 * What a participant meets on arrival: the run, whether it is open, and its
 * questions with prompt and choices only. Pre-submission concealment has this
 * one home — expected answers and explanations are simply never formed here.
 */
export const theParticipantFace = former(
  "the face of (run)",
  ({ run }, { questionnaire, title, form, open, question, prompt, choices, position }) =>
    where(
      Publishing._edition({ edition: run }).is({ material: questionnaire, open }),
      Questioning._getQuestionnaire({ questionnaire }).is({ title, form }),
    ).form({
      run,
      title,
      form,
      open,
      questions: each(
        Questioning._getQuestions({ questionnaire }).is({ question, prompt, choices, position }),
      ).form({ question, prompt, choices, position }),
    }),
).optional();

/** What a participant learns afterward, by the key's disclosure level. */
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
  ({ response }, { run, key, disclosure, score, outOf, item, expected, prompt, value }) =>
    where(
      Responding._response({ response }).is({ subject: run, submitted: true }),
      Scoring._keyFor({ subject: run }).is({ key, disclosure }),
      whether(Scoring._resultFor({ key, submission: response }).is({ score, outOf })),
    ).form({
      response,
      disclosure,
      score,
      outOf,
      items: each(Scoring._expectations({ key }).is({ item, expected }))
        .where(
          Questioning._getQuestion({ question: item }).is({ prompt }),
          whether(Responding._answers({ response }).is({ item, value })),
        )
        .form({ item, prompt, expected, value }),
    }),
).optional();

export const theExplanationsOutcome = former(
  "the explained outcome of (response)",
  (
    { response },
    { run, key, disclosure, score, outOf, item, expected, explanation, prompt, value },
  ) =>
    where(
      Responding._response({ response }).is({ subject: run, submitted: true }),
      Scoring._keyFor({ subject: run }).is({ key, disclosure }),
      whether(Scoring._resultFor({ key, submission: response }).is({ score, outOf })),
    ).form({
      response,
      disclosure,
      score,
      outOf,
      items: each(Scoring._expectations({ key }).is({ item, expected, explanation }))
        .where(
          Questioning._getQuestion({ question: item }).is({ prompt }),
          whether(Responding._answers({ response }).is({ item, value })),
        )
        .form({ item, prompt, expected, explanation, value }),
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
  ({ response, run, questionnaire, at, submitted }) =>
    receive({ response }).then(
      where(
        now(at),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        Publishing._edition({ edition: run }).is({ material: questionnaire }),
        Questioning._getQuestionnaire({ questionnaire }).is({ form: "survey" }),
      )
        .then(Responding.submit({ response, at }).responds({ response: submitted }))
        .then(respond({ response: submitted }))
        .named("survey"),
      where(
        now(at),
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        Publishing._edition({ edition: run }).is({ material: questionnaire }),
        Questioning._getQuestionnaire({ questionnaire }).is({ form: "quiz" }),
        responseIsWhole({ response }),
      )
        .then(Responding.submit({ response, at }).responds({ response: submitted }))
        .then(respond({ response: submitted }))
        .named("quiz-whole"),
      where(
        Responding._response({ response }).is({ subject: run }),
        runIsOpen({ run }),
        Publishing._edition({ edition: run }).is({ material: questionnaire }),
        Questioning._getQuestionnaire({ questionnaire }).is({ form: "quiz" }),
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
