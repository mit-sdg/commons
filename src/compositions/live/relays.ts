import {
  compute,
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
  legHasAnOpenSource,
  legHasNotRunInRun,
  legIsNotOfRun,
  legIsOfRun,
  legRanInRun,
  legSourcesHaveClosed,
  legTakesNothing,
  mayHostLive,
  mayNotHostLive,
  questionnaireHasAnOpenRun,
  questionnaireHasNoOpenRun,
  roundHasNoPicks,
  roundHasPicks,
  runHasAnOpenRound,
  runHasNoOpenRound,
  runIsClosed,
  runIsOpen,
  theOpenRoundOf,
  theRoundOfLegInRun,
  theTakeOf,
} from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";

const {
  Locating,
  PickLinking,
  Piling,
  Publishing,
  Questioning,
  Relaying,
  Responding,
  RoundLinking,
  RunSnapshotting,
  Sharing,
} = concepts;

/** Whether a round's edition is open, and how many responses it drew. */
export const theRoundFigure = former(
  "the figure of (round)",
  ({ round }, { open, openedAt, closedAt, begun, handedIn }) =>
    where(Publishing._edition({ edition: round }).is({ open, openedAt, closedAt })).form({
      round,
      open,
      openedAt,
      closedAt,
      begun: each(Responding._responsesFor({ subject: round }).is({ response: begun })).count(),
      handedIn: each(
        Responding._responsesFor({ subject: round }).is({ response: handedIn, submitted: true }),
      ).count(),
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
    },
  ) =>
    each(Relaying._relays({}).is({ relay, title, createdAt }))
      .where(
        whether(Publishing._editionsFor({ material: relay }).is({ edition: run, open: true })),
        whether(Locating._for({ subject: run }).is({ code })),
        whether(theOpenRoundOf({ run }).is({ round: openRound })),
      )
      .form({
        relay,
        title,
        createdAt,
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
      shape,
      run,
      open,
      openedAt,
      closedAt,
      token,
      code,
    },
  ) =>
    where(Relaying._relay({ relay }).is({ title, createdAt })).form({
      relay,
      title,
      createdAt,
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
          takes: each(Relaying._draws({ leg }).is({ source, shape }))
            .where(Relaying._leg({ leg: source }).is({ position: sourceNumber }))
            .form({ source, sourceNumber, shape }),
        }),
      runs: each(
        Publishing._editionsFor({ material: relay }).is({ edition: run, open, openedAt, closedAt }),
      )
        .where(
          whether(Sharing._sharesFor({ subject: run }).is({ token })),
          whether(Locating._for({ subject: run }).is({ code })),
        )
        .form({ run, open, openedAt, closedAt, token, code }),
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
    },
  ) =>
    where(
      Publishing._edition({ edition: run }).is({ material: relay, open, openedAt, closedAt }),
      Relaying._relay({ relay }).is({ title }),
      whether(Locating._for({ subject: run }).is({ code })),
      whether(theOpenRoundOf({ run }).is({ round: openRound })),
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
          parts,
          cap,
          position,
        }),
      ).form({
        item: question,
        prompt,
        choices: each(PickLinking._getLinks({ source: sourceRound }).is({ target: pile }))
          .where(Piling._getCategoryDetail({ category: pile }).is({ name }))
          .distinct(name),
        expected,
        explanation,
        parts,
        cap,
        position,
      }),
    }),
).optional();

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
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(Relaying.retitle({ relay, title }).responds({ relay: retitled }))
        .then(respond({ relay: retitled }))
        .named("success"),
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
          Relaying._leg({ leg }).is({ material: questionnaire }),
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
  ({ session, leg, user, questionnaire }) =>
    receive({ session, leg }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ material: questionnaire }),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
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
  ({ session, leg, user, at, questionnaire, removed, material }) =>
    receive({ session, leg }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }).is({ material: questionnaire }),
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
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "leg"] } },
);

export const MoveRound = endpoint(
  "/live/relays/move-round",
  ({ session, leg, position, user, at, moved, placed }) =>
    receive({ session, leg, position }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(Relaying.moveLeg({ leg, position }).responds({ leg: moved, position: placed }))
        .then(respond({ leg: moved, position: placed }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "leg", "position"] } },
);

export const SetTakes = endpoint(
  "/live/relays/set-takes",
  ({ session, leg, source, shape, user, at, draw }) =>
    receive({ session, leg, source, shape }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(Relaying.draw({ leg, source, shape }).responds({ draw }))
        .then(respond({ draw }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "leg", "source", "shape"] } },
);

export const ClearTakes = endpoint(
  "/live/relays/clear-takes",
  ({ session, leg, source, user, at, cleared }) =>
    receive({ session, leg, source }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(Relaying.undraw({ leg, source }).responds({ leg: cleared }))
        .then(respond({ leg: cleared }))
        .named("success"),
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
      )
        .then(Publishing.publish({ author: user, material: relay, at }).responds({ edition: run }))
        .then(Sharing.issue({ subject: run }).responds({ token }))
        .then(Locating.ensure({ subject: run }).responds({ code }))
        .then(respond({ run, token, code }))
        .named("success"),
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
 * as the material. A round taking every pile or the top few first records the
 * carried piles on the source round, so every shape reads the same record;
 * then the round is published and tied to its run. The tie is what captures
 * the presentation, below. Every later stage reads the leg and the run afresh;
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
          Relaying._leg({ leg }).is({ material: questionnaire }),
        )
          .then(
            Publishing.publish({ author: user, material: questionnaire, at }).responds({
              edition: round,
            }),
          )
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
          theTakeOf({ leg }).is({ source, shape: "picked" }),
          theRoundOfLegInRun({ run, leg: source }).is({ round: sourceRound }),
          roundHasPicks({ round: sourceRound }),
          Relaying._leg({ leg }).is({ material: questionnaire }),
        )
          .then(
            Publishing.publish({ author: user, material: questionnaire, at }).responds({
              edition: round,
            }),
          )
          .named("picked"),
      )
      .then(
        where(compute(computations.soleTarget, { target: run }, tie)).then(
          RoundLinking.setLinks({ source: round, targets: tie }).responds(),
        ),
      )
      .then(respond({ round })),
  { input: { required: ["session", "run", "leg"] } },
);

/** The same path for a round taking every pile or the top few: the carried piles are recorded first. */
export const OpenRoundCarrying = endpoint(
  "/live/relays/open-round",
  ({
    session,
    run,
    leg,
    user,
    at,
    questionnaire,
    round,
    targets,
    tie,
    source,
    taken,
    carried,
    categories,
  }) =>
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
          theTakeOf({ leg }).is({ source, shape: "every" }),
          theRoundOfLegInRun({ run, leg: source }).is({ open: false }),
          Relaying._leg({ leg }).is({ material: questionnaire }),
        )
          .then(
            Publishing.publish({ author: user, material: questionnaire, at }).responds({
              edition: round,
            }),
          )
          .named("every"),
        where(
          now(at),
          activeUser({ session }).is({ user }),
          mayHostLive({ user }),
          runIsOpen({ run }),
          legIsOfRun({ run, leg }),
          runHasNoOpenRound({ run }),
          legHasNotRunInRun({ run, leg }),
          legSourcesHaveClosed({ run, leg }),
          theTakeOf({ leg }).is({ source, shape: "top" }),
          theRoundOfLegInRun({ run, leg: source }).is({ open: false }),
          Relaying._leg({ leg }).is({ material: questionnaire }),
        )
          .then(
            Publishing.publish({ author: user, material: questionnaire, at }).responds({
              edition: round,
            }),
          )
          .named("top"),
      )
      .then(
        where(
          theTakeOf({ leg }).is({ source: taken, shape: "every" }),
          theRoundOfLegInRun({ run, leg: taken }).is({ round: carried }),
          Piling._categoriesWithItems({ scope: carried }).is({ categories }),
          compute(computations.everyPile, { categories }, targets),
        )
          .then(PickLinking.setLinks({ source: carried, targets }).responds())
          .named("every-pick"),
        where(
          theTakeOf({ leg }).is({ source: taken, shape: "top" }),
          theRoundOfLegInRun({ run, leg: taken }).is({ round: carried }),
          Piling._categoriesWithItems({ scope: carried }).is({ categories }),
          compute(computations.topPiles, { categories }, targets),
        )
          .then(PickLinking.setLinks({ source: carried, targets }).responds())
          .named("top-pick"),
      )
      .then(
        where(compute(computations.soleTarget, { target: run }, tie)).then(
          RoundLinking.setLinks({ source: round, targets: tie }).responds(),
        ),
      )
      .then(respond({ round })),
);

/**
 * Tying a round to its run is what captures the presentation: the questionnaire
 * as it stands for a round that takes nothing, or with the carried piles' names
 * as its choices for a round that takes from an earlier one. The former is
 * evaluated as the capture is asked, after the carried piles were recorded.
 */
export const TiedRoundCapturesPresentation = reaction(
  ({ round, run, questionnaire, leg, source, carried }) =>
    when(RoundLinking.setLinks({ source: round }).responds())
      .where(
        Publishing._edition({ edition: round }).is({ material: questionnaire }),
        Relaying._legFor({ material: questionnaire }).is({ leg }),
      )
      .then(
        where(legTakesNothing({ leg }))
          .then(RunSnapshotting.capture({ subject: round, value: theRoundPresentation({ leg }) }))
          .named("plain"),
        where(
          RoundLinking._getLinks({ source: round }).is({ target: run }),
          theTakeOf({ leg }).is({ source }),
          theRoundOfLegInRun({ run, leg: source }).is({ round: carried }),
        )
          .then(
            RunSnapshotting.capture({
              subject: round,
              value: theRoundPresentationTaking({ leg, sourceRound: carried }),
            }),
          )
          .named("taking"),
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
        theTakeOf({ leg }).is({ source, shape: "picked" }),
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

/** One model participant per request, under an identity the dashboard minted and marked. */
export const Invite = endpoint(
  "/live/relays/invite",
  ({ session, run, device, user, at, round, participant, response }) =>
    receive({ session, run, device }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theOpenRoundOf({ run }).is({ round }),
        compute(computations.modelParticipant, { device }, participant),
      )
        .then(Responding.begin({ participant, subject: round, at }).responds({ response }))
        .then(respond({ response, participant }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), runHasNoOpenRound({ run }))
        .then(respond({ error: "NO_OPEN_ROUND" }))
        .named("no-open-round"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "run", "device"] } },
);
