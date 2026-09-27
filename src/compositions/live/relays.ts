import {
  compute,
  each,
  form,
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
  legHasNotRunInRun,
  legIsOfRun,
  legSourcesHaveClosed,
  legTakesNothing,
  liveLaunchInput,
  mayHostLive,
  mayNotHostLive,
  openRoundInput,
  participantIsSeated,
  questionnaireHasAnOpenRun,
  questionnaireHasNoOpenRun,
  relayHasAnOpenRun,
  relayHasNoOpenRun,
  relayIsNotRetired,
  relayIsRetired,
  runIsARelayRun,
  runIsClosed,
  runIsOpen,
  seatIsNotDismissed,
  theOpeningOf,
  theOpenPartOf,
  theOpenRoundOf,
  theRoundOfLegInRun,
  theRoundOfMaterialInRun,
  theRunOf,
  theParticipationAccess,
  theTakeOf,
} from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";
import { RESERVED_PILES, SORTING_USE } from "./rounds.ts";

const {
  Accessing,
  Attending,
  Categorizing,
  Guiding,
  Locating,
  Pinning,
  Publishing,
  Questioning,
  Reasoning,
  Relaying,
  Responding,
  RunSnapshotting,
  Sharing,
  Subscribing,
  Trashing,
} = concepts;

/** The reserved Pinning scope in which a pinned run is one the model sorts. */
export const SORTING = "sorting";

/** Whether a round's edition is open, and how many responses it drew. */
export const theRoundFigure = former(
  "the figure of (round)",
  (
    { round },
    {
      open,
      openedAt,
      closedAt,
      begun,
      handedIn,
      modelResponse,
      participant,
      run,
      silentResponse,
      silentSeat,
      silentRun,
    },
  ) =>
    where(Publishing._edition({ edition: round }).is({ open, openedAt, closedAt })).form({
      round,
      open,
      openedAt,
      closedAt,
      begun: each(Responding._responsesFor({ subject: round }).is({ response: begun })).count(),
      handedIn: each(
        Responding._responsesFor({ subject: round }).is({ response: handedIn, submitted: true }),
      ).count(),
      handedInByModel: each(
        Responding._responsesFor({ subject: round }).is({
          response: modelResponse,
          participant,
          submitted: true,
        }),
      )
        .where(theRunOf({ round }).is({ run }), participantIsSeated({ participant, run }))
        .count(),
      // A seat whose ask failed and has no reply is not writing: nothing is
      // coming for it, and the Model row says so rather than counting it as
      // still writing.
      silentByModel: each(
        Responding._responsesFor({ subject: round }).is({
          response: silentResponse,
          participant: silentSeat,
          submitted: false,
        }),
      )
        .where(
          theRunOf({ round }).is({ run: silentRun }),
          participantIsSeated({ participant: silentSeat, run: silentRun }),
          Reasoning._lastFailureAbout({ about: silentResponse }),
          no(Reasoning._repliesAbout({ about: silentResponse })),
        )
        .count(),
    }),
).optional();

/** Every relay, newest first, with its rounds and whatever run of it is live. */
export const theRelays = former(
  "the relays",
  (
    _inputs,
    {
      relay,
      title,
      createdAt,
      leg,
      material,
      position,
      roundTitle,
      run,
      code,
      openRound,
      round,
      open,
      runs,
      past,
      retired,
    },
  ) =>
    each(Relaying._relays({}).is({ relay, title, createdAt }))
      .where(
        Trashing._isTrashed({ item: relay }).is({ trashed: retired }),
        whether(Publishing._editionsFor({ material: relay }).is({ edition: run, open: true })),
        whether(Locating._for({ subject: run }).is({ code })),
        whether(theOpenRoundOf({ run }).is({ round: openRound })),
      )
      .form({
        relay,
        title,
        createdAt,
        retired,
        rounds: each(Relaying._legs({ relay }).is({ leg, material, position }))
          .where(
            Questioning._getQuestionnaire({ questionnaire: material }).is({ title: roundTitle }),
            whether(theRoundOfMaterialInRun({ run, material }).is({ round, open })),
          )
          .form({ leg, number: position, title: roundTitle, round, open }),
        run,
        code,
        openRound,
        figure: whether(theRoundFigure({ round: openRound })),
        runs: each(Publishing._editionsFor({ material: relay }).is({ edition: runs })).count(),
        closedRuns: each(
          Publishing._editionsFor({ material: relay }).is({ edition: past, open: false }),
        ).count(),
      }),
);

/** One relay whole: each round with its question and takes, and the relay's runs. */
export const theRelayGuide = former(
  "host guidance for relay (relay)",
  ({ relay }, { opening, closing }) =>
    where(
      Guiding._guidanceText({ subject: relay, use: "hosting-opening" }).is({ text: opening }),
      Guiding._guidanceText({ subject: relay, use: "hosting-closing" }).is({ text: closing }),
    ).form({ opening, closing }),
);
export const theRoundGuide = former(
  "host guidance for round (leg)",
  ({ leg }, { purpose, facilitation, selection, consumer }) =>
    where(
      Guiding._guidanceText({ subject: leg, use: "hosting-purpose" }).is({ text: purpose }),
      Guiding._guidanceText({ subject: leg, use: "hosting-facilitation" }).is({
        text: facilitation,
      }),
      Guiding._guidanceText({ subject: leg, use: "hosting-selection" }).is({ text: selection }),
    ).form({
      purpose,
      facilitation,
      selection: each(Relaying._drawsOn({ source: leg }).is({ leg: consumer })).first(selection),
    }),
);

export const theRelay = former(
  "the relay (relay)",
  (
    { relay },
    {
      title,
      description,
      storedSelection,
      createdAt,
      leg,
      material,
      position,
      roundTitle,
      question,
      prompt,
      choices,
      parts,
      cap,
      source,
      sourceNumber,
      use,
      run,
      open,
      openedAt,
      closedAt,
      token,
      code,
      retired,
      ran,
      pile,
      pileName,
      sentence,
      notes,
      kind,
    },
  ) =>
    where(
      Relaying._relay({ relay }).is({ title, createdAt }),
      Trashing._isTrashed({ item: relay }).is({ trashed: retired }),
      Guiding._guidanceText({ subject: relay, use: "relay-description" }).is({ text: description }),
    ).form({
      relay,
      title,
      description,
      hostGuide: theRelayGuide({ relay }),
      createdAt,
      retired,
      rounds: each(Relaying._legs({ relay }).is({ leg, material, position, kind }))
        .where(
          Guiding._guidanceText({ subject: leg, use: "hosting-selection" }).is({
            text: storedSelection,
          }),
          Questioning._getQuestionnaire({ questionnaire: material }).is({ title: roundTitle }),
          Questioning._getQuestions({ questionnaire: material }).is({
            question,
            prompt,
            choices,
            parts,
            cap,
          }),
          Guiding._guidanceText({ subject: leg, use: SORTING_USE }).is({ text: notes }),
        )
        .form({
          leg,
          storedSelection,
          hostGuide: theRoundGuide({ leg }),
          number: position,
          kind,
          questionnaire: material,
          title: roundTitle,
          question,
          prompt,
          choices,
          parts,
          cap,
          takes: each(Relaying._draws({ leg }).is({ source, use }))
            .where(Relaying._leg({ leg: source }).is({ position: sourceNumber }))
            .form({ source, sourceNumber, use }),
          piles: each(
            Categorizing._categoriesIn({ scope: leg }).is({
              category: pile,
              name: pileName,
              description: sentence,
            }),
          ).form({ pile, name: pileName, description: sentence }),
          notes,
        }),
      runs: each(
        Publishing._editionsFor({ material: relay }).is({ edition: run, open, openedAt, closedAt }),
      )
        .where(
          whether(Sharing._sharesFor({ subject: run }).is({ token })),
          whether(Locating._for({ subject: run }).is({ code })),
        )
        .form({
          run,
          open,
          openedAt,
          closedAt,
          token,
          code,
          rounds: each(Publishing._parts({ whole: run }).is({ edition: ran })).form({
            round: ran,
            figure: whether(theRoundFigure({ round: ran })),
          }),
        }),
    }),
).optional();

/**
 * One run: which rounds ran, which is open or opening, the figure of each, and
 * the room: how many devices were heard since the given instant, and how many
 * of them hold the open round.
 */
export const theRelayRun = former(
  "the run (run) with its room since (since)",
  (
    { run, since },
    {
      relay,
      title,
      description,
      storedSelection,
      open,
      openedAt,
      closedAt,
      token,
      code,
      openRound,
      opening,
      leg,
      material,
      position,
      roundTitle,
      round,
      takenFrom,
      seat,
      modelSorts,
      attendee,
      onRound,
      held,
    },
  ) =>
    where(
      Publishing._edition({ edition: run }).is({ material: relay, open, openedAt, closedAt }),
      Relaying._relay({ relay }).is({ title }),
      whether(Locating._for({ subject: run }).is({ code })),
      whether(theOpenRoundOf({ run }).is({ round: openRound })),
      whether(theOpeningOf({ run }).is({ round: opening })),
      Pinning._isPinned({ item: run, scope: SORTING }).is({ pinned: modelSorts }),
      Guiding._guidanceText({ subject: relay, use: "relay-description" }).is({ text: description }),
    ).form({
      run,
      relay,
      title,
      description,
      hostGuide: theRelayGuide({ relay }),
      open,
      openedAt,
      closedAt,
      token: each(Sharing._sharesFor({ subject: run }).is({ token })).first(token),
      code,
      openRound,
      opening,
      modelSorts,
      room: form({
        here: each(Attending._present({ gathering: run, since }).is({ attendee })).count(),
        onOpenRound: each(
          Attending._present({ gathering: run, since }).is({ attendee: onRound, holding: held }),
        )
          .where(theOpenRoundOf({ run }).is({ round: held }))
          .count(),
      }),
      seats: each(Subscribing._getSubscribers({ target: run }).is({ user: seat }))
        .where(seatIsNotDismissed({ participant: seat }))
        .form({ participant: seat }),
      rounds: each(Relaying._legs({ relay }).is({ leg, material, position }))
        .where(
          Guiding._guidanceText({ subject: leg, use: "hosting-selection" }).is({
            text: storedSelection,
          }),
          Questioning._getQuestionnaire({ questionnaire: material }).is({ title: roundTitle }),
          whether(theRoundOfMaterialInRun({ run, material }).is({ round })),
        )
        .form({
          leg,
          storedSelection,
          hostGuide: theRoundGuide({ leg }),
          number: position,
          title: roundTitle,
          round,
          figure: whether(theRoundFigure({ round })),
          takes: each(Relaying._draws({ leg }).is({ source: takenFrom })).count(),
        }),
    }),
).optional();

/**
 * A round the room has met in a run: every round published within it but the
 * one still opening, so a round closed before it opened counts as run.
 */
const theRoundMetInRun = view(
  "the round of (material) the room met in (run)",
  ({ run, material }, { round, open }, _bindings) =>
    where(
      theRoundOfMaterialInRun({ run, material }).is({ round, open }),
      no(theOpeningOf({ run }).is({ round })),
    ),
).optional();

/** What a phone meets on a relay run: the rounds' standing and the open round's face. */
export const theRelayFace = former(
  "the face of relay run (run)",
  (
    { run },
    {
      mode,
      requireSignIn,
      relay,
      title,
      open,
      openRound,
      presentation,
      questions,
      leg,
      material,
      position,
      roundTitle,
      round,
      roundOpen,
    },
  ) =>
    where(
      theParticipationAccess({ subject: run }).is({ mode }),
      compute(computations.liveRequiresSignIn, { mode }, requireSignIn),
      Publishing._edition({ edition: run }).is({ material: relay, open }),
      Relaying._relay({ relay }).is({ title }),
      whether(theOpenRoundOf({ run }).is({ round: openRound })),
      whether(RunSnapshotting._snapshot({ subject: openRound }).is({ value: presentation })),
      compute(computations.participantQuestions, { value: presentation }, questions),
    ).form({
      run,
      requireSignIn,
      title,
      open,
      openRound,
      questions,
      rounds: each(Relaying._legs({ relay }).is({ leg, material, position }))
        .where(
          Questioning._getQuestionnaire({ questionnaire: material }).is({ title: roundTitle }),
          whether(theRoundMetInRun({ run, material }).is({ round, open: roundOpen })),
        )
        .form({ leg, number: position, title: roundTitle, round, open: roundOpen }),
    }),
).optional();

/** The table of what a round may take from an earlier one, by the kind of round it is. */
export const Uses = endpoint(
  "/live/relays/uses",
  ({ session, user, uses }) =>
    receive({ session }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        compute(computations.carryUses, {}, uses),
      )
        .then(respond({ uses }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session"] } },
);

export const List = endpoint("/live/relays/list", ({ session, user, at }) =>
  receive({ session }).then(
    where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
      .then(respond({ relays: theRelays({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const Get = endpoint(
  "/live/relays/get",
  ({ session, relay, user, at }) =>
    receive({ session, relay }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(respond({ relay: theRelay({ relay }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "relay"] } },
);

export const Run = endpoint(
  "/live/relays/run",
  ({ session, run, user, at, since }) =>
    receive({ session, run }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        compute(computations.roomSince, { at }, since),
      )
        .then(respond({ run: theRelayRun({ run, since }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "run"] } },
);

export const Plan = endpoint(
  "/live/relays/plan",
  ({ session, title, user, at, relay }) =>
    receive({ session, title }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(Relaying.plan({ author: user, title, at }).responds({ relay }))
        .then(respond({ relay }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "title"] } },
);

export const Retitle = endpoint(
  "/live/relays/retitle",
  ({ session, relay, title, user, at, retitled }) =>
    receive({ session, relay, title }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._relay({ relay }),
        relayIsNotRetired({ relay }),
      )
        .then(Relaying.retitle({ relay, title }).responds({ relay: retitled }))
        .then(respond({ relay: retitled }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._relay({ relay }),
        relayIsRetired({ relay }),
      )
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._relay({ relay })),
      )
        .then(respond({ error: "RELAY_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "relay", "title"] } },
);

/**
 * A round is one questionnaire of the survey form holding one question. One
 * request composes it, adds the question, sets its parts, and appends the leg,
 * so a half-made round never stands.
 */
/** A relay retires like a questionnaire: never while a run is open, and its runs stay readable. */
export const Retire = endpoint(
  "/live/relays/retire",
  ({ session, relay, user, at, retired }) =>
    receive({ session, relay }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._relay({ relay }),
        relayHasNoOpenRun({ relay }),
        relayIsNotRetired({ relay }),
      )
        .then(Trashing.trash({ item: relay, by: user, at }).responds({ item: retired }))
        .then(respond({ relay: retired }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._relay({ relay }),
        relayHasAnOpenRun({ relay }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._relay({ relay }),
        relayIsRetired({ relay }),
      )
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._relay({ relay })),
      )
        .then(respond({ error: "RELAY_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "relay"] } },
);

export const AddRound = endpoint(
  "/live/relays/add-round",
  ({
    session,
    relay,
    title,
    prompt,
    parts,
    cap,
    choices,
    valid,
    user,
    at,
    questionnaire,
    question,
    leg,
    position,
  }) =>
    receive({ session, relay, title, prompt, parts, cap, choices }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._relay({ relay }),
        relayIsNotRetired({ relay }),
        compute(computations.roundMaterialIsValid, { title, prompt, choices, parts, cap }, valid),
        is.among(valid, [true]),
      )
        .then(
          Questioning.compose({
            author: user,
            title,
            form: "survey",
            disclosure: "score",
            at,
          }).responds({ questionnaire }),
        )
        .then(
          Questioning.addQuestion({
            questionnaire,
            prompt,
            choices,
            expected: "",
            explanation: "",
            position: 1,
          }).responds({ question }),
        )
        .then(Questioning.setParts({ question, parts, cap }).responds())
        .then(Relaying.addLeg({ relay, material: questionnaire }).responds({ leg, position }))
        .then(respond({ leg, questionnaire, question, position }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._relay({ relay }),
        relayIsNotRetired({ relay }),
        compute(computations.roundMaterialIsValid, { title, prompt, choices, parts, cap }, valid),
        is.among(valid, [false]),
      )
        .then(respond({ error: "INVALID_REQUEST" }))
        .named("invalid-material"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._relay({ relay }),
        relayIsRetired({ relay }),
      )
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._relay({ relay })),
      )
        .then(respond({ error: "RELAY_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "relay", "title", "prompt", "parts", "cap", "choices"] } },
);

export const ReviseRound = endpoint(
  "/live/relays/revise-round",
  ({
    session,
    leg,
    title,
    prompt,
    parts,
    cap,
    choices,
    valid,
    user,
    at,
    relay,
    questionnaire,
    material,
    question,
    position,
    held,
    revised,
    again,
  }) =>
    receive({ session, leg, title, prompt, parts, cap, choices })
      .then(
        where(
          now(at),
          activeUser({ session }).is({ user }),
          mayHostLive({ user }),
          Relaying._leg({ leg }).is({ relay, material: questionnaire }),
          relayIsNotRetired({ relay }),
          questionnaireHasNoOpenRun({ questionnaire }),
          compute(computations.roundMaterialIsValid, { title, prompt, choices, parts, cap }, valid),
          is.among(valid, [true]),
        ).then(Questioning.retitle({ questionnaire, title }).responds()),
      )
      .then(
        where(
          Relaying._leg({ leg }).is({ material }),
          Questioning._getQuestions({ questionnaire: material }).is({ question }),
        ).then(Questioning.setParts({ question, parts: [], cap: 0 }).responds({ question: held })),
      )
      .then(
        where(Questioning._getQuestion({ question: held }).is({ position })).then(
          Questioning.reviseQuestion({
            question: held,
            prompt,
            choices,
            expected: "",
            explanation: "",
            position,
          }).responds({ question: revised }),
        ),
      )
      .then(Questioning.setParts({ question: revised, parts, cap }).responds({ question: again }))
      .then(respond({ question: again })),
  { input: { required: ["session", "leg", "title", "prompt", "parts", "cap", "choices"] } },
);

export const ReviseRoundRefused = endpoint(
  "/live/relays/revise-round",
  ({ session, leg, title, prompt, choices, parts, cap, valid, user, relay, questionnaire }) =>
    receive({ session, leg, title, prompt, choices, parts, cap }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay, material: questionnaire }),
        relayIsNotRetired({ relay }),
        questionnaireHasNoOpenRun({ questionnaire }),
        compute(computations.roundMaterialIsValid, { title, prompt, choices, parts, cap }, valid),
        is.among(valid, [false]),
      )
        .then(respond({ error: "INVALID_REQUEST" }))
        .named("invalid-material"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ material: questionnaire }),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay }),
        relayIsRetired({ relay }),
      )
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), no(Relaying._leg({ leg })))
        .then(respond({ error: "LEG_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const RemoveRound = endpoint(
  "/live/relays/remove-round",
  ({ session, leg, user, at, relay, questionnaire, removed, material }) =>
    receive({ session, leg }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay, material: questionnaire }),
        relayIsNotRetired({ relay }),
        questionnaireHasNoOpenRun({ questionnaire }),
      )
        .then(Relaying.removeLeg({ leg }).responds({ leg: removed, material }))
        .then(Questioning.retire({ questionnaire: material }).responds())
        .then(respond({ leg: removed }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ material: questionnaire }),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay }),
        relayIsRetired({ relay }),
      )
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "leg"] } },
);

export const MoveRound = endpoint(
  "/live/relays/move-round",
  ({ session, leg, position, user, at, relay, moved, placed }) =>
    receive({ session, leg, position }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay }),
        relayIsNotRetired({ relay }),
      )
        .then(Relaying.moveLeg({ leg, position }).responds({ leg: moved, position: placed }))
        .then(respond({ leg: moved, position: placed }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay }),
        relayIsRetired({ relay }),
      )
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), no(Relaying._leg({ leg })))
        .then(respond({ error: "LEG_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "leg", "position"] } },
);

export const SetTakes = endpoint(
  "/live/relays/set-takes",
  ({
    session,
    leg,
    source,
    use,
    user,
    at,
    relay,
    questionnaire,
    kind,
    choices,
    parts,
    draw,
    fit,
  }) =>
    receive({ session, leg, source, use }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay, material: questionnaire, kind }),
        relayIsNotRetired({ relay }),
        Questioning._getQuestions({ questionnaire }).is({ choices, parts }),
        compute(computations.useFit, { use, kind, choices, parts }, fit),
        is.among(fit, ["open"]),
      )
        .then(Relaying.draw({ leg, source, use }).responds({ draw }))
        .then(respond({ draw }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay, material: questionnaire, kind }),
        relayIsNotRetired({ relay }),
        Questioning._getQuestions({ questionnaire }).is({ choices, parts }),
        compute(computations.useFit, { use, kind, choices, parts }, fit),
        is.among(fit, ["closed", "unknown"]),
      )
        .then(respond({ error: "INVALID_USE" }))
        .named("use-not-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay }),
        relayIsRetired({ relay }),
      )
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), no(Relaying._leg({ leg })))
        .then(respond({ error: "LEG_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "leg", "source", "use"] } },
);

export const ClearTakes = endpoint(
  "/live/relays/clear-takes",
  ({ session, leg, source, user, at, relay, cleared }) =>
    receive({ session, leg, source }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay }),
        relayIsNotRetired({ relay }),
      )
        .then(Relaying.undraw({ leg, source }).responds({ leg: cleared }))
        .then(respond({ leg: cleared }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay }),
        relayIsRetired({ relay }),
      )
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), no(Relaying._leg({ leg })))
        .then(respond({ error: "LEG_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "leg", "source"] } },
);

/** A leg whose take fills its choices is a vote with something to vote on. */
const legTakesChoices = view("(leg) takes its choices", ({ leg }, _outputs, _bindings) =>
  where(Relaying._draws({ leg }).is({ use: "choices" })),
).holds();

/**
 * A leg the planner called a vote that offers nothing to vote on: no choice of
 * its own and no take that fills them. The kind is the leg's word; a leg with
 * no word is the kind its content makes it, which is never a bare vote.
 */
const legIsABareVote = view(
  "(leg) is a vote with nothing to vote on",
  ({ leg }, _outputs, { material, kind, choices, standing }) =>
    where(
      Relaying._leg({ leg }).is({ material, kind }),
      Questioning._getQuestions({ questionnaire: material }).is({ choices }),
      compute(computations.voteStanding, { kind, choices }, standing),
      is.among(standing, ["bare"]),
      no(legTakesChoices({ leg })),
    ),
).holds();

const relayHasABareVote = view(
  "(relay) has a vote with nothing to vote on",
  ({ relay }, _outputs, { leg }) =>
    where(Relaying._legs({ relay }).is({ leg }), legIsABareVote({ leg })),
).holds();

/**
 * The kind a round is to its planner, kept on the leg so the launch guard can
 * read what the editor pressed: a vote with no choices yet is a vote after a
 * reload, not the write round its content would make it.
 */
export const SetKind = endpoint(
  "/live/relays/set-kind",
  ({ session, leg, kind, user, relay }) =>
    receive({ session, leg, kind }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay }),
        relayIsNotRetired({ relay }),
      )
        .then(Relaying.setKind({ leg, kind }).responds())
        .then(respond({ leg, kind }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay }),
        relayIsRetired({ relay }),
      )
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), no(Relaying._leg({ leg })))
        .then(respond({ error: "LEG_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "leg", "kind"] } },
);

/**
 * The relay itself is the run's material; nothing is captured until a round
 * opens. A relay holding a vote with nothing to vote on is refused, since the
 * round would open as a write round with the vote's word on it.
 * Access modes use explicit branches: the engine cannot carry computed holders
 * through this action chain. The computed holders select the branch; its access
 * write uses the matching literal before either participation address is issued.
 */
export const Launch = endpoint(
  "/live/relays/launch",
  ({ session, relay, requireSignIn, holders, user, at, run, token, code }) =>
    receive({ session, relay, requireSignIn }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._relay({ relay }),
        relayIsNotRetired({ relay }),
        relayHasABareVote({ relay }),
      )
        .then(respond({ error: "NO_CHOICES" }))
        .named("bare-vote"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._relay({ relay }),
        relayIsRetired({ relay }),
      )
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._relay({ relay })),
      )
        .then(respond({ error: "RELAY_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(
        compute(computations.liveAccessHolders, { requireSignIn }, holders),
        is.among("standing:everyone", holders),
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._relay({ relay }),
        relayIsNotRetired({ relay }),
        no(relayHasABareVote({ relay })),
      )
        .then(Publishing.publish({ author: user, material: relay, at }).responds({ edition: run }))
        .then(
          Accessing.establish({
            resource: run,
            holders: ["standing:everyone"],
          }).responds(),
        )
        .then(Sharing.issue({ subject: run }).responds({ token }))
        .then(Locating.ensure({ subject: run }).responds({ code }))
        .then(respond({ run, token, code }))
        .named("success"),
      where(
        compute(computations.liveAccessHolders, { requireSignIn }, holders),
        is.among("standing:authenticated", holders),
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._relay({ relay }),
        relayIsNotRetired({ relay }),
        no(relayHasABareVote({ relay })),
      )
        .then(Publishing.publish({ author: user, material: relay, at }).responds({ edition: run }))
        .then(
          Accessing.establish({
            resource: run,
            holders: ["standing:authenticated"],
          }).responds(),
        )
        .then(Sharing.issue({ subject: run }).responds({ token }))
        .then(Locating.ensure({ subject: run }).responds({ code }))
        .then(respond({ run, token, code }))
        .named("success-signed"),
    ),
  {
    input: { required: ["session", "relay"], defaults: { requireSignIn: false } },
    validators: { input: liveLaunchInput },
  },
);

/** How the request's picks stand on the closed wall the round takes from. */
const thePickStandingOf = view(
  "how (picked) stands on the wall (leg) takes from in (run)",
  ({ run, leg, picked }, { standing }, { source, round, categories }) =>
    where(
      theTakeOf({ leg }).is({ source }),
      theRoundOfLegInRun({ run, leg: source }).is({ round, open: false }),
      Categorizing._categoriesWithItems({ scope: round }).is({ categories }),
      compute(computations.pickStanding, { picked, categories }, standing),
    ),
).optional();

/** Ready on the request's picks: the round takes nothing, or every pile it picks stands. */
const legIsReady = view(
  "(leg) is ready to open in (run) on (picked)",
  ({ run, leg, picked }, _outputs, _bindings) => [
    where(legTakesNothing({ leg })),
    where(thePickStandingOf({ run, leg, picked }).is({ standing: "ready" })),
  ],
).holds();

/** Due its presentation: nothing is open and the round has not run, or it is the round opening. */
const legIsDueInRun = view(
  "(leg) is due its presentation in (run)",
  ({ run, leg }, _outputs, { round }) => [
    where(legHasNotRunInRun({ run, leg }), no(theOpenPartOf({ run }))),
    where(theOpeningOf({ run }).is({ round }), theRoundOfLegInRun({ run, leg }).is({ round })),
  ],
).holds();

/** What the picked piles carry from the round it takes from, in the order the request names them. */
const theCarryOf = view(
  "what (picked) carries from the round (leg) takes in (run)",
  (
    { run, leg, picked },
    { groups, sourceValue, sourceNumber },
    { source, round, categories, values },
  ) =>
    where(
      theTakeOf({ leg }).is({ source }),
      theRoundOfLegInRun({ run, leg: source }).is({ round }),
      Categorizing._categoriesWithItems({ scope: round }).is({ categories }),
      Responding._valuesForSubject({ subject: round }).is({ values }),
      RunSnapshotting._snapshot({ subject: round }).is({ value: sourceValue }),
      Relaying._leg({ leg: source }).is({ position: sourceNumber }),
      compute(
        computations.openingGroups,
        { picked, categories, values, value: sourceValue },
        groups,
      ),
    ),
).optional();

/** The round as the room will meet it: the leg's question as it stands, on the request's picks. */
const theRoundPresentation = view(
  "the presentation of (leg) in (run) on (picked)",
  (
    { run, leg, picked },
    { value },
    { questionnaire, kind, content, use, groups, sourceValue, sourceNumber },
  ) =>
    where(
      Relaying._leg({ leg }).is({ material: questionnaire, kind }),
      Questioning._content({ questionnaire }).is({ content }),
      whether(theTakeOf({ leg }).is({ use })),
      whether(theCarryOf({ run, leg, picked }).is({ groups, sourceValue, sourceNumber })),
      compute(
        computations.roundPresentation,
        { content, kind, use, groups, sourceValue, sourceNumber },
        value,
      ),
    ),
).optional();

/**
 * Opening a round is two writes: the round published within its run, then its
 * presentation. The request names the piles it opens on, as the screen showed
 * them, so nothing read after the press can change what the round carries.
 */
export const OpenRound = endpoint(
  "/live/relays/open-round",
  ({ session, run, leg, picked, user, at, questionnaire, round, value }) =>
    receive({ session, run, leg, picked })
      .then(
        where(
          now(at),
          activeUser({ session }).is({ user }),
          mayHostLive({ user }),
          legIsOfRun({ run, leg }),
          runIsOpen({ run }),
          legHasNotRunInRun({ run, leg }),
          no(theOpenPartOf({ run })),
          legIsReady({ run, leg, picked }),
          Relaying._leg({ leg }).is({ material: questionnaire }),
        ).then(
          Publishing.publishWithin({
            whole: run,
            author: user,
            material: questionnaire,
            at,
          }).responds({ edition: round }),
        ),
      )
      .then(
        where(runIsOpen({ run }), theRoundPresentation({ run, leg, picked }).is({ value }))
          .then(RunSnapshotting.capture({ subject: round, value }).responds())
          .then(respond({ round }))
          .named("captured"),
        where(runIsClosed({ run }))
          .then(respond({ declined: "CLOSED" }))
          .named("closed"),
      ),
  {
    input: { required: ["session", "run", "leg"], defaults: { picked: [] } },
    validators: { input: openRoundInput },
  },
);

/**
 * Open pressed again for a round already under way: the round open to the
 * room is answered, with any standing pile missing from its wall ensured again,
 * and the round the run holds open is given its presentation, which
 * Snapshotting refuses once one stands.
 */
export const OpenRoundAgain = endpoint(
  "/live/relays/open-round",
  ({ session, run, leg, picked, user, at, round, value, name, category }) =>
    receive({ session, run, leg, picked }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theOpenRoundOf({ run }).is({ round }),
        theRoundOfLegInRun({ run, leg }).is({ round }),
      )
        .then(respond({ round }))
        .named("open"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theOpenRoundOf({ run }).is({ round }),
        theRoundOfLegInRun({ run, leg }).is({ round }),
        Relaying._leg({ leg }).is.not({ kind: "vote" }),
        Categorizing._categoriesIn({ scope: leg }).is({ name }),
        no(Categorizing._categoriesIn({ scope: round }).is({ name })),
      )
        .then(
          Categorizing.ensureCategory({ scope: round, name, description: "" }).responds({
            category,
          }),
        )
        .then(Pinning.pin({ item: category, scope: RESERVED_PILES, priority: 0, at }))
        .named("pile"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theOpenRoundOf({ run }).is({ round }),
        theRoundOfLegInRun({ run, leg }).is({ round }),
        Relaying._leg({ leg }).is.not({ kind: "vote" }),
        Categorizing._categoriesIn({ scope: leg }).is({ name }),
        Categorizing._categoriesIn({ scope: round }).is({ category, name }),
        Pinning._isPinned({ item: category, scope: RESERVED_PILES }).is({ pinned: false }),
      )
        .then(Pinning.pin({ item: category, scope: RESERVED_PILES, priority: 0, at }))
        .named("reserve"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        runIsOpen({ run }),
        theOpenPartOf({ run }).is({ round }),
        theRoundOfLegInRun({ run, leg }).is({ round }),
        legIsReady({ run, leg, picked }),
        theRoundPresentation({ run, leg, picked }).is({ value }),
      )
        .then(RunSnapshotting.capture({ subject: round, value }).responds())
        .then(respond({ round }))
        .named("finish"),
    ),
);

/** A press that cannot open its round is answered with the word the board shows, as data. */
export const OpenRoundDeclined = endpoint(
  "/live/relays/open-round",
  ({ session, run, leg, picked, user, number, source, underway, material }) =>
    receive({ session, run, leg, picked }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(legIsOfRun({ run, leg })),
      )
        .then(respond({ declined: "LEG_NOT_FOUND" }))
        .named("leg-not-found"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsOfRun({ run, leg }),
        runIsClosed({ run }),
      )
        .then(respond({ declined: "CLOSED" }))
        .named("closed"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsOfRun({ run, leg }),
        runIsOpen({ run }),
        theRoundOfLegInRun({ run, leg }).is({ open: false }),
        Relaying._leg({ leg }).is({ position: number }),
      )
        .then(respond({ declined: "ROUND_DONE", round: number }))
        .named("round-done"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsOfRun({ run, leg }),
        runIsOpen({ run }),
        legHasNotRunInRun({ run, leg }),
        theTakeOf({ leg }).is({ source }),
        legHasNotRunInRun({ run, leg: source }),
        Relaying._leg({ leg: source }).is({ position: number }),
      )
        .then(respond({ declined: "SOURCE_UNRUN", source: number }))
        .named("source-unrun"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsOfRun({ run, leg }),
        runIsOpen({ run }),
        legHasNotRunInRun({ run, leg }),
        theTakeOf({ leg }).is({ source }),
        theRoundOfLegInRun({ run, leg: source }).is({ open: true }),
        Relaying._leg({ leg: source }).is({ position: number }),
      )
        .then(respond({ declined: "SOURCE_OPEN", source: number }))
        .named("source-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsOfRun({ run, leg }),
        runIsOpen({ run }),
        legHasNotRunInRun({ run, leg }),
        legSourcesHaveClosed({ run, leg }),
        theOpenPartOf({ run }).is({ round: underway }),
        Publishing._edition({ edition: underway }).is({ material }),
        Relaying._legFor({ material }).is({ position: number }),
      )
        .then(respond({ declined: "ROUND_OPEN", round: number }))
        .named("round-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsOfRun({ run, leg }),
        runIsOpen({ run }),
        legIsDueInRun({ run, leg }),
        thePickStandingOf({ run, leg, picked }).is({ standing: "none" }),
      )
        .then(respond({ declined: "NOTHING_PICKED" }))
        .named("nothing-picked"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsOfRun({ run, leg }),
        runIsOpen({ run }),
        legIsDueInRun({ run, leg }),
        thePickStandingOf({ run, leg, picked }).is({ standing: "gone" }),
      )
        .then(respond({ declined: "PILE_GONE" }))
        .named("pile-gone"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

/** A run that closes closes the round it holds open, whichever path closed it. */
export const ClosedRunClosesRounds = reaction(({ run, round, at }) =>
  when(Publishing.close({ edition: run }).responds())
    .where(now(at), runIsARelayRun({ run }), theOpenPartOf({ run }).is({ round }))
    .then(Publishing.close({ edition: round, at })),
);

export const CloseRound = endpoint(
  "/live/relays/close-round",
  ({ session, round, user, at, closed }) =>
    receive({ session, round }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(Publishing.close({ edition: round, at }).responds({ edition: closed }))
        .then(respond({ round: closed }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "round"] } },
);

/**
 * Closing the run closes the round it holds open first, open or opening, so no
 * phone is left answering. A run already closed is answered as closed.
 */
export const Close = endpoint(
  "/live/relays/close",
  ({ session, run, user, at, round, closedRound, closed }) =>
    receive({ session, run }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theOpenPartOf({ run }).is({ round }),
      )
        .then(Publishing.close({ edition: round, at }).responds({ edition: closedRound }))
        .then(Publishing.close({ edition: run, at }).responds({ edition: closed }))
        .then(respond({ run: closed }))
        .named("with-round"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        runIsOpen({ run }),
        no(theOpenPartOf({ run })),
      )
        .then(Publishing.close({ edition: run, at }).responds({ edition: closed }))
        .then(respond({ run: closed }))
        .named("bare"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), runIsClosed({ run }))
        .then(respond({ run }))
        .named("already-closed"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "run"] } },
);

/**
 * "Model sorts" is the run's switch, the same on every dashboard: the run
 * pinned in the reserved scope `sorting`. A staff member who flips it flips
 * it for the room; the dashboards that are open keep the cadence.
 */
export const SortByModel = endpoint(
  "/live/relays/sort-by-model",
  ({ session, run, user, at }) =>
    receive({ session, run }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        runIsOpen({ run }),
        Pinning._isPinned({ item: run, scope: SORTING }).is({ pinned: false }),
      )
        .then(Pinning.pin({ item: run, scope: SORTING, priority: 0, at }).responds())
        .then(respond({ run, modelSorts: true }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        runIsOpen({ run }),
        Pinning._isPinned({ item: run, scope: SORTING }).is({ pinned: true }),
      )
        .then(respond({ run, modelSorts: true }))
        .named("already"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), runIsClosed({ run }))
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "run"] } },
);

export const SortByHand = endpoint(
  "/live/relays/sort-by-hand",
  ({ session, run, user }) =>
    receive({ session, run }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        runIsOpen({ run }),
        Pinning._isPinned({ item: run, scope: SORTING }).is({ pinned: true }),
      )
        .then(Pinning.unpin({ item: run, scope: SORTING }).responds())
        .then(respond({ run, modelSorts: false }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        runIsOpen({ run }),
        Pinning._isPinned({ item: run, scope: SORTING }).is({ pinned: false }),
      )
        .then(respond({ run, modelSorts: false }))
        .named("already"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), runIsClosed({ run }))
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "run"] } },
);

/** A seat taken while a round is open answers that round at once. */
export const SeatedParticipantAnswersOpenRound = reaction(({ participant, run, round, at }) =>
  when(Subscribing.subscribe({ user: participant, target: run }).responds())
    .where(now(at), runIsARelayRun({ run }), theOpenRoundOf({ run }).is({ round }))
    .then(Responding.begin({ participant, subject: round, at })),
);

export const SetGuide = endpoint(
  "/live/relays/set-guide",
  ({ session, relay, field, body, user, use, said, guidance, cleared, scope }) =>
    receive({ session, relay, field, body }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        relayIsNotRetired({ relay }),
        is.among(field, ["description", "opening", "closing"]),
        compute(computations.guideUse, { field }, use),
        compute(computations.briefStanding, { request: body }, said),
        is.among(said, ["given"]),
      )
        .then(Guiding.set({ subject: relay, use, title: "", body }).responds({ guidance }))
        .then(respond({ guidance }))
        .named("set"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        relayIsNotRetired({ relay }),
        is.among(field, ["description", "opening", "closing"]),
        compute(computations.guideUse, { field }, use),
        compute(computations.briefStanding, { request: body }, said),
        is.among(said, ["blank"]),
      )
        .then(Guiding.clear({ subject: relay, use }).responds({ cleared }))
        .then(respond({ cleared }))
        .named("clear"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), relayIsRetired({ relay }))
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._relay({ relay })),
      )
        .then(respond({ error: "RELAY_NOT_FOUND" }))
        .named("missing"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        relayIsNotRetired({ relay }),
        compute(computations.guideScope, { field }, scope),
        is.among(scope, ["round", ""]),
      )
        .then(respond({ error: "INVALID_FIELD" }))
        .named("field"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "relay", "field", "body"] } },
);
