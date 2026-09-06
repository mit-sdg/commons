import {
  compute,
  former,
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
  legTakesNothing,
  mayHostLive,
  mayNotHostLive,
  relayIsNotRetired,
  relayIsRetired,
  theRoundOfLegInRun,
  theTakeOf,
} from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";

const {
  Categorizing,
  Guiding,
  Pinning,
  Publishing,
  Questioning,
  Reasoning,
  Relaying,
  RunSnapshotting,
} = concepts;

/** The Guiding use under which a round's note to whoever sorts its wall stands. */
export const SORTING_USE = "sorting";

/** A reserved category remains on its run wall even when empty or renamed. */
export const RESERVED_PILES = "live-reserved-piles";

/** The one reasoner name this page asks for; the floor decides what answers it. */
const REASONER = "gemini-flash";

/**
 * A round that has opened in a run still open is frozen with the run, whether
 * or not the round itself has closed: the wall has its own piles by then.
 */
const legHasAnOpenRun = view(
  "(leg) has opened in an open run",
  ({ leg }, _outputs, { relay, run }) =>
    where(
      Relaying._leg({ leg }).is({ relay }),
      Publishing._editionsFor({ material: relay }).is({ edition: run, open: true }),
      theRoundOfLegInRun({ run, leg }),
    ),
).holds();

const legHasNoOpenRun = view(
  "(leg) has not opened in an open run",
  ({ leg }, _outputs, _bindings) => where(Relaying._leg({ leg }), no(legHasAnOpenRun({ leg }))),
).holds();

const legIsOfARetiredRelay = view(
  "(leg) is a round of a retired relay",
  ({ leg }, _outputs, { relay }) =>
    where(Relaying._leg({ leg }).is({ relay }), relayIsRetired({ relay })),
).holds();

const legIsNotOfARetiredRelay = view(
  "(leg) is a round of a relay still in use",
  ({ leg }, _outputs, { relay }) =>
    where(Relaying._leg({ leg }).is({ relay }), relayIsNotRetired({ relay })),
).holds();

/** A standing pile stands in its round's own scope, before any wall exists for it. */
const theLegOf = view("the round (pile) stands on", ({ pile }, { leg }, _bindings) =>
  where(
    Categorizing._getCategoryDetail({ category: pile }).is({ scope: leg }),
    Relaying._leg({ leg }),
  ),
).optional();

/**
 * The wall opens with the round's standing piles already on it: when the
 * round's presentation is captured, each pile authored on the leg is ensured
 * on the round's wall with its name and its sentence, which is its lid at
 * birth. A round whose word is `vote` sorts itself by its choices, so its
 * standing piles stay on the leg and none is seeded.
 */
export const CapturedRoundSeedsStandingPiles = reaction(
  ({ round, questionnaire, leg, name, description, category, at }) =>
    when(RunSnapshotting.capture({ subject: round }).responds())
      .where(
        Publishing._edition({ edition: round }).is({ material: questionnaire }),
        Relaying._legFor({ material: questionnaire }).is({ leg }),
        Relaying._leg({ leg }).is.not({ kind: "vote" }),
        now(at),
        Categorizing._categoriesIn({ scope: leg }).is({ name, description }),
      )
      .then(Categorizing.ensureCategory({ scope: round, name, description }).responds({ category }))
      .then(Pinning.pin({ item: category, scope: RESERVED_PILES, priority: 0, at })),
);

export const AddPile = endpoint(
  "/live/rounds/add-pile",
  ({ session, leg, name, description, user, at, category }) =>
    receive({ session, leg, name, description }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
        legHasNoOpenRun({ leg }),
      )
        .then(Categorizing.createCategory({ scope: leg, name, description }).responds({ category }))
        .then(respond({ pile: category }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
        legHasAnOpenRun({ leg }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsOfARetiredRelay({ leg }),
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
  { input: { required: ["session", "leg", "name", "description"] } },
);

export const RenamePile = endpoint(
  "/live/rounds/rename-pile",
  ({ session, pile, name, user, at, leg, renamed }) =>
    receive({ session, pile, name }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theLegOf({ pile }).is({ leg }),
        legIsNotOfARetiredRelay({ leg }),
        legHasNoOpenRun({ leg }),
      )
        .then(Categorizing.renameCategory({ category: pile, name }).responds({ category: renamed }))
        .then(respond({ pile: renamed }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theLegOf({ pile }).is({ leg }),
        legIsNotOfARetiredRelay({ leg }),
        legHasAnOpenRun({ leg }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theLegOf({ pile }).is({ leg }),
        legIsOfARetiredRelay({ leg }),
      )
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), no(theLegOf({ pile })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "pile", "name"] } },
);

export const DescribePile = endpoint(
  "/live/rounds/describe-pile",
  ({ session, pile, description, user, at, leg, described }) =>
    receive({ session, pile, description }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theLegOf({ pile }).is({ leg }),
        legIsNotOfARetiredRelay({ leg }),
        legHasNoOpenRun({ leg }),
      )
        .then(
          Categorizing.describeCategory({ category: pile, description }).responds({
            category: described,
          }),
        )
        .then(respond({ pile: described }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theLegOf({ pile }).is({ leg }),
        legIsNotOfARetiredRelay({ leg }),
        legHasAnOpenRun({ leg }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theLegOf({ pile }).is({ leg }),
        legIsOfARetiredRelay({ leg }),
      )
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), no(theLegOf({ pile })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "pile", "description"] } },
);

export const RemovePile = endpoint(
  "/live/rounds/remove-pile",
  ({ session, pile, user, at, leg, removed }) =>
    receive({ session, pile }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theLegOf({ pile }).is({ leg }),
        legIsNotOfARetiredRelay({ leg }),
        legHasNoOpenRun({ leg }),
      )
        .then(Categorizing.deleteCategory({ category: pile }).responds({ category: removed }))
        .then(respond({ pile: removed }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theLegOf({ pile }).is({ leg }),
        legIsNotOfARetiredRelay({ leg }),
        legHasAnOpenRun({ leg }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theLegOf({ pile }).is({ leg }),
        legIsOfARetiredRelay({ leg }),
      )
        .then(respond({ error: "RELAY_RETIRED" }))
        .named("retired"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), no(theLegOf({ pile })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "pile"] } },
);

/**
 * The round's note to the sorter is one entry of guidance on its leg, set
 * whole each time so two dashboards writing at once leave one. It is never
 * frozen with the question: a note written on the dashboard reaches the next ask.
 */
export const SetNotes = endpoint(
  "/live/rounds/set-notes",
  ({ session, leg, body, user, at, guidance }) =>
    receive({ session, leg, body }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
      )
        .then(
          Guiding.set({ subject: leg, use: SORTING_USE, title: "", body }).responds({ guidance }),
        )
        .then(respond({ guidance }))
        .named("set"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsOfARetiredRelay({ leg }),
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
  { input: { required: ["session", "leg", "body"] } },
);

export const ClearNotes = endpoint(
  "/live/rounds/clear-notes",
  ({ session, leg, user, cleared }) =>
    receive({ session, leg }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
      )
        .then(Guiding.clear({ subject: leg, use: SORTING_USE }).responds({ cleared }))
        .then(respond({ cleared }))
        .named("cleared"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsOfARetiredRelay({ leg }),
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
  { input: { required: ["session", "leg"] } },
);

/**
 * The passage a sample of the round is asked with: its question as the phone
 * would put it, which its kind selects, its standing piles, its note to the sorter, and, when it takes
 * from an earlier round, the names and written examples of its sampled piles where the
 * placeholders stand — so a round is sampled after its source. The same
 * passage is formed on the ask and on every read, so a sample is fresh exactly
 * while nothing it was asked about has moved.
 */
const theSamplingPassage = view(
  "the sampling passage of (leg)",
  (
    { leg },
    { passage },
    {
      questionnaire,
      kind,
      prompt,
      choices,
      offered,
      parts,
      boxes,
      cap,
      boxCap,
      piles,
      notes,
      source,
      sourceKind,
      sourceMaterial,
      sourceChoices,
      sourceUse,
      use,
      reply,
      carried,
    },
  ) => [
    where(
      Relaying._leg({ leg }).is({ material: questionnaire, kind }),
      Questioning._getQuestions({ questionnaire }).is({ prompt, choices, parts, cap }),
      compute(computations.kindChoices, { kind, choices }, offered),
      compute(computations.kindParts, { kind, parts }, boxes),
      compute(computations.kindCap, { kind, cap }, boxCap),
      Categorizing._categoriesWithItems({ scope: leg }).is({ categories: piles }),
      Guiding._guidanceText({ subject: leg, use: SORTING_USE }).is({ text: notes }),
      legTakesNothing({ leg }),
      compute(
        computations.samplingPassage,
        { prompt, choices: offered, parts: boxes, cap: boxCap, piles, notes },
        passage,
      ),
    ),
    where(
      Relaying._leg({ leg }).is({ material: questionnaire, kind }),
      Questioning._getQuestions({ questionnaire }).is({ prompt, choices, parts, cap }),
      compute(computations.kindChoices, { kind, choices }, offered),
      compute(computations.kindParts, { kind, parts }, boxes),
      compute(computations.kindCap, { kind, cap }, boxCap),
      Categorizing._categoriesWithItems({ scope: leg }).is({ categories: piles }),
      Guiding._guidanceText({ subject: leg, use: SORTING_USE }).is({ text: notes }),
      theTakeOf({ leg }).is({ source, use }),
      Reasoning._lastReplyAbout({ about: source }).is({ reply }),
      Relaying._leg({ leg: source }).is({ kind: sourceKind, material: sourceMaterial }),
      Questioning._getQuestions({ questionnaire: sourceMaterial }).is({ choices: sourceChoices }),
      whether(theTakeOf({ leg: source }).is({ use: sourceUse })),
      compute(
        computations.sampledGroups,
        { reply, kind: sourceKind, choices: sourceChoices, use: sourceUse },
        carried,
      ),
      compute(
        computations.samplingPassageTaking,
        { prompt, choices: offered, parts: boxes, cap: boxCap, piles, notes, use, carried },
        passage,
      ),
    ),
    where(
      Relaying._leg({ leg }).is({ material: questionnaire, kind }),
      Questioning._getQuestions({ questionnaire }).is({ prompt, choices, parts, cap }),
      compute(computations.kindChoices, { kind, choices }, offered),
      compute(computations.kindParts, { kind, parts }, boxes),
      compute(computations.kindCap, { kind, cap }, boxCap),
      Categorizing._categoriesWithItems({ scope: leg }).is({ categories: piles }),
      Guiding._guidanceText({ subject: leg, use: SORTING_USE }).is({ text: notes }),
      theTakeOf({ leg }).is({ source, use }),
      no(Reasoning._lastReplyAbout({ about: source })),
      compute(computations.unsampledNames, { use }, carried),
      compute(
        computations.samplingPassageTaking,
        { prompt, choices: offered, parts: boxes, cap: boxCap, piles, notes, use, carried },
        passage,
      ),
    ),
  ],
).optional();

const anAskStandsAboutLeg = view("a sample of (leg) is still being asked", ({ leg }, _o, _b) =>
  where(Reasoning._pending({}).is({ about: leg })),
).holds();

const noAskStandsAboutLeg = view("no sample of (leg) is being asked", ({ leg }, _o, _b) =>
  where(no(Reasoning._pending({}).is({ about: leg }))),
).holds();

/**
 * The round's newest sample, read straight from Reasoning's record: what the
 * model wrote and where each answer went, and whether the passage it was asked
 * with is still the one the round would make now. Nothing is adopted and no
 * state of its own is kept; asking again is what replaces it.
 */
export const theSampleOf = former(
  "the sample of (leg)",
  ({ leg }, { asking, asked, reply, answeredAt, passage, standing, answers }) =>
    where(
      Relaying._leg({ leg }),
      Reasoning._lastReplyAbout({ about: leg }).is({ asking, passage: asked, reply, answeredAt }),
      theSamplingPassage({ leg }).is({ passage }),
      compute(computations.sampleStanding, { asked, passage }, standing),
      compute(computations.sampledAnswers, { reply }, answers),
    ).form({ asking, answeredAt, standing, answers }),
).optional();

/**
 * One deliberate ask about the previewed round. A round that takes from an
 * earlier one is sampled after its source: with no sample of the source to
 * name the carried piles, the ask is refused rather than made with
 * placeholders. While an ask is out, a second press asks nothing.
 */
export const SampleAnswers = endpoint(
  "/live/rounds/sample-answers",
  ({ session, leg, user, at, source, passage, asking }) =>
    receive({ session, leg }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
        noAskStandsAboutLeg({ leg }),
        legTakesNothing({ leg }),
        theSamplingPassage({ leg }).is({ passage }),
      )
        .then(Reasoning.ask({ reasoner: REASONER, about: leg, passage, at }).responds({ asking }))
        .then(respond({ asked: true, asking }))
        .named("plain"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
        noAskStandsAboutLeg({ leg }),
        theTakeOf({ leg }).is({ source }),
        Reasoning._lastReplyAbout({ about: source }),
        theSamplingPassage({ leg }).is({ passage }),
      )
        .then(Reasoning.ask({ reasoner: REASONER, about: leg, passage, at }).responds({ asking }))
        .then(respond({ asked: true, asking }))
        .named("after-source"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
        noAskStandsAboutLeg({ leg }),
        theTakeOf({ leg }).is({ source }),
        no(Reasoning._lastReplyAbout({ about: source })),
      )
        .then(respond({ error: "SOURCE_UNSAMPLED" }))
        .named("source-unsampled"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
        anAskStandsAboutLeg({ leg }),
      )
        .then(respond({ asked: false }))
        .named("asking"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsOfARetiredRelay({ leg }),
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
  { input: { required: ["session", "leg"] } },
);

/** The round's sample as it stands, whether an ask is still out, and the newest failure about it. */
export const ReadSample = endpoint(
  "/live/rounds/sample",
  ({ session, leg, user, at, failure, failedAt }) =>
    receive({ session, leg }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }),
        anAskStandsAboutLeg({ leg }),
        whether(Reasoning._lastFailureAbout({ about: leg }).is({ account: failure, failedAt })),
      )
        .then(respond({ sample: theSampleOf({ leg }), pending: true, failure, failedAt }))
        .named("pending"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }),
        noAskStandsAboutLeg({ leg }),
        whether(Reasoning._lastFailureAbout({ about: leg }).is({ account: failure, failedAt })),
      )
        .then(respond({ sample: theSampleOf({ leg }), pending: false, failure, failedAt }))
        .named("settled"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), no(Relaying._leg({ leg })))
        .then(respond({ error: "LEG_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "leg"] } },
);
