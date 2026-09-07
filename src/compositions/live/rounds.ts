import {
  compute,
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
  mayHostLive,
  mayNotHostLive,
  relayIsNotRetired,
  relayIsRetired,
  theRoundOfLegInRun,
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

export const SetGuide = endpoint(
  "/live/rounds/set-guide",
  ({ session, leg, field, body, user, use, said, guidance, cleared, scope }) =>
    receive({ session, leg, field, body }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
        is.among(field, ["purpose", "facilitation", "selection"]),
        compute(computations.guideUse, { field }, use),
        compute(computations.briefStanding, { request: body }, said),
        is.among(said, ["given"]),
      )
        .then(Guiding.set({ subject: leg, use, title: "", body }).responds({ guidance }))
        .then(respond({ guidance }))
        .named("set"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
        is.among(field, ["purpose", "facilitation", "selection"]),
        compute(computations.guideUse, { field }, use),
        compute(computations.briefStanding, { request: body }, said),
        is.among(said, ["blank"]),
      )
        .then(Guiding.clear({ subject: leg, use }).responds({ cleared }))
        .then(respond({ cleared }))
        .named("clear"),
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
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
        compute(computations.guideScope, { field }, scope),
        is.among(scope, ["relay", ""]),
      )
        .then(respond({ error: "INVALID_FIELD" }))
        .named("field"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "leg", "field", "body"] } },
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

const theSamplingResolution = view(
  "the preview inputs of (leg) with (picks)",
  (
    { leg, picks },
    { resolution },
    { relay, legs, questionnaires, materials, subjects, piles, notes, replies },
  ) =>
    where(
      Relaying._leg({ leg }).is({ relay }),
      Relaying._plan({ relay }).is({ legs }),
      compute(computations.legMaterials, { legs }, questionnaires),
      compute(computations.legIdentities, { legs }, subjects),
      Questioning._materials({ questionnaires }).is({ materials }),
      Categorizing._categoriesInScopes({ scopes: subjects }).is({ categories: piles }),
      Guiding._guidanceTexts({ subjects, use: SORTING_USE }).is({ texts: notes }),
      Reasoning._lastRepliesAbout({ subjects }).is({ replies }),
      compute(
        computations.samplingResolution,
        { leg, legs, materials, piles, notes, replies, picks },
        resolution,
      ),
    ),
).optional();

const theSamplingRequest = view(
  "the sampling request for (leg) with (picks)",
  ({ leg, picks }, { passage, account }, { resolution }) =>
    where(
      theSamplingResolution({ leg, picks }).is({ resolution }),
      compute(computations.samplingResolvedPassage, { resolution }, passage),
      compute(computations.samplingResolvedAccount, { resolution }, account),
    ),
).optional();

const anAskStandsAboutLeg = view("a sample of (leg) is still being asked", ({ leg }, _o, _b) =>
  where(Reasoning._pending({}).is({ about: leg })),
).holds();

const noAskStandsAboutLeg = view("no sample of (leg) is being asked", ({ leg }, _o, _b) =>
  where(no(Reasoning._pending({}).is({ about: leg }))),
).holds();

export const theSampleOf = former(
  "the sample of (leg) with (picks)",
  ({ leg, picks }, { asking, reply, answeredAt, standing, answers, resolution }) =>
    where(
      Reasoning._lastReplyAbout({ about: leg }).is({ asking, reply, answeredAt }),
      theSamplingResolution({ leg, picks }).is({ resolution }),
      compute(computations.samplingResolvedStanding, { resolution }, standing),
      compute(computations.sampledAnswers, { reply }, answers),
    ).form({ asking, answeredAt, standing, answers }),
).optional();

export const SampleAnswers = endpoint(
  "/live/rounds/sample-answers",
  ({ session, leg, picks, user, at, passage, asking }) =>
    receive({ session, leg, picks }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
        noAskStandsAboutLeg({ leg }),
        theSamplingRequest({ leg, picks }).is({ passage, account: "" }),
      )
        .then(Reasoning.ask({ reasoner: REASONER, about: leg, passage, at }).responds({ asking }))
        .then(respond({ asked: true, asking }))
        .named("ready"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
        noAskStandsAboutLeg({ leg }),
        theSamplingRequest({ leg, picks }).is({ account: "SOURCE_UNSAMPLED" }),
      )
        .then(respond({ error: "SOURCE_UNSAMPLED" }))
        .named("source-unsampled"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
        noAskStandsAboutLeg({ leg }),
        theSamplingRequest({ leg, picks }).is({ account: "SOURCE_STALE" }),
      )
        .then(respond({ error: "SOURCE_STALE" }))
        .named("source-stale"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        legIsNotOfARetiredRelay({ leg }),
        noAskStandsAboutLeg({ leg }),
        theSamplingRequest({ leg, picks }).is({ account: "NOTHING_PICKED" }),
      )
        .then(respond({ error: "NOTHING_PICKED" }))
        .named("nothing-picked"),
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
  { input: { required: ["session", "leg"], defaults: { picks: {} } } },
);

export const ReadSample = endpoint(
  "/live/rounds/sample",
  ({ session, leg, picks, user, at, failure, failedAt, resolution, preview }) =>
    receive({ session, leg, picks }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }),
        anAskStandsAboutLeg({ leg }),
        whether(Reasoning._lastFailureAbout({ about: leg }).is({ account: failure, failedAt })),
        theSamplingResolution({ leg, picks }).is({ resolution }),
        compute(computations.samplingResolvedPreview, { resolution }, preview),
      )
        .then(
          respond({
            sample: theSampleOf({ leg, picks }),
            pending: true,
            failure,
            failedAt,
            preview,
          }),
        )
        .named("pending"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._leg({ leg }),
        noAskStandsAboutLeg({ leg }),
        whether(Reasoning._lastFailureAbout({ about: leg }).is({ account: failure, failedAt })),
        theSamplingResolution({ leg, picks }).is({ resolution }),
        compute(computations.samplingResolvedPreview, { resolution }, preview),
      )
        .then(
          respond({
            sample: theSampleOf({ leg, picks }),
            pending: false,
            failure,
            failedAt,
            preview,
          }),
        )
        .named("settled"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), no(Relaying._leg({ leg })))
        .then(respond({ error: "LEG_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "leg"], defaults: { picks: {} } } },
);
