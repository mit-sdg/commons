import {
  compute,
  each,
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
  mayHostLive,
  mayNotHostLive,
  namesNoAccount,
  participantIsSeated,
  runIsAQuestionnaireRun,
  runIsClosed,
  runIsOpen,
  seatIsNotDismissed,
} from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";

const {
  Locating,
  Profiling,
  Publishing,
  Questioning,
  Reasoning,
  Relaying,
  Responding,
  RunSnapshotting,
  Scoring,
  Sharing,
  Subscribing,
  Trashing,
} = concepts;

const REASONER = "gemini-flash";

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
      seat,
      modelResponse,
      participant,
      submitted,
      silentResponse,
      silentSeat,
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
      seats: each(Subscribing._getSubscribers({ target: run }).is({ user: seat }))
        .where(seatIsNotDismissed({ participant: seat }))
        .form({ participant: seat }),
      modelResponses: each(
        Responding._responsesFor({ subject: run }).is({
          response: modelResponse,
          participant,
          submitted,
        }),
      )
        .where(participantIsSeated({ participant, run }))
        .form({ response: modelResponse, submitted }),
      // A seat whose ask failed and has no reply is not writing: nothing is
      // coming for it, and the Model row says so.
      silentSeats: each(
        Responding._responsesFor({ subject: run }).is({
          response: silentResponse,
          participant: silentSeat,
          submitted: false,
        }),
      )
        .where(
          participantIsSeated({ participant: silentSeat, run }),
          Reasoning._lastFailureAbout({ about: silentResponse }),
          no(Reasoning._repliesAbout({ about: silentResponse })),
        )
        .count(),
    }),
).optional();

/** The scores of a keyed run, in grading order, named where the participant is a signed-in account. */
export const theRunScores = former(
  "the scores of (run)",
  ({ run }, { key, disclosure, submission, participant, name, score, outOf, model }) =>
    where(Scoring._keyFor({ subject: run }).is({ key, disclosure })).form({
      run,
      disclosure,
      results: each(Scoring._results({ key }).is({ submission, score, outOf }))
        .where(
          Responding._response({ response: submission }).is({ participant }),
          Subscribing._isSubscribed({ user: participant, target: run }).is({ subscribed: model }),
          whether(Profiling._getProfileFields({ user: participant }).is({ displayName: name })),
        )
        .form({ submission, participant, name, score, outOf, model }),
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

/**
 * One seat per request, under a participant identity the dashboard minted for
 * it. A seat is a subscription to the run, which is what makes the participant
 * the model's: the run open now reaches it, and on a relay run so does every
 * round that opens later, until it is dismissed.
 */
export const Invite = endpoint(
  "/live/runs/invite",
  ({ session, run, device, user, at }) =>
    receive({ session, run, device }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        namesNoAccount({ identifier: device }),
        runIsOpen({ run }),
      )
        .then(Subscribing.subscribe({ user: device, target: run, at }).responds())
        .then(respond({ participant: device }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        runIsOpen({ run }),
        no(namesNoAccount({ identifier: device })),
      )
        .then(respond({ error: "NOT_A_SEAT" }))
        .named("named-account"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), runIsClosed({ run }))
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "run", "device"] } },
);

/**
 * A dismissed seat leaves the run: no later round reaches it. What it handed
 * in stays, and stays marked, because dismissing trashes the participant
 * rather than dropping its seat.
 */
export const Dismiss = endpoint(
  "/live/runs/dismiss",
  ({ session, run, participant, user, at }) =>
    receive({ session, run, participant }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        participantIsSeated({ participant, run }),
        seatIsNotDismissed({ participant }),
      )
        .then(Trashing.trash({ item: participant, by: user, at }).responds())
        .then(respond({ participant }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(participantIsSeated({ participant, run })),
      )
        .then(respond({ error: "NOT_SEATED" }))
        .named("not-seated"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        participantIsSeated({ participant, run }),
        no(seatIsNotDismissed({ participant })),
      )
        .then(respond({ participant }))
        .named("already-dismissed"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "run", "participant"] } },
);

/**
 * A questionnaire run is answered whole, so a seat taken while one is open
 * answers the run itself at once: its presentation was captured at launch, and
 * the run is the response's subject exactly as it is a phone's.
 */
export const SeatedParticipantAnswersOpenRun = reaction(({ participant, run, at }) =>
  when(Subscribing.subscribe({ user: participant, target: run }).responds())
    .where(now(at), runIsOpen({ run }), runIsAQuestionnaireRun({ run }))
    .then(Responding.begin({ participant, subject: run, at })),
);

/**
 * A response begun to a run under a participant that holds a seat on that run
 * puts the run's captured presentation before the reasoner under the same
 * participant contract a round uses, seeded by the identity so the seats do
 * not all say the same thing. A phone's begin holds no seat and asks nothing.
 */
export const BegunModelRunResponseAsksMind = reaction(
  ({ participant, run, response, value, passage, at }) =>
    when(Responding.begin({ participant, subject: run }).responds({ response }))
      .where(
        now(at),
        participantIsSeated({ participant, run }),
        RunSnapshotting._snapshot({ subject: run }).is({ value }),
        compute(computations.participantPassage, { value, participant }, passage),
      )
      .then(Reasoning.ask({ reasoner: REASONER, about: response, passage, at })),
);
