import { compute, count, is, no, view, where } from "@mit-sdg/sync-engine/language";
import { computations, concepts } from "../../concepts.ts";
import { ADMINISTER, COMMONS } from "../access/capabilities.ts";

const { Drafting, Publishing, Questioning, Responding, Roling, RunSnapshotting, Scoring } =
  concepts;

/** How many questions the questionnaire holds; contiguity makes it the last position. */
export const theQuestionCount = view(
  "the question count of (questionnaire)",
  ({ questionnaire }, { total }, _bindings) =>
    where(count(Questioning._getQuestions, { questionnaire }, total)),
).one();

/** How many items the candidate carries. */
export const theItemCount = view(
  "the item count of (candidate)",
  ({ candidate }, { total }, _bindings) => where(count(Drafting._items, { candidate }, total)),
).one();

export const mayHostLive = view("(user) may host live runs", ({ user }, _outputs, _bindings) => [
  where(
    Roling._hasCapability({ user, context: COMMONS, capability: "live:host" }).is({
      allowed: true,
    }),
  ),
  where(
    Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({ allowed: true }),
  ),
]).holds();

export const mayNotHostLive = view(
  "(user) may not host live runs",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: "live:host" }).is({
        allowed: false,
      }),
      Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({
        allowed: false,
      }),
    ),
).holds();

export const runIsOpen = view("(run) is open to participation", ({ run }, _outputs, _bindings) =>
  where(Publishing._edition({ edition: run }).is({ open: true })),
).holds();

export const runIsClosed = view("(run) is closed", ({ run }, _outputs, _bindings) =>
  where(Publishing._edition({ edition: run }).is({ open: false })),
).holds();

export const questionnaireHasAnOpenRun = view(
  "(questionnaire) has an open run",
  ({ questionnaire }, _outputs, _bindings) =>
    where(Publishing._hasOpenEditionFor({ material: questionnaire }).is({ open: true })),
).holds();

export const questionnaireHasNoOpenRun = view(
  "(questionnaire) has no open run",
  ({ questionnaire }, _outputs, _bindings) =>
    where(Publishing._hasOpenEditionFor({ material: questionnaire }).is({ open: false })),
).holds();

export const questionBelongsToRun = view(
  "(question) belongs to (run)",
  ({ question, run }, _outputs, { presentation, belongs }) =>
    where(
      RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
      compute(computations.snapshotHasQuestion, { value: presentation, question }, belongs),
      is.among(belongs, [true]),
    ),
).holds();

export const questionIsNotOfRun = view(
  "(question) is not part of (run)",
  ({ question, run }, _outputs, { presentation, belongs }) =>
    where(
      RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
      compute(computations.snapshotHasQuestion, { value: presentation, question }, belongs),
      is.among(belongs, [false]),
    ),
).holds();

/** A quiz is whole when every question captured for this run has an answer. */
export const responseIsWhole = view(
  "(response) answers every question",
  ({ response }, _outputs, { run, presentation, answers, whole }) =>
    where(
      Responding._response({ response }).is({ subject: run }),
      RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
      Responding._collectedAnswers({ response }).is({ answers }),
      compute(computations.snapshotIsWhole, { value: presentation, answers }, whole),
      is.among(whole, [true]),
    ),
).holds();

export const responseIsNotWhole = view(
  "(response) leaves a question unanswered",
  ({ response }, _outputs, { run, presentation, answers, whole }) =>
    where(
      Responding._response({ response }).is({ subject: run }),
      RunSnapshotting._snapshot({ subject: run }).is({ value: presentation }),
      Responding._collectedAnswers({ response }).is({ answers }),
      compute(computations.snapshotIsWhole, { value: presentation, answers }, whole),
      is.among(whole, [false]),
    ),
).holds();

export const runIsAKeyedQuiz = view(
  "(run) measures against a key",
  ({ run }, _outputs, _bindings) => where(Scoring._keyFor({ subject: run })),
).holds();

export const runIsNotKeyed = view("(run) has no key", ({ run }, _outputs, _bindings) =>
  where(no(Scoring._keyFor({ subject: run }))),
).holds();

const { Categorizing, Linking, Pinning, Relaying, Subscribing, Trashing } = concepts;

export const relayHasAnOpenRun = view("(relay) has an open run", ({ relay }, _outputs, _bindings) =>
  where(Publishing._hasOpenEditionFor({ material: relay }).is({ open: true })),
).holds();

export const relayHasNoOpenRun = view("(relay) has no open run", ({ relay }, _outputs, _bindings) =>
  where(Publishing._hasOpenEditionFor({ material: relay }).is({ open: false })),
).holds();

export const relayIsRetired = view("(relay) is retired", ({ relay }, _outputs, _bindings) =>
  where(Trashing._isTrashed({ item: relay }).is({ trashed: true })),
).holds();

export const relayIsNotRetired = view("(relay) is not retired", ({ relay }, _outputs, _bindings) =>
  where(Trashing._isTrashed({ item: relay }).is({ trashed: false })),
).holds();

/** The run's rounds are the editions Linking ties to it; at most one is open. */
export const theOpenRoundOf = view("the open round of (run)", ({ run }, { round }, _bindings) =>
  where(
    Linking._getBacklinks({ target: run }).is({ source: round }),
    Publishing._edition({ edition: run }).is({ open: true }),
    Publishing._edition({ edition: round }).is({ open: true }),
  ),
).optional();

export const runHasAnOpenRound = view("(run) has a round open", ({ run }, _outputs, _bindings) =>
  where(theOpenRoundOf({ run })),
).holds();

export const runHasNoOpenRound = view("(run) has no round open", ({ run }, _outputs, _bindings) =>
  where(no(theOpenRoundOf({ run }))),
).holds();

export const runIsARelayRun = view("(run) is a relay run", ({ run }, _outputs, { relay }) =>
  where(Publishing._edition({ edition: run }).is({ material: relay }), Relaying._relay({ relay })),
).holds();

export const runIsAQuestionnaireRun = view(
  "(run) is a questionnaire run",
  ({ run }, _outputs, _bindings) => where(RunSnapshotting._snapshot({ subject: run })),
).holds();

export const legIsOfRun = view("(leg) is a round of (run)", ({ run, leg }, _outputs, { relay }) =>
  where(
    Publishing._edition({ edition: run }).is({ material: relay }),
    Relaying._leg({ leg }).is({ relay }),
  ),
).holds();

export const legIsNotOfRun = view(
  "(leg) is not a round of (run)",
  ({ run, leg }, _outputs, { relay }) =>
    where(
      Publishing._edition({ edition: run }).is({ material: relay }),
      Relaying._leg({ leg }).is.not({ relay }),
    ),
).holds();

/** The edition a round got when it opened in this run, if it did. */
export const theRoundOfLegInRun = view(
  "the round of (leg) in (run)",
  ({ run, leg }, { round, open }, { material }) =>
    where(
      Relaying._leg({ leg }).is({ material }),
      Linking._getBacklinks({ target: run }).is({ source: round }),
      Publishing._edition({ edition: round }).is({ material, open }),
    ),
).optional();

export const legRanInRun = view("(leg) already ran in (run)", ({ run, leg }, _outputs, _bindings) =>
  where(theRoundOfLegInRun({ run, leg })),
).holds();

export const legHasNotRunInRun = view(
  "(leg) has not run in (run)",
  ({ run, leg }, _outputs, _bindings) => where(no(theRoundOfLegInRun({ run, leg }))),
).holds();

/** A source is unclosed while it has no closed round in this run. */
export const legHasAnOpenSource = view(
  "(leg) takes from a round not yet closed in (run)",
  ({ run, leg }, _outputs, { source }) =>
    where(
      Relaying._draws({ leg }).is({ source }),
      no(theRoundOfLegInRun({ run, leg: source }).is({ open: false })),
    ),
).holds();

export const legSourcesHaveClosed = view(
  "every round (leg) takes from has closed in (run)",
  ({ run, leg }, _outputs, _bindings) => where(no(legHasAnOpenSource({ run, leg }))),
).holds();

/** What a round takes: this pass fills one source per round. */
export const theTakeOf = view("what (leg) takes", ({ leg }, { source, use }, _bindings) =>
  where(Relaying._draws({ leg }).is({ source, use })),
).optional();

export const legTakesNothing = view("(leg) takes nothing", ({ leg }, _outputs, _bindings) =>
  where(no(Relaying._draws({ leg }))),
).holds();

/** How many piles the round has picked so far, which is the next pick's place in the order. */
export const thePickCount = view("the pick count of (round)", ({ round }, { taken }, _bindings) =>
  where(count(Pinning._getPinned, { scope: round }, taken)),
).one();

export const roundHasPicks = view("(round) has piles picked", ({ round }, _outputs, _bindings) =>
  where(Pinning._getPinned({ scope: round })),
).holds();

export const roundHasNoPicks = view(
  "(round) has no piles picked",
  ({ round }, _outputs, _bindings) => where(no(Pinning._getPinned({ scope: round }))),
).holds();

export const pileIsOfRound = view(
  "(pile) is on the wall of (round)",
  ({ pile, round }, _outputs, _bindings) =>
    where(Categorizing._getCategoryDetail({ category: pile }).is({ scope: round })),
).holds();

/** The run a round belongs to: the edition Linking tied it to when the round opened. */
export const theRunOf = view("the run of (round)", ({ round }, { run }, _bindings) =>
  where(Linking._getLinks({ source: round }).is({ target: run })),
).optional();

/**
 * A participant is the model's when it holds a seat on the run: the dashboard
 * subscribed it, and the subscription outlives a dismissal so the cards it
 * wrote keep their mark.
 */
export const participantIsSeated = view(
  "(participant) holds a seat on (run)",
  ({ participant, run }, _outputs, _bindings) =>
    where(Subscribing._isSubscribed({ user: participant, target: run }).is({ subscribed: true })),
).holds();

/** A dismissed seat is a trashed participant: no later round reaches it. */
export const seatIsNotDismissed = view(
  "(participant)'s seat is not dismissed",
  ({ participant }, _outputs, _bindings) =>
    where(Trashing._isTrashed({ item: participant }).is({ trashed: false })),
).holds();

/** A round's run is the edition Linking tied it to when the round opened. */
export const roundIsOfAnOpenRun = view(
  "(round) is of an open run",
  ({ round }, _outputs, { run }) =>
    where(
      Linking._getLinks({ source: round }).is({ target: run }),
      Publishing._edition({ edition: run }).is({ open: true }),
    ),
).holds();

export const roundIsOfAClosedRun = view(
  "(round) is of a closed run",
  ({ round }, _outputs, { run }) =>
    where(
      Linking._getLinks({ source: round }).is({ target: run }),
      Publishing._edition({ edition: run }).is({ open: false }),
    ),
).holds();

export const roundIsNotOfAClosedRun = view(
  "(round) is not of a closed run",
  ({ round }, _outputs, _bindings) => where(no(roundIsOfAClosedRun({ round }))),
).holds();

/** A round is live while its own edition and the run it belongs to are both open. */
export const roundIsLive = view(
  "(round) is open on an open run",
  ({ round }, _outputs, _bindings) =>
    where(runIsOpen({ run: round }), roundIsOfAnOpenRun({ round })),
).holds();

export const roundIsNotLive = view(
  "(round) is not open on an open run",
  ({ round }, _outputs, _bindings) => where(no(roundIsLive({ round }))),
).holds();

/** A pile stands in its round's scope, so that round's run governs every write to it. */
export const pileIsOfAClosedRun = view(
  "(pile) is on the wall of a closed run",
  ({ pile }, _outputs, { round }) =>
    where(
      Categorizing._getCategoryDetail({ category: pile }).is({ scope: round }),
      roundIsOfAClosedRun({ round }),
    ),
).holds();

export const pileIsNotOfAClosedRun = view(
  "(pile) is not on the wall of a closed run",
  ({ pile }, _outputs, _bindings) => where(no(pileIsOfAClosedRun({ pile }))),
).holds();

/** A card reaches its round through the pile holding it; a card in the tray reaches none. */
export const cardIsOfAClosedRun = view(
  "(card) is in a pile of a closed run",
  ({ card }, _outputs, { category }) =>
    where(
      Categorizing._getCategory({ item: card }).is({ category }),
      pileIsOfAClosedRun({ pile: category }),
    ),
).holds();

export const cardIsNotOfAClosedRun = view(
  "(card) is in no pile of a closed run",
  ({ card }, _outputs, _bindings) => where(no(cardIsOfAClosedRun({ card }))),
).holds();
