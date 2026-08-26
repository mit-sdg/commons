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
import { mayHostLive, mayNotHostLive } from "./policy.ts";
import { concepts } from "../../concepts.ts";

const { Publishing, Questioning, Responding, Scoring, Sharing } = concepts;

/**
 * Publishing a quiz establishes its key from the authored expectations and
 * disclosure, whole, before any participant can reach the run — the share
 * token is issued to the caller only after the same occurrence.
 */
export const PublishedQuizEstablishesKey = reaction(
  ({ questionnaire, run, disclosure, expectations }) =>
    when(Publishing.publish({ material: questionnaire }).responds({ edition: run }))
      .where(
        Questioning._getQuestionnaire({ questionnaire }).is({ form: "quiz", disclosure }),
        Questioning._expectedAnswers({ questionnaire }).is({ expectations }),
      )
      .then(Scoring.establish({ subject: run, disclosure, expectations })),
);

/** Every open run, newest first, with its questionnaire and its share token. */
export const theOpenRuns = former(
  "the open runs",
  (_inputs, { run, questionnaire, title, form, openedAt, token }) =>
    each(Publishing._openEditions({}).is({ edition: run, material: questionnaire, openedAt }))
      .where(
        Questioning._getQuestionnaire({ questionnaire }).is({ title, form }),
        whether(Sharing._sharesFor({ subject: run }).is({ token })),
      )
      .form({ run, questionnaire, title, form, openedAt, token }),
);

/** The live board of one run: counts, questions, and every handed-in value. */
export const theRunBoard = former(
  "the board of (run)",
  (
    { run },
    {
      questionnaire,
      title,
      form,
      open,
      openedAt,
      closedAt,
      token,
      started,
      handedIn,
      question,
      prompt,
      choices,
      expected,
      explanation,
      position,
      participant,
      value,
    },
  ) =>
    where(
      Publishing._edition({ edition: run }).is({
        material: questionnaire,
        open,
        openedAt,
        closedAt,
      }),
      Questioning._getQuestionnaire({ questionnaire }).is({ title, form }),
    ).form({
      run,
      questionnaire,
      title,
      form,
      open,
      openedAt,
      closedAt,
      token: each(Sharing._sharesFor({ subject: run }).is({ token })).first(token),
      started: each(Responding._responsesFor({ subject: run }).is({ response: started })).count(),
      handedIn: each(
        Responding._responsesFor({ subject: run }).is({ response: handedIn, submitted: true }),
      ).count(),
      questions: each(
        Questioning._getQuestions({ questionnaire }).is({
          question,
          prompt,
          choices,
          expected,
          explanation,
          position,
        }),
      ).form({
        question,
        prompt,
        choices,
        expected,
        explanation,
        position,
        values: each(
          Responding._valuesFor({ subject: run, item: question }).is({ participant, value }),
        ).form({ participant, value }),
      }),
    }),
).optional();

/** The scores of a keyed run, in grading order. */
export const theRunScores = former(
  "the scores of (run)",
  ({ run }, { key, disclosure, submission, score, outOf }) =>
    where(Scoring._keyFor({ subject: run }).is({ key, disclosure })).form({
      run,
      disclosure,
      results: each(Scoring._results({ key }).is({ submission, score, outOf })).form({
        submission,
        score,
        outOf,
      }),
    }),
).optional();

export const OpenRuns = endpoint("/live/runs/open", ({ session, user, at }) =>
  receive({ session }).then(
    where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
      .then(respond({ runs: theOpenRuns({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const Launch = endpoint(
  "/live/runs/launch",
  ({ session, questionnaire, user, at, run, token }) =>
    receive({ session, questionnaire }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestionnaire({ questionnaire }).is({ form: "quiz" }),
        Questioning._proposesAnswers({ questionnaire }).is({ proposes: true }),
      )
        .then(
          Publishing.publish({ author: user, material: questionnaire, at }).responds({
            edition: run,
          }),
        )
        .then(Sharing.issue({ subject: run }).responds({ token }))
        .then(respond({ run, token }))
        .named("quiz"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestionnaire({ questionnaire }).is({ form: "quiz" }),
        Questioning._proposesAnswers({ questionnaire }).is({ proposes: false }),
      )
        .then(respond({ error: "NOT_QUIZ_READY" }))
        .named("quiz-not-ready"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestionnaire({ questionnaire }).is({ form: "survey" }),
      )
        .then(
          Publishing.publish({ author: user, material: questionnaire, at }).responds({
            edition: run,
          }),
        )
        .then(Sharing.issue({ subject: run }).responds({ token }))
        .then(respond({ run, token }))
        .named("survey"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "questionnaire"] } },
);

export const Close = endpoint(
  "/live/runs/close",
  ({ session, run, user, at, closed }) =>
    receive({ session, run }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(Publishing.close({ edition: run, at }).responds({ edition: closed }))
        .then(respond({ run: closed }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "run"] } },
);

export const Results = endpoint(
  "/live/runs/results",
  ({ session, run, user, at }) =>
    receive({ session, run }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Scoring._keyFor({ subject: run }),
      )
        .then(respond({ board: theRunBoard({ run }), scores: theRunScores({ run }) }))
        .named("quiz"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Scoring._keyFor({ subject: run })),
      )
        .then(respond({ board: theRunBoard({ run }) }))
        .named("survey"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "run"] } },
);
