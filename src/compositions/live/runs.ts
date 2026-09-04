import { compute, each, former, is, no, now, where, whether } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { activeUser } from "../access/session.ts";
import { mayHostLive, mayNotHostLive } from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";

const {
  Locating,
  Profiling,
  Publishing,
  Questioning,
  Relaying,
  Responding,
  RunSnapshotting,
  Scoring,
  Sharing,
} = concepts;

/** Every open run, newest first, with its questionnaire and its share token. */
export const theOpenRuns = former(
  "the open runs",
  (_inputs, { run, questionnaire, presentation, title, form, openedAt, token, code }) =>
    each(Publishing._openEditions({}).is({ edition: run, material: questionnaire, openedAt }))
      .where(
        RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
        compute(computations.snapshotTitle, { value: presentation }, title),
        compute(computations.snapshotForm, { value: presentation }, form),
        whether(Sharing._sharesFor({ subject: run }).is({ token })),
        whether(Locating._for({ subject: run }).is({ code })),
      )
      .form({ run, questionnaire, title, form, openedAt, token, code }),
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
      code,
      started,
      handedIn,
      presentation,
      values,
      questions,
    },
  ) =>
    where(
      Publishing._edition({ edition: run }).is({
        material: questionnaire,
        open,
        openedAt,
        closedAt,
      }),
      RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
      Responding._valuesForSubject({ subject: run }).is({ values }),
      compute(computations.snapshotTitle, { value: presentation }, title),
      compute(computations.snapshotForm, { value: presentation }, form),
      compute(computations.boardQuestions, { value: presentation, values }, questions),
      whether(Locating._for({ subject: run }).is({ code })),
    ).form({
      run,
      questionnaire,
      title,
      form,
      open,
      openedAt,
      closedAt,
      token: each(Sharing._sharesFor({ subject: run }).is({ token })).first(token),
      code,
      started: each(Responding._responsesFor({ subject: run }).is({ response: started })).count(),
      handedIn: each(
        Responding._responsesFor({ subject: run }).is({ response: handedIn, submitted: true }),
      ).count(),
      questions,
    }),
).optional();

/** The scores of a keyed run, in grading order, named where the participant is a signed-in account. */
export const theRunScores = former(
  "the scores of (run)",
  ({ run }, { key, disclosure, submission, participant, name, score, outOf }) =>
    where(Scoring._keyFor({ subject: run }).is({ key, disclosure })).form({
      run,
      disclosure,
      results: each(Scoring._results({ key }).is({ submission, score, outOf }))
        .where(
          Responding._response({ response: submission }).is({ participant }),
          whether(Profiling._getProfileFields({ user: participant }).is({ displayName: name })),
        )
        .form({ submission, participant, name, score, outOf }),
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

/**
 * Presenting is the one coherent authored read for a launch. Every durable run
 * artifact is derived from that returned value before either address is issued.
 */
export const Launch = endpoint(
  "/live/runs/launch",
  ({
    session,
    questionnaire,
    user,
    at,
    presentation,
    form,
    disclosure,
    proposes,
    expectations,
    run,
    snapshot,
    key,
    token,
    code,
  }) =>
    receive({ session, questionnaire })
      .then(
        where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user })).then(
          Questioning.present({ questionnaire }).responds({
            presentation,
            form,
            disclosure,
            proposes,
            expectations,
          }),
        ),
      )
      .then(
        where(
          now(at),
          activeUser({ session }).is({ user }),
          mayHostLive({ user }),
          no(Relaying._legFor({ material: questionnaire })),
          is.among(form, ["quiz"]),
          is.among(proposes, [true]),
        )
          .then(
            Publishing.publish({ author: user, material: questionnaire, at }).responds({
              edition: run,
            }),
          )
          .then(
            RunSnapshotting.capture({ subject: run, value: presentation }).responds({ snapshot }),
          )
          .then(Scoring.establish({ subject: run, disclosure, expectations }).responds({ key }))
          .then(Sharing.issue({ subject: run }).responds({ token }))
          .then(Locating.ensure({ subject: run }).responds({ code }))
          .then(respond({ run, token, code }))
          .named("quiz"),
        where(
          now(at),
          activeUser({ session }).is({ user }),
          mayHostLive({ user }),
          no(Relaying._legFor({ material: questionnaire })),
          is.among(form, ["survey"]),
        )
          .then(
            Publishing.publish({ author: user, material: questionnaire, at }).responds({
              edition: run,
            }),
          )
          .then(
            RunSnapshotting.capture({ subject: run, value: presentation }).responds({ snapshot }),
          )
          .then(Sharing.issue({ subject: run }).responds({ token }))
          .then(Locating.ensure({ subject: run }).responds({ code }))
          .then(respond({ run, token, code }))
          .named("survey"),
        where(
          no(Relaying._legFor({ material: questionnaire })),
          is.among(form, ["quiz"]),
          is.among(proposes, [false]),
        )
          .then(respond({ error: "NOT_QUIZ_READY" }))
          .named("unready-quiz"),
        where(Relaying._legFor({ material: questionnaire }))
          .then(respond({ error: "QUESTIONNAIRE_NOT_FOUND" }))
          .named("round"),
      ),
  { input: { required: ["session", "questionnaire"] } },
);

export const LaunchForbidden = endpoint("/live/runs/launch", ({ session, questionnaire, user }) =>
  receive({ session, questionnaire })
    .where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
    .then(respond({ error: "FORBIDDEN" })),
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
