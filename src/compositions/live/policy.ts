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

const { Piling, PickLinking, Relaying, RoundLinking } = concepts;

/** The run's rounds are the editions RoundLinking ties to it; at most one is open. */
export const theOpenRoundOf = view("the open round of (run)", ({ run }, { round }, _bindings) =>
  where(
    RoundLinking._getBacklinks({ target: run }).is({ source: round }),
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
      RoundLinking._getBacklinks({ target: run }).is({ source: round }),
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
export const theTakeOf = view("what (leg) takes", ({ leg }, { source, shape }, _bindings) =>
  where(Relaying._draws({ leg }).is({ source, shape })),
).optional();

export const legTakesNothing = view("(leg) takes nothing", ({ leg }, _outputs, _bindings) =>
  where(no(Relaying._draws({ leg }))),
).holds();

export const roundHasPicks = view("(round) has piles picked", ({ round }, _outputs, _bindings) =>
  where(PickLinking._getLinks({ source: round })),
).holds();

export const roundHasNoPicks = view(
  "(round) has no piles picked",
  ({ round }, _outputs, _bindings) => where(no(PickLinking._getLinks({ source: round }))),
).holds();

export const pileIsOfRound = view(
  "(pile) is on the wall of (round)",
  ({ pile, round }, _outputs, _bindings) =>
    where(Piling._getCategoryDetail({ category: pile }).is({ scope: round })),
).holds();
