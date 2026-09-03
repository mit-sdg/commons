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
  legHasAnOpenSource,
  legHasNotRunInRun,
  legIsNotOfRun,
  legIsOfRun,
  legRanInRun,
  legSourcesHaveClosed,
  legTakesNothing,
  mayHostLive,
  mayNotHostLive,
  participantIsSeated,
  questionnaireHasAnOpenRun,
  questionnaireHasNoOpenRun,
  relayHasAnOpenRun,
  relayHasNoOpenRun,
  relayIsNotRetired,
  relayIsRetired,
  roundHasNoPicks,
  roundHasPicks,
  runHasAnOpenRound,
  runHasNoOpenRound,
  runIsARelayRun,
  runIsClosed,
  runIsOpen,
  seatIsNotDismissed,
  theOpenRoundOf,
  theRoundOfLegInRun,
  theRunOf,
  theTakeOf,
} from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";

const {
  Categorizing,
  Linking,
  Locating,
  Locking,
  Pinning,
  Publishing,
  Questioning,
  Relaying,
  Responding,
  RunSnapshotting,
  Sharing,
  Subscribing,
  Trashing,
} = concepts;

/** The reserved Pinning scope in which a pinned run is one the model sorts. */
const SORTING = "sorting";

/** Whether a round's edition is open, and how many responses it drew. */
export const theRoundFigure = former(
  "the figure of (round)",
  ({ round }, { open, openedAt, closedAt, begun, handedIn, modelResponse, participant, run }) =>
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
            whether(theRoundOfLegInRun({ run, leg }).is({ round, open })),
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
export const theRelay = former(
  "the relay (relay)",
  (
    { relay },
    {
      title,
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
    },
  ) =>
    where(
      Relaying._relay({ relay }).is({ title, createdAt }),
      Trashing._isTrashed({ item: relay }).is({ trashed: retired }),
    ).form({
      relay,
      title,
      createdAt,
      retired,
      rounds: each(Relaying._legs({ relay }).is({ leg, material, position }))
        .where(
          Questioning._getQuestionnaire({ questionnaire: material }).is({ title: roundTitle }),
          Questioning._getQuestions({ questionnaire: material }).is({
            question,
            prompt,
            choices,
            parts,
            cap,
          }),
        )
        .form({
          leg,
          number: position,
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
          rounds: each(Linking._getBacklinks({ target: run }).is({ source: ran })).form({
            round: ran,
            figure: whether(theRoundFigure({ round: ran })),
          }),
        }),
    }),
).optional();

/** One run: which rounds ran, which is open, and the figure of each. */
export const theRelayRun = former(
  "the run (run)",
  (
    { run },
    {
      relay,
      title,
      open,
      openedAt,
      closedAt,
      token,
      code,
      openRound,
      leg,
      material,
      position,
      roundTitle,
      round,
      takenFrom,
      seat,
      modelSorts,
    },
  ) =>
    where(
      Publishing._edition({ edition: run }).is({ material: relay, open, openedAt, closedAt }),
      Relaying._relay({ relay }).is({ title }),
      whether(Locating._for({ subject: run }).is({ code })),
      whether(theOpenRoundOf({ run }).is({ round: openRound })),
      Pinning._isPinned({ item: run, scope: SORTING }).is({ pinned: modelSorts }),
    ).form({
      run,
      relay,
      title,
      open,
      openedAt,
      closedAt,
      token: each(Sharing._sharesFor({ subject: run }).is({ token })).first(token),
      code,
      openRound,
      modelSorts,
      seats: each(Subscribing._getSubscribers({ target: run }).is({ user: seat }))
        .where(seatIsNotDismissed({ participant: seat }))
        .form({ participant: seat }),
      rounds: each(Relaying._legs({ relay }).is({ leg, material, position }))
        .where(
          Questioning._getQuestionnaire({ questionnaire: material }).is({ title: roundTitle }),
          whether(theRoundOfLegInRun({ run, leg }).is({ round })),
        )
        .form({
          leg,
          number: position,
          title: roundTitle,
          round,
          figure: whether(theRoundFigure({ round })),
          takes: each(Relaying._draws({ leg }).is({ source: takenFrom })).count(),
        }),
    }),
).optional();

/** What a phone meets on a relay run: the rounds' standing and the open round's face. */
export const theRelayFace = former(
  "the face of relay run (run)",
  (
    { run },
    {
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
      Publishing._edition({ edition: run }).is({ material: relay, open }),
      Relaying._relay({ relay }).is({ title }),
      whether(theOpenRoundOf({ run }).is({ round: openRound })),
      whether(RunSnapshotting._snapshot({ subject: openRound }).is({ value: presentation })),
      compute(computations.participantQuestions, { value: presentation }, questions),
    ).form({
      run,
      title,
      open,
      openRound,
      questions,
      rounds: each(Relaying._legs({ relay }).is({ leg, material, position }))
        .where(
          Questioning._getQuestionnaire({ questionnaire: material }).is({ title: roundTitle }),
          whether(theRoundOfLegInRun({ run, leg }).is({ round, open: roundOpen })),
        )
        .form({ leg, number: position, title: roundTitle, round, open: roundOpen }),
    }),
).optional();

/** The round's questionnaire as it stands, for a round that takes nothing. */
export const theRoundPresentation = former(
  "the presentation of (leg)",
  (
    { leg },
    {
      questionnaire,
      title,
      form,
      disclosure,
      question,
      prompt,
      choices,
      expected,
      explanation,
      parts,
      cap,
      position,
    },
  ) =>
    where(
      Relaying._leg({ leg }).is({ material: questionnaire }),
      Questioning._getQuestionnaire({ questionnaire }).is({ title, form, disclosure }),
    ).form({
      title,
      form,
      disclosure,
      questions: each(
        Questioning._getQuestions({ questionnaire }).is({
          question,
          prompt,
          choices,
          expected,
          explanation,
          parts,
          cap,
          position,
        }),
      ).form({ item: question, prompt, choices, expected, explanation, parts, cap, position }),
    }),
).optional();

/** The same, with the choices replaced by the piles carried out of the source round. */
export const theRoundPresentationTaking = former(
  "the presentation of (leg) taking from (sourceRound)",
  (
    { leg, sourceRound },
    {
      questionnaire,
      title,
      form,
      disclosure,
      question,
      prompt,
      expected,
      explanation,
      parts,
      cap,
      position,
      pile,
      name,
    },
  ) =>
    where(
      Relaying._leg({ leg }).is({ material: questionnaire }),
      Questioning._getQuestionnaire({ questionnaire }).is({ title, form, disclosure }),
    ).form({
      title,
      form,
      disclosure,
      questions: each(
        Questioning._getQuestions({ questionnaire }).is({
          question,
          prompt,
          expected,
          explanation,
          position,
        }),
      )
        .where(
          compute(computations.oneBoxParts, { question }, parts),
          compute(computations.oneBoxCap, { question }, cap),
        )
        .form({
          item: question,
          prompt,
          choices: each(Pinning._getPinned({ scope: sourceRound }).is({ item: pile }))
            .where(Categorizing._getCategoryDetail({ category: pile }).is({ name }))
            .distinct(name),
          expected,
          explanation,
          parts,
          cap,
          position,
        }),
    }),
).optional();

/** The same, with the parts replaced by the piles carried out of the source round, one box each. */
export const theRoundPresentationTakingParts = former(
  "the presentation of (leg) taking parts from (sourceRound)",
  (
    { leg, sourceRound },
    {
      questionnaire,
      title,
      form,
      disclosure,
      question,
      prompt,
      expected,
      explanation,
      cap,
      choices,
      position,
      pile,
      name,
    },
  ) =>
    where(
      Relaying._leg({ leg }).is({ material: questionnaire }),
      Questioning._getQuestionnaire({ questionnaire }).is({ title, form, disclosure }),
    ).form({
      title,
      form,
      disclosure,
      questions: each(
        Questioning._getQuestions({ questionnaire }).is({
          question,
          prompt,
          expected,
          explanation,
          position,
        }),
      )
        .where(
          compute(computations.oneBoxCap, { question }, cap),
          compute(computations.noChoices, { question }, choices),
        )
        .form({
          item: question,
          prompt,
          choices,
          expected,
          explanation,
          parts: each(Pinning._getPinned({ scope: sourceRound }).is({ item: pile }))
            .where(Categorizing._getCategoryDetail({ category: pile }).is({ name }))
            .distinct(name),
          cap,
          position,
        }),
    }),
).optional();

/** The questionnaire as it stands, showing the carried piles and their cards above the prompt. */
export const theRoundPresentationShowing = former(
  "the presentation of (leg) showing (sourceRound)",
  (
    { leg, sourceRound },
    {
      questionnaire,
      title,
      form,
      disclosure,
      question,
      prompt,
      choices,
      expected,
      explanation,
      parts,
      cap,
      position,
      pile,
      name,
      categories,
      values,
      cards,
    },
  ) =>
    where(
      Relaying._leg({ leg }).is({ material: questionnaire }),
      Questioning._getQuestionnaire({ questionnaire }).is({ title, form, disclosure }),
    ).form({
      title,
      form,
      disclosure,
      questions: each(
        Questioning._getQuestions({ questionnaire }).is({
          question,
          prompt,
          choices,
          expected,
          explanation,
          parts,
          cap,
          position,
        }),
      ).form({
        item: question,
        prompt,
        choices,
        expected,
        explanation,
        parts,
        cap,
        context: each(Pinning._getPinned({ scope: sourceRound }).is({ item: pile }))
          .where(
            Categorizing._getCategoryDetail({ category: pile }).is({ name }),
            Categorizing._categoriesWithItems({ scope: sourceRound }).is({ categories }),
            Responding._valuesForSubject({ subject: sourceRound }).is({ values }),
            compute(computations.pileCards, { pile, categories, values }, cards),
          )
          .form({ name, cards }),
        position,
      }),
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
  ({ session, run, user, at }) =>
    receive({ session, run }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(respond({ run: theRelayRun({ run }) }))
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

/**
 * Clears the parts, revises the question, and sets the parts again, so a round
 * may change shape. Each stage reads the round's question afresh from the leg.
 */
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
  ({ session, leg, user, relay, questionnaire }) =>
    receive({ session, leg }).then(
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
  ({ session, leg, source, use, user, at, relay, questionnaire, choices, parts, draw, fit }) =>
    receive({ session, leg, source, use }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay, material: questionnaire }),
        relayIsNotRetired({ relay }),
        Questioning._getQuestions({ questionnaire }).is({ choices, parts }),
        compute(computations.useFit, { use, choices, parts }, fit),
        is.among(fit, ["open"]),
      )
        .then(Relaying.draw({ leg, source, use }).responds({ draw }))
        .then(respond({ draw }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ relay, material: questionnaire }),
        relayIsNotRetired({ relay }),
        Questioning._getQuestions({ questionnaire }).is({ choices, parts }),
        compute(computations.useFit, { use, choices, parts }, fit),
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

/** The relay itself is the run's material; nothing is captured until a round opens. */
export const Launch = endpoint(
  "/live/relays/launch",
  ({ session, relay, user, at, run, token, code }) =>
    receive({ session, relay }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._relay({ relay }),
        relayIsNotRetired({ relay }),
      )
        .then(Publishing.publish({ author: user, material: relay, at }).responds({ edition: run }))
        .then(Sharing.issue({ subject: run }).responds({ token }))
        .then(Locating.ensure({ subject: run }).responds({ code }))
        .then(respond({ run, token, code }))
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
  { input: { required: ["session", "relay"] } },
);

/**
 * Opening a round is publishing a second time with the round's questionnaire
 * as the material. A round that takes from an earlier one opens only once
 * that round has closed in this run and some of its piles are picked. The run
 * is locked before the round is published: the lock is the run's "a round is
 * open" held where one holder at a time is the rule, so two dashboards that
 * tap Open in one instant open one round and the other is refused. The round
 * is then published and tied to its run; the tie is what captures the
 * presentation, below. Every later stage reads the leg and the run afresh;
 * only the request and the stages' returns cross.
 */
export const OpenRound = endpoint(
  "/live/relays/open-round",
  ({ session, run, leg, user, at, questionnaire, round, tie, source, sourceRound }) =>
    receive({ session, run, leg })
      .then(
        where(
          now(at),
          activeUser({ session }).is({ user }),
          mayHostLive({ user }),
          runIsOpen({ run }),
          legIsOfRun({ run, leg }),
          runHasNoOpenRound({ run }),
          legHasNotRunInRun({ run, leg }),
          legSourcesHaveClosed({ run, leg }),
          legTakesNothing({ leg }),
        )
          .then(Locking.lock({ target: run, at }).responds())
          .named("plain"),
        where(
          now(at),
          activeUser({ session }).is({ user }),
          mayHostLive({ user }),
          runIsOpen({ run }),
          legIsOfRun({ run, leg }),
          runHasNoOpenRound({ run }),
          legHasNotRunInRun({ run, leg }),
          legSourcesHaveClosed({ run, leg }),
          theTakeOf({ leg }).is({ source }),
          theRoundOfLegInRun({ run, leg: source }).is({ round: sourceRound }),
          roundHasPicks({ round: sourceRound }),
        )
          .then(Locking.lock({ target: run, at }).responds())
          .named("taking"),
      )
      .then(
        where(
          activeUser({ session }).is({ user }),
          Relaying._leg({ leg }).is({ material: questionnaire }),
        ).then(
          Publishing.publish({ author: user, material: questionnaire, at }).responds({
            edition: round,
          }),
        ),
      )
      .then(
        where(compute(computations.soleTarget, { target: run }, tie)).then(
          Linking.setLinks({ source: round, targets: tie }).responds(),
        ),
      )
      .then(respond({ round })),
  { input: { required: ["session", "run", "leg"] } },
);

/**
 * Tying a round to its run is what captures the presentation: the questionnaire
 * as it stands for a round that takes nothing, and for a round that takes from
 * an earlier one, the questionnaire with the picked piles as its choices, as
 * its parts, or shown above its prompt, by the use the take names. The former
 * is evaluated as the capture is asked, so it reads the picks as they stand.
 */
export const TiedRoundCapturesPresentation = reaction(
  ({ round, run, questionnaire, leg, source, carried }) =>
    when(Linking.setLinks({ source: round }).responds())
      .where(
        Publishing._edition({ edition: round }).is({ material: questionnaire }),
        Relaying._legFor({ material: questionnaire }).is({ leg }),
      )
      .then(
        where(legTakesNothing({ leg }))
          .then(RunSnapshotting.capture({ subject: round, value: theRoundPresentation({ leg }) }))
          .named("plain"),
        where(
          Linking._getLinks({ source: round }).is({ target: run }),
          theTakeOf({ leg }).is({ source, use: "choices" }),
          theRoundOfLegInRun({ run, leg: source }).is({ round: carried }),
        )
          .then(
            RunSnapshotting.capture({
              subject: round,
              value: theRoundPresentationTaking({ leg, sourceRound: carried }),
            }),
          )
          .named("choices"),
        where(
          Linking._getLinks({ source: round }).is({ target: run }),
          theTakeOf({ leg }).is({ source, use: "parts" }),
          theRoundOfLegInRun({ run, leg: source }).is({ round: carried }),
        )
          .then(
            RunSnapshotting.capture({
              subject: round,
              value: theRoundPresentationTakingParts({ leg, sourceRound: carried }),
            }),
          )
          .named("parts"),
        where(
          Linking._getLinks({ source: round }).is({ target: run }),
          theTakeOf({ leg }).is({ source, use: "context" }),
          theRoundOfLegInRun({ run, leg: source }).is({ round: carried }),
        )
          .then(
            RunSnapshotting.capture({
              subject: round,
              value: theRoundPresentationShowing({ leg, sourceRound: carried }),
            }),
          )
          .named("context"),
      ),
);

export const OpenRoundRefused = endpoint(
  "/live/relays/open-round",
  ({ session, run, leg, user, source, sourceRound }) =>
    receive({ session, run, leg }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        runIsOpen({ run }),
        legIsOfRun({ run, leg }),
        runHasNoOpenRound({ run }),
        legHasNotRunInRun({ run, leg }),
        legSourcesHaveClosed({ run, leg }),
        theTakeOf({ leg }).is({ source }),
        theRoundOfLegInRun({ run, leg: source }).is({ round: sourceRound }),
        roundHasNoPicks({ round: sourceRound }),
      )
        .then(respond({ error: "NOTHING_PICKED" }))
        .named("nothing-picked"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        runIsOpen({ run }),
        legIsOfRun({ run, leg }),
        runHasAnOpenRound({ run }),
      )
        .then(respond({ error: "ROUND_OPEN" }))
        .named("round-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        runIsOpen({ run }),
        legIsOfRun({ run, leg }),
        runHasNoOpenRound({ run }),
        legRanInRun({ run, leg }),
      )
        .then(respond({ error: "ROUND_DONE" }))
        .named("round-done"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        runIsOpen({ run }),
        legIsOfRun({ run, leg }),
        runHasNoOpenRound({ run }),
        legHasNotRunInRun({ run, leg }),
        legHasAnOpenSource({ run, leg }),
      )
        .then(respond({ error: "SOURCE_OPEN" }))
        .named("source-open"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), runIsClosed({ run }))
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfRun({ run, leg }),
      )
        .then(respond({ error: "LEG_NOT_FOUND" }))
        .named("not-of-run"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

/** A round that closes gives the run's lock back, whichever path closed it. */
export const ClosedRoundUnlocksRun = reaction(({ round, run }) =>
  when(Publishing.close({ edition: round }).responds())
    .where(
      Linking._getLinks({ source: round }).is({ target: run }),
      runIsARelayRun({ run }),
      Locking._isLocked({ target: run }).is({ locked: true }),
    )
    .then(Locking.unlock({ target: run })),
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

/** Closing the run closes its open round first, so no phone is left answering. */
export const Close = endpoint(
  "/live/relays/close",
  ({ session, run, user, at, round, closedRound, closed }) =>
    receive({ session, run }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theOpenRoundOf({ run }).is({ round }),
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
        runHasNoOpenRound({ run }),
      )
        .then(Publishing.close({ edition: run, at }).responds({ edition: closed }))
        .then(respond({ run: closed }))
        .named("bare"),
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

/**
 * One seat per request, under a participant identity the dashboard minted for
 * it. A seat is a subscription to the run, which is what makes the participant
 * the model's: the round open now reaches it, and so does every round that
 * opens later, until it is dismissed.
 */
export const Invite = endpoint(
  "/live/relays/invite",
  ({ session, run, device, user, at }) =>
    receive({ session, run, device }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        runIsOpen({ run }),
      )
        .then(Subscribing.subscribe({ user: device, target: run, at }).responds())
        .then(respond({ participant: device }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), runIsClosed({ run }))
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "run", "device"] } },
);

/** A seat taken while a round is open answers that round at once. */
export const SeatedParticipantAnswersOpenRound = reaction(({ participant, run, round, at }) =>
  when(Subscribing.subscribe({ user: participant, target: run }).responds())
    .where(now(at), runIsARelayRun({ run }), theOpenRoundOf({ run }).is({ round }))
    .then(Responding.begin({ participant, subject: round, at })),
);

/**
 * A dismissed seat leaves the run: no later round reaches it. What it handed
 * in stays, and stays marked, because dismissing trashes the participant
 * rather than dropping its seat.
 */
export const Dismiss = endpoint(
  "/live/relays/dismiss",
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
 * A round's presentation, once captured, is what a seat answers: every seat
 * of the run begins a response to the round, exactly as a phone that was in
 * the room would, and the model's reply follows from the begin.
 */
export const CapturedRoundSeatsParticipants = reaction(({ round, run, participant, at }) =>
  when(RunSnapshotting.capture({ subject: round }).responds())
    .where(
      now(at),
      theRunOf({ round }).is({ run }),
      Subscribing._getSubscribers({ target: run }).is({ user: participant }),
      seatIsNotDismissed({ participant }),
    )
    .then(Responding.begin({ participant, subject: round, at })),
);
