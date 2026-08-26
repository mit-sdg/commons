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
