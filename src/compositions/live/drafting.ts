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
  mayHostLive,
  mayNotHostLive,
  questionnaireHasAnOpenRun,
  questionnaireHasNoOpenRun,
  theItemCount,
  theQuestionCount,
} from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";

const { AdoptLinking, Drafting, DraftTrashing, Insisting, Questioning, Reasoning } = concepts;

/** The one reasoner name this composition asks for; the floor decides what answers it. */
const REASONER = "gemini-flash";

/** How many times an unusable reply is stood upon before the brief stalls. */
const PATIENCE = 3;

/**
 * Abandonment belongs to a drafting line, not to one of its steps. Drafting
 * already knows how a correction reaches its root; the separate Trashing
 * instance records only that root's lifecycle.
 */
const theDraftRoot = view(
  "the root of drafting line (brief)",
  ({ brief }, { root, rootAuthor, abandoned }, _bindings) =>
    where(
      Drafting._rootOf({ brief }).is({ root }),
      Drafting._brief({ brief: root }).is({ author: rootAuthor }),
      DraftTrashing._isTrashed({ item: root }).is({ trashed: abandoned }),
    ),
).one();

/** A described brief goes straight before the reasoner. */
export const DescribedBriefAsksReasoner = reaction(({ brief, request, passage, at }) =>
  when(Drafting.describe({ request }).responds({ brief }))
    .where(
      now(at),
      theDraftRoot({ brief }).is({ abandoned: false }),
      compute(computations.draftingPassage, { request }, passage),
    )
    .then(Reasoning.ask({ reasoner: REASONER, about: brief, passage, at })),
);

/** A correction carries the prior material and asks again. */
export const CorrectedBriefAsksReasoner = reaction(
  ({ brief, candidate, request, form, material, passage, at }) =>
    when(Drafting.correct({ candidate, request }).responds({ brief }))
      .where(
        now(at),
        theDraftRoot({ brief }).is({ abandoned: false }),
        Drafting._material({ candidate }).is({ form, material }),
        compute(computations.revisionPassage, { request, form, material }, passage),
      )
      .then(Reasoning.ask({ reasoner: REASONER, about: brief, passage, at })),
);

/** An answered clarification resumes drafting from the whole exchange. */
export const ClarifiedBriefAsksReasoner = reaction(
  ({ clarification, brief, question, answer, request, passage, at }) =>
    when(Drafting.clarify({ clarification, answer }).responds({ brief }))
      .where(
        now(at),
        theDraftRoot({ brief }).is({ abandoned: false }),
        Drafting._clarifications({ brief }).is({ clarification, question }),
        Drafting._brief({ brief }).is({ request }),
        compute(computations.clarifiedPassage, { request, question, answer }, passage),
      )
      .then(Reasoning.ask({ reasoner: REASONER, about: brief, passage, at })),
);

/**
 * A reply meets its reading: a draft is proposed, a question is asked, and
 * anything else is stood upon. The readings partition every reply, so exactly
 * one of these fires per answered ask — and a clarifying question may only
 * answer a brief that begins a line, because a correction's form was settled
 * when the line began, so a question there is unusable and is stood upon.
 */
export const ReplyDraftProposes = reaction(({ asking, reply, brief, kind, form, material }) =>
  when(Reasoning.answer({ asking, reply }).responds())
    .where(
      Reasoning._asking({ asking }).is({ about: brief }),
      Drafting._brief({ brief }),
      theDraftRoot({ brief }).is({ abandoned: false }),
      compute(computations.parseKind, { reply }, kind),
      is.among(kind, ["draft"]),
      compute(computations.parsedForm, { reply }, form),
      compute(computations.parsedMaterial, { reply }, material),
    )
    .then(Drafting.propose({ brief, form, material })),
);

export const ReplyQuestionAsks = reaction(({ asking, reply, brief, kind, question }) =>
  when(Reasoning.answer({ asking, reply }).responds())
    .where(
      Reasoning._asking({ asking }).is({ about: brief }),
      Drafting._brief({ brief }),
      theDraftRoot({ brief }).is({ abandoned: false }),
      compute(computations.parseKind, { reply }, kind),
      is.among(kind, ["question"]),
      no(Drafting._basisOf({ brief })),
      compute(computations.parsedQuestion, { reply }, question),
    )
    .then(Drafting.ask({ brief, question })),
);

export const CorrectionQuestionComplains = reaction(({ asking, reply, brief, kind }) =>
  when(Reasoning.answer({ asking, reply }).responds())
    .where(
      Reasoning._asking({ asking }).is({ about: brief }),
      Drafting._brief({ brief }),
      theDraftRoot({ brief }).is({ abandoned: false }),
      compute(computations.parseKind, { reply }, kind),
      is.among(kind, ["question"]),
      Drafting._basisOf({ brief }),
    )
    .then(
      Insisting.complain({
        aim: brief,
        patience: PATIENCE,
        offering: reply,
        account:
          "A correction takes no clarifying question — the form was already settled. Deliver the whole revised draft.",
      }),
    ),
);

export const ReplyNeitherComplains = reaction(({ asking, reply, brief, kind, reason }) =>
  when(Reasoning.answer({ asking, reply }).responds())
    .where(
      Reasoning._asking({ asking }).is({ about: brief }),
      Drafting._brief({ brief }),
      theDraftRoot({ brief }).is({ abandoned: false }),
      compute(computations.parseKind, { reply }, kind),
      is.among(kind, ["neither"]),
      compute(computations.parsedReason, { reply }, reason),
    )
    .then(Insisting.complain({ aim: brief, patience: PATIENCE, offering: reply, account: reason })),
);

/** A usable reply settles whatever was being insisted on for the brief. */
export const ProposedDraftSatisfiesInsistence = reaction(({ brief }) =>
  when(Drafting.propose({ brief }).responds())
    .where(
      theDraftRoot({ brief }).is({ abandoned: false }),
      Insisting._unsettledFor({ aim: brief }),
    )
    .then(Insisting.satisfy({ aim: brief })),
);

export const AskedQuestionSatisfiesInsistence = reaction(({ brief }) =>
  when(Drafting.ask({ brief }).responds())
    .where(
      theDraftRoot({ brief }).is({ abandoned: false }),
      Insisting._unsettledFor({ aim: brief }),
    )
    .then(Insisting.satisfy({ aim: brief })),
);

/** While patience remains, a complaint carries the exchange back to the reasoner. */
export const ComplaintRetriesTheAsk = reaction(
  ({ brief, offering, account, request, passage, at }) =>
    when(Insisting.complain({ aim: brief, offering, account }).responds())
      .where(
        now(at),
        Drafting._brief({ brief }),
        theDraftRoot({ brief }).is({ abandoned: false }),
        Insisting._standingFor({ aim: brief }),
        Drafting._brief({ brief }).is({ request }),
        compute(computations.repairPassage, { request, offering, account }, passage),
      )
      .then(Reasoning.ask({ reasoner: REASONER, about: brief, passage, at })),
);

/** Once patience is spent, the brief stalls honestly and the insistence closes. */
export const SpentPatienceStallsTheBrief = reaction(({ brief }) =>
  when(Insisting.complain({ aim: brief }).responds())
    .where(
      Drafting._brief({ brief }),
      theDraftRoot({ brief }).is({ abandoned: false }),
      Insisting._spentFor({ aim: brief }),
    )
    .then(
      Drafting.stall({
        brief,
        reason: "The reply could not be read, and standing on it did not help.",
      }).responds(),
    )
    .then(Insisting.giveUp({ aim: brief })),
);

/** A reasoner that could not answer leaves nothing waiting silently. */
export const FailedAskStallsTheBrief = reaction(({ asking, brief, account }) =>
  when(Reasoning.fail({ asking }).responds())
    .where(
      Reasoning._asking({ asking }).is({ about: brief }),
      Drafting._brief({ brief }),
      theDraftRoot({ brief }).is({ abandoned: false }),
    )
    .then(
      where(Insisting._unsettledFor({ aim: brief }))
        .then(Insisting.giveUp({ aim: brief }))
        .named("give-up"),
      where(
        Reasoning._failureOf({ asking }).is({ account }),
        Drafting._standing({ brief }).is({ stalled: false }),
      )
        .then(Drafting.stall({ brief, reason: account }))
        .named("stall"),
    ),
);

/** Abandoning a line also closes any repair insistence still awaiting a reply. */
export const AbandonedLineGivesUpInsistence = reaction(({ root, brief }) =>
  when(DraftTrashing.trash({ item: root }).responds())
    .where(Drafting._line({ brief: root }).is({ brief }), Insisting._unsettledFor({ aim: brief }))
    .then(Insisting.giveUp({ aim: brief })),
);

/**
 * Adopting a described line's candidate turns the drafted material into an
 * ordinary editable questionnaire — after this, revision happens by hand in
 * Questioning, and nothing else ever crosses from the drafting line into the
 * live domain. The brief is linked to what it composed, so the line can say
 * where its material went.
 */
export const AdoptedCandidateComposesQuestionnaire = reaction(
  ({
    candidate,
    brief,
    linked,
    targets,
    author,
    form,
    title,
    at,
    questionnaire,
    prompt,
    choices,
    expected,
    explanation,
    position,
  }) =>
    when(Drafting.adopt({ candidate }).responds())
      .where(
        now(at),
        Drafting._candidate({ candidate }).is({ brief, form }),
        theDraftRoot({ brief }).is({ abandoned: false }),
        no(Drafting._originOf({ brief })),
        Drafting._brief({ brief }).is({ author }),
        compute(computations.draftTitle, { form }, title),
      )
      .then(
        Questioning.compose({ author, title, form, disclosure: "score", at }).responds({
          questionnaire,
        }),
      )
      .then(
        where(
          Drafting._items({ candidate }).is({ prompt, choices, expected, explanation, position }),
        )
          .then(
            Questioning.addQuestion({
              questionnaire,
              prompt,
              choices,
              expected,
              explanation,
              position,
            }),
          )
          .named("each-item"),
        where(
          Drafting._candidate({ candidate }).is({ brief: linked }),
          compute(computations.soleTarget, { target: questionnaire }, targets),
        )
          .then(AdoptLinking.setLinks({ source: linked, targets }))
          .named("link"),
      ),
);

/**
 * Adopting a refining line's candidate applies it back to the questionnaire it
 * refines instead of composing a new one: each question is revised in place by
 * position, the questions past the candidate's reach are shed, and the items
 * past the questionnaire's are added — so a question that merely changed keeps
 * its identity, and the boards of closed runs keep reading their answers.
 */
export const AdoptedRevisionRevisesQuestionnaire = reaction(
  ({
    candidate,
    brief,
    questionnaire,
    itemTotal,
    questionTotal,
    prompt,
    choices,
    expected,
    explanation,
    position,
    question,
    shed,
    shedAt,
    past,
  }) =>
    when(Drafting.adopt({ candidate }).responds())
      .where(
        Drafting._candidate({ candidate }).is({ brief }),
        theDraftRoot({ brief }).is({ abandoned: false }),
        Drafting._originOf({ brief }).is({ origin: questionnaire }),
      )
      .then(
        where(
          Drafting._items({ candidate }).is({ prompt, choices, expected, explanation, position }),
          Questioning._getQuestions({ questionnaire }).is({ question, position }),
        )
          .then(
            Questioning.reviseQuestion({
              question,
              prompt,
              choices,
              expected,
              explanation,
              position,
            }),
          )
          .named("revise"),
        where(
          Questioning._getQuestions({ questionnaire }).is({ question: shed, position: shedAt }),
          theItemCount({ candidate }).is({ total: itemTotal }),
          is.gt(shedAt, itemTotal),
        )
          .then(Questioning.removeQuestion({ question: shed }))
          .named("shed"),
        where(
          Drafting._items({ candidate }).is({
            prompt,
            choices,
            expected,
            explanation,
            position: past,
          }),
          theQuestionCount({ questionnaire }).is({ total: questionTotal }),
          is.gt(past, questionTotal),
        )
          .then(
            Questioning.addQuestion({
              questionnaire,
              prompt,
              choices,
              expected,
              explanation,
              position: past,
            }),
          )
          .named("grow"),
      ),
);

/** A drafting line whole: every step, its material, and its open questions. */
export const theDraftLine = former(
  "the drafting line of (brief)",
  (
    { brief },
    {
      step,
      request,
      basis,
      candidate,
      form,
      adopted,
      clarifying,
      stalled,
      clarification,
      question,
      answer,
      prompt,
      choices,
      expected,
      explanation,
      position,
      refines,
      composed,
      root,
      rootAuthor,
      abandoned,
    },
  ) =>
    each(Drafting._line({ brief }).is({ brief: step, request, basis, candidate, form, adopted }))
      .where(
        theDraftRoot({ brief: step }).is({ root, rootAuthor, abandoned }),
        Drafting._standing({ brief: step }).is({ clarifying, stalled }),
        whether(Drafting._originOf({ brief: step }).is({ origin: refines })),
        whether(AdoptLinking._getLinks({ source: step }).is({ target: composed })),
      )
      .form({
        step,
        request,
        basis,
        candidate,
        form,
        adopted,
        clarifying,
        stalled,
        refines,
        composed,
        root,
        rootAuthor,
        abandoned,
        items: each(
          Drafting._items({ candidate }).is({ prompt, choices, expected, explanation, position }),
        ).form({ prompt, choices, expected, explanation, position }),
        clarifications: each(
          Drafting._clarifications({ brief: step }).is({ clarification, question, answer }),
        ).form({ clarification, question, answer }),
      }),
);

/**
 * The author's lines, newest first: where each stands, and the questionnaire
 * it was opened from or its adoption composed.
 */
export const theDraftLines = former(
  "the drafting lines of (author)",
  (
    { author },
    {
      brief,
      request,
      createdAt,
      origin,
      adopted,
      stalled,
      clarifying,
      refinesTitle,
      composed,
      composedTitle,
      rootAuthor,
      abandoned,
    },
  ) =>
    each(
      Drafting._lines({ author }).is({
        brief,
        request,
        createdAt,
        origin,
        adopted,
        stalled,
        clarifying,
      }),
    )
      .where(
        theDraftRoot({ brief }).is({ rootAuthor, abandoned }),
        whether(
          Questioning._getQuestionnaire({ questionnaire: origin }).is({ title: refinesTitle }),
        ),
        whether(AdoptLinking._getLinks({ source: brief }).is({ target: composed })),
        whether(
          Questioning._getQuestionnaire({ questionnaire: composed }).is({ title: composedTitle }),
        ),
      )
      .form({
        brief,
        request,
        createdAt,
        adopted,
        stalled,
        clarifying,
        refines: origin,
        refinesTitle,
        composed,
        composedTitle,
        rootAuthor,
        abandoned,
      }),
);

/**
 * How a questionnaire came to read as it does: the described line whose
 * adoption composed it — one at most — and every refining line opened on it.
 */
export const theProvenance = former(
  "the drafting provenance of (questionnaire)",
  (
    { questionnaire },
    {
      composer,
      composedRequest,
      composedAt,
      brief,
      author,
      request,
      createdAt,
      adopted,
      stalled,
      clarifying,
      composedRoot,
      composedRootAuthor,
      composedAbandoned,
      rootAuthor,
      abandoned,
    },
  ) =>
    form({
      composed: each(AdoptLinking._getBacklinks({ target: questionnaire }).is({ source: composer }))
        .where(
          theDraftRoot({ brief: composer }).is({
            root: composedRoot,
            rootAuthor: composedRootAuthor,
            abandoned: composedAbandoned,
          }),
          Drafting._brief({ brief: composer }).is({
            request: composedRequest,
            createdAt: composedAt,
          }),
        )
        .form({
          brief: composer,
          root: composedRoot,
          rootAuthor: composedRootAuthor,
          request: composedRequest,
          createdAt: composedAt,
          abandoned: composedAbandoned,
        }),
      refined: each(
        Drafting._openedFrom({ origin: questionnaire }).is({
          brief,
          author,
          request,
          createdAt,
          adopted,
          stalled,
          clarifying,
        }),
      )
        .where(theDraftRoot({ brief }).is({ rootAuthor, abandoned }))
        .form({
          brief,
          author,
          rootAuthor,
          request,
          createdAt,
          adopted,
          stalled,
          clarifying,
          abandoned,
        }),
    }),
);

export const Describe = endpoint(
  "/live/drafts/describe",
  ({ session, request, user, at, brief }) =>
    receive({ session, request }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(Drafting.describe({ author: user, request, at }).responds({ brief }))
        .then(respond({ brief }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "request"] } },
);

export const Line = endpoint(
  "/live/drafts/line",
  ({ session, brief, user, at }) =>
    receive({ session, brief }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(respond({ line: theDraftLine({ brief }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "brief"] } },
);

export const Lines = endpoint("/live/drafts/lines", ({ session, user, at }) =>
  receive({ session }).then(
    where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
      .then(respond({ lines: theDraftLines({ author: user }) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const Provenance = endpoint(
  "/live/drafts/provenance",
  ({ session, questionnaire, user, at }) =>
    receive({ session, questionnaire }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(respond({ provenance: theProvenance({ questionnaire }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "questionnaire"] } },
);

export const Clarify = endpoint(
  "/live/drafts/clarify",
  ({ session, clarification, answer, user, at, root, clarified, brief }) =>
    receive({ session, clarification, answer }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Drafting._lines({ author: user }).is({ brief: root }),
        Drafting._line({ brief: root }).is({ brief }),
        Drafting._clarifications({ brief }).is({ clarification }),
        DraftTrashing._isTrashed({ item: root }).is({ trashed: false }),
      )
        .then(
          Drafting.clarify({ clarification, answer }).responds({
            clarification: clarified,
            brief,
          }),
        )
        .then(respond({ clarification: clarified, brief }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Drafting._lines({ author: user }).is({ brief: root }),
        Drafting._line({ brief: root }).is({ brief }),
        Drafting._clarifications({ brief }).is({ clarification }),
        DraftTrashing._isTrashed({ item: root }).is({ trashed: true }),
      )
        .then(respond({ error: "CONFLICT" }))
        .named("abandoned"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "clarification", "answer"] } },
);

export const Correct = endpoint(
  "/live/drafts/correct",
  ({ session, candidate, request, user, at, continued, brief }) =>
    receive({ session, candidate, request }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Drafting._candidate({ candidate }).is({ brief: continued }),
        theDraftRoot({ brief: continued }).is({ rootAuthor: user, abandoned: false }),
      )
        .then(Drafting.correct({ author: user, candidate, request, at }).responds({ brief }))
        .then(respond({ brief }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Drafting._candidate({ candidate }).is({ brief: continued }),
        theDraftRoot({ brief: continued }).is({ rootAuthor: user, abandoned: true }),
      )
        .then(respond({ error: "CONFLICT" }))
        .named("abandoned"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Drafting._candidate({ candidate }).is({ brief: continued }),
        theDraftRoot({ brief: continued }).is.not({ rootAuthor: user }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("not-author"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "candidate", "request"] } },
);

export const Refine = endpoint(
  "/live/drafts/refine",
  ({ session, questionnaire, user, at, title, form, material, brief, candidate }) =>
    receive({ session, questionnaire }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestionnaire({ questionnaire }).is({ title, retired: false }),
        questionnaireHasNoOpenRun({ questionnaire }),
        Questioning._material({ questionnaire }).is({ form, material }),
      )
        .then(
          Drafting.open({
            author: user,
            request: title,
            form,
            material,
            origin: questionnaire,
            at,
          }).responds({ brief, candidate }),
        )
        .then(respond({ brief, candidate }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestionnaire({ questionnaire }).is({ retired: false }),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestionnaire({ questionnaire }).is({ retired: true }),
      )
        .then(respond({ error: "QUESTIONNAIRE_RETIRED" }))
        .named("retired"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Questioning._getQuestionnaire({ questionnaire })),
      )
        .then(respond({ error: "QUESTIONNAIRE_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "questionnaire"] } },
);

/**
 * Leave an unfinished line without changing Drafting's own lifecycle. The
 * line's root author alone may abandon it, and adopted history remains intact.
 */
export const Abandon = endpoint(
  "/live/drafts/abandon",
  ({ session, brief, user, at, root, trashed }) =>
    receive({ session, brief }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theDraftRoot({ brief }).is({ root, rootAuthor: user, abandoned: false }),
        no(Drafting._line({ brief: root }).is({ adopted: true })),
      )
        .then(DraftTrashing.trash({ item: root, by: user, at }).responds({ item: trashed }))
        .then(respond({ brief: trashed }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theDraftRoot({ brief }).is({ root, rootAuthor: user, abandoned: false }),
        Drafting._line({ brief: root }).is({ adopted: true }),
      )
        .then(respond({ error: "ALREADY_ADOPTED" }))
        .named("adopted"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theDraftRoot({ brief }).is({ rootAuthor: user, abandoned: true }),
      )
        .then(respond({ error: "CONFLICT" }))
        .named("abandoned"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        theDraftRoot({ brief }).is.not({ rootAuthor: user }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("not-author"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Drafting._rootOf({ brief })),
      )
        .then(respond({ error: "BRIEF_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "brief"] } },
);

export const Adopt = endpoint(
  "/live/drafts/adopt",
  ({ session, candidate, user, at, brief, questionnaire, form, adopted }) =>
    receive({ session, candidate }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Drafting._candidate({ candidate }).is({ brief }),
        theDraftRoot({ brief }).is({ rootAuthor: user, abandoned: false }),
        no(Drafting._originOf({ brief })),
      )
        .then(Drafting.adopt({ candidate }).responds({ candidate: adopted }))
        .then(respond({ candidate: adopted }))
        .named("success"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Drafting._candidate({ candidate }).is({ brief, form }),
        theDraftRoot({ brief }).is({ rootAuthor: user, abandoned: false }),
        Drafting._originOf({ brief }).is({ origin: questionnaire }),
        questionnaireHasNoOpenRun({ questionnaire }),
        Questioning._getQuestionnaire({ questionnaire }).is({ form, retired: false }),
      )
        .then(Drafting.adopt({ candidate }).responds({ candidate: adopted }))
        .then(respond({ candidate: adopted }))
        .named("refit"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Drafting._candidate({ candidate }).is({ brief }),
        theDraftRoot({ brief }).is({ rootAuthor: user, abandoned: true }),
      )
        .then(respond({ error: "CONFLICT" }))
        .named("abandoned"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Drafting._candidate({ candidate }).is({ brief }),
        theDraftRoot({ brief }).is.not({ rootAuthor: user }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("not-author"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Drafting._candidate({ candidate }).is({ brief }),
        Drafting._originOf({ brief }).is({ origin: questionnaire }),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Drafting._candidate({ candidate }).is({ brief, form: "survey" }),
        Drafting._originOf({ brief }).is({ origin: questionnaire }),
        questionnaireHasNoOpenRun({ questionnaire }),
        Questioning._getQuestionnaire({ questionnaire }).is({ form: "quiz", retired: false }),
      )
        .then(respond({ error: "FORM_FIXED" }))
        .named("form-fixed-quiz"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Drafting._candidate({ candidate }).is({ brief, form: "quiz" }),
        Drafting._originOf({ brief }).is({ origin: questionnaire }),
        questionnaireHasNoOpenRun({ questionnaire }),
        Questioning._getQuestionnaire({ questionnaire }).is({ form: "survey", retired: false }),
      )
        .then(respond({ error: "FORM_FIXED" }))
        .named("form-fixed-survey"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Drafting._candidate({ candidate }).is({ brief }),
        Drafting._originOf({ brief }).is({ origin: questionnaire }),
        questionnaireHasNoOpenRun({ questionnaire }),
        Questioning._getQuestionnaire({ questionnaire }).is({ retired: true }),
      )
        .then(respond({ error: "QUESTIONNAIRE_RETIRED" }))
        .named("retired"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Drafting._candidate({ candidate })),
      )
        .then(respond({ error: "CANDIDATE_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "candidate"] } },
);
