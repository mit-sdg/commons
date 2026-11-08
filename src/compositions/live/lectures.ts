import {
  compute,
  each,
  former,
  no,
  now,
  view,
  where,
  whether,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { activeUser } from "../access/session.ts";
import {
  mayMarkLectures,
  mayNotMarkLectures,
  mayNotReadAttendance,
  mayNotViewAttendance,
  mayReadAttendance,
  mayViewAttendance,
} from "../access/policy.ts";
import { computations, concepts } from "../../concepts.ts";

const {
  Authenticating,
  Pinning,
  Profiling,
  Publishing,
  Questioning,
  Relaying,
  Responding,
  Rostering,
  Subscribing,
} = concepts;

/** The reserved Pinning scope in which a pinned run is one held as a lecture. */
export const LECTURES = "lectures";

/** A run that stands on its own: an edition that is no round of another. */
export const runStandsAlone = view("(run) stands alone", ({ run }, _outputs, _bindings) =>
  where(Publishing._edition({ edition: run }).is({ whole: null })),
).holds();

export const runDoesNotStandAlone = view(
  "(run) does not stand alone",
  ({ run }, _outputs, _bindings) => [
    where(no(Publishing._edition({ edition: run }))),
    where(Publishing._edition({ edition: run }).is.not({ whole: null })),
  ],
).holds();

/** What a run is called, what kind it is, and when it opened. */
export const theRunLabel = view(
  "the label of (run)",
  ({ run }, { title, kind, openedAt }, { material, quizTitle, quizForm, relayTitle }) =>
    where(
      Publishing._edition({ edition: run }).is({ material, openedAt }),
      whether(
        Questioning._getQuestionnaire({ questionnaire: material }).is({
          title: quizTitle,
          form: quizForm,
        }),
      ),
      whether(Relaying._relay({ relay: material }).is({ title: relayTitle })),
      compute(computations.runTitle, { quizTitle, relayTitle }, title),
      compute(computations.runKind, { quizForm, relayTitle }, kind),
    ),
).optional();

/**
 * Every quiz and survey run, newest first, retired questionnaires included,
 * with whether it is held as a lecture. A relay round's questionnaire is
 * reached through its relay.
 */
export const theQuestionnaireRuns = former(
  "the questionnaire runs",
  (_inputs, { questionnaire, title, kind, run, open, openedAt, closedAt, lecture }) =>
    each(Questioning._getQuestionnaires({}).is({ questionnaire, title, form: kind }))
      .where(no(Relaying._legFor({ material: questionnaire })))
      .form({
        questionnaire,
        title,
        kind,
        runs: each(
          Publishing._editionsFor({ material: questionnaire }).is({
            edition: run,
            open,
            openedAt,
            closedAt,
          }),
        )
          .where(Pinning._isPinned({ item: run, scope: LECTURES }).is({ pinned: lecture }))
          .form({ run, open, openedAt, closedAt, lecture }),
      }),
);

/** Every relay run, newest first, retired relays included, with whether it is held as a lecture. */
export const theRelayRuns = former(
  "the relay runs",
  (_inputs, { relay, title, run, open, openedAt, closedAt, lecture }) =>
    each(Relaying._relays({}).is({ relay, title })).form({
      relay,
      title,
      runs: each(
        Publishing._editionsFor({ material: relay }).is({ edition: run, open, openedAt, closedAt }),
      )
        .where(Pinning._isPinned({ item: run, scope: LECTURES }).is({ pinned: lecture }))
        .form({ run, open, openedAt, closedAt, lecture }),
    }),
);

/**
 * Each run held as a lecture: who joined it, as identities holding an active
 * seat, and who joined without an account, leaving out the run's model seats.
 * A relay's participants respond to its rounds, so its rounds count with it.
 */
export const theLectureRuns = former(
  "the lecture runs",
  (
    _inputs,
    {
      run,
      title,
      kind,
      openedAt,
      parts,
      subjects,
      participants,
      joined,
      accounts,
      seats,
      signedOut,
    },
  ) =>
    each(Pinning._getPinned({ scope: LECTURES }).is({ item: run }))
      .where(
        theRunLabel({ run }).is({ title, kind, openedAt }),
        Publishing._partsOf({ whole: run }).is({ parts }),
        compute(computations.lectureSubjects, { run, parts }, subjects),
        Responding._participantsAmong({ subjects }).is({ participants }),
        Rostering._activeUsers({ users: participants }).is({ active: joined }),
        Authenticating._accountsAmong({ users: participants }).is({ accounts }),
        Subscribing._subscribersOf({ target: run }).is({ users: seats }),
        compute(computations.signedOutJoiners, { participants, accounts, seats }, signedOut),
      )
      .form({ run, title, kind, openedAt, joined, signedOut }),
);

/** The active students, with section and name, in roster order. */
export const theAttendanceRoster = former(
  "the attendance roster",
  (_inputs, { user, section, email, displayName }) =>
    each(Rostering._getActiveStudents({}).is({ user, section, email }))
      .where(whether(Profiling._getProfileFields({ user }).is({ displayName })))
      .form({ user, section, email, displayName }),
);

export const Runs = endpoint("/live/lectures/runs", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayViewAttendance({ user }))
      .then(
        respond({
          questionnaires: theQuestionnaireRuns({}),
          relays: theRelayRuns({}),
        }),
      )
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotViewAttendance({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const Attendance = endpoint(
  "/live/lectures/attendance",
  ({ session, user, detail, timezone }) =>
    receive({ session }).then(
      where(
        activeUser({ session }).is({ user }),
        mayReadAttendance({ user }),
        whether(Rostering._getClass({}).is({ detail })),
        compute(computations.classTimezone, { detail }, timezone),
      )
        .then(
          respond({
            timezone,
            students: theAttendanceRoster({}),
            runs: theLectureRuns({}),
          }),
        )
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotReadAttendance({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const Mark = endpoint(
  "/live/lectures/mark",
  ({ session, run, user, at }) =>
    receive({ session, run }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayMarkLectures({ user }),
        runStandsAlone({ run }),
        Pinning._isPinned({ item: run, scope: LECTURES }).is({ pinned: false }),
      )
        .then(Pinning.pin({ item: run, scope: LECTURES, priority: 0, at }).responds())
        .then(respond({ run, lecture: true }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayMarkLectures({ user }),
        runStandsAlone({ run }),
        Pinning._isPinned({ item: run, scope: LECTURES }).is({ pinned: true }),
      )
        .then(respond({ run, lecture: true }))
        .named("already"),
      where(
        activeUser({ session }).is({ user }),
        mayMarkLectures({ user }),
        runDoesNotStandAlone({ run }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("not-a-run"),
      where(activeUser({ session }).is({ user }), mayNotMarkLectures({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "run"] } },
);

export const Unmark = endpoint(
  "/live/lectures/unmark",
  ({ session, run, user }) =>
    receive({ session, run }).then(
      where(activeUser({ session }).is({ user }), mayMarkLectures({ user }))
        .then(Pinning.unpin({ item: run, scope: LECTURES }).responds())
        .then(respond({ run, lecture: false }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotMarkLectures({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "run"] } },
);
